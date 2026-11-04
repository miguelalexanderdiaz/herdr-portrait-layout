# Round 1 audit: documentation

Role: documentation. Owns README.md, docs/**, AGENTS.md, llms.txt, CHANGELOG.md, CONTRIBUTING.md.
Audited at commit b4c1673 (single import commit). Read: every file under mods/, layouts/*.json, keys.json,
.gitignore, plus ~/.config/herdr-app AGENTS.md (layout, keys, "Layouts and mods other people made",
mods, exec/hc/file sections). `herdr-app check` passes for all 7 mods (baseline).

## Summary

The repo has no prose at all: no README, docs, AGENTS.md, llms.txt, CHANGELOG, CONTRIBUTING, RECIPE.md,
preview.png or LICENSE. The code is the only documentation, and several of its comments are stale.
Everything below is derived from the source (file:line), not from memory of how the author uses it.

Facts the docs must state (verified in source):
- Layout: root row = left column [bar (a 246 px TALL strip: bar-strip 26 px + portrait-tree), work (tabs 42 px +
  panes), workspace-status 28 px] + right `panel` (368 px wide, hidden by default, stack files/changes/vault).
  portrait-bottom is the same with the bar between work and status. It uses the system title bar
  (no `titlebar: none`), so the window-button code in portrait-tabs only draws on platforms without them.
- No mod in this repo calls `fetch`, opens a socket or touches the network (rg over mods/: no match).
- Side effects (see DOC-1-4): exec sh / powershell / git / nvim (login shell), `hc run`, `hc read`, readTextFile,
  watchFolder, a file written under <herdr home>/data/, localStorage, shared keys `agents.since` and `attention.sort`.
- Herdr home is `~/.config/herdr-app` (`HERDR_APP_HOME` overrides) per `herdr-app --help`; docs must say
  "the Herdr home folder", never an absolute user path.

Decisions taken (unattended):
- The clone/install URLs necessarily contain the GitHub owner (`miguelalexanderdiaz/herdr-portrait-layout`);
  that is a repo address, not leaked personal data, so it appears in README/AGENTS.md install lines only.
  Everywhere else docs use `<home>`, `~`, "the author", generic examples. Round lead: veto if you disagree.
- Docs state only what is verified: "developed on macOS". Linux/Windows are described as "expected to
  work for X, not for Y" with the exact code reason, until herdr-completeness reports a real test.
- Enabling GitHub Pages (main /docs) is a repo setting I may not change: it is a manual author step,
  and Pages on a private repo needs a paid plan. docs/ is built so it works the day the repo goes public.

## Findings (ordered by impact)

### DOC-1-1  [high] No README: first-contact page is missing
- Evidence: `git ls-files` has no README.md; repo root holds only keys.json, layouts/, mods/.
- Change: write README.md with: one-paragraph pitch (portrait monitors: spaces as columns on a strip, tab/pane
  tree, side panel); `![Portrait layout](preview.png)` (file owned by herdr-completeness, README links it, and a
  missing-image check is part of verify); "What you get" (layouts portrait and portrait-bottom, the 7 mods, one line each);
  Requirements (Herdr app 0.1.12 or newer; git for change marks; nvim optional for click-to-edit; OS matrix from DOC-1-5);
  Install by agent (paste: "install https://github.com/miguelalexanderdiaz/herdr-portrait-layout") and by hand
  (copy layouts/*.json to `<home>/layouts/`, mods/* to `<home>/mods/`, merge keys.json, `herdr-app check` each mod,
  `herdr-app do layout.switch --name portrait`); Keys table; Privacy summary linking docs/privacy; Troubleshooting top 5;
  Uninstall (delete the copied files, the `data/portrait-tree-spines/` folder, remove the keys, `layout.switch` back; the
  escape hatch ctrl-alt-shift-escape); Credits/relationship to herdr-agents-waiting and herdr-obsidian-vault; License pointer.
- Owner of touched files: documentation (README.md); herdr-completeness (preview.png, LICENSE, RECIPE.md link targets).
- Verify: `rg -n '/Users/|@[a-z0-9.-]+\.' README.md` empty; every relative link resolves (node one-liner over md links);
  every command in "by hand" executed against a scratch HERDR_APP_HOME copy by the completeness role or reasoned from AGENTS.md.

### DOC-1-2  [high] GitHub Pages site under docs/
- Evidence: no docs/ folder. Spec: plain HTML+CSS, `.nojekyll`, no CDN/trackers, light+dark, mobile, accessible.
- Change: docs/.nojekyll, docs/assets/site.css (CSS variables, `prefers-color-scheme` dark, `max-width` reading column,
  16px gutters, visible focus rings, `skip to content` link, contrast >= 4.5:1, no web fonts: system stack), pages
  index.html (overview + screenshot copy at docs/assets/preview.png), install.html, usage.html, configuration.html
  (theme, sizes, keys, panels), how-it-works.html, privacy.html, troubleshooting.html, platforms.html, for-agents.html
  (rendered AGENTS.md summary + llms.txt link), 404.html. Shared header/nav repeated by hand (no build step: nothing to
  install, nothing to drift). Every page: `<html lang>`, one `<h1>`, landmark `<main>/<nav>`, alt text on images.
  docs/llms.txt is a copy served at the Pages root of the site; root llms.txt stays canonical (a one-line check script
  compares them).
- Owner of touched files: documentation; `.github/` (a Pages workflow is NOT needed for main /docs, so none requested).
- Verify: `python3 -m http.server -d docs` + node script that crawls internal links/ids; `rg -n 'https?://' docs`
  only lists github.com / herdr.dev links (no CDNs); axe-style manual checks listed in CONTRIBUTING; widths 360px and 1280px
  screenshot check is outside this run (no browser driving) so it is verified by CSS review only and flagged in round 2.

### DOC-1-3  [high] AGENTS.md and llms.txt for installing agents
- Evidence: Herdr's reference (AGENTS.md "Layouts and mods other people made", steps 1-5) requires the installing
  agent to tell the person what a mod runs/reads/reaches before adding; nothing in the repo supplies it.
- Change: AGENTS.md at root, structured as: (1) What this is, file map; (2) Before installing, tell the person:
  no network; runs sh/powershell, git, nvim (via login shell), `hc run`/`hc read`; reads the focused pane's folder,
  files on alt-click, agent screen text; writes `<home>/data/portrait-tree-spines/*.svg`; (3) Install steps following
  Herdr's protocol: never overwrite, rename on clash (names to check: portrait.json, portrait-bottom.json, bar-strip,
  portrait-tree, portrait-tabs, portrait-pane, portrait-files, nvim-float, attention-picker; if the person already has
  attention-picker from herdr-agents-waiting, keep theirs and skip the bundled copy), merge keys.json asking before
  replacing, check each mod, `layout.switch`; (4) Adapt: theme, sizes, OS keys, removing the Vault parts, renaming
  procedure incl. `mods/<name>/` asset paths; (5) Test: `herdr-app check <abs path>` per mod, `node --check`, JSON parse,
  never `herdr-app do/shot/status` against someone else's running app without asking, never write the live home from a
  repo checkout script; (6) Edit safely: attention-picker is a bundled copy, change it upstream; saving a file in a mod
  folder hot-reloads it (so runtime output goes to `data/`, see portrait-tree.js:63); `cloned_from` mods are clones of
  0.1.12 shipped mods, never updated by Herdr; (7) Gotchas list from DOC-1-11/12. llms.txt: llmstxt.org format (H1, blockquote,
  link sections to README, docs pages, AGENTS.md, RECIPE.md, raw layout/mod paths).
- Owner: documentation. (CONTRIBUTING and AGENTS.md must agree; AGENTS.md wins on agent steps.)
- Verify: dry-run the install steps by a fresh agent in a scratch `HERDR_APP_HOME` (completeness role can do it
  without touching the live app: copy only); `llms.txt` links resolve.

### DOC-1-4  [high] Privacy and side-effects statement (per mod, with evidence)
- Evidence (all verified):
  - bar-strip/main.js: no exec, no network; `agents()`, `layout()`, `updates()`; opens overlays `picker`, `machine-add`, `attention-picker`; commands `mod.open`, `app.settings`, `agent.focus`, `layout.select/show/hide`.
  - portrait-tree/main.js:349-355 writes `<home>/data/portrait-tree-spines/<hash>.svg` containing each space NAME (never removed); :77-80,102 localStorage `folded`, `peeked`, `changed` (agent addresses + timestamps); :107 shared `agents.since`; reads shared `space.colors`, `vault.panes`, terminal labels `editor.file`.
  - portrait-files/main.js:29 `sh -c` listing, :23 powershell on Windows, :87-91 `git rev-parse` and `git status` (read-only flags), :193 readTextFile (alt-click only), :49 watchFolder, :144-149 `hc run` with labels `editor.file=<full path>` (visible in `hc ls`), :143 socket `/tmp/herdr-nvim-<base36 time>.sock`, :134 login shell `$SHELL -lc`.
  - nvim-float/main.js:17-19 `sh -c ... nvim --server/--remote-send/--remote-expr`.
  - attention-picker/main.js:125-129 `hc read <address>` for every blocked/done agent every 2 s (:62), only the last question/last message line is displayed; :141 shared `attention.sort`.
  - portrait-tabs: localStorage `panels` (space id -> panel); portrait-pane: none.
  - `rg 'fetch|XMLHttp|WebSocket|http'` finds only an SVG xmlns string.
- Change: docs/privacy.html + README section as a table (mod / reads / runs / writes / network = none), plus "what
  leaves your machine: nothing from this repo; agents you run in terminals do their own thing". Mention the `editor.file`
  label and /tmp socket explicitly (an honest minor exposure on shared machines).
- Owner of touched files: documentation. Related code findings for code-review: DOC-1-9 items (socket location, unpruned `changed`).
- Verify: each row has a file:line that a reviewer can open; rerun the rg after code-review's changes and update lines
  in round 2 (docs reference function names plus lines, to survive edits).

### DOC-1-5  [high] Honest per-OS requirements (macOS / Linux / Windows)
- Evidence: macOS-only or POSIX-only pieces: keys.json `cmd-b` (both layout sections); nvim-float/main.js:57,
  `.replace(/^\/Users\/[^/]+/, "~")` (Linux paths shown in full, Windows never match); portrait-files/main.js:134,
  nvim-float/main.js:17 run `sh -c` and `$SHELL -lc` (Windows has no `sh` unless Git Bash is on PATH);
  portrait-files:143 socket in `/tmp` (no /tmp on Windows). Windows file listing IS handled (:20-27, powershell), the
  preview (readTextFile) is OS-neutral, tree/tabs/pane/bell/picker use no OS APIs. portrait-tabs:79-93 handles
  window buttons for linux/windows/macos.
- Change: README + docs/platforms.html matrix: feature x OS with Works / Untested / Not supported, e.g. Windows:
  click-to-edit in nvim is not expected to work (use alt-click preview) until code-review adds a fallback; `cmd-b` mac
  only, with the Linux/Windows replacement key once herdr-completeness chooses it (propose `ctrl-b b`, already
  present, as the documented cross-platform key; `cmd-b` stays an optional mac alias). State "developed and used on
  macOS; Linux and Windows untested" unless a tester appears. No claims of testing that did not happen.
- Owner of touched files: documentation (README, docs/platforms.html); code-review (nvim paths, /Users regex,
  Windows fallback); herdr-completeness (keys.json). Posted to board.
- Verify: matrix rows each cite the line that decides them; after code-review/completeness change, rows are updated in round 2.

### DOC-1-6  [high] Vault is documented as optional, but the layout shows it unconditionally
- Evidence: layouts/portrait.json and portrait-bottom.json always contain the `vault` block (mod `vault`);
  bar-strip/main.js:105-106 shows the Vault button when `find(body, "vault")` is truthy (always true with this layout);
  portrait-tabs/main.js:84 appends `"vault"` to the enabled panels unconditionally; portrait-tree/main.js:277,313 and
  portrait-pane/main.js:49-54 draw `mods/vault-reader/obsidian.png` for vault-reader panes (only matters if such panes exist).
  Without the vault mod, the Vault button opens a block whose mod is missing.
- Change (docs side): write docs for the intended behavior ("Vault is optional; install herdr-obsidian-vault to light up the
  Vault button, panel and note rows") ONLY once fixed; until then the README states the current limitation in a "Known
  limits" box and AGENTS.md tells installing agents how to remove the vault child from the layout's `panel-body` stack.
  Hand-off: code-review to gate the button/enabled list on the vault mod being installed (e.g. does the app expose installed
  mods? if not, check `shared("vault.ready")` or ask the vault repo to publish a shared flag); completeness to decide whether
  the layout JSON drops the `vault` child by default and an add-on snippet adds it.
- Owner: code-review (bar-strip, portrait-tabs, portrait-tree, portrait-pane), herdr-completeness (layouts/). Posted to board.
- Verify: with the vault mods absent in a scratch home, `herdr-app check` passes and no Vault UI is visible (reviewers on the
  other roles run this; docs then drop the Known limits box).

### DOC-1-7  [medium] Theme: documented decision needed (vesper is not shipped)
- Evidence: both layouts' root has no `theme` or `colors`; all mods read theme tokens (`chrome`, `canvas`, `raised`, `hover`,
  `selected`, `popover`, `working/blocked/done/idle`, all present in herdr.d.ts:264-267), so any theme works. The author's
  look is the user theme `vesper` (not shipped; ~/.config/herdr-app/themes/vesper.json, 343 B).
  portrait-tree/main.js:12 and attention-picker/main.js:15 hard-code six space-badge colors (same as the shipped list).
- Change: docs/configuration.html "Theme" section with three options: (a) do nothing: Settings -> Look decides; (b) pin
  `"theme": {"light":"paper","dark":"graphite"}` on the layout root (follows system appearance); (c) carry its own
  `themes/<name>.json` (AGENTS.md: a theme file is a plain JSON with background/foreground/selection/ansi). The README shows
  which one the screenshot uses. Wait for completeness's decision (propose: set the shipped pair `paper`/`graphite` on the
  root and ship `themes/vesper.json` as an optional extra, copied with the "never overwrite" rule); docs follow whichever lands.
- Owner of touched files: herdr-completeness (layouts/, themes/ file); documentation (configuration page, README).
- Verify: the screenshot's theme named in README matches the layout file; `rg theme layouts/` agrees with docs.

### DOC-1-8  [medium] Keys: chord syntax is undocumented by Herdr; `ctrl-b` collides; `ctrl-b a` is global but needs bar-strip
- Evidence: keys.json uses `"ctrl-b a"`, `"ctrl-b shift-b"`, `"ctrl-b b"` (space-separated chords). Herdr's own reference
  (Keys section) only shows single combos; "ctrl-b" is readline's back-char and tmux's prefix, and "plain ctrl+letters go to
  the program unless bound". `ctrl-b a` sits in `global` (keys.json:3) but `bar-strip.attention` is delivered "to shown
  copies only" (Herdr: Mods), so it silently does nothing in any other layout.
- Change: docs keys table (key, action, where, notes: chord = press ctrl-b, release, then the second key IF the app supports
  chords; flagged "verify in your Herdr version"), conflict note for tmux/readline users with how to rebind, the unbound
  `bar-strip.jump` command (bell click action) as a bindable extra (bar-strip.js:25-26). Ask completeness to (1) confirm chord
  support with an app expert / `herdr-app commands` output / source since AGENTS.md does not document it, (2) move
  `ctrl-b a` from `global` into the two `layout:portrait*` sections, (3) pick the non-mac toggle key.
- Owner: herdr-completeness (keys.json); documentation (tables). Posted to board.
- Verify: keys.json parses; docs table rows equal keys.json entries one to one (script compares).

### DOC-1-9  [medium] Stale or wrong comments in code that docs would otherwise inherit
- Evidence: portrait-files/main.js:125-128 says nvim is "peeked over the tab" while the code opens a floating `window` overlay (:175);
  :136-139 refer to a "keep" button as "↗ keep" but nvim-float's button is "Keep" with a chevron; :160-164 are five blank lines;
  portrait-files/mod.json lacks a `title` (the other mods have one); portrait-files header (:1-4) does not mention that click-to-edit needs
  `sh` and nvim (see DOC-1-5); attention-picker header says "Go to..." without saying that is a shipped dialog.
- Change: ask code-review to fix those comments (docs link to behavior, not comments); documentation will not edit .js.
- Owner: code-review. Posted to board.
- Verify: `rg -n 'peeked over|↗ keep' mods/portrait-files mods/nvim-float` after the fix returns nothing stale.

### DOC-1-10  [medium] CHANGELOG.md and CONTRIBUTING.md (and a version to hang them on)
- Evidence: no version anywhere (mod.json files carry none; `cloned_from` pins 0.1.12). The repo has exactly one commit
  ("Import from a working Herdr setup"), at least two review rounds are planned.
- Change: CHANGELOG.md in Keep a Changelog style: `## [Unreleased]` collecting round 1/2 results, `## [0.1.0]` = import from
  a working setup (list layouts, mods, keys); a "Compatibility" line: built against Herdr app 0.1.12 shipped mods.
  CONTRIBUTING.md: principles (privacy rules, generic examples), setup (`git clone`, no build), checks (`herdr-app check
  <abs mod folder>` for each mod, `node --check` for .js, `node -e 'JSON.parse(...)'` for layouts/keys, `node` for ask.js which
  is pure), the don't-touch list (mods/attention-picker: change in herdr-agents-waiting, sync after; shipped mod clones keep
  `cloned_from`), manual test checklist per feature (fold a space, bell, picker, Files click, alt-click preview, flip layout, bar
  toggle), never test against your live home, commit style, how to add a mod to the layout. Ask completeness for a scripts/check
  entry so CONTRIBUTING can cite one command.
- Owner: documentation (both files); herdr-completeness (scripts/).
- Verify: every command in CONTRIBUTING run once; CHANGELOG links compare URLs exist.

### DOC-1-11  [medium] Dependencies on shipped Herdr mods and assets must be listed (and one inconsistency fixed)
- Evidence: layouts reference shipped mods `workspace-status`, `changes`; mods open overlays `picker`, `machine-add`, `menu`,
  `new-menu` (bar-strip.js:62-63,92-93; portrait-tree.js:170,177; portrait-tabs.js:70,90) and draw shipped assets
  `mods/workspace-chrome/{search,server,settings,plus,spinner,chevron-left,chevron-right,chevron-down}.svg`,
  `mods/files/file.svg`, `mods/changes/changes.svg`, `mods/pane/close.svg` (bar-strip.js:88-102; nvim-float.js:57,58;
  portrait-tabs.js:75,93; portrait-tree.js:153,216,336, 498). Herdr says shipped files are replaced on every start, so a rename
  upstream breaks icons silently. portrait-pane/close.svg is bundled but tabs and nvim-float use the shipped `mods/pane/close.svg`.
- Change: README "Needs from Herdr" table (shipped mod/asset, who uses it, what happens if gone) and "Tested with Herdr 0.1.12";
  AGENTS.md rule: on Herdr update, re-run the checks and re-clone if `cloned_from` versions drift. Ask code-review to prefer
  bundled assets over `mods/pane/close.svg` and to bundle the chrome SVGs it relies on (shipped-asset legitimacy is
  completeness's call, per task note). Documentation lists whichever remain.
- Owner: code-review (assets, js), herdr-completeness (legitimacy, NOTICE if bundling). Posted to board.
- Verify: `rg -o 'mods/[a-z-]+/[A-Za-z0-9._/-]+\.(svg|png)' mods | sort -u` equals the table, and each path exists after install.

### DOC-1-12  [medium] Usage and troubleshooting content, verified from the source (to write now, from facts below)
- Evidence for behavior statements (page "usage"): tree: header click selects space, drag to reorder within a machine
  (portrait-tree.js:182-195), fold button -> 34 px strip with rotated name (:145,367-388), focusing a folded space's agent opens it
  and re-folds when you leave (:117-138), tab row click/double-click rename/drag reorder/right-click (:234-256), agent row shows
  state word + time in state (:258-273, :35-41 `<1m`, `5m`, `2h`, `1d`), columns min 290 px, markers when they don't fit, wheel/shift-wheel
  scroll (:15,507-517); bell: "N need you · M done", click = longest waiting (blocked first), shift-click = list (bar-strip.js:37-42,
  80-94); picker: search, up/down, Enter, 1-9 jump, Tab/click sort recent/oldest/space, agents idle > 1 day folded (attention-picker.js:13-24,
  100-117,230-243); Files: click folder expands, file opens nvim float, alt-click read-only preview, marks A/U/D/M, 500/folder 5000 total,
  10 s + folder watcher (portrait-files.js:16-17,41,213,217); panel choice remembered per space (portrait-tabs.js:25-49); tabs wheel = prev/next (:88).
- Troubleshooting entries (each with its cause in code): "Couldn't open nvim" (nvim not on login-shell PATH; `hc run` failed; 10 s wait,
  portrait-files.js:156,181-184); Files shows "No folder" (no focused pane folder, :233); "File list limited" (:234); folded names empty for a moment
  (spine SVG is written on first render, then redraws, portrait-tree.js:342-363); Vault button with nothing in it (DOC-1-6); tree columns cut off
  (strip height 246 px, tree needs ~290 px per column, drag the divider); bell does nothing in other layouts (DOC-1-8); layout won't load (`layout.error`,
  escape hatch ctrl-alt-shift-escape); mods stale after a failed save (`herdr-app status`).
- Change: usage.html, troubleshooting.html, README section built from these. No screenshots of real windows (generic demo content only).
- Owner: documentation.
- Verify: each sentence in usage/troubleshooting traces to a line above; round 2 re-verifies after code changes.

### DOC-1-13  [medium] Provenance and bundled-copy documentation (attention-picker, clones)
- Evidence: mods/attention-picker has no version or origin marker in mod.json; four mods carry `cloned_from` (portrait-files/pane/tabs 0.1.12,
  layouts too); portrait-tree/bar-strip/nvim-float are original.
- Change: README/docs "What is original, what is cloned, what is bundled" table; ATTRIBUTION wording ready for NOTICE (completeness) saying clones derive from
  Herdr's shipped mods (license of those unknown to docs: ask completeness to verify permission to redistribute). Ask herdr-agents-waiting board to put a version/date
  in the bundled copy's header comment so we can state "bundled from X at Y"; until then docs say "bundled copy, synced by the maintainer".
- Owner: documentation (tables); herdr-completeness (NOTICE, redistribution legality).
- Verify: table matches `rg -l cloned_from`.

### DOC-1-14  [low] Single source of truth with RECIPE.md and herdr.dev publication notes
- Evidence: Herdr's sharing rules need a RECIPE.md ("What you see / How it behaves / Built from / Watch out / Done when") and a `herdr-layout` repo topic;
  sizes (246/26/42/28 px strip, 368 px panel, 8 px padding, 10 px radius, terminal_padding [14,12]) would otherwise be duplicated by hand.
- Change: docs reference RECIPE.md for the build brief and repeat only user-facing numbers; a "Publish checklist" in CONTRIBUTING (preview.png without personal data,
  topic `herdr-layout` is a manual author step because I cannot change repo settings, public repo, README links). Board note to completeness to cite the same numbers.
- Owner: documentation (checklist); herdr-completeness (RECIPE.md, preview.png).
- Verify: numbers in docs equal layouts/*.json (script in round 2).

### DOC-1-15  [low] Docs-vs-code drift guard
- Evidence: docs will cite behavior; round 2 code changes will move lines.
- Change: reference function names with approximate lines; add `docs/` link check and a small script idea (`scripts/docs-check.mjs`: internal links, no external hosts,
  keys.json rows = docs table, llms.txt copy equal) proposed to completeness who owns scripts/; documentation provides the spec, completeness adds it, or CONTRIBUTING shows
  the one-liners.
- Owner: herdr-completeness (scripts/), documentation.
- Verify: script exits non-zero on a deliberate broken link.

## Round-1 execution order (for the plan step)
DOC-1-4 and DOC-1-5 first (they feed README and AGENTS.md), then DOC-1-3, DOC-1-1, DOC-1-2, DOC-1-12, DOC-1-10, DOC-1-7/8/11/13/14 as code-review and
completeness land their changes. DOC-1-6 text waits for the Vault fix.
