# Round 2, code-review audit

Base: `main` at ef8b513 (round 1 merged). Scope: the whole round-1 diff (`git diff b4c1673..main -- mods tests`), every `main.js`, `logic.mjs` and test, read against `herdr.d.ts`, `gpui-kit.d.ts` and the Herdr AGENTS.md rules, plus the round-1 SUMMARY priorities. Nothing in the repo was changed except this file.

## Summary

Round 1 holds up better than expected. I ran everything that can run without the app:

- `node --test`: 73 pass (Node 26). `validate`, `privacy-scan`, `check-recipe`, `check-assets`, `check-docs`: all ok.
- API check by script: every name imported from `herdr`, `gpui-kit` and `gpui-base` exists in the d.ts files, and every builder method the six own mods call (`.text_ellipsis_start()`, `.on_scroll_wheel()`, `.overflow_x_scrollbar()`, ...) is declared in `gpui-kit.d.ts`. No API misuse found.
- The coordinator's sync was rehearsed in a scratch copy (outside the repo): `mods/attention-picker` replaced by `origin/feat/round-1-standalone-picker`. `node --test` 73 pass, validate / check-assets / check-recipe / check-docs ok, `herdr-app check` passes for all 7 mods (the new picker adds `logic.js`, `search.svg`, `spinner.svg`; none of the repo's checks trips on them). The synced picker still takes `{ search }` and reads `agents.since` as `{ address: ms }`, so `bar-strip`'s call fits it.

What is wrong is smaller and mostly behavioural: one state-loss bug that round 1 introduced with its pruning (CR-2-1), one key that goes dead exactly when the bar is hidden (CR-2-2), three interaction/perf problems that the tests cannot see (CR-2-3, -4, -5), a hole in what the tree shows (CR-2-6), and the tests' blind spot for API names (CR-2-7). Six statements in RECIPE or the docs are not backed by the code (CR-2-13). Items I could not verify without driving the app are marked "verify in app" and are the author's to confirm.

Ownership key: CR = code-review (`mods/**/*.js|mjs`, mod assets, `tests/**`), DOC = documentation, HC = herdr-completeness (RECIPE, mod.json, layouts, keys.json, scripts, NOTICE).

Order is by impact.

---

## CR-2-1 (high) Round 1's pruning deletes a remote machine's remembered state when that machine is loading or offline

Evidence:
- `mods/portrait-tree/main.js:105-110`: `reveal()` prunes `folded` and `peeked` with `pruneIds(set, live)` where `live` is `spaces()`. The only guard is "list not empty".
- `mods/portrait-tabs/main.js:48-50`: `prunePanels(this.panels, all.map(s => s.id))`, same guard.
- `herdr.d.ts` `machines()`: each machine has `layout: "loading" | "ready" | "unavailable"`, and "unavailable includes offline cores". Remote space ids carry a `machine/` prefix (d.ts, `TabInfo` comment).
- At start the local spaces are listed first; a remote machine's spaces appear later or never (offline). The first render with a non-empty local list therefore prunes every remote id out of `folded`, `peeked` and `panels`, and `saveFolds()` / `writeJson` persists the loss. A user with a folded space on a VPS that is down at launch finds it unfolded, with no per-space panel, for good. SUMMARY "Round 2 priorities" #4 flagged this and left it open. It is also the only way round 1 can destroy user state.

Change:
- New pure function in the shared `storage` block (identical copy in `portrait-tree/logic.mjs` and `portrait-tabs/logic.mjs`; `tests/shared.test.mjs` already enforces equality):
  `pruneSpaceIds(ids, spaces, machines)`: keep an id when its space is listed, or when its machine is not `"ready"` (machine = text before the first `/`, none = this computer, `machines()` entry with `name === null`). An id whose machine is unknown is kept.
- Use it in the three places above, passing `machines()` (add `machines` to the `herdr` import). Keep the "never against an empty list" rule inside it.
- `portrait-tree` spine pruning (`this.spines.prune`, once per start) is harmless (files are rewritten on demand); leave it.

Owner: CR (all files). DOC: privacy page already says state is "pruned"; no change.

Verify: unit tests: remote id kept while its machine is `loading` or `unavailable`, dropped once `ready` and unlisted; local ids still pruned; unknown machine keeps; empty spaces keep everything. Extend the smoke test: `state.spaces` without the remote space and `machines()` stand-in returning `unavailable`, assert `m.folded` still holds the remote id after `render`. Author: fold a remote space, quit, stop the remote core, relaunch, it is still folded.

