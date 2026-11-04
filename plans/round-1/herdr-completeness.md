# Round 1 audit: herdr-completeness

Repo state audited: `main` at b4c1673 (single import commit). Prior rounds: none.
References read: AGENTS.md sections "Layouts and mods other people made", "The look", "Keys", mods/`mod.json`,
"Machine/Files" (exec, hc, fs), and the official `herdrdev/herdr-layout-examples` repo (Apache-2.0; layout
folder = `RECIPE.md`, `preview.png`, `layouts/<name>.json`, `mods/<name>/`; mod folder adds optional `keys.json`).
`herdr-app check` passes on all 7 mods today.

## Summary

The code and layouts are in good shape, but the repo is not yet publishable. Missing outright: `RECIPE.md`,
`preview.png`, `LICENSE`, `NOTICE`, CI, any validation/privacy scripts. The biggest functional gaps for "works for any
user" are (a) the Vault button/panel is always on, because both layouts hard-code a `vault` block and `portrait-tabs`
force-enables it; (b) `keys.json` is half macOS-only (`cmd-b`) and half tmux-style `ctrl-b` chords that steal
tmux's prefix from users who run tmux inside a pane; (c) the nvim path assumes `sh`, `/tmp`, a Unix login shell and
nvim, so it silently fails on Windows. A privacy scan of the tree today is clean (no `/Users/<name>`, emails,
hostnames, vault content; the only `/Users/` hit is a generic display regex in `nvim-float`). The one residual
item is commit metadata: the author is a GitHub `users.noreply.github.com` address (acceptable, noted in HC-1-12).

Decisions taken (unattended, with reasons):
- Theme: ship NO theme and set NO root `theme` in the layouts, so the user's settings.json theme applies (AGENTS.md:
  "a layout without a theme shows settings.json's theme"). Vesper is a third-party theme and the layout only uses
  theme color tokens (`canvas`, `chrome`, `border`, `accent`, `background`); do not bundle it.
- Disclosure: no network use anywhere (`fetch` is not called). `exec`/`hc` and out-of-folder file access are
  disclosed in RECIPE "Built from"/"Watch out" (list in HC-1-1).
- Vault: the layouts stop containing the vault block; the optional vault panel is a documented snippet (HC-1-2).
- Do not add the `herdr-layout` topic; the publish checklist lists it (HC-1-12).

## Findings (ordered by impact)

### HC-1-1  No RECIPE.md (high) - owner: herdr-completeness
Evidence: `git ls-files` has no RECIPE.md; AGENTS.md:418-450 requires it with six sections in this order.
Change: write `RECIPE.md` from the real files, sections exactly: `# Portrait` + paragraph + `![Portrait](preview.png)`;
**What you see** (tabs strip 42px at top of the work column; work body with panes: radius 10, gap 8, border 1px
`border`, focus 1px `accent`, header 30px; bar column 246px `chrome` with 26px strip then the space-column tree; status
28px; hidden right panel 368px, min 280, max 1600 with Files/Changes stack; bottom variant puts the bar left of the
work area and moves nothing else); **How it behaves** (every agent status: working spinner `workspace-chrome/spinner.svg`
at 12px `working` color, blocked "!" chip / "Needs you" chip with `blocked` +26 alpha, done, idle; click/hover/wheel
behaviours of tabs, tree, folded spines `FOLDED_COL` 34, bell click vs shift-click, `bar-strip.attention` command,
Files click opens nvim in nvim-float; shared state `agents.since`, `workspace.panels`, `vault.panes`); **Built from**
(node tree with ids `root/left/work/tabs/work-body/main/bar/bar-strip/tree/status/panel/panel-body`, every mod and its
`props` role, shipped mods used: `workspace-status`, `changes`, `picker`, `machine-add`, `new-menu`; assets read from
shipped mods; commands `layout.toggle:bar`, `layout.switch:*`, `tab.close`, `window.*`, `mod.open`, `app.settings`,
`agent.focus`; `herdr` functions used); **Watch out**; **Done when** (see below).
Disclosure block, required, listed in Built from and Watch out:
- Network: none.
- Runs programs: `git` (portrait-files: `rev-parse`, `status`), `sh -c` (directory listing, nvim launch), `powershell`
  (Windows listing), `nvim` via the login shell (`$SHELL -lc`), `hc run/read/label` (portrait-files, attention-picker).
