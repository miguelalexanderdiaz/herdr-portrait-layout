# Round 1, documentation: apply log

Branch `feat/round-1-share-ready--documentation`. Owner files: README.md, docs/**, AGENTS.md, llms.txt, CHANGELOG.md,
CONTRIBUTING.md (this log too). Text was written from the code-review branch (apply log, `logic.mjs` files, `main.js`)
and the herdr-completeness branch (keys.json, snippets, NOTICE, RECIPE, PUBLISH, scripts) as they stood at their
last pushed commits, not from the first import.

## Done (task ids)

- DOC-1-4 Privacy: `docs/privacy.html` (per mod: reads, runs, writes, function names to check) and the README table.
  Verified: `rg -n "fetch|XMLHttpRequest|WebSocket" mods` prints nothing; `exec(` and `hc(` call sites match the table.
- DOC-1-5 Platforms: `docs/platforms.html` and the README matrix. Windows click-to-edit = read-only preview plus one
  info toast (D8); nvim missing = toast plus preview. Rows cite functions (`directory`, `platformMode`, `edit`).
  "Expected to work" is used for Linux and Windows; nothing claims a test that was not run.
- DOC-1-3 `AGENTS.md`, `llms.txt`, `docs/llms.txt` (byte-equal; links are absolute github.com URLs on purpose).
  Dry run done by reading only: steps use only files that exist in the merged tree (layouts/*, mods/*, keys.json,
  snippets/vault-panel.json, RECIPE.md).
- DOC-1-1 README; DOC-1-2 Pages site (10 pages incl. 404, `docs/assets/site.css`, `.nojekyll`, `docs/assets/preview.png`
  copy of completeness' preview, no scripts, no external requests, light and dark, skip link, one h1 per page).
- DOC-1-12 usage and troubleshooting, from the final behavior (Files idle while closed, no spine loop, folder dots, etc.).
- DOC-1-6/7/8/11/13 Vault page text and snippet, theme (D5), keys table generated row for row from `keys.json`
  (ctrl-shift-g, cmd-b, ctrl-shift-y, ctrl-shift-j), optional tmux-style chords (paste-in only), needs-from-Herdr table,
  provenance table (original / cloned / bundled / icons, matching NOTICE).
- DOC-1-10 CHANGELOG (0.1.0 not yet tagged, matching PUBLISH.md) and CONTRIBUTING.
- DOC-1-14 README and docs link RECIPE.md; only user-facing numbers (246/26/42/28/368/30 px) repeated, equal to the layout files.

## Checks run

Scratch merge of the three pushed branches (code-review, completeness, documentation) in a clone under the scratchpad:
- `node --test`: 73 tests, 0 failures.
- `herdr-app check <abs folder>` for all 7 mods: all passed.
- `node scripts/validate.mjs`, `privacy-scan.mjs`, `check-recipe.mjs`, `check-assets.mjs`, `check-docs.mjs`: all `ok`
  (check-docs: 6 Markdown, 10 HTML, 2 text files).
- My own scratch checker (links, anchors, one h1, alt, tags balanced, external hosts, home paths, e-mails): all good.
- Rendered `privacy.html` and `index.html` in headless Chrome (dark mode, 800 and 1100 px) and looked at them. 360 px
  was not verified (the headless window has a minimum width), so mobile width is CSS review only (flex-wrap nav,
  scrollable table regions, `max-width:100%` images, 16 px gutters).
- Every command in CONTRIBUTING was run once in the scratch merge (the `HERDR_APP_HOME` scratch example was not run
  as such; the `herdr-app check` it shows was run on the same folders).
- Not run: the install-by-hand commands (PowerShell version especially), nothing was written into any Herdr home.

## Deviations and decisions

- Test command is plain `node --test` (not `node --test tests/`): fails on Node 22+ (code-review log, board).
- CI: the workflow could not be pushed (OAuth scope). Docs do not claim a CI run exists; CONTRIBUTING says "when
  `.github/workflows/ci.yml` is in the tree". Platforms page says tests are written to run on three systems.
- Dropped the keepachangelog.com link (check-docs allows only github.com and herdr.dev).
- Docs refer to function names, not line numbers.

## Deferred / handoffs for round 2

- Add a CHANGELOG line and drop the conditional wording in CONTRIBUTING once the CI workflow lands in the tree.
- Real screenshots check of docs at 360 px and 1280 px (needs a proper browser run); an axe-style pass.
- Keys table versus docs comparison is generated, not checked; a script check is round 2 (D14).
- Statements to re-verify after any code change: pruning rules (7 days for `changed`), vault probe every 60 s,
  40 px per tab wheel step (author's manual check), folder dots, Windows toast text, `terminal.kill` after 10 s.
- Needs the author: enable Pages (main, /docs), topic, visibility (PUBLISH.md); the 404 page uses relative links, fine at
  the site root only.
- If the published slug changes: README/AGENTS install lines, docs links, llms.txt (absolute GitHub URLs).
- Regenerate note: the HTML pages and README were produced by a throwaway generator in the scratchpad (not committed);
  edit the committed files directly next time.
