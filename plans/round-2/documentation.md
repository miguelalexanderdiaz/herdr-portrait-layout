# Round 2 audit: documentation

Role: documentation. Owns README.md, docs/**, AGENTS.md, llms.txt, CHANGELOG.md, CONTRIBUTING.md.
Audited at main ef8b513 (round 1 merged). Read: README, AGENTS.md, llms.txt, CHANGELOG, CONTRIBUTING, all 10 docs pages and
site.css, every mod's main.js and logic.mjs that a doc sentence depends on, layouts, keys.json, scripts/PUBLISH.md,
plans/round-1/*, the board, Herdr's AGENTS.md, and the canonical herdr-agents-waiting branch
`origin/feat/round-1-standalone-picker` (the version the round lead syncs first). Nothing in the tree was changed.

## Summary

Round 1 docs are accurate on almost everything I could check against the code. The problems are few but two are
claims the code contradicts, and one is a wave of statements that become wrong the moment the attention-picker sync lands.

Checked and found TRUE (no change needed, so round 2 does not redo it):
- Install by hand (macOS/Linux script) run in a scratch `HERDR_APP_HOME`: nothing overwritten, `herdr-app check` passes 7/7.
  The PowerShell script was NOT run (no pwsh here).
- Keys table in README and docs/configuration.html equals keys.json row for row (8 rows). Layout sizes (246/26/42/28/368/30,
  min/max, terminal_padding 14/12) equal both layout files; portrait-bottom child order matches the tree drawn in how-it-works.
- Numbers: MIN_COL 290, FOLDED_COL 34, six marks then "+N", WHEEL_STEP 40 and at most three steps, 30 s tree timer, 60 s vault
  probe, 10 s Files timer, 10 s nvim give-up, 500 per folder / 5,000 total, 400,000 characters, 7-day `changed` TTL, nvim window
  90% x 85%, `:confirm qa`, double-click rename, `agent.next` order (portrait-tree calls `setAgentOrder`, skipping folded spaces).
- Every function named in a "Where to check" cell exists in mods/ (probeVault, keyHint, track, reveal, createSpineStore,
  pruneChanged, syncPanel, prunePanels, directory, refresh, edit, loginPath, nvimArgv, show, keptEditors, readPreviews ...).
  `rg -n "fetch|XMLHttpRequest|WebSocket" mods` is empty; `http` only matches SVG namespaces.
- Phone width: all 10 pages at 360 px (iframe in headless Chrome) have no horizontal overflow (scrollWidth equals clientWidth);
  table regions scroll inside their own box. Text contrast from the CSS tokens: body 16.9/15.3, muted 8.0/8.4, link 5.8/8.4,
  current-nav chip 5.8/8.8 (light/dark), all above 4.5. This closes the round-1 "360 px unverified" item for overflow; the
  items under DOC-2-7 are what is left.
- Herdr rules: AGENTS.md install protocol equals Herdr's five steps; theme text matches Herdr's `theme` field rules.

Decisions (unattended): keep the hand-edited HTML (no generator), guard it with checks instead (DOC-2-5). Keep the repo address
in install lines. Docs say "expected to work" for Linux and Windows until someone runs them.

## Findings (ordered by impact)

### DOC-2-1  [high] "The mods use only theme colours" is false
- Evidence: README.md:141 ("Any Herdr theme works, because the mods use only theme colours"), docs/configuration.html:22 ("The mods
  only use theme colours (...)"), docs/how-it-works.html "Theme colors ... Not applicable". Code: mods/portrait-tree/main.js:17
  `MARK` (six fixed hex colours for Herdr's ansi space colours), mods/portrait-tree/logic.mjs:13 `inkOn` returns `#ffffff` or
  `#141414`, :143 the spine SVG names a font stack (colour is `currentColor`, so that part follows the theme).
- Change: say what is true: all chrome, text and state colours come from theme tokens (list them); the exceptions are the space
  badge colours Herdr names `ansi1..6` (fixed, same on every theme) and the white or near-black letter drawn on them, picked by
  contrast. Add that a layout can override single tokens with `"colors": {...}` (Herdr's reference) and that a light theme was
  never looked at by the author (unverified: ask code-review whether the fixed marks stay readable on `paper`). Reword the
  "Needs from Herdr" row from "every theme defines them" to "the 11 tokens every theme defines".
- Owner: documentation (README, docs/configuration.html, docs/how-it-works.html); code-review only for the light-theme question (board).
- Verify: `rg -n "only (use )?theme" README.md docs` is empty; the exception list equals `rg -n "#[0-9a-fA-F]{6}" mods --glob '!*.svg' --glob '!*.d.ts' --glob '!attention-picker'`.

### DOC-2-2  [high] The attention-picker sync makes the privacy and "how it works" text wrong; prepare the exact new text
- Evidence (canonical branch `origin/feat/round-1-standalone-picker`, mods/attention-picker/main.js header and constants):
  polls every `POLL_MS = 3000` (docs say 2 seconds: README.md:155, docs/privacy.html:67, RECIPE.md:237, docs/privacy.html "waiting list" bullets);
  keeps a first-seen record in its own localStorage key `attention.seen` ({address: {s, at}}, no screen text), which no doc lists;
  reads `agents.since` only "when a layout tracks status times (it wins)", otherwise tracks times itself (docs/how-it-works.html:
  "Reads agents.since", README, AGENTS.md); has its own key `ctrl-shift-a` -> `mod.open:attention-picker`, but only in the canonical
  repo's keys.json, which this repo does not ship; new own files `logic.js`, `ask.js`, `spinner.svg`, `search.svg`; `READ_LINES = 60`
  lines read per screen, concurrency 4.
- Change (after the round lead's sync commit, same round): privacy rows (README, docs/privacy.html) become "hc read every 3 seconds,
  60 lines per agent, only while the list is open; keeps one line; local storage `attention.seen` (agent address, state group, time;
  dropped when the agent is gone)"; how-it-works row becomes "Uses agents.since from portrait-tree when published, else its own times";
  AGENTS.md file map and rename checklist unchanged (name `attention-picker`), but add one line: the bundled copy ships no key of its own;
  the bell and `ctrl-shift-j` open it, and a person who also has the herdr-agents-waiting keys can open it with `ctrl-shift-a` too (no clash).
  Ask herdr-completeness to change RECIPE.md the same way and NOTICE/mods list if the folder gained files (board).
- Owner: documentation (README, docs); herdr-completeness (RECIPE.md:237, NOTICE); round lead (the sync).
- Verify: `rg -n "2 seconds|every 2" README.md docs RECIPE.md AGENTS.md` is empty; `rg -n "POLL_MS" mods/attention-picker/main.js` equals the number in the docs; the new storage key appears in privacy.html and README.

### DOC-2-3  [medium-high] README and AGENTS.md link to docs/*.html, which GitHub shows as source, not as a page
- Evidence: README.md:9,36,157,167 and AGENTS.md:38 (`docs/privacy.html`, `docs/index.html`, `docs/platforms.html`, `docs/troubleshooting.html`).
  On github.com a relative link to an .html file opens the raw markup. The site only exists after PUBLISH.md step 11 (and not at all while the repo is private).
  llms.txt and docs/llms.txt also point at `blob/main/docs/*.html` for the same reason.
- Change: README says where the site will live, as one line with the Pages address (`https://<owner>.github.io/<repo>/`, using the
  address already present in the install lines) and links the pages through it; every fact a first-time reader needs stays in README
  itself (privacy table, platform matrix, troubleshooting are already there). AGENTS.md and llms.txt link README sections and RECIPE.md instead
  of docs/*.html (agents read markdown better). Keep `docs/` relative links inside the site. Add PUBLISH-day step: open the
  five main Pages URLs after enabling Pages.
- Owner: documentation (README, AGENTS.md, llms.txt, docs/llms.txt); herdr-completeness: `scripts/check-docs.mjs` allows only github.com and
  herdr.dev, so it must also allow `<owner>.github.io` for links in README only; PUBLISH.md step 11 gets the URL check.
- Verify: `node scripts/check-docs.mjs` passes with the new host; no README/AGENTS.md link ends in `.html` except the Pages URL; llms.txt copy equality still holds.

### DOC-2-4  [medium] CI statements and the CHANGELOG must follow the "pushable CI definition" rule
- Evidence: CONTRIBUTING.md:45 ("When `.github/workflows/ci.yml` is in the tree ..."); `scripts/ci.workflow.yml` does not exist yet (scripts/ has no such file);
  CHANGELOG.md `[Unreleased]` says "Nothing yet" although round 2 will change docs, keys text, the bundled picker and checks; PUBLISH.md has no "install the workflow" step.
- Change: once herdr-completeness lands `scripts/ci.workflow.yml` and the PUBLISH step, CONTRIBUTING says: "CI definition: scripts/ci.workflow.yml; the maintainer copies it to
  .github/workflows/ci.yml (needs the workflow scope), see PUBLISH.md" and drops the conditional; platforms.html keeps saying no CI run exists until the author reports one. CHANGELOG gets
  an Unreleased section filled per round (attention-picker sync, docs fixes, new checks, CI definition) with the rule "every merged round adds lines under Unreleased; the tag moves them".
- Owner: documentation (CONTRIBUTING, CHANGELOG); herdr-completeness (the workflow file, PUBLISH.md) - question on board.
- Verify: `rg -n "workflow" CONTRIBUTING.md AGENTS.md README.md docs` names only scripts/ci.workflow.yml and PUBLISH.md; CHANGELOG has Unreleased entries.

### DOC-2-5  [medium] Docs-vs-code drift guard (round-1 priority 2): checks, not a generator
- Evidence: scripts/check-docs.mjs checks links, hosts, h1/alt, llms.txt copy, home paths; it does not compare the keys table with keys.json, the numbers with the code, or
  the "Where to check" function names with mods/. I did all three by hand this round (see Summary); they will rot.
- Change: (a) check-docs.mjs: parse keys.json, require every (section, key, action) in README.md and docs/configuration.html and no extra row; require each mod folder name in README's
  mod table and docs/privacy.html; require each backticked identifier in a "Where to check" cell to appear in mods/. (b) tests/docs-claims.test.mjs (code-review): import MIN_COL, FOLDED_COL,
  WHEEL_STEP, CHANGED_TTL from the logic modules and assert the numbers (290, 34, 40, 7 days) occur in README/docs text. No docs rewrite needed; the check proves the current text.
- Owner: herdr-completeness (scripts/check-docs.mjs), code-review (tests/docs-claims.test.mjs); documentation keeps the text parseable (one `<td>` per key, no line wrapping inside cells) and says so in CONTRIBUTING.
- Verify: change a key in keys.json or MIN_COL locally, the check fails; revert, it passes.

### DOC-2-6  [medium] "Never rename these ids" is incomplete and partly wrong
- Evidence: AGENTS.md:55 and docs/for-agents.html:42 list `root, bar, panel, panel-body, vault`. Code looks up by id: `panel`, `panel-body`, `vault` (find in bar-strip/main.js:103,116,
  portrait-tabs/main.js:79,82, portrait-files/logic.mjs:78) and the stack children `files` and `changes` (`layout.select { stack: "panel-body", child: id }`, bar-strip/main.js:76,
  portrait-tabs/main.js:29). `bar` is used only by the key `layout.toggle:bar`; `root` by no mod. RECIPE.md:290 lists a wider set.
- Change: AGENTS.md, for-agents.html and configuration.html: one list, split in "looked up by mods: panel, panel-body, files, changes, vault" and "named by keys: bar", and say that renaming
  `files`/`changes` also needs the mod-side `enabledPanels` defaults. Point to RECIPE.md for the full frozen list.
- Owner: documentation (all three); herdr-completeness only to keep RECIPE.md:290 consistent.
- Verify: `rg -n "Never rename" AGENTS.md docs` matches the list in `rg -n 'find\(.*"(panel|panel-body|vault|sidebar)"' mods`; `node scripts/validate.mjs` still ok.

### DOC-2-7  [medium] Install by hand on Windows is not copy-paste, and verification claims need an honest line
- Evidence: README.md:76-98 and docs/install.html set `$H = "<the path printed by herdr-app --help>"`: pasted as is, `<`/`>` are illegal in Windows paths and the next line fails. The sentence
  "follows its documentation and has not been run on Windows" is right but the default home is not given for Windows (Herdr's reference uses `~/.config/herdr-app` throughout; unverified for Windows).
  Also install.html says the default is `~/.config/herdr-app` "on macOS" only, while Linux is the same path.
- Change: PowerShell: `$H = if ($env:HERDR_APP_HOME) { $env:HERDR_APP_HOME } else { Join-Path $HOME ".config\herdr-app" }` followed by "if `herdr-app --help` prints another folder, set `$H` to it", marked
  unverified on Windows. State "run in a scratch home on macOS: nothing overwritten, 7 of 7 checks pass" for the sh script (done this round) and nothing more. Say the default for Linux too.
- Owner: documentation (README, docs/install.html, AGENTS.md "Uninstall").
- Verify: README and install.html snippets are identical (diff of the code blocks); the sh block run again in a scratch HERDR_APP_HOME; PowerShell block flagged unverified until the author or a CI Windows leg runs it.

### DOC-2-8  [medium-low] Site accessibility and phone polish (what is left after the 360 px overflow check)
- Evidence: the six table wrappers carry `role="region" aria-label="What table"|"Section table"|"Mod table"|"Piece table"|"Needs table"|"Feature table"` (derived from the first header, meaningless to a
  screen reader) and no `<caption>`; at 360 px the nav takes four rows (about 200 px of the first screen) and the platforms table hides its Windows column with no visible cue;
  docs/index.html image has `width="540"` but no height (layout shift); docs/404.html uses relative `assets/site.css` and `index.html`, which break when GitHub Pages serves the 404 for a nested missing path.
- Change: real captions ("Layout sizes", "Keys", "Which mod talks to which", ...) and `aria-labelledby` pointing at them; nav as `<details><summary>Menu</summary>` below 40rem using plain CSS (no script);
  an edge shadow or a "scroll sideways" hint on `.scroll`; `width="1080" height="1920"` (the file's real size) on the preview; 404.html with root-relative links to the project path, or a
  meta refresh free text fallback ("Go to the overview: <full github.io address>").
- Owner: documentation (docs/**).
- Verify: re-run the 360 px probe (iframe wrapper in headless Chrome, scrollWidth == clientWidth on all pages); `node scripts/check-docs.mjs` ok; keyboard: Tab reaches every nav link and scroll region.

### DOC-2-9  [medium-low] Maintainer procedures are missing: "when Herdr updates" and "when attention-picker is re-synced"
- Evidence: AGENTS.md says only "after a Herdr update re-run the checks"; PUBLISH.md step 7 and "After publishing" say "keep in sync" without the command; scripts/default-keys.json and
  scripts/shipped-mods.json are snapshots of Herdr 0.1.12 with no documented refresh; the three clones carry `cloned_from` 0.1.12 and nothing tells a maintainer how to compare them with a newer shipped version.
- Change: CONTRIBUTING gets a "Maintenance" section: (1) after a Herdr update: `herdr-app --version`, `herdr-app check` for every mod, diff each clone against the shipped mod folder of the same name
  in the Herdr home folder (read-only), refresh the two snapshots (completeness supplies the exact way), re-check the keys against the new defaults, update "Built and used on 0.1.12" in README/CHANGELOG;
  (2) re-syncing attention-picker: the exact sync command used by the round lead, `herdr-app check`, then the privacy rows in DOC-2-2 are re-read against the new constants. AGENTS.md links to it.
- Owner: documentation; herdr-completeness supplies the snapshot refresh steps (board).
- Verify: a maintainer who has not seen the repo can follow it; commands are copy-paste.

### DOC-2-10  [low] The Windows listing caveat: "Folders are listed before files" overpromises
- Evidence: docs/usage.html ("Folders are listed before files"), README. `directory()` for a local Windows machine (mods/portrait-files/main.js:20-25) takes `Select-Object -First 501` in PowerShell's
  own order before `logic.mjs:151` sorts folders first, so on a folder with more than 500 entries, which 500 appear is arbitrary there (the sh path does folders first).
- Change: docs: "Folders first; on Windows with more than 500 entries in one folder, the 500 shown are the first PowerShell returns" plus the existing limit sentence; board note to code-review (Round 1 deferred item).
- Owner: documentation (usage.html, platforms.html row); code-review for the optional code fix.
- Verify: sentence added; if code-review fixes it, the sentence is removed in the same round.

### DOC-2-11  [low] Provenance wording differs from NOTICE
- Evidence: README.md:184 and docs/how-it-works.html "Lucide icons (ISC licence)" versus NOTICE:51 "Lucide (ISC License; some also MIT)"; `fold.svg`/`unfold.svg` have no recorded origin (round-1 priority 5, completeness);
  the bundled attention-picker folder gains files in the sync, so "NOTICE lists each file" stays true only if completeness adds them.
- Change: wording "(ISC; a few also MIT, see NOTICE)" and a line that the bundled picker keeps its upstream licence terms; no doc claim about fold/unfold until NOTICE records them.
- Owner: documentation (wording); herdr-completeness (NOTICE entries).
- Verify: `rg -n "ISC" README.md docs` matches NOTICE wording; `node scripts/validate.mjs` (it checks icon names in NOTICE) ok after the sync.

### DOC-2-12  [low] README length and four copies of the privacy table
- Evidence: README.md is 200 lines; the per-mod privacy table appears in README, docs/privacy.html, RECIPE.md (disclosure) and AGENTS.md (summary); "Needs from Herdr" and "original, cloned, bundled" tables are
  in README and docs/how-it-works.html. Round 1 hand-synced them; DOC-2-2 shows each behaviour change must now touch four files.
- Change: README keeps: pitch, picture, what you get, requirements and OS matrix, install, keys, a seven-line privacy summary (one bullet per mod, same facts, no function names), troubleshooting top five, uninstall.
  The two long tables move to the site (README links them, DOC-2-3 wording). The full privacy table stays in docs/privacy.html and RECIPE.md. Target: README under 130 lines, first screen = pitch + picture + install line.
- Owner: documentation.
- Verify: every fact removed from README still exists on the site (rg for the row names); `node scripts/check-docs.mjs` ok; the DOC-2-5 check covers the remaining copies.

### DOC-2-13  [low] Publication-day text and issue intake
- Evidence: README has one install line (GitHub address); Herdr's reference also accepts `herdr.dev/layouts/<owner>/<name>` once listed; "Still stuck" (docs/troubleshooting.html) asks for version, OS and `herdr-app status`
  text but there is no `.github/ISSUE_TEMPLATE` to collect them.
- Change: add the herdr.dev install line to README, AGENTS.md and the site in a block that PUBLISH.md step 10 lists as "uncomment after the listing appears"; propose an issue template (bug: Herdr version, OS, layout name,
  `herdr-app status`, what you expected; no screenshots with personal data). I write the text, completeness places it under `.github/ISSUE_TEMPLATE/` (no workflows involved).
- Owner: documentation (text, README/AGENTS lines); herdr-completeness (.github/ISSUE_TEMPLATE, PUBLISH.md).
- Verify: `node scripts/privacy-scan.mjs` ok; template file lists exactly the fields in troubleshooting.html.

## Dependencies on the other roles (also posted on the board)
- code-review: DOC-2-1 light-theme question for the fixed colours; DOC-2-5 tests/docs-claims.test.mjs; DOC-2-10 optional PowerShell folder-first fix.
- herdr-completeness: DOC-2-2 RECIPE.md:237 and NOTICE after the sync; DOC-2-3 github.io host allowance in check-docs; DOC-2-4 scripts/ci.workflow.yml and the PUBLISH step; DOC-2-5 check-docs additions;
  DOC-2-6 RECIPE.md:290 consistency; DOC-2-9 snapshot refresh steps; DOC-2-11 NOTICE; DOC-2-13 .github/ISSUE_TEMPLATE.

## How the round-2 apply step is verified
`node --test`; `node scripts/validate.mjs`, `privacy-scan.mjs`, `check-recipe.mjs`, `check-assets.mjs`, `check-docs.mjs`; `herdr-app check <abs folder>` for 7 mods; the 360 px probe on all pages; `rg` commands listed per finding.
