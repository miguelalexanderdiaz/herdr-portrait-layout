# Round 1, code-review: apply log

Branch `feat/round-1-share-ready--code-review`. Tasks CR-1-1 to CR-1-14 of `PLAN.md`, in the order
1, 5, 10, 2, 3, 4, 9, 6, 8, 12, 13, 7, 11, 14. Everything was done except the items under "Deferred".
`mods/attention-picker` was not touched.

## Checks run (all green at the last commit)

| Check | Result |
|-------|--------|
| `node --test` (see "Test command" below) | 73 tests, 0 failures (node 26; written for Node 18+ with no dependencies) |
| `herdr-app check <folder>` for all 7 mods and the bundled picker | all "check passed" |
| Negative test: rename `mods/bar-strip/search.svg` | `repo.test.mjs` fails ("draws mods/bar-strip/search.svg, which does not exist"); renamed back |
| Negative test: remove `mods/portrait-files/chevron-down.svg` (template path) | `repo.test.mjs` fails; restored |
| `rg 'peeked over\|↗ keep' mods` | empty |
| `rg 'mods/(workspace-chrome\|pane\|files\|changes)/\|obsidian\.png' mods --glob '!attention-picker/**'` | empty |
| Folder listing shell script run in a real `sh` (folders, dotfiles, `..odd`, dangling link, a name with a space) | folders first, all entries listed |
| `portrait-tree` render with a stub host: 0, 90, 300, 900, 1500 px wide, zoom 3 with no spaces, malformed `vault.panes` record, agents with `pane: null` and `pane: ""` | no throw |

Not verified (rule 2, no running app): how it looks and feels, fish/zsh login shells for the nvim click, Linux and
Windows runs. They stay on the author's manual list.

### Test command (differs from PLAN D1)

`node --test tests/` does NOT work on current Node: from Node 22 a positional argument is a glob/file, not a
folder, and it fails with `Cannot find module '.../tests'` (verified on node 26). Use plain:

    node --test

It finds `tests/*.test.mjs` on Node 18, 20, 22 and later, on all three operating systems (it also needs no
quoting, unlike a glob). CI and CONTRIBUTING should say `node --test`. (Posted on the board.)

## What was done, by task

- **CR-1-1** `mods/{portrait-tree,portrait-files,bar-strip,portrait-tabs,portrait-pane,nvim-float}/logic.mjs`
  (no gpui-kit, no herdr, no node imports). `herdr-app check` accepts `import ... from "./logic.mjs"`.
  Tests: `tests/tree.test.mjs`, `files.test.mjs`, `bar-strip.test.mjs`, `tabs.test.mjs`, `shared.test.mjs`,
  `repo.test.mjs`, `smoke.test.mjs`. `smoke.test.mjs` loads each `main.js` with stand-ins for `gpui-kit`/`herdr`
  and runs `init()` and `render()` in several situations (it caught nothing wrong in the end, but it is the only
  thing that exercises the render paths outside the app). Note that Herdr's script engine has **no `Intl`**;
  found because `herdr-app check` failed on a `new Intl.Collator()`; `arrange` falls back to `localeCompare`.
- **CR-1-5** Vault gating. `bar-strip` probes `<appHome>/mods/vault/main.js` with `fs.exists` at start and every
  60 s and publishes shared `mods.vault` only when it changes. The Vault button shows iff `mods.vault === true`
  AND the layout has a `vault` node (`vaultWanted`). `portrait-tabs` adds `vault` to the panels a space may
  remember under the same rule (`enabledPanels`), so a stored "vault" choice is never restored without it.
  `portrait-tree` and `portrait-pane` read vault notes through `noteParts` (never throws on `{}`, `{vault: 1}`,
  a missing file or a non-object).
- **CR-1-10** Icons vendored per mod (list below); the Obsidian logo is gone, replaced by `note.svg`.
- **CR-1-2** `portrait-files` works only while the panel is on screen (`filesVisible`: layout node `panel` not
  hidden and `panel-body.active === "files"`; a layout without those nodes counts as visible). No timer refresh,
  no `git`/`sh`, no watch while closed; opening the panel runs one refresh. Watches: one loop per root
  (`this.watching`), none for the home folder or a drive/filesystem root (`watchable`), loops end when the
  panel closes or the root changes. `git status` is limited to the shown folder (`-- .`).
