# Round 2, code-review log

Branch `feat/round-2-hardening--code-review` (from `feat/round-2-hardening`). Scope: `mods/{portrait-tree,portrait-tabs,portrait-pane,portrait-files,bar-strip,nvim-float}/**` except `mod.json`, and `tests/**`. `mods/attention-picker` untouched.

## Done (task ids)

| Id | What changed | Where |
|----|--------------|-------|
| CR-2-1 | `pruneSpaceIds(ids, spaces, machines)` in the shared `storage` block (replaces `pruneIds`): an unlisted id stays while its machine is `loading`, `unavailable` or unknown; local ids are pruned once this computer is `ready`; never against an empty list. Used for `folded`, `peeked` (tree) and `panels` (tabs, `prunePanels(panels, spaces, machines)`). `machines` is a new import of both mods. | `portrait-tree`, `portrait-tabs` |
| CR-2-3 | `over` / `tabOver` set by `on_mouse_move`, cleared by `on_hover(false)`, mouse up and the root mouse up. The drop line is drawn only on the header or tab row under the pointer, with id `drop-<id>`; the pressed row dims (`opacity(0.5)`) once the pointer is over another row; a move happens only when released on the `over` row. | `portrait-tree/main.js` |
| CR-2-4 | `wheelStream(state, event, axis, now, pixelStep)` in the shared `wheel` block: `delta_lines` = one step per line (fractions accumulate), pixels = `WHEEL_STEP` (40) per step, `touch_phase: "started"` or a change of unit drops the remainder. `WHEEL_IDLE` is now inside the shared block and used as the default. | tree, tabs |
| CR-2-6 | `tabRows(panes, agents)`: the tab's panes, then its pane-less agents by address, each with its tree branch. Pane-less rows use id `ag-<address>`, click = `agent.focus {terminal}`, no right-click menu (the pane menu needs a pane). `byPane` unchanged. | tree |
| CR-2-5 | `createPacer()` (`REFRESH_GAP` 1500): watch events call `refreshSoon()`; one run at a time, runs at least 1.5 s apart, a request during a run (also from the timer or render) runs once more after it; `MAX_WATCHERS = 3` live watch loops. | `portrait-files` |
| CR-2-2 | `keyHint(bindings, layout, actions = KEY_ACTIONS)` takes a name or a list and finds `mod.open:attention-picker` and `bar-strip.attention`; `picker()` lost its always-true parameter (the dialog is opened with `props.search: true`); commands `attention` and `jump` are still served. `keys.json` is herdr-completeness' (D1). | `bar-strip` |
| CR-2-9 | `waitingAgents(list, since)`: by `agents.since` when the agent has an entry (those first), then by `seq`. | `bar-strip` |
| CR-2-10 | Shared `title` block: `cleanTitle` keeps a leading dot and returns "" when no letter or digit is left; used by tree (names, editor rows) and nvim-float. `./x` and `../x` titles count as paths. | tree, nvim-float |
| CR-2-11 | `markText(color, foreground, dark)`: mixes 50 % toward the foreground when `settings().dark === false`; used for the active folded space's spine text only. Test: >= 4.5:1 for all six marks on white, `#f4f1ea`, `#ebe8e1` with foregrounds `#000` to `#333`. | tree |
| CR-2-12 | Shared `alpha` block (bar-strip, portrait-pane, portrait-tree): first six digits + alpha, bad input returned unchanged. Replaces `color + "1f"` and the like in all three. | three mods |
| CR-2-13a | Label `editor.space` removed (D4); `rg editor.space mods tests` is empty. | `portrait-files` |
| CR-2-14 | Unused import `markOf`, unused exports `lumOf` / `isPlainObject` / `WHEEL_IDLE` gone; `xml()` escapes written as `￾￿`; one `panes()` per render in the tab bar; `enabledPanels` moved into the shared `vault` block and used by bar-strip (a non-array `workspace.panels` no longer throws); `colors[s.id]` type guard with `t.accent` fallback; `PATH="$1:$PATH"` in the shared `nvim` block (real-sh test updated); `tests/tree.test.mjs` header says `node --test`. The 30 s redraw stays (D15). | various |
| CR-2-15 | `fold.svg` / `unfold.svg` redrawn from scratch (a strip rectangle between two arrow heads), same names. | tree |
| CR-2-7 | `tests/api.test.mjs`: per own mod, every name imported from `herdr` / `gpui-kit` / `gpui-base` is exported by Herdr's type files and every `.name(` call in `main.js` is declared there, defined in the mod itself or a JS built-in. Files come from `$HERDR_APP_HOME` or the default app folder (read only); skipped with a message when absent. Verified: a misspelled builder (`text_ellipsis_strat`) and a misspelled import (`machinez`) in a scratch copy each fail it. | `tests/api.test.mjs` |
| CR-2-8 | `tests/docs-claims.test.mjs` (see "Deferred" for its state). | `tests/docs-claims.test.mjs` |