---

## CR-2-2 (medium) `ctrl-shift-j` does nothing while the bar is hidden, which is when the list is most useful

Evidence:
- `keys.json`: `"ctrl-shift-j": "bar-strip.attention"`; `bar-strip/main.js:21-28` serves it through `nextCommand()`.
- AGENTS.md (Herdr): "`<mod>.<command>` reaches shown copies only". `ctrl-shift-g` / `cmd-b` do `layout.toggle:bar`, which hides the block holding `bar-strip`, so the command has no receiver. The repo's own AGENTS.md says the same ("reach shown copies only").
- The synced picker is a self-opening overlay (`mod.json`: `overlay: { kind: "dialog", width: 640 }`), so `mod.open:attention-picker` needs no other mod, passes no props (search box on by default) and, per Herdr, toggles (pressing it again closes it). That also removes the "second press replaces the open one" workaround in `bar-strip.picker()` for the keyboard path.

Change:
- HC: `keys.json` binds `ctrl-shift-j` to `mod.open:attention-picker` in both layout sections. Shift-click on the bell keeps using `bar-strip.picker(true)` (the picker is open the same way, just with props).
- CR: `keyHint` (`bar-strip/logic.mjs:37-41`) must find the new action too: accept a list, `["bar-strip.attention", "mod.open:attention-picker"]`, both spellings each. Keep `bar-strip.attention` and `jump` served for people who bound them. Drop the always-`true` `search` parameter of `picker()` or use it (`search` is never `false` anywhere).
- DOC / HC: README keys table, docs/configuration.html, RECIPE keys table and "Done when" mention the action name.

Verify: tests for `keyHint` with the new action in layout and global sections. Verify in app (author): hide the bar with `ctrl-shift-g`, press `ctrl-shift-j`, the dialog opens, pressing again closes it. If the key still works with `bar-strip.attention`, this finding is moot and the repo AGENTS.md sentence is what needs a footnote.

---

## CR-2-3 (medium) Drag-to-reorder shows a drop line on every other header and tab row for the whole press

Evidence:
- `portrait-tree/main.js:155` (`header`): `target = this.pressed !== null && this.pressed !== i && sameMachine`. It does not test where the pointer is, so on mouse down every other header of that machine gets the 2px accent line, including on a plain click (down, `cx.notify()`, redraw, up). Same shape in `tabRow` (`:209`), where `on_mouse_down` has no `cx`, so the line appears on the next unrelated redraw instead.
- Herdr's own `spaces` mod (`mods/spaces/main.js:361-387` in the app home) tracks `over` with `on_mouse_move`, draws the line only on `over`, dims the dragged row (`opacity(0.5)`), and moves only when `over === i`.

Change (CR): add `this.over` / `this.tabOver`; `on_mouse_move` sets it (same-machine / same-space only, `cx.notify()` only when it changes); draw the indicator only for `over === i` and give it an id (`drop-<id>`) so a test can see it; on mouse up move only when the release row is `over`; clear both in the root `on_mouse_up`. Call `cx.notify()` in the tab row's mouse down. Dim the pressed row as the shipped list does.

Verify: smoke test: set `m.pressed = 0`, render, assert no `drop-*` id; set `m.over = 1`, render, assert exactly `drop-<s2>`. Author, in app: a plain click on a header no longer flashes lines on the others.

---

## CR-2-4 (medium) Wheel: 40 px per tab may turn one notch of a mouse wheel into several, a regression against the shipped tab bar

Evidence:
- `portrait-tabs/main.js:87-93`: round 1 replaced the shipped `|dy| >= 1 -> one tab` with an accumulator at `WHEEL_STEP = 40` px. `portrait-tree/main.js:444-450` uses the same step for columns.
- `gpui-kit.d.ts:520-531` `ScrollWheelEvent`: `delta` is pixels "whichever unit the device reported", `delta_lines` is set "when the device reported lines" (a notched wheel), and `touch_phase` is `started | moved | ended | cancelled`. A notched wheel reports whole lines; converted to pixels one notch is roughly one line height (about 16-20 px), so a user needs two or three notches for one tab where the shipped bar needed one. A trackpad reports pixels and is what 40 px was tuned for. SUMMARY: "wheel feel (`WHEEL_STEP`)" was never checked on real hardware.