- Reads outside its folder: the open folder trees via `exec`/`readTextFile` (portrait-files), terminal text via
  `hc read` (attention-picker), shared state (`agents.since`, `workspace.panels`, `vault.panes`).
- Writes outside its folder: `<appHome>/data/portrait-tree-spines/*.svg` (portrait-tree), nvim socket under `/tmp` (portrait-files).
Verify: CI step `scripts/check-recipe.mjs` asserts the six `##`/`**` headings in order, `![..](preview.png)`, every `layouts/*.json`
filename and every `mods/*` folder is mentioned, and no `/Users/` text. Manual: an agent with an empty folder can rebuild the tree.

### HC-1-2  Vault block hard-coded: Vault button/panel always shown without the vault mods (high) - owners: herdr-completeness (layouts), code-review (.js)
Evidence: `layouts/portrait.json` and `portrait-bottom.json` end `panel-body` with `{"id":"vault","content":{"mod":"vault"}}`;
`mods/bar-strip/main.js:116` shows the Vault button when `find(body,"vault")` exists, so it is always on;
`mods/portrait-tabs/main.js:84` appends `"vault"` to `enabled` unconditionally, so `syncPanel` tries to open a mod that
is not installed. `herdr-app check` cannot see this.
Change (layouts): remove the `vault` child from `panel-body` in both layouts. Add `snippets/vault-panel.json`
(one stack child) and a RECIPE "Optional: Vault" paragraph telling the user to insert it when `mods/vault` and
`mods/vault-reader` (herdr-obsidian-vault) are installed; the bar button then appears by itself via the existing `find()`.
Change (code-review): in `portrait-tabs` make `"vault"` conditional on `find(body,"vault")` (same test as bar-strip);
confirm `portrait-tree`/`portrait-pane` note rows only run when `p.mod === "vault-reader"` (they do, lines 277/49) and that
`image("mods/vault-reader/obsidian.png")` is never reached otherwise.
Verify: new CI check `scripts/validate.mjs` fails if a layout references a `mod` that is neither in `mods/` nor on the
shipped-mod allowlist (`scripts/shipped-mods.json`); a test (code-review) renders tabs/strip with a fake `find()` lacking vault.
Coordination: asked herdr-obsidian-vault's board to publish the same snippet there (see board).

