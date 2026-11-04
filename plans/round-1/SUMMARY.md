# Round 1 summary: share-ready layout

Branch: feat/round-1-share-ready. Three role branches merged with --no-ff (code-review, herdr-completeness, documentation); no merge conflicts.

## What changed

### Code review
- `logic.mjs` per mod (tree, files, bar-strip, tabs, pane, nvim-float) and 73 dependency-free tests in `tests/`, including repo invariants (a renamed or removed vendored icon fails the suite) and a smoke test that renders every mod against stand-ins.
- No mod references Herdr's shipped mod assets any more: 12 icons are vendored into the mods that draw them; the Obsidian logo is replaced by `note.svg`.
- Vault mod is optional: bar-strip probes for it every 60 s and publishes `mods.vault`; the Vault button, panel choice and note rows appear only when it is installed.
- Files panel does no work while closed; one watch loop per root; git status limited to the shown folder.
- nvim click path: plain `sh` with the login shell PATH (fish safe), one nvim per click, Windows read-only preview plus one toast, missing nvim toast.
- Robustness: spine store retries, stored state validated and pruned, `tilde()` shared and tested for mac/linux/windows, planColumns/wheelSteps extracted (fixes an empty-list crash at zoom 3 on a 90 px bar), `nameOf` no longer takes a shell title for an agent name.

### Herdr completeness
- Apache-2.0 `LICENSE`, `NOTICE` (Herdr 0.1.12 clones with statement of changes, Herdr art, Lucide/Feather icons, bundled attention-picker), `.gitattributes` (LF), wider `.gitignore`.
- Layouts no longer include a vault child or pin a theme or fonts; `snippets/vault-panel.json` is the opt-in. Portable `keys.json` (ctrl-shift-g / cmd-b bar toggle, ctrl-shift-y flip, ctrl-shift-j attention), checked against snapshots of Herdr 0.1.12 defaults.
- `RECIPE.md` in Herdr's six-section format with disclosure block, synthetic `preview.png` and layout thumbnails.
- `scripts/`: validate, privacy-scan (files and commit history), check-recipe, check-assets, check-docs, `PUBLISH.md` (author-only steps).

### Documentation
- README, `AGENTS.md`, `llms.txt` (equal to `docs/llms.txt`), CHANGELOG (0.1.0, untagged), CONTRIBUTING.
- 10-page static GitHub Pages site in `docs/` (no scripts, no external requests, light and dark): install, usage, platforms, privacy per mod, troubleshooting, and more.

### Integration (round lead)
- The five `logic.mjs` header comments said `node --test tests/`, which fails on Node 22+; they now say `node --test`.
- `plans/round-1/board.md` holds the board; this summary added.

## Checks (on the merged result)
- `herdr-app check` passed for all 7 mod folders (including bundled attention-picker).
- `node --test`: 73 pass, 0 fail.
- All `.json` files parse.
- `scripts/validate`, `privacy-scan`, `check-recipe`, `check-assets`, `check-docs`: all ok.
- rg for home paths and emails (outside plans/docs that discuss the pattern and tests that build fake homes): clean. `preview.png` equals `docs/assets/preview.png`. No keepachangelog link in shipped docs.

## Deferred / not verified
- CI: `.github/workflows/ci.yml` is one commit on local branch `feat/round-1-share-ready--herdr-completeness-ci`, not pushed: the OAuth token lacks the `workflow` scope. Author runs `gh auth refresh -s workflow -h github.com`, then pushes that branch. No CI run exists, so the Linux and Windows legs are untested.
- Nothing was run in a live app (rule 2): looks, fish/zsh login shell click, Linux and Windows runs, tab-bar wheel feel (`WHEEL_STEP`).
- Docs not checked in a real browser at 360 px; install-by-hand commands (especially PowerShell) not executed.
- Rows for agents without a pane; virtualised Files list; folders first in the PowerShell listing; pruning could drop remote-machine space state if the app lists only local spaces briefly at startup.
- The docs generator is not committed; edit HTML and README directly.
- keys table versus keys.json is generated, not checked.
- Author-only publish steps: Pages (main, /docs), topic herdr-layout, visibility, tag (see `scripts/PUBLISH.md`).
- `fold.svg` and `unfold.svg` have no recorded origin in NOTICE.

## Round 2 priorities
1. Land CI (needs the workflow scope), read the first runs on ubuntu, windows, macos, fix what fails.
2. Check keys table against keys.json in check-docs; commit or replace the docs generator.
3. Run the layout on Linux and Windows (author or a VM); verify PowerShell listing order and the Windows nvim preview path.
4. Resolve the pruning guard for partial space lists (remote machines).
5. Record the origin of fold.svg and unfold.svg in NOTICE.
6. Docs at phone width and an accessibility pass; run install-by-hand commands in a scratch home.
7. Rows for agents without a pane once real data exists; shared helpers with attention-picker via the herdr-agents-waiting board.
8. Re-verify docs against code after any behavior change (pruning, vault probe interval, wheel step, toasts).