Change (CR): in both handlers prefer `e.delta_lines?.y` (or `.x`) when present: one line = one step, no accumulator; else accumulate pixels as now. Reset the accumulator on `touch_phase === "started"` instead of relying only on the 400 ms idle timer. Put the decision in a pure `wheelDelta(event)` in the shared `wheel` block (`{ step: 1, amount: lines }` or `{ step: 40, amount: px }`) with tests.

Verify: unit tests for line events (3 notches = 3 steps), pixel events (unchanged), `started` resets. Author (feel, cannot be tested here): mouse wheel one notch = one tab, trackpad swipe unchanged.

---

## CR-2-5 (medium) Files watcher refreshes without a floor, can drop an event, and leaves a watcher per visited folder

Evidence (`portrait-files/main.js`):
- `:57-70` `watch()`: each batch from `watchFolder(root)` calls `refresh()` at once. On macOS and Windows the watch is recursive and "includes ignored directories" (`herdr.d.ts`), so a dev server, a build writing `dist/` or `target/`, or `node_modules` churn produces events continuously; each one lists every open folder and runs `rev-parse` + `git status`. `refresh()` serialises on `this.loading` but nothing spaces runs apart, so the loop becomes back-to-back git runs for as long as something writes.
- `:96` `refresh()` returns when `this.loading`; the batch that arrived while a load was in flight is simply lost until the 10 s timer. An edit made during a 300 ms git run shows up to 10 s late.
- `watchFolder` cannot be cancelled. A loop ends only at its next event, so visiting 30 project folders leaves 30 live recursive watchers (inotify watches on Linux, FSEvents streams on macOS) until each fires once. On Linux that adds toward `max_user_watches`; a rejected watch (over 4096 directories) retries every 10 s tick, which is fine.

Change (CR):
- A small pure coalescer in `portrait-files/logic.mjs`: `createCoalescer({ gap: 1500, now })` with `request()` returning `"now" | "later" | "skip"`; the watch loop does `await cx.sleep(gap)` after each batch (`Context.sleep` exists, `gpui-kit.d.ts:387`) and `refresh()` sets `this.again = true` when it is skipped for `loading`, running once more when the load finishes.
- Cap live watch roots: remember the last 3 roots that started a loop and do not start a loop for a fourth until one of them ended (the folder falls back to the timer). Say so in one comment.
- DOC: one sentence in docs/platforms or troubleshooting ("a busy folder refreshes at most about every 1.5 s").

Verify: coalescer unit tests (burst of 100 requests = one run per gap, trailing run happens, `skip` while loading sets `again`). Extend the smoke test: two `refresh()` calls during a pending load produce exactly two `git status` runs, not one lost and not three. Author: build a project in a watched folder with the panel open and watch CPU.

---

## CR-2-6 (medium) Agents without a pane are counted but have no row, so a blocked sub-agent says "! 1" and shows nothing to click

Evidence:
- `portrait-tree/main.js:134-140` (`counts`) and `:380` (agent order) include every agent; rows come only from `panes()` (`:369-373`, `:419-423`). Herdr's model: sub-agents "belong to their parent's tab without a pane", and `agent.focus {terminal}` is documented as working for sub-agents too (`herdr.d.ts`).
- The bell and the picker count them; the tree is the one place the author looks at to find who waits. RECIPE "Pane-less agents" admits it. SUMMARY priority #7 deferred this "until real data exists"; the data shape is already in `AgentInfo` (`pane` empty, `tab` set, `address`), and the smoke world already has such agents (`t6`, `t7`).

Change (CR): a pure `tabRows(panes, agents)` in `portrait-tree/logic.mjs` returning the tab's children in order: its panes, then that tab's pane-less agents (stable by address), each marked `{ kind: "pane" | "agent" }`, with the tree-line prefix computed from the combined length (the last child gets `└─`). Pane-less rows use `agentRow` with `run("agent.focus", { terminal: a.address })` and a `sub` hint (muted second line is not needed; the program icon and name do). Do not add them to `byPane`.

Verify: unit tests for `tabRows` (order, prefixes, a tab with only pane-less agents, none). Smoke: `ag-<address>` ids appear for `t6` and `t7`. DOC: drop RECIPE's "Pane-less agents" Watch-out (HC) and update README usage.

