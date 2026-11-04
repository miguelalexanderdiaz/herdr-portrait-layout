# Round 1 plan: make the portrait layout shareable

Branch: `feat/round-1-share-ready`. Written by the round lead from the three audits in this folder
(`code-review.md`, `documentation.md`, `herdr-completeness.md`). Round 1 of at least 2.

## Goal

Take the layout from "works on the author's machine" to "installable by any Herdr user on macOS, Linux or
Windows, with no personal data in the repo, documented for humans and agents, and ready to be published to
herdr.dev". After round 1 the repo has: a RECIPE.md, LICENSE and NOTICE, a synthetic preview, a clean layout
that works without the Vault mods, portable keys, mods that do not poll or loop when idle, vendored icons,
tests, CI on three operating systems, a README, a Pages site under `docs/`, `AGENTS.md` and `llms.txt`.

## Scope and non-goals

In scope: everything in the three audits except the items listed under "Deferred to round 2".

Non-goals this round:
- `mods/attention-picker` (bundled copy, canonical source is the herdr-agents-waiting repo). Nobody edits it;
  needs go to that repo's board and the coordinator syncs it after the round.
- Renaming layouts or mods (the published slug is not fixed yet).
- Changing repo visibility, settings, topics or enabling Pages (manual author steps, listed in the publish checklist).
- Driving the running app (`herdr-app do/shot/status`) or writing under the Herdr app home.

## Decisions (disagreements between the audits, resolved)

