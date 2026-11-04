# Round 2, herdr-completeness: log

Branch `feat/round-2-hardening--herdr-completeness` (from `feat/round-2-hardening` at efd5a69). Worktree under `.wt/`.
Nothing under `.github/workflows/` was written (rule 9); `mods/attention-picker/**` was not edited.

## Done (task ids)

| Id | What landed | Files |
|----|-------------|-------|
| HC-2-3 | `scripts/bundled.json` (ref b7fcb3fa..., SHA-256 of the six files, LF-normalised; the hashes equal `git show` of the canonical branch) checked by `validate`; `scripts/bundled.mjs` writes a new manifest after a sync (`node scripts/bundled.mjs <commit>`); `tolerated_assets["attention-picker"]` removed; RECIPE picker row, disclosure (3 s, `--lines 60`, `attention.seen`), NOTICE section 4 (the picker's icons are that project's own) | `scripts/{bundled.json,bundled.mjs,validate.mjs,shipped-mods.json,lib.mjs}`, `RECIPE.md`, `NOTICE` |
| HC-2-1 | `privacy-scan --commits` names `commit <sha>: the author|committer address ...`; PUBLISH step 0 (author) | `scripts/{privacy-scan.mjs,PUBLISH.md}` |
| HC-2-2 | `scripts/ci.workflow.yml` (SHA-pinned checkout 3d3c42e v7.0.1 and setup-node 949feb2 v7.1.0, read from the GitHub API; `persist-credentials: false`; ubuntu/windows/macos on Node 20 and 22 plus ubuntu on Node 18; `push` on main + `pull_request`; concurrency; timeouts; preview-drift step; separate `history` job), `scripts/check-all.mjs`, `package.json` (`npm test`, `npm run check`, `npm run check:history`), `.github/dependabot.yml`, `validate` rule (installed `ci.yml` must equal the template), PUBLISH step 6 with the workflow-scope commands | as listed |
| HC-2-5 | RECIPE: intro line, function list (adds `keys`, `machines`, `fs/promises`, `terminal.kill`, `overlay.close`), disclosure (login-shell startup files, folder's machine, picker polling, `attention.seen`, labels), Done-when without the mod command; `check-recipe` cross-checks imports from `herdr`, other modules, literal `run()` commands, `exec()`/`hc()`/`nvim` programs, and fails on `fetch`/`WebSocket`/`XMLHttpRequest`/`EventSource`/`sendBeacon` | `RECIPE.md`, `scripts/check-recipe.mjs` |
| HC-2-13a / D1 | `keys.json`: `ctrl-shift-j` -> `mod.open:attention-picker` in both layout sections; RECIPE Keys table, Done-when, bell paragraph; `cmd-b` dead on Linux and Windows; D2 (window buttons), D3 (folder dot), agent.next, wheel notch, 1.5 s refresh floor, sub-agent rows, light-theme spine colour (marked as not seen), pane-less caveat removed, `editor.space` dropped | `keys.json`, `RECIPE.md` |
| HC-2-6 | `validate`: `preview` must equal `layouts/<file name>.svg`; RECIPE Watch out: rename `preview`, copy the thumbnails | `scripts/validate.mjs`, `RECIPE.md` |
| HC-2-4 | NOTICE rewritten: every icon copied from Herdr 0.1.12 listed with its source mod (checked byte-for-byte, whitespace aside, against the shipped mods in the author's app home, read only) under Herdr's own `LICENSES.md` statement; `bell.svg` listed as Lucide; no "exactly the geometry"; fold/unfold listed as original (code-review's redraw, commit b0937b5); `validate` requires each icon under a heading that names Apache, ISC or MIT | `NOTICE`, `scripts/validate.mjs` |
| HC-2-7 | plans/ is scanned like any file; only a line that shows a pattern (regex, `<home>`, `/..`, `...@`) lets a path or address through; PUBLISH step 7a (author) | `scripts/{privacy-scan.mjs,PUBLISH.md}` |
| HC-2-8 | `scripts/checks.test.mjs`: 55 cases on a temp copy (see commit message); every case asserts exit 1 and a message; the clean tree passes. Two rules were removed in a scratch copy and their cases failed as they should | `scripts/checks.test.mjs` |
| HC-2-12 | PUBLISH step 4: per-OS scratch-home commands (sh and PowerShell) and an empty result table; RECIPE marks Linux, Windows and fish behaviour as never run | `scripts/PUBLISH.md`, `RECIPE.md` |
| HC-2-11 | every tracked JSON ends with a newline (`validate`); `portrait-bottom.json` rewritten with `portrait.json`'s key order (content identical, `diff` shows only the moved bar and `preview`; `validate` checks the order); `.editorconfig`; `mods/portrait-{pane,tabs}/mod.json` got their final newline | as listed |
| HC-2-14 | `check-docs`: Pages address derived from the `github.com/<owner>/<repo>` links (D11), keys tables of README and configuration.html equal `keys.json`, "Where to check" names exist in mods, every mod folder named in README and the privacy page | `scripts/check-docs.mjs` |
| HC-2-15 | `.github/ISSUE_TEMPLATE/bug.md` | as listed |
| HC-2-9 (stretch) | `scripts/preview.sha256` written by `make-preview` after a render; `check-assets` fails when `preview-source.svg` changed and the picture did not. `preview.png` re-rendered from the committed source is byte-identical, so the recorded hash is true | `scripts/{make-preview.mjs,check-assets.mjs,preview.sha256}` |

Found while testing: `herdr-app check` writes `gpui-kit.d.ts` and `jsconfig.json` into the mod folders (git-ignored). The first
version of the bundled-copy check listed the folder and failed after that; fixed in `validate.mjs` and `bundled.mjs`, with a test.

## Deferred (and why)

- `refresh-snapshots.mjs` network tool and `--clones` mode (HC-2-10): D14; the manual procedure is in PUBLISH.md "When Herdr releases a new version".
- Wide 1600x900 preview variants (HC-2-9 B and C): D13, needs the real gallery crop.
- First CI run on Linux and Windows: the author installs the workflow (PUBLISH step 6) and reads the run.
- Verifying `cmd-b` on Linux and Windows, `mod.open:attention-picker` toggling, fish `PATH` lookup, PowerShell listing: need a live app on those systems (PUBLISH step 4 table).
- `titlebar: none` + `traffic_lights` for window buttons on Linux and Windows: author's design call (D2).

## Checks run (macOS, Node 26)

| Command | Result |
|---------|--------|
| `herdr-app check <worktree>/mods/<m>` for all 7 mods | 7 of 7 passed |
| `node scripts/check-all.mjs` (validate, check-recipe, check-assets, check-docs, privacy-scan) on this branch alone | check-docs fails with 8 problems, all one kind: the README and `docs/configuration.html` keys rows still say `bar-strip.attention` for `ctrl-shift-j` (documentation owns them, its branch has `mod.open:attention-picker`); the other four pass |
| `node --test` on this branch alone | 128 tests (73 earlier ones plus 55 in `scripts/checks.test.mjs`): 127 pass; the one failing case is "the clean tree passes every check", for the same docs rows |
| Scratch merge (outside the repo) of this branch + `...--documentation` (README, AGENTS, CONTRIBUTING, CHANGELOG, llms.txt, docs) + `...--code-review` (mods, tests) | `node --test` 160 of 160, `check-all` all 5 ok, `herdr-app check` 7 of 7 |
| `node scripts/privacy-scan.mjs --commits` | fails only on `ef8b513` (author address of PR 1's web merge), as D10 expects |
| `node scripts/make-preview.mjs --svg-only && git status` | clean |
| `python3 -c yaml.safe_load` on the workflow and Dependabot files | parse |
| Mutations in a scratch copy (ctrl+alt rule, bundled hash comparison replaced by `true`) | the two matching cases of `checks.test.mjs` failed |
| No file under `.github/workflows/` | true |

A removal of a `mktemp` scratch directory with a command substitution was refused by the safety check; I did not work around it
and cleaned scratch copies by literal path instead (all under the session scratchpad, outside the repo).

## Handoffs for round 3 / the round lead

- Merge order: this branch, code-review, documentation. Only after the docs branch (keys rows) is the whole suite green; the merged scratch tree was.
- Author: PUBLISH step 0 (private-address settings before merging any web PR; history decision), step 6 (copy `scripts/ci.workflow.yml` with a workflow-scoped token), step 4 (per-OS table), 7a (keep or remove `plans/`), the `herdr-layout` topic at publication.
- When herdr-agents-waiting round 2 is integrated: remove the folder, archive the new commit, run `herdr-app check`, `node scripts/bundled.mjs <commit>`, then re-read RECIPE's picker row and disclosure and NOTICE section 4 (poll interval, `hc read` lines, storage keys, header lines, a possible move of `spaceColor`).
- Heartbeat key `agents.since.at` proposed by the picker's lead: not added here (portrait-tree is code-review's file); if added, RECIPE "Shared state" and the privacy page must name it, and `validate`'s load-bearing list may.
- Clone drift: `cloned_from` pins 0.1.12; nothing compares the clones with a newer Herdr (manual step in PUBLISH.md).
- An API-level check for `mod.open:attention-picker` toggling needs the app (author step 4, item 5).