---

## CR-2-7 (medium) The smoke test accepts any method name, so it does not do what its header says

Evidence:
- `tests/smoke.test.mjs:20-34`: the stand-in element answers every property with `() => self`, so `.text_ellipsis_strat()` or a method Herdr removes passes. The header comment says it "catches typos, undefined names and wrong shapes". Typos in builder names are exactly what it cannot see. `herdr-app check` renders once and the Herdr AGENTS.md says it "does not lay out the mod or run deferred rows, nested renders or later async states".
- Three of the mods are clones of Herdr 0.1.12 mods; every Herdr update can drop or rename a builder method (the d.ts files are rewritten on each start). Today everything resolves (I checked all 6 mods by script), so this guards the future, not a current bug.

Change (CR): new `tests/api.test.mjs` that, when `herdr.d.ts` and `gpui-kit.d.ts` are found (`$HERDR_APP_HOME`, else `os.homedir()/.config/herdr-app`; never written; skipped with a message when absent, because those files are app-written and untracked), checks for each of the six own mods: (a) every name imported from `herdr`, `gpui-kit`, `gpui-base` is exported there; (b) every `.name(` call in `main.js`, minus names the class defines itself and a short allow-list of JS built-ins (`filter find map some includes push pop slice split join get set has add delete reduce trim parse stringify catch then ...`), is declared in `gpui-kit.d.ts` as `name<` or `name(`. Build the test paths from `os.homedir()` so no home path is written in a file (privacy scan).
- Mention in `scripts/PUBLISH.md` / CONTRIBUTING "after a Herdr update run `node --test` with the d.ts present" (HC / DOC).

Verify: the test passes today; temporarily misspelling one builder in a scratch copy makes it fail.

---

## CR-2-8 (medium) DOC asked for `tests/docs-claims.test.mjs` (DOC-2-5)

Evidence: board message "documentation -> code-review: three asks". The documented numbers are 290 px (`MIN_COL`), 34 px (`FOLDED_COL`), 40 px (`WHEEL_STEP`, tree and tabs) and "7 days" (`CHANGED_TTL`). Checking that a number occurs somewhere in a page is weak (34 or 40 occur by chance), so the test should match the number inside its own sentence.

Change (CR): `tests/docs-claims.test.mjs` imports the constants (`MIN_COL`, `FOLDED_COL`, `WHEEL_STEP` from tree and tabs, `CHANGED_TTL / 86400000`) and asserts, per file, a regex tied to the unit and noun: `README.md` and `docs/usage.html` for the column width and strip (`/290\s*px/` and `/34\s*px/`), the wheel (`/40\s*px/`), `docs/privacy.html` (`/7 days|a week|seven days/`). It also asserts that the wheel constants of the two mods agree. Land it after DOC lands the text, and after CR-2-4 so the wheel sentence is final. If CR-2-4 changes the number for mouse wheels, the test follows the docs, not the other way round.

Verify: `node --test` passes; changing `MIN_COL` fails it.

---

## CR-2-9 (low) The bell goes to the "longest waiting" agent by `seq`, the tree and the picker show time by `agents.since`

Evidence: `bar-strip/logic.mjs:45-48` sorts by `seq` ("higher = changed more recently", any change). `portrait-tree` publishes `agents.since` (time of the last state change) and the synced picker reads it first (the coordinator note). Both are "who waited longest", and they can disagree: `seq` also moves when a title or other field changes.

Change (CR): `waitingAgents(list, since)` sorts by `since?.[address]` when present for both agents, else by `seq` (a missing entry sorts last within its group). `bar-strip` passes `shared("agents.since")`. The jump order then matches the picker's default "oldest" order.

Verify: tests with `since` present, partly missing, and absent.

---

## CR-2-10 (low) A dotfile opened from the Files panel shows the wrong name and folder in the tree

Evidence: `portrait-tree/logic.mjs:18` `clean` strips every leading non-letter, including `.`; `nvim-float/main.js:18` has its own `clean` that keeps the dot. In `portrait-tree/main.js:255-259` `shown = clean(p.title)` for `.env` is `env`, `base` is `.env`, `shown === base` fails, so `where` falls back to the pane's cwd instead of the file's folder.

