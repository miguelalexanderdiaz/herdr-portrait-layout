# Round 1, code-review: audit

Scope: every file under `mods/` (8 mods, about 1,470 lines of JS), checked against `herdr.d.ts`,
`gpui-kit.d.ts` and `AGENTS.md` of the installed Herdr. `mods/attention-picker` is the bundled
copy: read, not edited, notes go to the herdr-agents-waiting board.

## Summary

The mods are in good shape for a first publication: all seven author mods pass
`herdr-app check`, every `run()` command name and argument used (`space.move`, `tab.move`,
`tab.rename`, `pane.focus`, `agent.focus`, `layout.select/show/hide`, `terminal.keep`, `mod.open`,
`app.settings`, `window.*`) exists with those argument names in `herdr-app commands`, and the gpui-kit
calls used exist in the type file. Hash collisions in the spine file names were checked
(400,000 names, zero collisions) and are NOT a finding.

What is wrong is mostly about being a *shared* layout rather than the author's private one:

1. Things that poll or watch forever (Files panel while closed), or retry forever (spine writer).
2. POSIX/macOS/author-setup assumptions: `$0`/`$1` through the login shell (breaks fish), a macOS home prefix
   hard-coded, `sh` on Windows, absolute `git` paths vs cwd paths, a Vault that is always assumed.