Tests added or changed: `tree` (pruneSpaceIds, alpha, markText, tabRows, wheelStream, cleanTitle), `tabs` (prunePanels with machines, notch vs swipe), `bar-strip` (keyHint with the picker action, waitingAgents with `since`, alpha, enabledPanels), `files` (pacer, PATH order), `shared` (EXPECTED gained `alpha` and `title`), `smoke` (sub-agent rows, drop line follows the pointer, remote state kept while the machine is unavailable, a refresh asked for during a load runs exactly once more), `api` (new).

## Checks run

- `node --test`: 105 tests, 104 pass. The one failure is `docs-claims` (column widths): README.md has no `34 px` yet (see Deferred). Without `docs-claims`: 102 pass (88 before `api.test.mjs`, which adds 14).
- `herdr-app check <worktree>/mods/<m>` for portrait-tree, portrait-tabs, portrait-pane, portrait-files, bar-strip, nvim-float: all pass.
- `node scripts/{validate,check-assets,check-recipe,check-docs,privacy-scan}.mjs`: ok.
- Scratch merge of this branch with `origin/feat/round-2-hardening--herdr-completeness` (outside the repo): `node --test` 102 pass, all five scripts ok.
- API cross-check by script and by `tests/api.test.mjs`: no name or builder is missing in `herdr.d.ts` / `gpui-kit.d.ts`; `settings().dark` is read untyped (guarded with `=== false`).

## Deferred, and why

- CR-2-8 `docs-claims.test.mjs` needs documentation's final text. D8 requires `290 px` and `34 px` in `README.md`; today the README states only 290 px (34 px is in `docs/usage.html`), so the test fails on this branch alone until documentation's branch is merged. If documentation drops the README sentence for 34 px, delete the README line of that test rather than the number.
- Live checks the author must do (no app access here): drop line only on the header under the pointer (CR-2-3); one notch = one tab, trackpad unchanged (CR-2-4); a build in a watched folder with the Files panel open does not peg the CPU (CR-2-5); a blocked sub-agent has a row (CR-2-6); the spine text on a light theme (CR-2-11); `ctrl-shift-j` with the bar hidden (CR-2-2, keys.json side).
- PowerShell listing order (D6), virtualised Files list, remote `~`: round 3 as planned.

## Judgement calls

- `pruneSpaceIds` treats a machine that `machines()` does not list as unknown and keeps its ids; so does this computer if `machines()` has no `null` entry. The cost is a stale id lingering, never lost state.
- The file watch cap is "at most 3 live loops". A loop only ends at its next event, so after visiting three quiet folders a fourth is served by the 10 s timer until one of them fires. Accepted in the plan; a cancellable watch would remove it (needs a Herdr API).
- Dimming of the pressed row only starts once the pointer is over another row (the shipped list dims on press), so a plain click does not flash.
- The mark mix for light themes is 50 % (the audit sketched about 35 %): 35 % gave 4.6:1 at best on cream, 50 % gives >= 4.5:1 on all three backgrounds with a margin.

## Handoffs

- herdr-completeness: NOTICE lists `fold.svg` / `unfold.svg` as original (done on the board, they are my redraw); RECIPE needs no new function names; the "Pane-less agents" watch-out can go; the `editor.space` label is gone; shared blocks `alpha`, `title` are new (`validate` does not look at them).
- documentation: sub-agent rows exist; wheel notch vs trackpad; refresh at most about every 1.5 s; the ctrl-shift-j tooltip names `mod.open:attention-picker`; after a Herdr update run `node --test` with the app's type files present (`tests/api.test.mjs`); keep `290 px`, `34 px`, `40 px`, `7 days` as plain text next to their units.
- Round 3: live verification list above; cancellable folder watch; remote `~`; consider reading `settings().dark` once per render if a light theme shows a cost (it is a cheap call today).