### HC-1-3  keys.json: macOS-only key and tmux-prefix chords that break other users' terminals (high) - owner: herdr-completeness
Evidence: `keys.json:6,10` `cmd-b` (no meaning on Linux/Windows); `ctrl-b a`, `ctrl-b b`, `ctrl-b shift-b` make `ctrl-b` a
prefix globally, so tmux/vim users lose `ctrl-b` inside terminals; section names `layout:portrait`/`layout:portrait-bottom`
silently stop working if an installer renames a layout on a name clash (AGENTS.md:427-430). Herdr's own default for the sidebar
is `ctrl-shift-b` off macOS.
Change: rewrite keys.json as: `global`: `ctrl-shift-a` -> `bar-strip.attention` (bell list); `layout:portrait` and
`layout:portrait-bottom`: `ctrl-shift-b` and `cmd-b` -> `layout.toggle:bar`, `ctrl-shift-y` -> `layout.switch:<other>` (final
letters to be checked against `herdr-app commands`/shipped defaults for free keys in the verify step; if none is clearly free,
use `alt-` combos only on Windows/Linux and say so). Keep the author's `ctrl-b ...` chords out of the repo; document them in the
README as an optional tmux-style set. Add a keys block per OS to RECIPE "Watch out" (cmd = macOS, ctrl-shift = Linux/Windows) and
a one-liner on renaming sections when a layout is renamed.
Verify: `scripts/validate.mjs` parses keys.json, checks each action is `<mod>.<command>`, `name[:value]` with a known command from
`scripts/commands.json` (snapshot of `herdr-app commands`), flags duplicate chords across sections, and flags any `ctrl-<letter>`
in the program-reserved list from AGENTS.md (c d l r w a e u k z [). Manual: on Linux and Windows the bar toggles without cmd.

### HC-1-4  No LICENSE or NOTICE (high) - owner: herdr-completeness
Evidence: no LICENSE/NOTICE in tree. Four mods are verbatim clones of Herdr 0.1.12 mods (`cloned_from` in portrait-tabs, portrait-pane,
portrait-files, layouts) and several SVGs are copies of shipped art; herdrdev repos are Apache-2.0 (`gh api orgs/herdrdev/repos`).
Change: add `LICENSE` (Apache-2.0 full text, `Copyright 2026 <author name from git config>`) and `NOTICE` listing: derivative files
(`mods/portrait-tabs`, `portrait-pane`, `portrait-files` and their SVGs, `layouts/*.json` cloned from `main` 0.1.12) as modified
copies of Herdr (Apache-2.0, herdrdev) with a statement of changes; `mods/attention-picker` bundled from herdr-agents-waiting
(same author); a line that shipped-mod assets referenced by path (workspace-chrome, pane, files, changes icons) belong to Herdr and are
not redistributed (or, if HC-1-7 vendors them, listed with their upstream icon-set license after verifying provenance). Add
`SPDX-License-Identifier: Apache-2.0` comment? Not in JSON; only in the .js header lines (code-review adds) - optional.
Verify: CI step asserts LICENSE starts with `Apache License` and contains the copyright line, NOTICE exists and names every
mod listed in `cloned_from`. Manual: `gh api repos/miguelalexanderdiaz/herdr-portrait-layout/license` reports Apache-2.0 after push.

### HC-1-5  No CI, no validation or privacy scripts (high) - owner: herdr-completeness (code-review supplies tests)
Evidence: no `.github/`, no `scripts/`, no tests dir.
Change: add dependency-free Node scripts (Node 20+, run the same on all three OS, no shell-isms):
- `scripts/validate.mjs`: all `*.json` parse; layout tree rules (unique ids, `size` shapes, every `content.mod` resolvable per HC-1-2,
  ids the code looks up exist: `panel`, `panel-body`, `bar`, extracted from `find(` calls and `layout.toggle:` actions);
  portrait-bottom is portrait with `left.children` reordered (so the variants cannot drift); mod.json keys limited to
  `place,title,overlay,focusable,size,cloned_from`; every `svg("mods/<x>/...")`/`image(...)` path in .js exists in repo or on the shipped
  allowlist; every mod has `main.js` + `mod.json`; no `gpui-kit.d.ts`/`jsconfig.json` committed in mods.
- `scripts/privacy-scan.mjs`: fails on `/Users/<name>`, `/home/<name>`, `C:\Users\<name>`, emails (except `noreply@anthropic.com` in commit
  trailers, which are not in files), `ghp_`/`github_pat_`/`sk-` tokens, private IPv4 and `*.local` hosts, and an optional local
  `.privacy-denylist` (gitignored, one term per line, for the author's own names) plus the repo secret `PRIVACY_DENYLIST` in CI; allowlist
  LICENSE copyright line and the generic regex in `nvim-float` (code-review should replace it, HC-1-9). Scans all tracked text files and, in CI,
  `git log --format=%B` bodies.
- `scripts/check-recipe.mjs` (HC-1-1), `scripts/check-assets.mjs` (preview is a real PNG at least 800px wide; SVGs well-formed).
- `.github/workflows/ci.yml`: matrix `ubuntu-latest, windows-latest, macos-latest`, `actions/checkout@v4`, `actions/setup-node@v4` (node 20), steps
  `node scripts/validate.mjs`, `node scripts/privacy-scan.mjs`, `node --test` (tests from code-review under `test/`), triggers push + pull_request, `permissions: contents: read`.
Verify: run all scripts locally on macOS now (must pass), then push a branch and read the three matrix legs with `gh run list/watch`.
Ask to code-review: tests in `test/*.test.mjs` for the pure helpers (`rgb/hex/inkOn`, `spineFile`, `spineSvg`, `agentTitle`) by extracting them to a
`mods/<x>/lib.js` without gpui imports, or tests that import only the helper functions; Windows-safe paths.

### HC-1-6  No preview.png (high) - owner: herdr-completeness
Evidence: none in tree; herdr.dev listing needs it (AGENTS.md:418, 441). Rule 2 forbids screenshotting the author's running app, and a
screenshot would show the author's real spaces and notes.
Change: produce a synthetic, privacy-safe `preview.png` (portrait, e.g. 1080x1920, shown scaled) from a hand-written SVG mock of the layout
with invented content ("api", "web", "docs" spaces, generic tab and agent names), rendered by `scripts/make-preview.mjs`. The generator uses
only `rsvg-convert`/`sips` when present and otherwise keeps the committed PNG; the committed PNG is the deliverable. Colors use the default
Herdr `graphite` theme values (read from the shipped theme at design time, hard-coded in the SVG) so it matches what a new user sees.
Also add `layouts/portrait.svg` and `layouts/portrait-bottom.svg` (small thumbnails like `win98.svg`) and the root field
`"preview": "layouts/portrait.svg"` in each layout so Settings shows a picture (AGENTS.md:260). Open point: if the installer copies only the
`.json`, the field is harmless (plain frame).
Verify: HC-1-5 asset check (PNG header, size); RECIPE embeds it; view the PNG with Read before committing; no text from the author's setup.

### HC-1-7  Layout depends on shipped-mod files that Herdr may rename or replace (medium) - owners: code-review (js paths), herdr-completeness (NOTICE/RECIPE)
Evidence: JS loads `mods/workspace-chrome/{spinner,search,server,settings,plus,chevron-left,chevron-right,chevron-down}.svg`,
`mods/pane/close.svg`, `mods/files/file.svg`, `mods/changes/changes.svg`, and `mods/vault/icons/book-open.svg`
(bar-strip:107-116, portrait-tree:153/216/223/336/498, portrait-tabs:73/87-93, portrait-pane:72, nvim-float:72/77). AGENTS.md says Herdr's
own mods are "replaced whole" on update; reading them is legal on the current version but a rename breaks icons silently.
Decision: vendor the ~11 small icons into this repo (one `mods/portrait-tree/icons/` is wrong because mods are copied independently: each
mod gets the SVGs it uses, as `portrait-files` already does with chevrons/file/folder). Cost is tiny (<5KB) and removes the compatibility
assumption; the vault icon stays a reference (optional mod). Keep `workspace-status`, `changes`, `picker`, `machine-add`, `new-menu`
as the only shipped mods referenced by name, and list them with the minimum Herdr version (0.1.12) in RECIPE.
Change: code-review edits the `svg(...)` paths and adds the files; completeness records provenance and license in NOTICE (HC-1-4) and keeps
`scripts/shipped-mods.json` (the allowlist) down to those five names.
Verify: HC-1-5 asset check (all referenced paths resolve inside the repo, except the allowlist).

### HC-1-8  Cross-platform: the editor path only works on macOS/Linux (medium) - owner: code-review (+ completeness for RECIPE/CI)
Evidence: `portrait-files/main.js:133-148` `sh -c exec "${SHELL:-sh}" -lc ...`, socket `/tmp/herdr-nvim-*.sock`; `nvim-float/main.js:22` same
wrapper, `:69` display regex `^/Users/` only; `portrait-tree/main.js:350-352` writes SVGs with `path.slice(0, lastIndexOf("/"))` (breaks if
`appHome()` returns backslashes); comment "the app's own PATH lacks Homebrew" is macOS-specific. On Windows `sh`/`/tmp` do not exist and nvim
may be absent; on any OS a missing `nvim` yields only a toast.
Change (code-review): (1) when `window().platform === "windows"` or `nvim` is not found, fall back to `terminal.open` with `$EDITOR` or just
show the toast text "install nvim or set an editor" (decision: no per-user config file; use `settings()`-independent detection); (2) socket
under `appHome()` + `/data/` (portable, no /tmp) or use `os`-neutral name; (3) separator-agnostic dirname in portrait-tree; (4) `~`
collapse via `home()` instead of `/Users/` regex. Completeness: RECIPE "Watch out" lists the editor assumption; CI matrix runs the pure-helper tests on
Windows to catch separator bugs.
Verify: `node --test` green on three OS; reading the diff shows no `/tmp` or `/Users`; `herdr-app check`.

### HC-1-9  Bundled mod and generic names collide with a user's existing setup (medium) - owners: herdr-completeness (RECIPE/NOTICE), code-review (bar-strip)
Evidence: `mods/attention-picker` is a bundled copy of another repo; `bar-strip` opens `{mod:"attention-picker"}` by name (main.js:44), `keys.json`
refers to `bar-strip.attention`; layout files are `portrait`/`portrait-bottom` (likely taken by users: the author's own home has `portrait-top`); layout ids
`bar`, `panel`, `panel-body` are referenced by code and by `layout.toggle:bar`. AGENTS.md:427 says installers rename on a clash, which would break the
`mod` name in bar-strip and the keys sections.
Change: RECIPE "Watch out" states which names are load-bearing (a rename list: mod names used in JS strings, keys section names, layout ids) and says
"if you already have attention-picker (herdr-agents-waiting), keep yours". Ask code-review to read the attention-picker mod name from one constant
in bar-strip. Do not rename the files in this round (published URLs/slug not yet fixed; revisit in round 2).
Verify: `scripts/validate.mjs` extracts the load-bearing names and fails if they disappear from layouts/keys.

### HC-1-10  Optional vs required pieces are not declared; mod.json is uneven (low) - owner: herdr-completeness
Evidence: `mods/portrait-files/mod.json` has no `title` (all others do); `nvim-float` is not a layout mod but has `place: none` (correct, opened through
`openOverlay`); no field tells an installer which mods are needed. Official examples use only `place`, `title`, `overlay`, `size`, `focusable`.
Change: add `"title": "Files (portrait)"`; keep `cloned_from`; do not invent new fields (unknown keys might be rejected, validate.mjs enforces the known set). Declare
required/optional in RECIPE: required = portrait-tree, bar-strip, portrait-tabs, portrait-pane, attention-picker; optional-but-wired = portrait-files + nvim-float (needs
nvim), Vault (HC-1-2).
Verify: `herdr-app check` on every mod; validate.mjs mod.json key whitelist.

### HC-1-11  .gitignore too thin (low) - owner: herdr-completeness
Evidence: `.gitignore` = `gpui-kit.d.ts, jsconfig.json, .DS_Store, node_modules/`.
Change: add `Thumbs.db`, `desktop.ini`, `*.log`, `.env*`, `*.swp`, `.idea/`, `.vscode/`, `.privacy-denylist`, `herdr-shot*.png`, `*.corrupt-*`, `.wt/`, and `data/` (spines are
written under appHome, but a developer symlinking the repo as a home could create it). Keep `gpui-kit.d.ts` and `jsconfig.json` ignored (the app writes them into mods). Do not ignore `plans/`.
Verify: `git status` clean after a local `herdr-app check`; validate.mjs rejects tracked `gpui-kit.d.ts`.

### HC-1-12  Publish checklist and residual privacy items (low) - owner: herdr-completeness
Evidence: commit author `<author> <...@users.noreply.github.com>` (GitHub noreply, acceptable); repo is private; topics must not be added by agents.
Change: keep a publish checklist at `scripts/PUBLISH.md` (completeness-owned, not part of the Pages site). Items: add topic `herdr-layout`
(the repo is a layout that also contains mods, so one topic; if the herdr.dev mods list should show the mods, publish them from a separate repo later), set visibility public,
enable Pages (documentation), confirm preview.png renders on GitHub, run privacy scan with the author's `.privacy-denylist`, confirm CI green on all three OS, tag `v0.1.0`.
Open question for the author (not blocking): should the repo's two layouts also appear at herdr.dev/layouts as one entry (RECIPE covers both) or one per layout.
Verify: checklist file ticked at publish time.

## Hand-offs (also on the board)
- code-review: HC-1-2 (portrait-tabs vault guard), HC-1-5 (testable helpers, `test/`), HC-1-7 (vendored icon paths), HC-1-8 (portability), HC-1-9 (constant for attention-picker name).
- documentation: README/docs must not duplicate RECIPE sections; document per-OS keys and the optional tmux-style chords; link the disclosure list; a Pages site must not embed
  anything from the author's setup; docs for the vault snippet.