3. Dependence on assets of other mods (Herdr's shipped icons, the Obsidian logo).
4. No tests at all, and all the pure logic lives inside gpui-importing files that node cannot load.

Mechanism for tests (verified in a scratch folder): a sibling module named `logic.mjs` next to
`main.js` is accepted by `herdr-app check` (`import { x } from "./logic.mjs"`) and is importable by
`node --test` on any Node 18+ without a package.json. So: each mod that has testable logic gets a
gpui-free `logic.mjs`; `main.js` imports it; `tests/*.test.mjs` import it by relative path.
Tests must not use POSIX-only paths (CI runs ubuntu, windows, macos).

Suggested apply order: CR-1-1 (harness) first, because CR-1-2..CR-1-9 each add tests to it.

Ownership note: all findings below touch only files code-review owns (`mods/**/*.js|mjs`, mod assets,
`tests/**`), except where "Needs" names another role.

---

## CR-1-1  Test harness and repo invariants (medium, enabler)

Evidence: no `tests/`, no way to run anything; 100% of the logic is in files that import `gpui-kit`
and `herdr` (e.g. `portrait-tree/main.js:6-8`), which node cannot load.

Change:
- Create `mods/portrait-tree/logic.mjs`, `mods/portrait-files/logic.mjs`, `mods/bar-strip/logic.mjs`
  (details in the findings below); `main.js` of each imports from `./logic.mjs`.
- `tests/*.test.mjs` using only `node:test` and `node:assert/strict`, no dependencies.
- `tests/repo.test.mjs`, static invariants over the tracked tree:
  - every `mods/*/mod.json` parses; every `mods/*/main.js` has a default-exported class extending `View`
    (regex), and is not larger than a sanity limit;
  - every literal `svg("mods/<m>/<file>")` / `image(...)` in `mods/**/*.js` resolves to a file of this
    repo, except an explicit allowlist (`mods/vault/**`, `mods/vault-reader/**`; see CR-1-10);
  - template-literal asset paths (`chevron-${...}.svg`) are enumerated in the test by listing the
    folder, so a renamed icon is caught;
  - no absolute home-folder path (macOS, Linux or Windows form) and no e-mail pattern in `mods/**` (the privacy scan itself
    is herdr-completeness's `scripts/privacy-scan.mjs`; this one is the cheap in-test duplicate).
- Command: `node --test tests/` (also found by plain `node --test`, which globs `*.test.mjs`).

Owner: code-review. Needs: herdr-completeness to call it from CI (HC-1-5 asked for `test/`; I use
`tests/` because that is the folder assigned to this role, and `node --test` finds both).

Verify: `node --test tests/` passes on a clean checkout; deliberately renaming an icon makes
`repo.test.mjs` fail.

---

## CR-1-2  Files panel polls and watches while it is closed (high, performance)

Evidence: `portrait-files/main.js:41` `cx.timer.every(10000, refresh)`; `refresh` (67-102) runs a
`sh` directory listing for the root and every open folder, `git rev-parse` and
`git status --porcelain=v1 -z --untracked-files=all` (line 91) on the whole repo, every 10 s,
forever. In `layouts/portrait.json` the `panel` starts `hidden: true`, so for most of a session
nobody sees the result. AGENTS.md ("timers keep running while hidden, so poll gently") and the
`watchFolder` doc ("Watch what you show, not a whole home folder") both warn about this. Also
`watch()` (44-52) puts a recursive watch on `cwd` even when that is the home folder (macOS/Windows watch
recursively including ignored dirs), and `refresh` on a context change leaves the previous
`watchFolder` promise pending until that folder changes.

Change:
- Pure `filesVisible(layoutRoot)` in `portrait-files/logic.mjs`: find node `panel` and `panel-body`;
  visible iff `!panel.hidden && body.active === "files"` (same `find` as `bar-strip/main.js:10`, same
  fields it already reads). `layout` is imported from `herdr`.
- In the timer callback and in `watch()` loop: `if (!visible) return`/skip. In `render()`: when
  `visible` flips from false to true, call `refresh(cx)` once (layout changes re-render the mod, as
  bar-strip's lit state relies on).
- Do not watch when `root === home()` or `root` is a drive root; rely on the timer there.
- Run `git status` with the pathspec `-- .` from `cwd` so a monorepo is not scanned for a subfolder
  view (also see CR-1-8).
- Keep one watch loop per root (`this.watching = new Set()`), not per context.

Verify: unit test `filesVisible` for hidden panel, other active child, missing nodes. Manual (author):
with the panel closed no `git`/`sh` process appears every 10 s (Activity Monitor / `ps`).

---

## CR-1-3  Spine writer retries forever when it cannot write; spine files never cleaned (high, correctness/perf)

Evidence: `portrait-tree/main.js:342-363`. `spine()` is called from `render()` for every folded space.
On failure the `catch {}` swallows the error, `writing.delete(file)` and `cx.notify()` run, the next
render calls `spine()` again, which spawns another write, which fails, which notifies: an unbounded
render loop (each render redraws the whole window) whenever `<appHome>/data` is not writable
(read-only home, a sandboxed `HERDR_APP_HOME`, Windows path quirks with the mixed `\` + `/` string at
line 349). Also the files `data/portrait-tree-spines/*.svg` are never removed for renamed or deleted
spaces (documentation flagged this), and `xml()` (69) does not strip XML-invalid control characters, so a
space name containing e.g. U+0001 makes an SVG that silently fails to load.

Change (logic in `portrait-tree/logic.mjs`, injected `fs` so it is testable):
- `createSpineStore({ fs, dir })` with `ready(name)` (sync, true once written), `request(name)` (starts one
  write), `failed` set with a cool-down (60 s) so a failure is retried later, not on the next frame;
  `prune(keepNames)` (readdir + unlink files whose hash is not in the current set), called once after the
  first render with a non-empty space list.
- Fallback while not ready or failed: the existing badge only (already drawn) plus a horizontal
  truncated name is NOT possible in a 34 px strip, so show nothing under the marks (current behaviour
  while the file is pending), but never loop.
- `xml()` also removes `[\u0000-\u0008\u000B\u000C\u000E-\u001F]`.
- Build the path with one separator rule (`dir + "/" + file`) and let `fs` accept it (the d.ts says
  write under appHome; verify on Windows that forward slashes work with `fs.writeFile`; if not, build with
  the platform separator from `process.platform`).
- Font stack in `spineSvg`: add `"Segoe UI", Arial` before `sans-serif` (Helvetica Neue is macOS only).

Verify: tests for `spineFile` stability, `spineSvg` escaping/control chars, store: failing fs does not
re-request before the cool-down (fake clock), `prune` deletes only unknown names.

---

## CR-1-4  Click-to-edit through the login shell is POSIX- and bash/zsh-only (high, portability)

Evidence: `portrait-files/main.js:134` and `nvim-float/main.js:19-24` run
`sh -c 'exec "${SHELL:-sh}" -lc '<script>' "$@"' sh args...` and the script reads `"$0"` and `"$1"`.
That relies on `sh -c script arg0 arg1` positional semantics being forwarded by the user's login shell.
fish and csh do not define `$0`/`$1` (fish passes `$argv`; AGENTS.md says agents run in fish too), so for
a fish user the click fails with a shell error. On Windows there is no `sh`, no `$SHELL`, and `/tmp`
(line 143) does not exist: `exec("sh", ...)` rejects and the user gets "Couldn't open nvim" for every
file click, while alt-click is the only working path. The `QUIT`/menu actions in nvim-float repeat it.

Decision (unattended, written down): keep `/tmp` for the socket on POSIX. A macOS `$TMPDIR` path is long
and can exceed the 104-byte `sun_path` limit; `/tmp` is short and exists on macOS and Linux.

Change (shared helper copied into both `portrait-files/logic.mjs` and `nvim-float/logic.mjs`, with a test
asserting the two copies are byte-identical):
- `loginPath(exec, on)`: once per machine (cache in a Map keyed by `on ?? ""`), run
  `sh -c '"${SHELL:-sh}" -lc "printenv PATH"'`. `printenv PATH` is an external command, so it prints the
  colon-joined PATH in fish and csh too. On failure fall back to the app's own PATH.
- `nvimArgv(pathValue, script, ...args)` returns `["sh","-c", 'PATH="$1"; export PATH; shift; ' + script, "sh", pathValue, ...args]`
  with `$1..` inside the script (plain POSIX `sh`, never the login shell's dialect).
- Windows (`window().platform === "windows"`) and no `on`: do not start nvim. A normal click opens the
  read-only preview (today's alt-click path); show the hint "Editing needs nvim on macOS or Linux" once via
  `notify` level "info". Remote machines (`on` set) keep the POSIX path. This is the answer to
  documentation's DOC-1-5: Windows = read-only preview.
- If `nvim` is not found (exit 127) show "nvim not found on PATH" instead of the raw stderr, and fall back to
  the preview.

Verify: unit tests for `nvimArgv` (quotes, spaces, `'` in a file name pass as arguments, not code),
`platformMode("windows")`. `herdr-app check` still passes. Manual (author): fish login shell.

---

## CR-1-5  Vault is assumed present; Vault button and stored panel survive its absence (high, sharing)

Evidence: `bar-strip/main.js:116` shows the Vault button iff the layout has a `vault` node;
`portrait-tabs/main.js:84` appends `"vault"` to `enabled` unconditionally, so a space whose stored panel
is `vault` re-selects a stack child with no working mod; `portrait-tree/main.js:277,304-306` and
`portrait-pane/main.js:49-54` read `shared("vault.panes")[pane]` and do
`note.vault.split("/")` without checking that `note.vault` exists (a malformed record throws in
`render` and blanks the whole tree).

Change:
- `bar-strip` probes once at `init` and every 60 s with `fs.exists(appHome() + "/mods/vault/main.js")`
  (`fs/promises` has `exists`) and publishes the result with `setShared("mods.vault", bool)` only when it
  changes. The button shows iff `shared("mods.vault") === true` AND `find(body, "vault")` (so the optional
  layout snippet from herdr-completeness is still required for the panel itself).
- `portrait-tabs`: `enabled = [..., ...(shared("mods.vault") ? ["vault"] : [])]` and require
  `find(body, "vault")` before selecting it (HC-1-2).
- `portrait-tree`, `portrait-pane`: `note?.vault?.split("/").pop() ?? ""`, `file` string guard; and the
  Obsidian logo is replaced by an own `note.svg` (see CR-1-10).
- Pure `vaultWanted({installed, hasNode})` and `noteParts(note)` in the logic modules, with tests for a
  malformed record (`{}`, `{vault: 1}`, missing file).

Needs: herdr-completeness (layout without vault child, snippet), answered on the board.
Verify: tests above; with `mods/vault` absent the button never renders (`herdr-app check` only covers the
initial description, so the pure helper test carries the logic).

---

## CR-1-6  Double or repeated click on a file starts two nvims and orphans the first (medium, correctness)

Evidence: `portrait-files/main.js:213` `cx.spawn(async (cx) => this.edit(path, cx))` has no guard.
`edit()` overwrites `this.peekFor` (152) on every call. The terminal name is chosen from `terminals()`
(140) which does not yet list the first nvim, so a second click gets the same name `nvim`, `hc run`
refuses duplicate live names (comment 136) and a "Couldn't open nvim" toast appears; if the names differ
(slower second click), the first terminal runs with `--rm --no-parent` and no window or tab (orphan) until
the user finds it. The 10 s timeout branch (181-184) only toasts; it does not kill the terminal it started.

Change: `this.opening` flag set for the whole `edit()` and cleared in `finally`; ignore clicks while
`opening || peekFor`. On the timeout path call `run("terminal.kill", { terminal: want.terminal })`
(command exists: `terminal.kill {terminal}`) before the toast.

Verify: logic test of the small state machine (`openGate()` returns false while pending), manual double
click opens exactly one float.

---

## CR-1-7  Column windowing math crashes on a tiny width and is untestable (medium, edge case)

Evidence: `portrait-tree/main.js:434-458`. `windowed` is true whenever `total > avail`; with zoom 3 and the
bar at its 90 px minimum, `avail = 90/3 - 34 = -4` so an EMPTY `sp` (all spaces closed, or startup before
the list loads) is "windowed" and `widthOf(sp[sp.length - 1])` reads `sp[-1].id`, a TypeError that blanks
the mod. `room` can be negative for the same reason; `fits()` hides it with `Math.max(e, from + 1)`.
The block is 25 lines of index arithmetic inside `render`, which is also where wheel/scroll bugs would
hide.

Change: move to `planColumns({ widths, width, zoom, active, start, folded, MIN, FOLDED, MARKER })` in
`portrait-tree/logic.mjs`, returning `{ windowed, room, start, end, lastStart, wordy, open }`; guard `n === 0`
and clamp `room` to `>= 0`. `render` only maps the result to elements. `wheelSteps(accum, dx, step)` (the
accumulator at 507-517) moves too, and resets the remainder when the direction flips or after 400 ms idle
(today a stale remainder from an earlier swipe makes the next one jump).

Verify: tests: empty list, one list wider than `avail`, active space off-screen follows, all folded,
zoom 0.5/1/3, `wheelSteps` direction flip. Compare outputs with the current inline code on 200 random
inputs before deleting the old block (property test in the same file).

---

## CR-1-8  Git marks and file listing: wrong classification, wrong paths, silent truncation (medium)

Evidence:
- `portrait-files/main.js:94` `xy.includes("A") ? "A" : xy.includes("U") ? "U" ...`: `AA`, `AU`, `UA` are
  conflicts but are shown as added (green "A"); verified in node: `AA->A, AU->A, UA->A`.
- Marks are keyed by absolute path (`top.stdout.trim() + "/" + path`, line 94) and looked up as
  `${this.root}/${path}` (212). `git rev-parse --show-toplevel` returns forward slashes and the resolved
  real path: on Windows (`C:/x` vs `C:\x`) and for a symlinked project folder (macOS `/tmp`, `/var`,
  `~/code -> ...`) the keys never match and no marks are drawn.
- A changed file inside a collapsed folder marks nothing on the folder row.
- `loadFolder` (63) slices to 500 BEFORE sorting, and the shell loop (28) emits entries in glob order
  (`*` then dotfiles) so past 500 entries directories and dotfiles can be dropped although directories
  sort first; the sort uses `localeCompare` without a collator (slow at 5,000 rows).

Change (pure, in `portrait-files/logic.mjs`):
- `markOf(xy)`: conflicts first (`DD AU UD UA DU AA UU` -> "U"), then `??`/`A` -> "A", `D` -> "D", else "M".
- `parseStatus(stdout, prefix)`: use `git rev-parse --show-prefix` instead of `--show-toplevel`, so keys are
  paths relative to the shown root (no absolute paths, no separators problem, no symlink problem); entries
  outside the prefix are ignored.
- `bubble(marks)`: mark every ancestor folder (single "M" colour, or the "highest" mark) so collapsed folders show it.
- `arrange(entries, per, budget)`: sort (dirs first, `Intl.Collator` created once) then slice.
- Shell script: emit directories first by two passes, or just raise the loop cap to 501 after sorting is
  moved to JS (keep the 501 bound; it is the memory guard).

Verify: tests with a realistic `git status -z` string including spaces, a renamed-off entry, `AA`; prefix
`"src/"`; bubble; arrange over 600 mixed entries.

---

## CR-1-9  `~` shortening is macOS-only or separator-blind in four places (medium, portability)

Evidence: `nvim-float/main.js:69` a regex that shortens only the macOS home prefix (a Linux
or Windows home is not shortened); `portrait-tree/main.js:286` `p.cwd.replace(this.home, "~")`
replaces the FIRST occurrence anywhere (with `home() === "/"` it turns `/usr/local` into `~usr/local`;
verified); `portrait-pane/main.js:18-22` only handles `/`; `portrait-tree/main.js:350` and the Files header
(`portrait-files/main.js:231` `split(/[\\/]/)` is fine) mix both.

Change: one pure `tilde(path, home)` per mod folder that needs it (copied, with a test asserting the
copies are identical): normalises `\` to `/` for comparison, case-insensitive for a `X:` drive prefix,
only replaces when `path === home` or `path` starts with `home + sep`, never when `home` is `"/"` or empty.
`nvim-float` uses `home()` from `herdr` (it is a local path; for `on` machines leave the path as is).
HC-1-8 asks for the same.

Verify: tests: mac, linux, windows (mixed separators), `/` home, sibling-prefix (a folder whose name starts with the home folder's name), trailing slash.

---

## CR-1-10  Assets from other mods: 16 icon dependencies on Herdr's shipped files and the Obsidian logo (medium, sharing)

Evidence (file: asset) , all are loaded by path, so a rename in a later Herdr version leaves an empty
icon with no error:
- `mods/workspace-chrome/`: `plus.svg` (portrait-tree 223, 498), `server.svg` (tree 216, bar-strip 108),
  `spinner.svg` (tree 153, tabs 73, pane 72, attention-picker), `chevron-left.svg`/`chevron-right.svg`
  (tree 336), `chevron-down.svg` (nvim-float 72), `search.svg` (bar-strip 107, attention-picker),
  `settings.svg` (bar-strip 110).
- `mods/pane/close.svg` (tabs 75, 93; nvim-float 77): this repo already has `portrait-pane/close.svg`.
- `mods/files/file.svg` (bar-strip 113): this repo already has `portrait-files/file.svg`.
- `mods/changes/changes.svg` (bar-strip 114). The shipped `changes` mod itself is still required (layout panel).
- `mods/vault-reader/obsidian.png` (tree 313, pane 53): Obsidian's logo must not be redistributed (board note
  from herdr-completeness) and depends on an optional mod. `mods/vault/icons/book-open.svg` (bar-strip 116)
  is only drawn when the vault mod is installed (CR-1-5), so it stays.
- The shipped icons are Lucide (`class="lucide lucide-plus"` in the files), ISC licensed; the spinner is Herdr's own.

Change: vendor into the mod folder that uses it and point `svg()` at `mods/<own-mod>/<file>`:
- bar-strip: `search.svg`, `server.svg`, `settings.svg`, `changes.svg`, `file.svg`
- portrait-tree: `plus.svg`, `server.svg`, `spinner.svg`, `chevron-left.svg`, `chevron-right.svg`, `note.svg`
- portrait-tabs: `spinner.svg`, `close.svg`
- portrait-pane: `spinner.svg`, `note.svg`
- nvim-float: `chevron-down.svg`, `close.svg`
(`note.svg` = Lucide `file-text`, from `workspace-chrome/file-text.svg`, replaces the Obsidian logo; the row
keeps the vault's name and folder.) Upstream names for NOTICE (HC-1-7): `workspace-chrome/{plus,server,spinner,
chevron-left,chevron-right,chevron-down,search,settings,file-text}.svg`, `pane/close.svg`, `files/file.svg`,
`changes/changes.svg`. Keep `attention-picker` untouched (its canonical repo vendors its own, see board).

Needs: herdr-completeness (NOTICE: Lucide ISC + Herdr spinner provenance).
Verify: `repo.test.mjs` (CR-1-1) fails on any remaining `mods/workspace-chrome|pane|files|changes/` or
`obsidian.png` reference outside `attention-picker`.

---

## CR-1-11  Agents without a pane, and the tree's per-render cost (medium-low, correctness/perf)

Evidence:
- `portrait-tree/main.js:404-415`: `byPane` is keyed by `a.pane` and the renumbering loop reads
  `byPane.get(a.pane)`. AGENTS.md says sub-agents "belong to their parent's tab without a pane"; if
  `agents()` lists them with a null/empty `pane`, they all collide on one key, share one object, and get
  renumbered wrongly; they also count in the header's `!` / `working` badge but have no row.
  (The type says `pane: string`, so I cannot prove null on the real data; the fix is harmless.)
- `header()` (181) calls `spaces()` once per column and per render; `render` calls `terminals()` (424)
  every time only to find `editor.file` labels, marshalling every core terminal; the 30 s timer (91)
  re-renders even with no agents or while the bar is hidden.

Change: build `named` per agent in a `Map` keyed by `address`; `byPane` only for truthy `pane`; agents
without a pane are listed as extra rows under their tab (`└─`, program icon, name, state) so counts and
rows agree. Pass `sp` into `header()`. Compute `this.files` lazily on the first non-agent terminal pane.
Timer: only `notify` when some agent shows a duration (`Object.keys(this.changed)` intersects live agents).

Verify: tests for `dedupeNames(list)` (same name twice in a tab gets (1)/(2); distinct tabs not; missing pane).

---

## CR-1-12  Persisted state: crash on a corrupt value, unbounded growth (medium-low)

Evidence: `portrait-tree/main.js:77-80` and `portrait-tabs/main.js:17` `JSON.parse(localStorage.getItem(..))`
with no try/catch: one truncated or hand-edited value makes `init` throw on every reload (blank
mod until site data is cleared; AGENTS.md says storage "can come back empty or throw"). `changed`
(94-103) gains an entry for every agent address ever seen and is never pruned (documentation flagged it);
`folded`/`peeked` keep ids of deleted spaces; `panels` in portrait-tabs the same.

Change: `readJson(key, fallback, validate)` + `writeJson` with try/catch in each `logic.mjs` (a `storage`
argument for tests); prune `changed` entries not in the live agent list AND older than 7 days, and
`folded`/`peeked`/`panels` ids not in `spaces()` when the list is non-empty (a transient empty list at
startup must not wipe state).

Verify: tests with a fake storage: corrupt string, wrong shape (`[]` where an object is expected), prune
keeps live and recent, empty live list prunes nothing.

---

## CR-1-13  Bell: hard-coded key hint, stacked pickers, hard-coded picker name (low)

Evidence: `bar-strip/main.js:94-95` tooltips say "ctrl-b a" although keys.json is the user's and is
changing (herdr-completeness is replacing the ctrl-b defaults); `picker()` (43) opens a new dialog on
every key press (a second press stacks a second picker); `"attention-picker"` is a literal (HC-1-9 asks for
a constant because installers rename on a clash).

Change: `const PICKER = "attention-picker"` at the top; the tooltip asks `keys()` (exported by `herdr`) for the
action `bar-strip.attention` in the section `layout:<name>` or `global` and prints that key, or nothing;
remember the overlay id from `openOverlay` and `closeOverlay` it first (wrapped in try/catch; a stale id
must not throw).

Verify: test `keyHint(keys, layoutName)` (pure) with global, layout and unbound cases.

---

## CR-1-14  Small hardening items (low, one commit)

- `portrait-tabs/main.js:88` every wheel event with `|delta.y| >= 1` runs `tab.next/prev`; a trackpad swipe
  with inertia fires dozens. Use the same accumulator as the tree (`wheelSteps`, threshold 40 px).
- `portrait-tabs/main.js:67` `shown[from].id`: guard `shown[from]?.id` (tabs may change between down and up);
  line 80 `settings().zoom` unguarded (`NaN` padding if absent), the tree already uses `Number(..) || 1`.
- `nvim-float/main.js:72-76` registers `on_mouse_down("left")` twice on the Keep button (once via
  `button()`, once chained); pass an optional `onDown` to `button()` instead.
- `portrait-files/main.js:159-164` six blank lines left by an edit, and the `edit()` comments
  (125-128, 136-139) describe a peek and a "↗ keep" button that no longer exist (it is a floating window with
  "Keep"); reword to match (documentation DOC-1-9 asked; the comments are in my files).
- `portrait-tree` ignores `tab.settled` (AGENTS.md: a mod that cares can fold settled tabs): optional, not
  done this round.

Verify: `herdr-app check` for each mod after the edit; static test for duplicate `on_mouse_down("left"` chains is
overkill, review only.

---

## Deferred (not for this round)

- Virtualising the Files rows (`v_virtual_list`): the row builder creates up to 5,000 elements per render
  (`portrait-files/main.js:207-220`), but virtual lists forbid per-row handlers and `on_item_click` does
  not report modifiers, so alt-click-for-preview would need a different gesture. A design decision for
  round 2.
- Moving `nameOf`, `duration` and `clean` into one place: they are duplicated in the bundled
  attention-picker (canonical repo owns it).

## Confirmations asked by other roles

- Hard-coded hex (herdr-completeness): `MARK` (portrait-tree:12) mirrors the shipped spaces list's avatar
  colours on purpose and the letter ink comes from `inkOn` (contrast-computed), so it works on light
  themes. The only theme-dependent hex logic is `t.blocked + "26"` style alpha suffixes, which assume 6-digit
  hex theme values (true for built-in and `themes/*.json`, since those are `#rrggbb`). No change needed.
- Windows click-to-edit: read-only preview plus a one-time info toast (CR-1-4).
- Privacy list for documentation: portrait-tree writes `<appHome>/data/portrait-tree-spines/*.svg` (will be
  pruned, CR-1-3); portrait-files runs `sh`, `git`, `powershell` (Windows), `hc run` (nvim) and `nvim`
  through `sh`; labels the nvim terminal with `editor.file=<full path>`, `editor.socket=<path under /tmp>`,
  `editor.space=<id>`; bar-strip will read `<appHome>/mods/vault/main.js` existence only; no network.