- **CR-1-3** Spine files. `createSpineStore`: a failed write is not retried for 60 s and triggers no redraw (no
  render loop); `prune` deletes `*.svg` spines of spaces that no longer exist once after the first non-empty
  space list; XML-forbidden control characters are dropped; font stack has Segoe UI and Arial; the path is built
  with the separator of `appHome()` (`joinPath`).
- **CR-1-4** Portable nvim launch. The login shell's PATH is read once per machine with `printenv PATH` (also
  works in fish), then everything runs in plain `sh` with the file as an argument (`nvimArgv`). Windows with no
  `on` machine: read-only preview and a one-time info toast. nvim not on PATH: toast "nvim not found on PATH" and
  the preview. The helper block is identical in `portrait-files` and `nvim-float` (`shared.test.mjs`).
  The socket stays under `/tmp` on POSIX (D7).
- **CR-1-9** One `tilde(path, home)` (macOS, Linux, Windows with mixed separators, drive letter case, `/` home,
  sibling prefix, trailing slash) in tree, pane and nvim-float (identical copies). `nvim-float` no longer
  assumes a macOS home folder.
- **CR-1-6** One editor per click: `createGate` stays shut from the click until the window is up, failed, or 30 s
  passed. On the 10 s peek timeout the terminal is ended with `terminal.kill`. The 10 s timer also calls
  `peekWhenReady`, so the timeout fires even if nothing re-renders.
- **CR-1-8** Git marks: `markOf` (AA, AU, UA, DD, ... are conflicts), `parseStatus` with `--show-prefix` (paths
  relative to the shown folder, no absolute paths, works with symlinks and Windows drive letters), `bubble` (a
  folder shows a dot, in the colour of its worst child), `arrange` (sort, then cut). The folder listing script
  does folders first, so the 501-entry cap can no longer drop a folder.
- **CR-1-12** Persisted state: `readJson` with validators (corrupt or wrong-shaped values fall back), storage
  wrapped in `safeStorage`; `changed` drops entries of dead agents once 7 days old, `folded`/`peeked`/`panels`
  drop ids of spaces that are gone; nothing is pruned against an empty live list.
- **CR-1-13** Bell: tooltip prints the real key from `keys()` (`keyHint`: layout section wins over global; an
  unbound action prints nothing); an open picker is closed before a new one opens; `PICKER` constant.
- **CR-1-7** `planColumns` and `wheelSteps` extracted. Property test against the old inline code on 400 random
  inputs agrees; the old crash (empty list, zoom 3, 90 px bar) is a test. `room` is never negative.
- **CR-1-11** (reduced, D13) agents keyed by address (`dedupeNames`), `byPane` only for a truthy pane,
  `header(…, sp)` takes the space list, `terminals()` is read lazily (only for a plain terminal row), the 30 s
  timer redraws only when there are agents.
- **CR-1-14** Tabs wheel accumulates (`wheelSteps`, 40 px per tab, at most 3 per event); `shown[from]?.id`
  guard; `Number(settings().zoom) || 1`; the duplicate `on_mouse_down("left")` on the Keep button is gone
  (`button()` takes `onDown`); blank lines and the stale peek/"↗ keep" comments in `portrait-files` rewritten.

Also fixed on the way: `nameOf` took a shell title such as `~/code/app` for an agent name, because `clean()`
strips the leading `~/` before the path check; the check now also looks at the raw title.

## Behaviour changes users and docs must know

- Files panel: nothing runs while it is closed; a git mark on a changed file inside a closed folder now shows as a
  dot on the folder; conflicts show "U" (red), not "A".
- Click a file: one nvim only, even on a double click. Windows: read-only preview + one toast per session. nvim
  missing: toast + preview. The terminal started by a timed-out click is ended.
- Vault: button, remembered panel choice and note rows need the vault mod installed AND the layout's `vault`
  node. Shared key `mods.vault` (boolean) is new and published by bar-strip.
- Tooltip of the bell prints the bound key (or none). A second key press replaces an open picker.
- Tabs bar wheel needs 40 px of scroll per tab (a smooth trackpad swipe moves several tabs, one notch of a
  mouse wheel may need a second notch): **manual check by the author**; the constant is `WHEEL_STEP` in
  `portrait-tabs/logic.mjs`.
