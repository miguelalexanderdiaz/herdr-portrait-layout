# Round 2 plan: review round 1, then harden it

Branch: `feat/round-2-hardening` (from `main` at ef8b513, PR 1 merged). Written by the round lead from the three
audits in this folder (`code-review.md`, `documentation.md`, `herdr-completeness.md`) and `plans/round-1/SUMMARY.md`.
Round 2 of at least 2.

First commit on the branch (done by the round lead, before this plan): `2fb912a Sync attention-picker from
herdr-agents-waiting round 1`. `mods/attention-picker` is now `b7fcb3fa576c44e33d5a03ada94cfd0ec598ecec`
(origin/feat/round-1-standalone-picker of herdr-agents-waiting). It adds `logic.js`, `search.svg`, `spinner.svg`, polls
every 3 s, keeps a localStorage record `attention.seen`, reads `agents.since` when portrait-tree publishes it, loads no
shipped-mod asset, and has `mod.json` `overlay: dialog 640`. `herdr-app check` passes for it and for the other six mods;
`node --test` (73), `validate`, `privacy-scan`, `check-recipe`, `check-assets` and `check-docs` stay green on the synced tree.
Fit with the layout: `bar-strip.attention` still opens it through `openOverlay({ mod: "attention-picker", kind: "dialog",
width: 640, props: { search } })`, which the new `props().search` reads (`pickSearch`). The canonical repo's own key
(`ctrl-shift-a`) lives in that repo's `keys.json`, not in `mods/attention-picker`, so nothing here binds it and
`validate.mjs` keeps refusing that chord.

## Goal

Turn "round 1 looks fine in checks" into "round 1 is true": remove the behaviour bugs an adversarial read found, make every
sentence in RECIPE, NOTICE and the docs something code or a script backs, give the repo CI and drift guards that
survive Herdr updates, and make the bundled picker tamper-evident. After round 2 the repo can be reviewed by the author,
published (author steps in `scripts/PUBLISH.md`) and re-checked by a CI run.

## Scope and non-goals

In scope: everything marked "this round" in the tables below (CR-2-*, DOC-2-*, HC-2-*).

Non-goals:
- Editing `mods/attention-picker/**` (frozen; hash-checked from this round). Findings go to the herdr-agents-waiting
  board. None came out of the audits.
- Driving the running app, writing under the Herdr app home, pushing anything under `.github/workflows/`.
- Rewriting history, merging PRs, changing visibility, settings, topics, Pages (author steps).
- Anything that needs a Linux or Windows machine to judge (see "Deferred to round 3").

## Decisions (disagreements between the audits and gaps, resolved)