Change (CR): one `cleanTitle` that keeps a leading `.` (move `nvim-float`'s into a shared `title` block in both logics, or export it from the tree's logic and copy into nvim-float's under a `<shared:title>` marker; add it to `EXPECTED` in `tests/shared.test.mjs`).

Verify: unit tests: `".env"`, `"✳ .gitignore"`, `"✳ Fix it"`, `"..."`.

---

## CR-2-11 (low) Answer to DOC-2-1: mark colours on light themes (`paper`)

Computed against white, `#f4f1ea` and `#ebe8e1` (stand-ins for the light `chrome`; the shipped `paper` values are inside the app):
- The badge ink is chosen per colour (`inkOn`): 5.5:1 to 6.6:1 against every mark, on any theme. Readable: yes.
- The marks themselves as text or rule on a light `chrome`: 2.3:1 to 3.4:1. That is the 13 px spine text of the active folded space (`portrait-tree/main.js:344`, `.text_color(s.active ? color : ...)`) and the 2 px rule under the title (`:186`). Not readable to WCAG for text (4.5:1) and below 3:1 for the rule on cream backgrounds. On dark themes the same colours measure well above 3:1.

Change (CR): when `settings().dark === false` (Herdr's AGENTS.md: `settings()` carries `dark`, the appearance now; not typed in `herdr.d.ts`, so guard with `=== false`), mix the mark toward `t.foreground` by about 35 % for the spine text only (`mix(color, t.foreground, 0.35)`); keep the badge and rule as they are. Pure helper `markText(color, foreground, dark)` with a contrast assertion in the test (>= 4.5 against white for all six marks).

Verify: unit test of `markText`; author looks at a folded space on `paper`.

---

## CR-2-12 (low) `color + "1f"` and friends assume six-digit hex

Evidence: `bar-strip/main.js:91` (`color + "1f"`, `"33"`), `portrait-tree/main.js:128` (`t.blocked + "26"`), `portrait-pane/main.js:66`. A layout may override theme colours with `#rrggbbaa` (AGENTS.md "Colors are theme names or `#rrggbb[aa]`"), which makes `#rrggbbaa1f` invalid.

Change (CR): `alpha(hex, a)` in the tree's logic (and the shared copies where used), taking the first six digits, `a` 0..1; use it in the three places; tests for 6 digits, 8 digits, bad input (returns the input).

Verify: unit tests; smoke with a theme stand-in returning `#11223344`.

---

## CR-2-13 (low) Statements the code does not back

For HC and DOC; I checked each against the code.
1. `agent.next` / `agent.prev` "follow the tree, folded spaces left out": RECIPE.md:114, docs/usage.html:49. `herdr.d.ts` `setAgentOrder`: agents missing from the list "are appended in model order". The tree passes only unfolded spaces (`portrait-tree/main.js:380`), so agents of folded spaces come last, they are not skipped, and focusing one unfolds its space (RECIPE.md:111-112 says exactly that two lines earlier). Fix the sentence: "folded spaces' agents come last". No code change.
2. "On Linux and Windows the tab strip also draws minimize, maximize and close" (RECIPE.md, What you see 1, and the same in What you see 2): the layouts keep the system title bar (no `"titlebar": "none"`, no `traffic_lights`; the shipped `main` has both). `window().buttons` is "the system draws no window buttons", so false here, and `portrait-tabs`' three buttons and its traffic-light padding never show. HC: either correct the sentence, or (a decision for the author) add `"titlebar": "none"` plus `traffic_lights` to both layouts. `window_drag` on `tabs` has no effect with a system title bar. No code change either way.
3. "A closed folder shows a dot in the color of its worst child" (RECIPE, Files panel): `bubble()` (`portrait-files/logic.mjs:133-142`) maps every changed child except a conflict to `"M"`, and the dot colour for `"M"` is `t.blocked`; a folder holding only a new file does not show the new file's green. Either say "a dot in the colour of a conflict (red) or modified (`blocked`)", or rank marks (`U` > `D` > `M` > `A`) in `bubble`; `tests/files.test.mjs:123` asserts the current `"M"` for `tools/` and would change with it (CR).
4. Disclosure lists the label `editor.space=<id>`: nothing reads it (`portrait-files/main.js:178` writes it; `nvim-float` gets the space through props). CR removes the label; HC then drops it from the RECIPE disclosure and DOC from privacy.
5. "`hc read` ... every 2 seconds" (RECIPE, privacy wording): the synced picker polls every 3 s (`POLL_MS`). Already raised by DOC (DOC-2-2); HC after the sync.
6. AGENTS.md "They read ... one file's text when the person alt-clicks it": a plain click reads it too on Windows and when nvim is missing (`edit()` falls back to `show()`), and `bar-strip` reads the existence of `<app home>/mods/vault/main.js`. DOC.

---

## CR-2-14 (low) Cleanups and small costs

- `portrait-files/main.js:12` imports `markOf`, unused. `portrait-tree/logic.mjs`: `WHEEL_IDLE` is unused (the default `400` in `wheelSteps` repeats it; use the constant), `lumOf` and `isPlainObject` are exported but used only inside the file or by the shared copy.
- `tests/tree.test.mjs:1` still says `node --test tests/` (fails on Node 22+); the other test headers were fixed.
- `portrait-tree/logic.mjs:140`: the `xml()` character class contains literal U+FFFE and U+FFFF bytes; write them as `￾￿` so an editor or tool cannot drop them.
- `portrait-tabs/main.js:56`: `panes()` is called up to twice per tab inside `item`, and `panes()` marshals every pane each time; hoist one `const all = panes()` above `shown.map(item)`. The tab bar re-renders on every agent title change, so this is the hottest of the three tab/strip mods.
- `bar-strip/main.js:105`: `shared("workspace.panels") ?? [...]` is used unguarded (`.includes`), while `portrait-tabs` validates it through `enabledPanels`. A value that is not an array would throw in the strip's render every time. Move `enabledPanels` into the `vault` shared block (both mods) and use it.
- `portrait-tree/main.js:405`: `colors[s.id]` is assumed to be a string; `c.startsWith` throws on anything else, and `MARK[c] ?? t[c]` can be `undefined`, which `.bg()` and `inkOn` then receive. Guard with `typeof c === "string"` and a `t.accent` fallback.
- `portrait-tree/main.js:53`: the 30 s redraw timer only changes text once a minute (`duration` has minute resolution); 60 s halves the whole-window redraws. Optional, trade-off is a stale "<1m" for up to 30 s.
- `portrait-files/main.js:180`: `PATH="$1"` replaces the app's PATH with the login shell's. `PATH="$1:$PATH"` keeps system folders if a profile prints a short list. Change in the shared `nvim` block (both mods; test `nvimArgv runs in a real sh` updates its expectation).

Verify: `node --test` after each; `tests/shared.test.mjs` keeps the copies equal.

---

## Not recommended this round (decisions)

- PowerShell listing order (DOC-2-10, SUMMARY #3): `portrait-files/main.js:28` takes `Select-Object -First 501` in PowerShell order, so above 500 entries the shown 500 are arbitrary on Windows. Fixing it means restructuring a script I cannot run (no `pwsh` here, and Windows was never exercised). Answer to DOC: document the limitation, as round 1 left it. Revisit when someone can run it on Windows.
- Virtualised Files list: `rows()` builds up to 5,000 elements per render. The d.ts has `uniform_list` / `v_virtual_list`, but a conversion cannot be judged without the app. Revisit with the author after CR-2-5 (it also lowers render frequency).
- Rows/label for remote paths with `~`: `portrait-tree` and `portrait-pane` shorten with the local home even for a remote space. Only a same-named home on both machines is affected (`/home/ann` on both); skip.

## What round 2 apply should do, in order

1. CR-2-1, CR-2-3, CR-2-4, CR-2-6 (the behavioural fixes), each with unit tests; then CR-2-5.
2. CR-2-2 together with HC's `keys.json` change (post to the board first; I do the `keyHint` part).
3. CR-2-7, CR-2-8 (tests), CR-2-9, CR-2-10, CR-2-11, CR-2-12, CR-2-14.
4. Keep `mods/attention-picker` untouched; findings about it go to the herdr-agents-waiting board (none from this audit).

Files I touch when applying: `mods/portrait-tree/{main.js,logic.mjs}`, `mods/portrait-tabs/{main.js,logic.mjs}`, `mods/portrait-files/{main.js,logic.mjs}`, `mods/bar-strip/{main.js,logic.mjs}`, `mods/portrait-pane/{main.js,logic.mjs}`, `mods/nvim-float/{main.js,logic.mjs}`, `tests/*`.