| # | Question | Decision | Reason |
|---|----------|----------|--------|
| D1 | Test folder: `test/` (completeness) or `tests/` (code-review) | `tests/`, owned by code-review. CI runs `node --test tests/`. | Folder is assigned to code-review; node finds either. |
| D2 | Key defaults: documentation proposed keeping `ctrl-b b` as the cross-platform key; completeness and code-review drop the `ctrl-b` prefix | Drop it. keys.json ships no `ctrl-b` chords; the tmux-style set is documented in the README as an optional paste-in (docs owns that text, completeness reviews it). | A `ctrl-b` prefix steals readline back-char and tmux's prefix in every pane. |
| D3 | `bar-strip.attention` binding: `global` (current) vs layout sections | Bind it only in `layout:portrait` and `layout:portrait-bottom` (Herdr delivers the command to shown copies only). Use a chord that is NOT `ctrl-shift-a`, because the standalone attention-picker repo binds `ctrl-shift-a` to `mod.open:attention-picker` and two merged keys.json files must not collide. | Documentation DOC-1-8 plus the cross-repo board note. |
| D4 | Free keys | Completeness picks them and proves they are free: not a Herdr default (`ctrl-shift-l` layout cycle and `ctrl-shift-b` sidebar toggle are taken), not `ctrl-alt-*` (AltGr on Windows), not a program-reserved `ctrl-<letter>`, verified against `herdr-app commands` and the key list in Herdr's reference. `cmd-` variants stay as macOS aliases. | HC-1-3. |
| D5 | Theme | Ship no theme, set no root `theme` (completeness). The documentation page says "no theme pinned; Settings, Look decides" and the preview uses the default `graphite` colors. Documentation's option (b) (pin paper/graphite) and (c) (carry vesper) are described as user choices only. | The layout only uses theme tokens; vesper is third-party. |
| D6 | Vault | Layouts lose the `vault` child. `snippets/vault-panel.json` is the opt-in. The Vault button, the stored panel choice and the note rows appear only when the vault mod is installed (`mods/vault/main.js` exists, published as shared `mods.vault`) AND the layout has a `vault` node. | HC-1-2 and CR-1-5 agree; this fixes the DOC-1-6 limitation. Stable ids: stack `panel-body`, panel `panel`, child `vault`, bar `bar`. |
| D7 | nvim socket location | Stays under `/tmp` on POSIX (code-review). Not `appHome/data` (completeness suggestion). | macOS `$TMPDIR` and a long home path can exceed the 104-byte unix-socket limit; `/tmp` is short. Disclosed in RECIPE and the privacy page. |
| D8 | Windows click-to-edit | Read-only preview plus a one-time info toast; editing in nvim is macOS/Linux (and remote POSIX machines). No `$EDITOR` fallback. | CR-1-4; documentation states exactly this. |
| D9 | Vendored icons and the spinner | Code-review vendors the 12 icons listed in CR-1-10 into the mods that use them and replaces the Obsidian logo with its own `note.svg`. Completeness records provenance in NOTICE: Lucide icons are ISC, `spinner.svg` is Herdr art, Apache-2.0 (Herdr's repos are Apache-2.0). If completeness finds the spinner cannot be redistributed it says so on the board and code-review draws its own ring in round 2. | Unblocks both roles now. |
| D10 | Who owns `mod.json` | Completeness, for all mods (so `portrait-files` gets its `title`, DOC-1-9 and HC-1-10 are one change). Code-review owns everything else inside `mods/<m>/`. | One owner per file. |
| D11 | Validation overlap | Code-review's `tests/` check the mod code (asset paths used in JS resolve inside the repo, no home paths, no external-mod icons). Completeness' `scripts/` check layouts, keys, mod.json fields, RECIPE, NOTICE, preview, privacy of the whole tree, docs. The two never edit each other's files. | Avoids duplicate ownership. |
| D12 | Install URL | The README and AGENTS.md install lines contain the repo address (owner/name). Accepted. No other personal data anywhere; LICENSE keeps the copyright line. | DOC-1 decision, no veto. |
| D13 | Pane-less agents (CR-1-11) | Do the safe parts (Map keyed by address, `byPane` only for truthy pane, no per-column `spaces()`, lazy `terminals()`, conditional timer). The extra "agent without a pane" row is deferred. | Evidence for a null `pane` is not proven; row design needs a look at real data. |
| D14 | Docs checker | Documentation supplies the spec (DOC-1-15); completeness writes `scripts/check-docs.mjs` last, covering internal links, no external hosts except github.com and herdr.dev, `llms.txt` equals `docs/llms.txt`. The keys-table-versus-keys.json comparison is deferred. | Needs final docs first. |

## File ownership

Every tracked file has exactly one owner this round.

| Owner | Files |
|-------|-------|
| round-lead | `plans/round-1/PLAN.md` |
| code-review | `plans/round-1/code-review.md`; `mods/*/main.js`, `mods/*/logic.mjs`, every `*.svg` and other asset inside `mods/<m>/` except `mod.json` and except `mods/attention-picker/**`; `tests/**` |
| documentation | `plans/round-1/documentation.md`; `README.md`, `docs/**` (including `docs/.nojekyll`, `docs/assets/**`, `docs/llms.txt`), `AGENTS.md`, `llms.txt`, `CHANGELOG.md`, `CONTRIBUTING.md` |
| herdr-completeness | `plans/round-1/herdr-completeness.md`; `LICENSE`, `NOTICE`, `RECIPE.md`, `preview.png`, `layouts/**` (json and svg thumbnails), `snippets/**`, `keys.json`, `mods/*/mod.json`, `.gitignore`, `.github/**`, `scripts/**` (including `PUBLISH.md`) |
| nobody (frozen) | `mods/attention-picker/**` |

Each role may append an "Apply log" section to its own audit file. Everything else (the board) is
append-only through shell heredocs.

## Tasks

Acceptance checks are commands from the repo root unless noted. `check all mods` means
`for m in mods/*; do herdr-app check "$PWD/$m"; done` (absolute folder).

### code-review

| Id | Title | Files | Acceptance |
|----|-------|-------|------------|
| CR-1-1 | Test harness: `logic.mjs` per mod, `tests/*.test.mjs`, `tests/repo.test.mjs` invariants | `tests/**`, `mods/{portrait-tree,portrait-files,bar-strip}/logic.mjs` | `node --test tests/` green; renaming a vendored icon makes `repo.test.mjs` fail; check all mods passes |
| CR-1-5 | Vault gating: probe `mods/vault`, shared `mods.vault`, guard `vault.panes` records, tabs `enabled` | `mods/{bar-strip,portrait-tabs,portrait-tree,portrait-pane}/main.js`, their logic files | tests for `vaultWanted`, `noteParts` with `{}`, `{vault:1}`, missing file |
| CR-1-10 | Vendor icons per mod, own `note.svg`, no reference to other mods' assets except `mods/vault/icons/book-open.svg` (allowlisted) | `mods/{bar-strip,portrait-tree,portrait-tabs,portrait-pane,portrait-files,nvim-float}/*.svg` and the `svg()` calls | `repo.test.mjs` finds no `mods/{workspace-chrome,pane,files,changes}/` or `obsidian.png` outside attention-picker; final asset list per mod posted on the board |
| CR-1-2 | Files panel: no poll, refresh or watch while closed; no watch on home; one watch per root | `mods/portrait-files/main.js`, `logic.mjs` | `filesVisible` tests (hidden, other child, missing nodes) |
| CR-1-3 | Spine store: no render loop on write failure, cool-down, prune, control chars, font fallback, one separator rule | `mods/portrait-tree/main.js`, `logic.mjs` | store tests with failing fake fs and fake clock; prune test |
| CR-1-4 | Portable nvim launch: `printenv PATH`, plain `sh` argv, Windows preview fallback, exit 127 message; copies of helper identical in `portrait-files` and `nvim-float` | `mods/portrait-files/{main.js,logic.mjs}`, `mods/nvim-float/{main.js,logic.mjs}` | `nvimArgv` tests with spaces and a quote; test that both helper copies are byte-identical |
| CR-1-9 | One `tilde(path, home)` using `home()` in nvim-float, tree and pane | the three `main.js` files and logic files | tests: mac, linux, windows mixed separators, `/` home, sibling prefix, trailing slash |
| CR-1-6 | Single in-flight edit gate; kill the terminal on peek timeout | `mods/portrait-files/main.js`, `logic.mjs` | gate test |
| CR-1-8 | Git marks: `markOf`, `--show-prefix`, bubble to folders, sort before slice, one collator | `mods/portrait-files/main.js`, `logic.mjs` | tests with `-z` output (spaces, `AA`, prefix `src/`), 600-entry arrange |
| CR-1-7 | `planColumns` and `wheelSteps` extracted, empty list and tiny width safe | `mods/portrait-tree/main.js`, `logic.mjs` | property test against the old inline code on 200 random inputs before it is deleted; empty-list test |
| CR-1-12 | Validated and pruned persisted state (`readJson`) | `mods/portrait-tree/main.js`, `mods/portrait-tabs/main.js`, logic files | fake-storage tests: corrupt, wrong shape, prune keeps live and recent, empty live list prunes nothing |
| CR-1-13 | Bell: real key from `keys()`, no stacked pickers, `PICKER` constant | `mods/bar-strip/main.js`, `logic.mjs` | `keyHint` tests (global, layout, unbound) |
| CR-1-11 | Reduced: address-keyed `named` Map, `byPane` for truthy pane only, `header(sp)`, lazy `terminals()`, conditional 30 s timer | `mods/portrait-tree/main.js` | `dedupeNames` test |
| CR-1-14 | Hardening and stale comments (tabs wheel via `wheelSteps`, `shown[from]?.id`, `zoom` guard, duplicate mouse-down, blank lines, comments describing the old peek) | `mods/portrait-tabs/main.js`, `mods/nvim-float/main.js`, `mods/portrait-files/main.js` | check all mods; `rg -n 'peeked over\|↗ keep' mods` is empty |

Suggested internal order: CR-1-1, CR-1-5, CR-1-10 (others depend on these), then CR-1-2, 3, 4, 9, 6, 8, 12, 13, 7, 11, 14. If time runs short the tail (CR-1-7, 11, 14) moves to round 2; say so in the apply log.

### herdr-completeness

| Id | Title | Files | Acceptance |
|----|-------|-------|------------|
| HC-1-4 | LICENSE (Apache-2.0) and NOTICE (clones, bundled attention-picker, Lucide ISC icons, Herdr spinner, statement of changes) | `LICENSE`, `NOTICE` | validate checks LICENSE header and that NOTICE names every `cloned_from` mod and every vendored icon |
| HC-1-11 | `.gitignore` | `.gitignore` | `git status` clean after check all mods |
| HC-1-10 | mod.json: `title` for portrait-files, known fields only | `mods/*/mod.json` | check all mods; validate key whitelist |
| HC-1-2 | Layouts without the vault child; `snippets/vault-panel.json` | `layouts/*.json`, `snippets/vault-panel.json` | validate: every `content.mod` is in `mods/` or on the shipped allowlist; ids `panel`, `panel-body`, `bar` still exist |
| HC-1-3 | Portable `keys.json` per D2, D3, D4 | `keys.json` | validate: actions exist in the `herdr-app commands` snapshot, no duplicate chords, no reserved ctrl letters |
| HC-1-6 | Synthetic `preview.png`, layout thumbnails, root `preview` field | `preview.png`, `layouts/portrait.svg`, `layouts/portrait-bottom.svg`, `scripts/make-preview.mjs` | check-assets: PNG header, width at least 800; the PNG viewed before commit; invented content only |
| HC-1-1 | `RECIPE.md` with the six sections and the disclosure block (no network; runs git, sh, powershell, nvim, hc; reads open folders and terminal text; writes spines under the app data folder and the `/tmp` nvim socket) | `RECIPE.md` | check-recipe: headings in order, preview embedded, every layout and mod named, no `/Users/` |
| HC-1-5 | Scripts and CI: `validate.mjs`, `privacy-scan.mjs`, `check-recipe.mjs`, `check-assets.mjs`, `shipped-mods.json`, `commands.json`; workflow on ubuntu, windows, macos running those scripts and `node --test tests/` | `scripts/**`, `.github/workflows/ci.yml` | all scripts exit 0 locally; after the push, `gh run list --branch feat/round-1-share-ready` shows the three legs (see risks) |
| HC-1-7 | Record shipped-mod dependencies and icon provenance in NOTICE and RECIPE; shrink the allowlist to `workspace-status`, `changes`, `picker`, `machine-add`, `menu`, `new-menu` | `NOTICE`, `RECIPE.md`, `scripts/shipped-mods.json` | validate |
| HC-1-8 | RECIPE "Watch out" lists the editor assumptions and the per-OS facts from the final code-review behavior | `RECIPE.md` | review against the code-review apply log |
| HC-1-9 | Load-bearing names list in RECIPE; validate extracts them and fails if they vanish from layouts or keys | `RECIPE.md`, `scripts/validate.mjs` | validate |
| HC-1-12 | `scripts/PUBLISH.md`: publish checklist (topic, visibility, Pages, denylist scan, CI green, tag) | `scripts/PUBLISH.md` | file exists; every manual step marked "author" |
| DOC-1-15 (script half) | `scripts/check-docs.mjs` per D14 | `scripts/check-docs.mjs` | exits non-zero on a deliberately broken link in a scratch copy |

### documentation

| Id | Title | Files | Acceptance |
|----|-------|-------|------------|
| DOC-1-4 | Privacy and side-effects page and README table, from the FINAL code behavior | `docs/privacy.html`, `README.md` | each table row traces to a function name in the code; `rg -n 'https?://' docs` lists only github.com and herdr.dev |
| DOC-1-5 | Per-OS matrix with exactly D8 and the final keys | `docs/platforms.html`, `README.md` | rows cite the deciding code or key; no claim of testing that did not happen |
| DOC-1-3 | `AGENTS.md` and `llms.txt` (Herdr's sharing protocol: tell the person what runs, never overwrite, rename on clash, merge keys asking first, check each mod, switch layout) | `AGENTS.md`, `llms.txt`, `docs/llms.txt` | a dry run of the steps in a scratch app home by reading only; links resolve |
| DOC-1-1 | README: pitch, preview, install by agent and by hand, keys, requirements, optional Vault snippet, optional tmux-style keys, privacy, troubleshooting, uninstall, credits | `README.md` | internal links resolve; `rg -n '/Users/\|@[a-z0-9.-]+\.[a-z]' README.md` empty |
| DOC-1-2 | Pages site: plain HTML and CSS, `.nojekyll`, no CDNs, light and dark, 16 px gutters, skip link, one `h1` per page, alt text | `docs/**` | `node scripts/check-docs.mjs` green; CSS reviewed at 360 px and 1280 px by reading |
| DOC-1-12 | Usage and troubleshooting pages written from the final behavior | `docs/usage.html`, `docs/troubleshooting.html` | each sentence traces to a function; stale behaviors (poll while closed, spine loop) not described |
| DOC-1-6, 7, 8, 11, 13 | Vault page text (opt-in, snippet), theme page text (D5), keys table (equal to `keys.json`), "Needs from Herdr" table (from the CR asset list and HC allowlist), provenance table (original, cloned, bundled) | `docs/configuration.html`, `docs/install.html`, `README.md` | table rows equal `keys.json` and `rg -l cloned_from mods` by hand |
| DOC-1-10 | `CHANGELOG.md` (Unreleased holds round 1) and `CONTRIBUTING.md` (one test command `node --test tests/`, the scripts, the frozen-copy rule, manual checklist, publish pointer to `scripts/PUBLISH.md`) | `CHANGELOG.md`, `CONTRIBUTING.md` | every command in CONTRIBUTING run once |
| DOC-1-14 | Link to RECIPE.md instead of duplicating it; repeat only user-facing numbers | README, docs | numbers equal `layouts/portrait.json` |

Not owned by documentation (reassigned to the owner of the file): DOC-1-6 code part to code-review (CR-1-5), DOC-1-9 comments to code-review (CR-1-14) and `mod.json` title to completeness (HC-1-10), DOC-1-7 and DOC-1-8 file changes to completeness (D4, D5).

## Cross-role dependencies and landing order

1. Wave 0 (no waiting, start together): CR-1-1; HC-1-4, 1-10, 1-11, 1-2, 1-3 (keys and snippet names are posted on the board as soon as written); documentation fact pages that do not depend on code (DOC-1-3 skeleton, DOC-1-10).
2. Wave 1: CR-1-5, 1-10, then the remaining CR tasks, each pushing its commit as it lands and posting "landed" on the board with the visible behavior change. HC-1-6, HC-1-1, HC-1-5 and NOTICE/icon records proceed in parallel (the vendored icon names are fixed in CR-1-10, so NOTICE does not wait).
3. Wave 2 (needs wave 1):
   - Documentation final text for privacy, platforms, usage and troubleshooting waits for the code-review apply log and for `keys.json`, `snippets/vault-panel.json` and `preview.png`. Docs copies `preview.png` to `docs/assets/preview.png`.
   - HC-1-8 and the RECIPE "Watch out" wait for CR-1-4 and CR-1-9.
   - `scripts/check-docs.mjs` and the final `validate.mjs` run go last, after documentation lands.
4. Hand-offs that must be posted on the board before the dependent role writes: final `keys.json` table (completeness to documentation), snippet filename and stack child id (completeness), asset list per mod and Windows behavior (code-review, already posted in the audits, confirm when landed), final list of icons for NOTICE (code-review).
5. Commit hygiene: a role commits only paths it owns (`git add <paths>`), one commit per task or small group, then `git pull --rebase` and push. A role that finds a bug in a file it does not own posts to the owner on the board instead of editing.

## How the round is verified

At the end of wave 2 the round lead (or completeness for steps 1 to 3) runs, from the repo root:

1. `node --test tests/`
2. `for m in mods/*; do herdr-app check "$PWD/$m" || echo FAIL $m; done`
3. `node scripts/validate.mjs && node scripts/privacy-scan.mjs && node scripts/check-recipe.mjs && node scripts/check-assets.mjs && node scripts/check-docs.mjs`
4. `rg -n '/Users/|/home/[a-z]|C:\\\\Users|@[a-z0-9.-]+\.(com|org|net|dev)' --glob '!LICENSE' --glob '!plans/**' .` returns nothing that is not an allowlisted repo address.
5. `rg -n 'mods/(workspace-chrome|pane|files|changes)/|obsidian\.png' mods --glob '!attention-picker/**'` returns nothing.
6. `git log --format=%B main..HEAD` contains no home path or e-mail.
7. After the push: `gh run list --branch feat/round-1-share-ready` (with the GitHub token from the repo owner's account) shows the three matrix legs; failures are fixed or written into round 2.
8. Manual items only the author can do (not blocking, listed in `scripts/PUBLISH.md`): look at the app with the layout, a fish login shell for the nvim click, a Linux and a Windows run.

## Risks

- Code-review is the largest workload (14 tasks, all in the same few `main.js` files). Mitigation: the order above; the tail is allowed to slip to round 2.
- Documentation depends on behavior that changes during the round. Mitigation: final text is written from the code-review apply log, and docs refer to function names, not line numbers.
- `herdr-app check` cannot see runtime behavior (vault gating, polling, nvim). The pure-logic tests carry that, and the author's manual list covers the rest. Behavior is not verified in a live app (rule 2).
- CI is created in this round, so the first matrix run may fail on Windows (separators). Treated as a round-2 input if it cannot be fixed with a small change in the owner's file.
- The shared tree: three roles committing to one branch. Mitigation: disjoint file ownership and `git add <paths>`.
- Spinner redistribution and the free-key choice rest on completeness' verification; a negative result is a board message plus a round-2 task.
- Hard-coded `ctrl-shift` chords may still collide with a terminal program on some OS; completeness documents how to rebind.

## Deferred to round 2

| Item | Reason |
|------|--------|
| Virtualised Files rows (`v_virtual_list`) | Row handlers and modifier clicks are not available in virtual lists; needs a gesture design (CR deferred list) |
| Extra rows for agents without a pane (rest of CR-1-11) | No evidence the data has a null pane; needs a look at real data |
| `tab.settled` folding in portrait-tree | Optional feature, not a sharing blocker |
| Duplicated helpers shared with attention-picker (`nameOf`, `duration`, `clean`) | Canonical repo owns them; wait for its round 2 |
| Re-sync of bundled `mods/attention-picker` (spinner, search, logic.js) | Done by the coordinator after the round, from the canonical repo |
| Docs keys table versus `keys.json` comparison script | Needs final docs layout |
| Line-number refresh in docs, screenshot checks at 360 px and 1280 px | Needs a browser, not allowed this round |
| Verified runs on Linux and Windows, CI fixes beyond small ones | Depends on the first CI result and real machines |
| Own-drawn spinner if redistribution is refused | Only if completeness rejects the vendored one |
| Layout rename for the published slug; one herdr.dev entry or two | Author decision |
| Optional Vesper theme file | Author preference; D5 documents the choice instead |

## Round-lead housekeeping

- The completeness audit named the author in two places outside LICENSE; the lead replaced them with placeholders (rule: no real names except the LICENSE copyright line). The LICENSE copyright text is `Copyright 2026 <name from the repo's git author>`; completeness writes the real name only there.