| # | Question | Decision | Reason |
|---|----------|----------|--------|
| D1 | CR-2-2: bind `ctrl-shift-j` to `mod.open:attention-picker`? (code-review proposes; herdr-completeness owns `keys.json`) | Yes. Final action string `mod.open:attention-picker` in both layout sections of `keys.json`. `bar-strip.attention` and `bar-strip.jump` stay served for people who bound them. `keyHint` accepts a list of action names (both spellings). | Herdr's AGENTS.md: `<mod>.<command>` reaches shown copies only, so the key is dead exactly when `ctrl-shift-g` hides the bar; `mod.open {name}` "again: closes it" and the synced picker is an overlay with its own `mod.json`. The author confirms in the app (see Risks); fallback is a one-line revert. |
| D2 | Window buttons on Linux and Windows (RECIPE says the tab strip draws them; layouts keep the system title bar) | Reword RECIPE and docs; no layout change. Adding `"titlebar": "none"` + `traffic_lights` is the author's design call, deferred. | `window().buttons` is false with a system title bar; changing the window chrome cannot be judged without the app. |
| D3 | Folder dot colour (RECIPE: "colour of its worst child"; `bubble()` returns only U or M) | Reword RECIPE ("conflict colour, otherwise the modified colour"). `bubble()` does not change. | No behaviour risk; tests in `tests/files.test.mjs` stay valid. |
| D4 | `editor.space` label (written, never read) | code-review removes the label; RECIPE and `docs/privacy.html` drop it from the disclosure. | Fewer labels visible to every mod. |
| D5 | `fold.svg` / `unfold.svg` have no recorded origin | code-review redraws both as small originals (same file names, so code and `validate` basenames stay); herdr-completeness lists them in NOTICE as original, Apache-2.0. | Nobody can answer "did you draw them" in an unattended run; originals settle the provenance. |
| D6 | PowerShell listing order above 500 entries (DOC-2-10) | Not fixed; documentation keeps the caveat sentence; deferred. | Nobody can run PowerShell here; a blind rewrite of a subtle script is a regression risk. |
| D7 | Who owns the drift guards | `tests/api.test.mjs` and `tests/docs-claims.test.mjs` are code-review (tests/**). `scripts/check-docs.mjs` extensions (keys table, "Where to check" names, mod names in README and privacy page) and `scripts/checks.test.mjs` are herdr-completeness (scripts/**). Both guards are kept; they check different things. | One owner per file. |
| D8 | docs-claims test vs README trim (DOC-2-12) | The test requires `290 px` and `34 px` in `README.md` and `docs/usage.html`, `40 px` in `docs/usage.html`, `7 days` in `docs/privacy.html`, each in its own sentence. Documentation keeps those units next to the numbers when it trims. | Avoids a test that fails on a legitimate trim. |
| D9 | `plans/` in the public tree (HC-2-7) | Stays on `main` for now. `privacy-scan` is tightened (path and e-mail rules apply to every line except lines that show a pattern or `<home>`). Removing `plans/` before publishing is an author step in PUBLISH.md. | Process notes are useful for the author's review; the scan removes the risk. |
| D10 | Personal address in the PR 1 web merge commit (HC-2-1) | Agents cannot fix history. `privacy-scan` names the offending commit; PUBLISH.md step 0 tells the author to switch on GitHub's private-address settings before merging any more PRs and to decide on a history rewrite or a fresh first commit before going public. Round-2 PRs are not merged in the web UI until step 0 is done. | Rules 9 and 4: no rewrite, no settings changes by agents. |
| D11 | Links from README / AGENTS.md / llms.txt to the rendered site (DOC-2-3) | They use the Pages address derived from the repo address already in the README; `check-docs` derives the allowed host from the first `github.com/<owner>/<repo>` link instead of hard-coding it. Pages internals stay relative. PUBLISH.md step 11 gets "open every Pages URL after enabling". While the repo is private these links are dead; README says "after publication". | The repo address is already accepted (round 1, D12); GitHub shows `.html` as source. |
| D12 | CI (HC-2-2) | `scripts/ci.workflow.yml` (pushable, SHA-pinned actions, `persist-credentials: false`, matrix ubuntu/windows/macos on Node 20 and 22 plus one ubuntu leg on Node 18, `push` on main only plus `pull_request`, concurrency, timeout), `scripts/check-all.mjs`, root `package.json` (`test`, `check`, no dependencies), `.github/dependabot.yml`. `validate` fails when `.github/workflows/ci.yml` exists and differs from the template. The author copies the file with a workflow-scoped token (PUBLISH.md). Nothing under `.github/workflows/` is committed. | Rule 9. |
| D13 | Preview image (HC-2-9) | Keep the tall image (option A). Stretch only: SHA-256 guard of `preview-source.svg`. Wide variants deferred until the gallery crop is seen. | Needs a real gallery. |
| D14 | Snapshot refresh tool (HC-2-10) | The network tool `refresh-snapshots.mjs` is deferred. PUBLISH.md and CONTRIBUTING get the manual procedure (where `default-keys.json`, `commands.json`, `shipped-mods.json` come from). RECIPE says `cmd-b` is dead on Linux and Windows. | Network code in the repo needs its own review; the manual steps cover DOC-2-9. |
| D15 | Optional items in CR-2-14 | The 30 s redraw timer stays 30 s (stale "<1m" trade-off not worth it). Everything else in CR-2-14 is done. | Behaviour unchanged. |
| D16 | DOC-2-13 (herdr.dev install line, issue template) | Issue template `.github/ISSUE_TEMPLATE/bug.md` is written by herdr-completeness (owns `.github/**`; documentation supplies the wording on the board). The publication-day README line is deferred to publication. | One owner per file. |
| D17 | DOC-2-1 (theme colours) and CR-2-11 | Documentation states: badge ink is chosen per colour and readable on any theme; spine text and rule use the mark colour and are darkened on light themes only after CR-2-11 lands. No claim "readable on paper" without the app. | CR measured 2.3-3.4:1 for marks as text on light backgrounds. |
| D18 | Question from the vault repo's board message (which Obsidian files are still used) | Answered by the round lead on the board: `mods/vault/icons/book-open.svg` (bar-strip, only when the vault mod is installed), the mod name `vault-reader` (a pane whose `mod` is that name gets a note row) and the shared key `vault.panes`; bar-strip publishes `mods.vault`; no use of `vault-reader/obsidian.png`, `vault.svg`, `vault.list`, `vault.current`, `vault.open`. | Checked with rg before posting. |

## File ownership

Every tracked file has exactly one owner this round. Each role may append to its own audit file (an "Apply log") and
write `plans/round-2/<role>-log.md`.

| Owner | Files |
|-------|-------|
| round-lead | `plans/round-2/PLAN.md`, `SUMMARY.md`, `board.md` (copy of the board) |
| code-review | `plans/round-2/code-review*.md`; `mods/{portrait-tree,portrait-tabs,portrait-pane,portrait-files,bar-strip,nvim-float}/**` except `mod.json` (main.js, logic.mjs, every `*.svg`); `tests/**` (including new `api.test.mjs`, `docs-claims.test.mjs`) |
| documentation | `plans/round-2/documentation*.md`; `README.md`, `AGENTS.md`, `llms.txt`, `docs/**` (including `docs/llms.txt`, `docs/assets/**`), `CHANGELOG.md`, `CONTRIBUTING.md` |
| herdr-completeness | `plans/round-2/herdr-completeness*.md`; `RECIPE.md`, `NOTICE`, `LICENSE`, `keys.json`, `layouts/**`, `snippets/**`, `preview.png`, `mods/*/mod.json`, `.gitignore`, `.gitattributes`, new `.editorconfig`, new `package.json`, `.github/**` (dependabot and issue template only, never `workflows/`), `scripts/**` (including `PUBLISH.md`, `ci.workflow.yml`, `bundled.json`, `checks.test.mjs`) |
| nobody (frozen, hash-checked) | `mods/attention-picker/**` |

Moves from the default ownership in the audits, with the reason:
- `scripts/PUBLISH.md` stays with herdr-completeness although DOC-2-3, DOC-2-4 and DOC-2-9 list it: scripts/** is one owner. Documentation posts the wording it needs on the board.
- `RECIPE.md` and `NOTICE` stay with herdr-completeness although CR-2-13 and DOC-2-6/-11 list them.
- CR-2-13 is split: RECIPE/NOTICE sentences go to herdr-completeness; `docs/usage.html`, `AGENTS.md` sentences to documentation; the label removal to code-review.
- `tests/docs-claims.test.mjs` is code-review (tests/**), `scripts/check-docs.mjs` is herdr-completeness although DOC-2-5 names both under one owner.
- `.github/ISSUE_TEMPLATE/bug.md` is herdr-completeness although DOC-2-13 proposes documentation writes it.
- `mods/portrait-tree/{fold,unfold}.svg` are code-review (all mod assets) although the NOTICE finding HC-2-4 is the trigger.

## Tasks

Work in a worktree under `<code>/.wt/` on branch `feat/round-2-hardening--<role>` created from this branch after the plan
commit. "Check all mods" = `for m in mods/*; do herdr-app check "$PWD/$m"; done`. "Suite" = `node --test`.
Priority: M = must land, S = should, X = stretch.

### code-review

Internal order: CR-2-1, 3, 4, 6, 5, 2 (code part), 9, 10, 11, 12, 15, 14, then 7 and 8 last (8 after documentation's text is final).

| Id | P | Title | Files | Acceptance |
|----|---|-------|-------|------------|
| CR-2-1 | M | Machine-aware `pruneSpaceIds(ids, spaces, machines)` in the shared `storage` block (identical copies in tree and tabs); used for `folded`, `peeked` and `panels`; `machines` added to the `herdr` import | `mods/portrait-tree/{main.js,logic.mjs}`, `mods/portrait-tabs/{main.js,logic.mjs}`, `tests/{tree,tabs,shared,smoke}.test.mjs` | unit tests: remote id kept while its machine is `loading` or `unavailable`, dropped once `ready` and unlisted, unknown machine keeps, local ids pruned, empty list keeps all; smoke: remote id still in `m.folded` after render with an unavailable machine; `shared.test.mjs` equal copies |
| CR-2-2 | M | `keyHint` accepts a list (`bar-strip.attention`, `mod.open:attention-picker`), global and layout sections; picker call keeps `props.search`; tooltip prints the new key | `mods/bar-strip/{main.js,logic.mjs}`, `tests/bar-strip.test.mjs` | keyHint tests with each spelling and both sections; commands `attention` and `jump` still served |
| CR-2-3 | M | Reorder drop line follows the pointer (`over`, `tabOver`, `on_mouse_move`, ids `drop-<id>`), pressed row dimmed, move only when released on `over`, `cx.notify()` only on change | `mods/portrait-tree/main.js`, `tests/smoke.test.mjs` | smoke: `pressed = 0` renders no `drop-*`; `over = 1` renders exactly one `drop-<id>` |
| CR-2-4 | M | `wheelDelta(event)` in the shared `wheel` block: `delta_lines` = one step per line, pixels accumulate as now (`WHEEL_STEP` 40 for trackpads), `touch_phase: "started"` resets | `mods/portrait-tabs/{main.js,logic.mjs}`, `mods/portrait-tree/{main.js,logic.mjs}`, `tests/{tree,tabs,shared}.test.mjs` | tests: 3 line events = 3 steps, pixel events unchanged, `started` resets; copies equal |
| CR-2-5 | M | Files watcher: pure coalescer (`gap` 1500 ms, `request()` returns `now`/`later`/`skip`), trailing refresh when skipped for `loading`, at most 3 live watch roots | `mods/portrait-files/{main.js,logic.mjs}`, `tests/{files,smoke}.test.mjs` | coalescer unit tests (burst of 100 = one run per gap, trailing run, skip sets `again`); smoke: two `refresh()` during a pending load = exactly two git status runs |
| CR-2-6 | M | `tabRows(panes, agents)`: a tab's panes then its pane-less agents (`kind`), tree-line prefixes from the combined length; pane-less rows use `agent.focus`, id `ag-<address>`; not added to `byPane` | `mods/portrait-tree/{main.js,logic.mjs}`, `tests/{tree,smoke}.test.mjs` | tests: order, prefixes, tab with only pane-less agents, none; smoke: `ag-<address>` exists for the two pane-less agents of the smoke world |
| CR-2-7 | S | `tests/api.test.mjs`: names imported from `herdr`, `gpui-kit`, `gpui-base` and `.name(` builder calls in the six own mods exist in the d.ts files (found via `$HERDR_APP_HOME` or `<home>/.config/herdr-app`, read only; skipped with a message when absent) | `tests/api.test.mjs` | passes now; a misspelled builder in a scratch copy fails it; skipped (not failed) with no d.ts |
| CR-2-8 | S | `tests/docs-claims.test.mjs` per D8, plus the two wheel constants agree | `tests/docs-claims.test.mjs` | passes on the final docs; changing `MIN_COL` in a scratch copy fails it |
| CR-2-9 | S | Bell orders waiting agents by `agents.since` with `seq` fallback (`waitingAgents(list, since)`) | `mods/bar-strip/{main.js,logic.mjs}`, `tests/bar-strip.test.mjs` | tests: since present, partly missing, absent |
| CR-2-10 | S | One `cleanTitle` that keeps a leading dot (shared `title` block in tree and nvim-float logic; added to `EXPECTED` in `shared.test.mjs`) | `mods/portrait-tree/{main.js,logic.mjs}`, `mods/nvim-float/{main.js,logic.mjs}`, `tests/shared.test.mjs` | tests: `.env`, a spinner glyph followed by `.gitignore`, a spinner glyph followed by a sentence, `...` |
| CR-2-11 | S | `markText(color, foreground, dark)`; spine text of the active folded space darkened when `settings().dark === false`; badge and rule unchanged | `mods/portrait-tree/{main.js,logic.mjs}`, `tests/tree.test.mjs` | contrast assertion >= 4.5 against white for all six marks |
| CR-2-12 | S | `alpha(hex, a)` helper (first six digits; bad input returned unchanged) used in bar-strip, tree and pane | `mods/{bar-strip,portrait-tree,portrait-pane}/{main.js,logic.mjs}`, `tests/*.test.mjs` | tests for 6 digits, 8 digits, bad input; smoke with a theme stand-in returning an 8-digit colour |
| CR-2-13a | S | Remove the `editor.space` label (D4) | `mods/portrait-files/main.js`, `tests/files.test.mjs` | `rg editor.space mods tests` empty |
| CR-2-14 | S | Cleanups: unused imports/exports (`markOf`, `WHEEL_IDLE` default, `lumOf`, `isPlainObject`), test header `node --test`, `xml()` escapes written as `\uFFFE\uFFFF`, hoisted `panes()` in tabs, `enabledPanels` shared block used by bar-strip, guard `colors[s.id]` type, `PATH="$1:$PATH"` in the shared `nvim` block | `mods/**` (code and logic), `tests/tree.test.mjs`, `tests/files.test.mjs`, `tests/shared.test.mjs` | Suite green; `node --test` header grep clean; the `nvimArgv` real-sh test updated |
| CR-2-15 | S | Redraw `fold.svg` and `unfold.svg` as original small drawings (D5); same names | `mods/portrait-tree/{fold,unfold}.svg` | `node scripts/check-assets.mjs`, repo test for icon names; posted to the board so NOTICE can list them |

### documentation

| Id | P | Title | Files | Acceptance |
|----|---|-------|-------|------------|
| DOC-2-1 | M | Replace "mods use only theme colours" with the true statement (fixed space-mark colours, per-colour ink; spine text darkened on light themes once CR-2-11 lands; no claim about `paper`) | `README.md`, `docs/configuration.html`, `docs/how-it-works.html` | `rg -n "only theme colo" README.md docs AGENTS.md` empty |
| DOC-2-2 | M | Picker facts after the sync: polls every 3 s with `--lines 60`, localStorage `attention.seen` (address, state group, time; no screen text), `agents.since` read when present, own key only in its own repo | `README.md`, `docs/privacy.html`, `docs/how-it-works.html`, `AGENTS.md` | `rg -n "every 2 s\|2 seconds" README.md docs AGENTS.md` empty; wording matches herdr-completeness' RECIPE disclosure |
| DOC-2-3 | M | Links to the rendered pages use the Pages address (D11); one line says they are live after publication | `README.md`, `AGENTS.md`, `llms.txt`, `docs/llms.txt` (kept byte-equal) | `node scripts/check-docs.mjs` ok after herdr-completeness lands the host rule |
| DOC-2-4 | M | CI wording follows D12: conditional sentence replaced by `npm test` / `npm run check` and the template path; CHANGELOG `Unreleased` gets the round-2 lines | `CONTRIBUTING.md`, `CHANGELOG.md` | lines match what exists (`package.json`, `scripts/ci.workflow.yml`) |
| DOC-2-5 | S | Keep the claim numbers as plain text next to their units (D8); one `<td>` per key, no wrapped cells; "Where to check" names real functions | `README.md`, `docs/usage.html`, `docs/privacy.html`, `docs/configuration.html` | passes herdr-completeness' extended `check-docs` and code-review's `docs-claims` |
| DOC-2-6 | S | Ids list: those looked up by mods (`panel`, `panel-body`, `files`, `changes`, `vault`) vs `bar` named only by a key; follows the final list in RECIPE | `AGENTS.md`, `docs/for-agents.html`, `docs/configuration.html` | consistent with RECIPE after herdr-completeness posts the list |
| DOC-2-7 | S | PowerShell install block usable (no placeholder path), honest verification line (what was and was not run, per OS) | `README.md`, `docs/install.html`, `AGENTS.md` | block copy-pasteable; wording says Linux and Windows are untested |
| DOC-2-8 | S | Site accessibility and phone polish (table captions and labels, nav on 360 px, hidden column, image height, 404 paths) | `docs/assets/site.css`, `docs/*.html` | `check-docs` ok; no horizontal overflow at 360 px (checked with a script over the CSS and tables, or by a headless render if available) |
| DOC-2-9 | S | CONTRIBUTING and AGENTS.md: "when Herdr updates" (manual refresh of the three snapshots, `node --test` with the d.ts present) and "when attention-picker is re-synced" (git archive command, `node scripts/bundled.mjs`) | `CONTRIBUTING.md`, `AGENTS.md` | steps exist and match PUBLISH.md |
| DOC-2-10 | S | Keep the Windows 500-entry caveat sentence (D6) | `docs/usage.html`, `docs/platforms.html` | sentence present |
| DOC-2-11 | S | Provenance wording equals NOTICE (Lucide ISC with some MIT; Herdr art Apache-2.0; fold/unfold original) | `README.md`, `docs/how-it-works.html` | `rg -n "Lucide" README.md docs` consistent with NOTICE |
| DOC-2-12 | S | Trim README (one privacy table, details on the site) | `README.md` | README at or below ~140 lines; units from D8 still present |
| DOC-2-13a | S | Sentences that follow code-review's and herdr-completeness' changes: `ctrl-shift-j` key, `agent.next` appends folded spaces last, window buttons (D2), sub-agent rows, refresh at most about every 1.5 s, mouse wheel notch vs trackpad, folder-dot wording (D3), AGENTS.md read list (plain click reads too; bar-strip checks the vault mod file) | `docs/usage.html`, `docs/platforms.html`, `docs/troubleshooting.html`, `AGENTS.md`, `README.md` | each statement checked against the code by the author of the sentence |

### herdr-completeness

Internal order: HC-2-3 (right after the sync commit), HC-2-5, HC-2-1, HC-2-2, HC-2-6, HC-2-11, HC-2-4, keys.json (D1) and RECIPE sentences, HC-2-7, HC-2-8, HC-2-12, HC-2-13, then S/X items.

| Id | P | Title | Files | Acceptance |
|----|---|-------|-------|------------|
| HC-2-3 | M | Bundled picker: `scripts/bundled.json` (`source`, `ref` = b7fcb3fa576c44e33d5a03ada94cfd0ec598ecec, SHA-256 per file, LF-normalised) checked by `validate`; `scripts/bundled.mjs` helper prints a new manifest; empty `tolerated_assets["attention-picker"]` (and its `_about`); RECIPE table row (props default on), disclosure (3 s, `--lines 60`, `attention.seen`), NOTICE section 3 (its two icons are that project's own drawings, not Herdr's) | `scripts/{bundled.json,bundled.mjs,validate.mjs,shipped-mods.json}`, `RECIPE.md`, `NOTICE` | `validate` ok; changing one byte of `mods/attention-picker/main.js` in a scratch copy fails it; `rg -n "every 2\|2 seconds" RECIPE.md` empty |
| HC-2-1 | M | `privacy-scan --commits` prints the short SHA and role (author or committer) of an offending commit; PUBLISH.md step 0 (author): private-address settings before merging more PRs, history decision before going public | `scripts/{privacy-scan.mjs,PUBLISH.md}` | on a scratch git repo with a non-noreply author the scan names the commit; PUBLISH step 0 present |
| HC-2-2 | M | CI definition (D12): `scripts/ci.workflow.yml`, `scripts/check-all.mjs`, `package.json`, `.github/dependabot.yml`, `validate` rule, PUBLISH.md author step and honest step 6; preview drift step (`make-preview.mjs --svg-only` leaves `git status` clean) | `scripts/{ci.workflow.yml,check-all.mjs,validate.mjs,PUBLISH.md}`, `package.json`, `.github/dependabot.yml` | `npm test` and `npm run check` exit 0; `validate` fails when `.github/workflows/ci.yml` differs (scratch); no file under `.github/workflows/` |
| HC-2-5 | M | RECIPE claims fixed (Done-when without `bar-strip.attention`, intro line, function list adds `keys`, `fs/promises`, `terminal.kill`, `machines`, `settings`; disclosure adds login-shell startup files and that nvim, PATH query and `hc run` run on the folder's machine); `check-recipe` cross-checks imports from `herdr`, literal `run()` commands, `exec()` programs and forbids `fetch(` / `WebSocket` / `XMLHttpRequest` in mods | `RECIPE.md`, `scripts/check-recipe.mjs` | `check-recipe` ok; a new import or `fetch(` in a scratch copy fails it |
| HC-2-6 | S | Layout `preview` must equal `layouts/<file name>.svg` (`validate`); RECIPE "Watch out": copy thumbnails, rename `preview` | `scripts/validate.mjs`, `RECIPE.md` | scratch rename of a layout file fails `validate` |
| HC-2-4 | S | NOTICE rewritten to claims the repo can support (no "exactly the geometry"; Herdr's `LICENSES.md` statement; fold/unfold original after CR-2-15); each icon entry under a heading that names a license | `NOTICE`, `scripts/validate.mjs` | `rg -n "exactly the geometry\|not recorded" NOTICE` empty; `validate` ok |
| HC-2-13a | M | `keys.json` per D1; RECIPE Keys table and Done-when; RECIPE sentences from CR-2-13 (agent.next, window buttons, folder dot, label, 3 s) and `cmd-b` dead on Linux and Windows; ids list posted on the board for documentation | `keys.json`, `RECIPE.md` | `validate` ok (action `mod.open` exists in the `commands.json` snapshot); keys table equals `keys.json` |
| HC-2-7 | S | `privacy-scan` path and e-mail rules apply to `plans/` except pattern lines (D9); PUBLISH.md author step "keep or remove `plans/`" | `scripts/{privacy-scan.mjs,PUBLISH.md}` | a real-looking home path on a plain line of a plan (scratch) fails; the existing plans pass |
| HC-2-8 | S | `scripts/checks.test.mjs`: temp copy, one fault each (duplicate chord, `ctrl-b` chord, reserved ctrl letter, `ctrl-alt`, Herdr default chord, unknown action, theme in layout, vault node, renamed layout, unlisted icon, stale NOTICE, edited bundled file, swapped RECIPE heading, home path, e-mail, `fetch(` in a mod, gmail commit author in a temp git repo), plus the clean tree passes | `scripts/checks.test.mjs` | `node --test` shows the cases; removing a rule in a scratch copy fails its case; never touches the real tree |
| HC-2-12 | S | PUBLISH.md step 4: per-OS scratch-home sequence and a result table; RECIPE marks Linux, Windows and fish behaviours as not exercised until the table is filled | `scripts/PUBLISH.md`, `RECIPE.md` | steps are commands, not prose |
| HC-2-11 | S | `.editorconfig`; every tracked `.json` parses and ends with a newline (`validate`); `portrait-bottom.json` key order equals `portrait.json` | `.editorconfig`, `scripts/validate.mjs`, `mods/*/mod.json`, `layouts/portrait-bottom.json` | `diff layouts/portrait.json layouts/portrait-bottom.json` shows only `bar` placement, `preview` and nothing else |
| HC-2-14 | S | `check-docs` extensions (DOC-2-5, DOC-2-3): keys.json rows equal the README and configuration table, backticked names in "Where to check" cells exist in `mods/`, mod folder names appear in README and privacy page, Pages host derived from the repo link | `scripts/check-docs.mjs` | ok on the final docs; each rule fails in a scratch copy |
| HC-2-15 | S | `.github/ISSUE_TEMPLATE/bug.md` (Herdr version, OS, layout name, `herdr-app check` output; no personal data) | `.github/ISSUE_TEMPLATE/bug.md` | file exists; `privacy-scan` ok |
| HC-2-9 | X | `scripts/preview.sha256` guard (D13) | `scripts/{make-preview.mjs,check-assets.mjs}`, `preview.png` | `check-assets` fails when the SVG changed and the PNG did not |

### round-lead

| Id | Title | Files | Acceptance |
|----|-------|-------|------------|
| RL-2-1 | Sync commit (done), plan, board posts, answer the vault repo's question (D18) | `mods/attention-picker/**` (sync only), `plans/round-2/PLAN.md` | commit 2fb912a; board posted |
| RL-2-2 | Integrate role branches with `--no-ff`, run the full verification, write `plans/round-2/SUMMARY.md` with the round-3 list, copy the board to `plans/round-2/board.md`, push, open the PR (never merge it) | `plans/round-2/SUMMARY.md`, `plans/round-2/board.md` | verification below green |

## Deferred to round 3

| Item | Reason |
|------|--------|
| PowerShell listing order above 500 entries (DOC-2-10) | No Windows to run it; blind rewrite is a regression risk |
| Virtualised Files list (`uniform_list`) | Cannot be judged without the app; CR-2-5 already lowers refresh rate |
| Remote paths shortened with the local `~` | Only same-named homes on two machines are affected |
| `titlebar: none` + `traffic_lights` for Linux/Windows window buttons | Author's design call (D2) |
| `refresh-snapshots.mjs` network tool, `--clones` mode (HC-2-10) | Network code needs its own review; manual procedure documented (D14) |
| Wide 1600x900 preview variants (HC-2-9 B and C) | Needs the real gallery crop |
| Publication-day README line (herdr.dev install) (DOC-2-13) | Only meaningful on publication day |
| First CI run and its fixes on Linux and Windows | Needs the author to push the workflow with a workflow-scoped token |
| Live verification in the app of: CR-2-2, -3, -4, -6, -11 behaviour, per-OS items | Rule 2; the author checks with the PUBLISH.md table |
| Docs generator (not committed) | Docs are edited directly; decide whether to commit a generator once the site is stable |

## Cross-role dependencies and landing order

Board gates (each is a board post "### [round 2] <role> -> <role|all>: ..." from the role that owns the fact):

1. G1, herdr-completeness -> all, first: HC-2-3 done (RECIPE and NOTICE after-sync wording, picker facts), the final ids list, CI file names (`scripts/ci.workflow.yml`, `npm test`, `npm run check`), the `keys.json` final action. Unblocks DOC-2-2, -3, -4, -6, -9, -13a.
2. G2, code-review -> all, after CR-2-1, -4, -5, -6: the new `herdr` imports (`machines`, `settings`; already allowed in RECIPE by HC-2-5 so `check-recipe` does not fail in between), the wheel behaviour (notch = one step; 40 px for trackpads), the refresh floor (about 1.5 s), sub-agent rows, label removed, `fold/unfold` redrawn. Unblocks DOC-2-13a and HC-2-4.
3. G3, documentation -> code-review and herdr-completeness: text final (numbers with units, tables). Unblocks CR-2-8 (last CR task) and HC-2-14.
4. G4, herdr-completeness -> round-lead: `check-docs` extensions and `checks.test.mjs` green on the merged tree.

Files that touch two roles through a name (not an edit): `RECIPE.md` function list must name every import of the six mods
(CR -> HC via G2); `NOTICE` must list every icon basename (CR-2-15 -> HC-2-4); `tests/shared.test.mjs` `EXPECTED` copies
(CR only); `validate.mjs` knows the layout ids the mods look up (HC; CR tells HC before adding a new `find()`).

Merge order for the round lead: herdr-completeness, code-review, documentation (round 1's order; no overlapping files, so
no conflicts expected), then fix-ups.

## How the round is verified

From the repo root on the merged branch (macOS, Node 18+; Linux and Windows are not available):

```
node --test                                     # suite incl. api and docs-claims (api skipped without the d.ts)
npm test && npm run check                       # same plus validate, check-recipe, check-assets, check-docs, privacy-scan
for m in mods/*; do herdr-app check "$PWD/$m"; done    # 7 of 7
node scripts/privacy-scan.mjs --commits         # expected: fails only on the PR 1 merge commit until the author acts (D10)
node scripts/validate.mjs                       # includes bundled.json hashes and the CI template rule
node scripts/make-preview.mjs --svg-only && git status --short   # clean
rg -n "/Users/|/home/[a-z]|C:\\\\Users" . --glob '!plans/**' --glob '!tests/**' --glob '!scripts/**'    # empty
```

The round lead also checks: `git diff --stat main..HEAD -- mods/attention-picker` equals the sync commit only; nothing under
`.github/workflows/`; every claim row in DOC is traceable (spot-check five); the board has a closing post from each role.

## Risks

- Nothing runs in the live app. CR-2-2, -3, -4, -6 and -11 change what the author sees or presses. Mitigation: each has pure-logic tests and a stand-in render test; the author checks them with the "verify in app" list in the summary. Fallbacks: D1 reverts to `bar-strip.attention` in `keys.json` alone; CR-2-4 wheel can fall back to the old accumulator by one constant.
- `mod.open` toggling and `delta_lines` semantics come from Herdr's AGENTS.md and the d.ts, not from a run.
- `tabRows` (CR-2-6) changes row counting in a hot render path: the smoke world has pane-less agents, and `byPane` must not receive them.
- Shared code blocks exist as identical copies (tree, tabs, files, nvim-float): `tests/shared.test.mjs` is the safety net; CR must update every copy in the same commit.
- `check-recipe` and `validate` get stricter: a role that adds an import, icon, layout id or command without telling the owner breaks the suite for everyone. Mitigation: gates G1-G4 and a board post before such a change.
- The CI definition has never run (token scope). Dependabot pins and the Node 18 leg are guesses until the author pushes the workflow.
- Web merges add commits with the author's personal address (D10): the PR for this round must not be merged in the web UI before PUBLISH.md step 0 is done.
- The synced picker is a moving target: if the canonical repo changes again, `bundled.json` fails the suite on purpose; re-sync with the commands in CONTRIBUTING.