- Spine files: pruned after the first render; a write that fails is retried at most once a minute.
- Persisted state (`localStorage`) is validated and pruned; a corrupt value no longer blanks a mod.

## Disclosure list (for RECIPE and docs; all true at this commit)

- No network access in any mod.
- Processes started: `git` (rev-parse, status), `sh` (folder listing, nvim launch, `printenv PATH` through the
  login shell), `powershell` (folder listing on Windows only), `hc` (run nvim), `nvim`.
- Files written: `<appHome>/data/portrait-tree-spines/*.svg` (pruned); `/tmp/herdr-nvim-<id>.sock` is created by
  nvim itself (POSIX). Files read: the shown folder, `<appHome>/mods/vault/main.js` (existence only).
- Terminal labels set on the nvim terminal: `editor.file=<full path>`, `editor.socket=<path under /tmp>`,
  `editor.space=<id>`. Terminal text is not read by these mods (the bundled attention-picker runs `hc read`).
- Storage: `localStorage` keys `folded`, `peeked`, `changed` (portrait-tree) and `panels` (portrait-tabs).
  Shared keys written: `agents.since`, `mods.vault`. Read: `space.colors`, `workspace.panels`, `vault.panes`,
  `layout`.

## Final asset list per mod (own files only; `mod.json` belongs to completeness)

| Mod | SVG files in the folder |
|-----|-------------------------|
| bar-strip | bell, changes\*, file\*, search\*, server\*, settings\* |
| portrait-tree | chevron-left\*, chevron-right\*, fold, note\*, plus\*, server\*, spinner\*, unfold |
| portrait-tabs | close\*, spinner\*, win-close, win-max, win-min, win-restore |
| portrait-pane | close, note\*, spinner\*, split-down, split-right, unzoom, zoom |
| portrait-files | chevron-down, chevron-right, file, folder |
| nvim-float | chevron-down\*, close\* |

\* copied in this round from Herdr's shipped mods. Upstream names (for NOTICE):
`workspace-chrome/{plus,server,spinner,chevron-left,chevron-right,chevron-down,search,settings,file-text}.svg`
(`file-text` became `portrait-tree/note.svg` and `portrait-pane/note.svg`), `pane/close.svg` (copied to
`portrait-tabs/close.svg` and `nvim-float/close.svg`; `portrait-pane/close.svg` was already in the repo),
`files/file.svg` (to `bar-strip/file.svg`), `changes/changes.svg` (to `bar-strip/changes.svg`).
**Correction for NOTICE**: only `settings.svg`, `plus.svg`, `chevron-right.svg` and `chevron-down.svg` carry the
`lucide` class marker. `search`, `server`, `chevron-left`, `file-text`, `close`, `file`, `changes` and `spinner`
do not, so do not call them all Lucide; record them as "from Herdr's shipped mods" (Apache-2.0) unless
completeness can match them to Lucide by shape.
The only reference left to another mod's file is `mods/vault/icons/book-open.svg`, drawn only when the vault
mod is installed (allowlisted in `repo.test.mjs`).
Other repos: nothing in these mods reads `mods/vault-reader/obsidian.png` any more.

## Deferred (and why)

- Rows for agents without a pane (rest of CR-1-11): D13, needs real data.
- Virtualised Files list, `tab.settled` folding, sharing `nameOf`/`duration`/`clean` with attention-picker.
- Dirs-first ordering in the Windows PowerShell listing: the 501 cut still happens in directory order there. I
  could not test PowerShell here, so I left it rather than ship untested code.
- Pruning `folded`/`peeked`/`panels` could drop the state of a remote machine's spaces if the app lists only the
  local ones for a moment at startup (the empty-list guard does not cover a partial list). Accepted for now.
- Nothing in `attention-picker`; see the board for notes to the canonical repo.

## Handoffs for round 2

- Completeness: CI should call `node --test`; NOTICE wording per the correction above; `RECIPE` disclosure
  from the list above.
- Documentation: use the "Behaviour changes" and "Disclosure" sections; the Files marks letters are A (new),
  M, D, U; folders show a dot.
- The author: manual items (looks, fish login shell click, tab wheel feel, Windows/Linux runs).
- Next round candidates: PowerShell dirs first, a unit test for the `hc run` argument list, `tab.settled`,
  `agents without a pane` once real data is seen.
