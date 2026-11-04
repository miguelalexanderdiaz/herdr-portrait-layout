# Round 2, herdr-completeness: audit

Scope: `git diff b4c1673..main` as it touches my files (RECIPE.md, preview.png, mod.json, layouts/, keys.json, LICENSE,
NOTICE, .gitignore, scripts/**, .github/**), plus the round-1 priority list. Read: Herdr's AGENTS.md ("Layouts and mods other
people made", Keys, Mods), `herdr-app commands`, herdrdev/herdr-app (`src/keys.rs`, `defaults/keys*.json`,
`defaults/icons/LICENSES.md`, `.github/`), herdrdev/herdr-layout-examples (structure, `mod.json`, RECIPE shape, preview size),
and the canonical `herdr-agents-waiting` branch `origin/feat/round-1-standalone-picker` (the version the coordinator syncs).

Ran on `main` (macOS, Node 26): `node --test` 73 pass; `validate`, `check-recipe`, `check-assets`, `check-docs` ok;
**`privacy-scan --commits` fails** (HC-2-1). Nothing was run on Linux or Windows and CI has never run (HC-2-2).

## Summary

The format side is in good shape: folder layout matches Herdr's examples, the six RECIPE sections are in order, every
`mod.json` uses only known fields with `place: "none"`, the keys were proven free against Herdr's 0.1.12 defaults (I re-diffed
the snapshots in `scripts/` against herdr-app master today: identical), and the license is detected as Apache-2.0.

What round 1 got wrong or left open, by impact:

1. The history on `main` already contains the author's personal e-mail (GitHub's web merge of PR 1), so the publish gate
   `privacy-scan --commits` is red and the repository cannot go public as is.
2. There is still no CI; the three-OS claim is unproven. The workflow file needs a pushable home and a few hardenings.
3. The coming attention-picker sync makes several RECIPE, NOTICE and validate statements false or stale, and nothing stops
   the "read-only" bundled copy from being edited.
4. NOTICE and RECIPE contain statements the real files do not back (icon geometry claim, one Done-when check, function and
   disclosure lists).
5. Smaller gaps: layout `preview` is not rename-safe, the scripts have no automated negative tests, Herdr-version drift is
   unchecked, `plans/` ships in the public tree.

Round-2 apply order I propose: HC-2-3 first (right after the coordinator's sync commit), then HC-2-5, HC-2-4, HC-2-2, HC-2-6,
HC-2-8, HC-2-9, HC-2-10, HC-2-7, HC-2-11, HC-2-12. HC-2-1 is mostly an author action; I only change the script and the checklist.

---

## HC-2-1 (high) The commit history on `main` carries a personal e-mail; the publish gate is red

- **Evidence.** `node scripts/privacy-scan.mjs --commits` on `main` prints `a commit author or committer address is not a GitHub
  noreply address ("***@gmail.com")`. The one commit is `ef8b513` ("Merge pull request #1 ..."): author = the owner with their
  primary address, committer = GitHub. All other commits use the `users.noreply.github.com` address. `scripts/PUBLISH.md` step 2
  says every command "must exit 0"; step 1 only talks about the denylist, not the address. Every further PR merged in the web UI
  adds another such commit.
- **Change.**
  1. (me) `scripts/privacy-scan.mjs`: print the offending short SHA and which of author/committer it is (today only the masked
     domain is shown, so nobody can find the commit); keep the failure.
  2. (me) `scripts/PUBLISH.md`: new step 0 before "Before publishing" (**author**): GitHub, Settings, Emails: tick "Keep my email
     addresses private" and "Block command line pushes that expose my email" **before merging PR 2 or any later PR**, then
     re-run the scan. Add: history cannot be fixed by an agent (rules: no rewrite); to publish with a clean history the author
     either rewrites `main` themselves before the repo goes public, or publishes from a fresh squashed first commit (`git
     checkout --orphan`, commit, push to a new repository or force-push by hand). State plainly that once the repository is
     public the address in `ef8b513` is permanent.
  3. (round-lead) Do not merge round-2 PRs in the web UI until the setting in step 0 is on; use the noreply address as
     the merge-commit email in the dialog.
- **Owner.** herdr-completeness (scripts, PUBLISH.md); author for the GitHub setting and any history decision.
- **Verify.** After the author's step: `node scripts/privacy-scan.mjs --commits` prints `ok`; `git log --format=%ae%n%ce | sort -u`
  shows only noreply addresses.

## HC-2-2 (high) CI is still not in the tree; give the workflow a pushable home and harden it

- **Evidence.** `.github/` does not exist on `main`. The only copy is commit `ad04c3a` on the local branch
  `feat/round-1-share-ready--herdr-completeness-ci` (the token has no `workflow` scope, rule 9). `PUBLISH.md` step 6 reads "CI is
  green on all three operating systems" but there is nothing to read. In that file: actions pinned to tags (`@v4`), while Herdr's own
  workflow pins commits ("org rule") and uses `persist-credentials: false`; `node: ["20"]` plus 22 on ubuntu only, yet
  CONTRIBUTING.md:19 and the scripts' headers promise "Node 18 or newer"; on `push` to `feat/**` and `pull_request` a branch
  with a PR runs twice; there is no `package.json`, so the sibling repo's `npm test` does not exist here.
- **Change.**
  1. `scripts/ci.workflow.yml` (pushable) = the workflow, hardened: `actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1`
     and `actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1 # v7.1.0` (both are the latest releases; SHAs read from the
     GitHub API today), `persist-credentials: false` (the scan only needs local git), matrix ubuntu/windows/macos on Node 20 and 22
     plus one ubuntu leg on Node 18 (or drop "Node 18" from the claims; I choose to test it, the code uses nothing newer: no
     `import.meta.dirname`, no `toSorted`), `push` only on `main` and `pull_request` for the rest (no double runs), `timeout-minutes`,
     `concurrency`. One extra step: `node scripts/make-preview.mjs --svg-only && git diff --exit-code -- layouts scripts/preview-source.svg`
     proves the committed thumbnails and preview source are what the generator writes (deterministic, no rsvg needed).
  2. `scripts/check-all.mjs` and a root `package.json` (`"private": true`, no dependencies, `"engines": {"node": ">=18"}`, scripts
     `test` = `node --test`, `check` = `node scripts/check-all.mjs`): runs validate, check-recipe, check-assets, check-docs and
     privacy-scan in one process-spawn loop and prints one summary; the workflow then calls `npm test` and `npm run check`. No `name`
     owner prefix, no `repository` field with the owner (nothing personal). PUBLISH step 2 collapses to these two commands.
  3. `.github/dependabot.yml` (not under `workflows/`, so it can be pushed now): `github-actions`, monthly, grouped, like Herdr's.
  4. `validate.mjs`: if `.github/workflows/ci.yml` exists it must equal `scripts/ci.workflow.yml`; PUBLISH.md gets the **author** step
     `mkdir -p .github/workflows && cp scripts/ci.workflow.yml .github/workflows/ci.yml`, then push with a workflow-scoped token
     (`gh auth refresh -s workflow`), then `gh run list` (step 6 becomes honest).
  5. Delete nothing: leave the local `...-ci` branch as it is (rule 9).
- **Expected first-run failures to watch for** (never exercised): Windows (`tests/smoke.test.mjs` temp-dir module imports use
  `pathToFileURL`, good; `scripts/check-docs.mjs` and `privacy-scan` read with LF normalisation, good; PowerShell and nvim paths are
  not reached by tests); `node --test` auto-discovery on Node 18/20 (no argument: matches `*.test.mjs` by name, expected fine).
- **Owner.** herdr-completeness (scripts/**, .github/dependabot.yml, package.json, PUBLISH.md). Handoff to documentation: one
  CHANGELOG line and CONTRIBUTING "npm test / npm run check" once it lands.
- **Verify.** `node scripts/check-all.mjs` exits 0 locally; the new validate rule fails when `.github/workflows/ci.yml` differs
  (scratch copy); `node scripts/make-preview.mjs --svg-only` leaves `git status` clean; the author pushes and reads the first run.

## HC-2-3 (high) The attention-picker sync invalidates statements here, and the "read-only" copy is not protected

- **Evidence (canonical `origin/feat/round-1-standalone-picker` vs this repo).**
  - RECIPE.md:236-237 says `hc read` runs "every 2 seconds"; the new `main.js` has `POLL_MS = 3000`, `READ_LINES = 60`,
    `READ_CONCURRENCY = 4` (`hc read <address> --lines 60`). Same wording in docs/privacy.html and AGENTS.md (documentation's).
  - It adds a localStorage key `attention.seen` (RECIPE's localStorage list at RECIPE.md:221-222 names only the tree's and the tabs'
    keys); props `search` now defaults to on (RECIPE.md:210 says `props() = { search }`); new files `logic.js`, `spinner.svg`,
    `search.svg`.
  - `scripts/shipped-mods.json` `tolerated_assets["attention-picker"]` still lets that mod load `mods/workspace-chrome/spinner.svg`
    and `search.svg`; the new copy loads none, so the allowance is dead and would silently excuse a regression.
  - NOTICE.md section 3 calls the copy "unmodified" and does not mention its two icons. Verified: they are NOT Herdr's files
    (canonical `search.svg` has `r="6"`, stroke 1.6; Herdr's has `r="6.5"`, stroke 1.5; spinner 9 vs 9.4), so they must not
    be listed under "Herdr art"; the canonical NOTICE says they were drawn for that project.
  - Nothing enforces "do not edit mods/attention-picker": `tests/repo.test.mjs` and `validate.mjs` only check its shape.
- **Change (apply right after the coordinator's sync commit).**
  1. `scripts/shipped-mods.json`: empty `tolerated_assets["attention-picker"]`; `validate.mjs` then fails if any bundled file loads
     another mod's asset.
  2. New `scripts/bundled.json` = `{ "source": "herdr-agents-waiting", "ref": "<commit of the synced branch>", "files": { "<path>":
     "<sha256>" } }` for every file in `mods/attention-picker/`, and a `validate.mjs` check that recomputes the hashes (LF-normalised).
     Editing the copy by hand, or forgetting a file of the next sync, fails the suite on all three OSes. PUBLISH step 7 becomes "re-sync
     and regenerate with `node scripts/bundled.mjs`" (a small helper that prints the new JSON; it does not fetch anything).
  3. RECIPE.md: table row (props default on, bar-strip still passes an explicit boolean), disclosure (3-second polling, `--lines 60`,
     `attention.seen` in localStorage, no screen text stored), "Done when" mentions the unchanged `ctrl-shift-j` path. NOTICE section 3: say
     "unmodified copy ... its two icons (`spinner.svg`, `search.svg`) are that project's own drawings, see its NOTICE; not Herdr's".
  4. Keep the rule that `keys.json` here never binds `ctrl-shift-a` (the canonical repo owns it); RECIPE "Watch out": if both repos are
     installed there are two ways to open the picker, which is fine.
- **Owner.** herdr-completeness for items 1-4; documentation for docs/privacy.html, AGENTS.md ("every 2 s") after my wording is on
  the board; code-review: nothing (the copy stays read-only), but `tests/repo.test.mjs`'s `files()` helper filters `.js|.mjs` so `logic.js`
  is already covered by the module-import checks.
- **Verify.** `herdr-app check <abs>/mods/attention-picker`; `node scripts/validate.mjs` ok after the sync, fails when one byte of
  `mods/attention-picker/main.js` changes (scratch copy); `rg -n "2 seconds|every 2" RECIPE.md docs AGENTS.md` empty.

## HC-2-4 (medium) NOTICE states things about icons that the files do not back

- **Evidence.**
  - NOTICE.md:76-80: "`bell.svg`, `chevron-left.svg`, `file.svg` and `note.svg` (Lucide's file-text) have exactly the geometry of the
    Lucide icon of that name". Compared with Lucide's current `icons/` (tarball of `lucide-icons/lucide` main): `bell`, `chevron-*`,
    `plus`, `settings`, `folder` match exactly; `file.svg` (`M15 2H6a2 2 0 0 0-2 2v16...`) and `note.svg` do not (Lucide's `file`
    is `M6 22a2 2 0 0 1-2-2V4...`). They are an older Lucide drawing, or Herdr's copy of it, not "exact".
  - Herdr states its own rule in `defaults/icons/LICENSES.md`: "Glyphs ... including icons in shipped mods: Lucide, ISC, with MIT-licensed
    Feather-derived icons." NOTICE instead sorts Herdr's icons into "Herdr art, Apache-2.0" (`search`, `server`, `changes`, `close`,
    `split-*`, `zoom`, `unzoom`, `win-*`, `spinner`) by guesswork. Those files do differ from Lucide (stroke 1.5, other radii), so
    Herdr drew them; the claim "Apache-2.0" for them is plausible but Herdr's repository says nothing file by file.
  - `fold.svg`, `unfold.svg` (portrait-tree) are still "drawn in the Lucide style; the original file was not recorded"
    (NOTICE.md:88-89). They match no current Lucide icon (`fold-horizontal` has dashes). Round-1 priority 5 is not resolved.
- **Change.**
  1. Rewrite NOTICE sections 1-2 so each statement is one the repo can support: every icon copied from a shipped Herdr 0.1.12 mod is listed
     with its source folder, and the notice says "Herdr documents glyphs in its shipped mods as Lucide (ISC, with MIT Feather-derived icons) in
     `defaults/icons/LICENSES.md`; the ones drawn differently are Herdr's own work under Apache-2.0; both license texts are reproduced". Drop
     "exactly the geometry".
  2. fold/unfold: ask the author (board) whether they drew them. Default, since nobody answers in an unattended run: code-review replaces
     them with the already-documented `chevron-left.svg`/`chevron-right.svg` (a fold = chevron pointing at the spine, unfold = away) or
     draws two small originals; I then list them as "original, Apache-2.0". Until then NOTICE keeps the precautionary Lucide line.
  3. `validate.mjs`: NOTICE must have an entry per icon basename (already) and each entry must sit under a heading that names a license
     (Herdr, Lucide, original); a stale or unlisted file fails (already for basenames).
- **Owner.** herdr-completeness (NOTICE, validate); code-review for the fold/unfold SVGs.
- **Verify.** `node scripts/validate.mjs`; `rg -n "exactly the geometry" NOTICE` empty; `rg -n "not recorded" NOTICE` empty once item 2 lands.

## HC-2-5 (medium) RECIPE has claims and lists the code does not back

- **Evidence.**
  - "Done when" (RECIPE.md:298-299): "`herdr-app commands` lists every command in `keys.json`". `bar-strip.attention` is a mod command;
    `herdr-app commands | rg -c bar-strip` is 0. A fresh builder following the check fails it.
  - RECIPE.md:13: "It uses the theme, fonts and keys of the person's own settings: it sets none." It ships four keys.
  - "Functions and commands used" (RECIPE.md:224-229) omits `keys` (bar-strip.js:8 reads the person's key bindings to print the bell
    tooltip: a read of their key config), `fs/promises` (portrait-tree writes, lists and deletes under `<app home>/data/portrait-tree-spines`),
    and the command `terminal.kill` (ends a stuck nvim terminal). I verified with a script over all own mods: imports from `"herdr"` not named
    in RECIPE = `keys`; `run("...")` commands not named = `terminal.kill`.
  - Disclosure: `exec("sh", ["-c", 'exec "${SHELL:-sh}" -lc "printenv PATH"'])` (portrait-files/logic.mjs:47, nvim-float/logic.mjs:35) starts the
    person's login shell, which runs their shell startup files; RECIPE says only "asks the login shell for its PATH". Remote machines: `exec`
    runs on the space's machine (`on`); stated for files, not for the PATH query and the nvim launch.
- **Change.**
  1. Fix the Done-when item ("every command in `keys.json` except the mod command `bar-strip.attention`, which is `<mod>.<command>`"); rewrite the
     line at :13 ("It sets no theme and no fonts; it adds four keys, see Keys"); add `keys`, `fs/promises (readFile, readdir, mkdir, writeFile,
     unlink)`, `terminal.kill`; extend the disclosure with the login-shell startup files and that nvim, the PATH query and `hc run` run on the
     folder's machine.
  2. `check-recipe.mjs`: cross-check the code: every name imported from `"herdr"` by an own mod, every literal `run("x.y")` command and every
     literal program in `exec("prog", ...)` / `hc(` must appear in the "Built from" text, and the strings `fetch(` / `WebSocket` / `XMLHttpRequest`
     must not occur in any mod while "Network: none" is claimed. This is the only mechanical link between the disclosure Herdr installers rely on
     and the code.
  3. After HC-2-3, run the same cross-check on `mods/attention-picker` (its `hc`, `localStorage`).
- **Owner.** herdr-completeness (RECIPE.md, check-recipe.mjs).
- **Verify.** `node scripts/check-recipe.mjs` ok; adding `import { x } from "herdr"` or a `fetch(` to a mod in a scratch copy makes it fail;
  `herdr-app commands` against the new Done-when wording.

## HC-2-6 (medium) The layout `preview` field is not rename-safe, and the thumbnails may not be copied

- **Evidence.** `layouts/portrait.json:7` `"preview": "layouts/portrait.svg"`; Herdr's AGENTS.md:258 defines it as `layouts/<name>.svg` of the layout's
  own name. Herdr's install protocol (AGENTS.md:426) says "copy the layout file to `layouts/`"; an installer that copies only the `.json` loses the
  thumbnail, and one that renames the layout on a name clash (step 2) leaves `preview` pointing at the old name. The repo's rename checklist
  (AGENTS.md "Rename checklist", RECIPE "Watch out") never mentions `preview`. `validate.mjs:74` only checks that the file exists, not that it belongs to
  the layout. Herdr's own examples keep the thumbnail inside the mod folder (`mods/mission/preview.svg`) so it travels with the copied folder.
- **Change.**
  1. `validate.mjs`: `preview` must equal `layouts/<file name>.svg` (so a rename that forgets it fails); `check-assets` already checks the SVG.
  2. RECIPE "Watch out", Layout and section names: "copy `layouts/*` (the `.svg` thumbnails too) and rename the root `preview` with the layout".
  3. Keep the thumbnails in `layouts/` (Herdr's documented place; moving them into a mod folder would reload that mod on every thumbnail change).
- **Owner.** herdr-completeness (validate, RECIPE); documentation adds `preview` to AGENTS.md's rename checklist and README's by-hand steps.
- **Verify.** In a scratch copy rename `layouts/portrait.json`: validate names the stale `preview`; `herdr-app` accepts the layout (author).

## HC-2-7 (medium) `plans/` ships in the published tree and the scan exempts it

- **Evidence.** `plans/round-1/*` (168 KB: audits, logs, the board, session wording, "the author's live app", theme names) is tracked on `main`. Installers
  never copy it, but it is public once the repo is. `privacy-scan.mjs:46` exempts `plans/` from the home-path and e-mail rules (they quote the patterns).
  A real path pasted into a plan would pass. Today a search finds only generic patterns, no personal data.
- **Change.** Decide in PUBLISH.md (new **author** step): either keep `plans/` and tighten the scan (exempt only lines that contain a regex or
  `<home>`, i.e. apply the rules to everything else), or publish without it (`git rm -r plans` on a release branch; the process notes stay in the
  history). Default I implement: tighten the scan and add one sentence to the checklist; the author can still remove the folder.
- **Owner.** herdr-completeness (scan, PUBLISH.md); round-lead decides whether `plans/` stays.
- **Verify.** Put `a macOS home path` on a plain line of a plan in a scratch copy: scan fails; the existing plans still pass.

## HC-2-8 (medium) The checks have no automated negative tests

- **Evidence.** The round-1 log lists negative tests "(scratch)", run by hand once. `tests/` covers mods only. A broken rule in `validate.mjs` (for
  example the hand-written duplicate-chord parser at lines 125-144, or the `ctrl-alt` rule) would stay green forever, so "validate: ok" proves less than the
  PUBLISH checklist claims.
- **Change.** `scripts/checks.test.mjs` (runs under plain `node --test`, no dependencies): copy the repo files to a temp dir (no `.git`, so the scripts use
  their directory walk), apply one fault, run `node <copy>/scripts/<script>.mjs`, assert exit 1 and the message. Faults: duplicate chord, `ctrl-b a`,
  `ctrl-c`, `ctrl-alt-x`, a Herdr default chord, unknown action, theme in a layout, a `vault` node in a layout, renamed layout (HC-2-6), unlisted icon,
  stale NOTICE line, edited bundled file (HC-2-3), RECIPE heading swapped, a home path, an e-mail, a CRLF RECIPE, a `fetch(` in a mod (HC-2-5), and (git
  temp repo) a gmail commit author (HC-2-1). Plus the clean tree passes. Skipped on a read-only temp dir, never touches the real tree.
- **Owner.** herdr-completeness (scripts/). `tests/**` belongs to code-review, so the file lives in `scripts/` (Node 22+ and 18/20 both discover
  `*.test.mjs` outside `tests/`; I verify on this machine and tell code-review so `repo.test.mjs` does not assume `tests/` is the only place).
- **Verify.** `node --test` shows the new cases; removing a rule from a script in a scratch copy makes its case fail.

## HC-2-9 (low) preview.png is portrait only and its source link is unproven

- **Evidence.** Herdr's example previews are 1600x900 (checked `mission`, `board`); `check-assets.mjs:22-23` demands width >= 800 and height > width, a rule
  invented here. herdr.dev's card crop is unknown; a 1080x1920 image may be letterboxed or cropped to the middle (where only the terminal text is). The image
  is rendered from `scripts/preview-source.svg` by `rsvg-convert`, which CI does not have, so nothing proves `preview.png` still equals the source.
- **Change (options, no change without the author's pick; schematics first).** A: keep the tall image (honest, shows the format). B: a 1600x900 composite:
  the tall window at 45% height on the left half plus the bar crop enlarged on the right half, so any card crop shows the idea. C: keep A and add
  `preview-wide.png` for README only. I recommend A now, B if the gallery crops it badly after publish (step 14 of PUBLISH.md checks it). Independently:
  `scripts/preview.sha256` holds the SHA-256 of `preview-source.svg`; `check-assets` fails when the SVG changed but the file was not re-rendered
  (`make-preview.mjs` writes it when `rsvg-convert` ran).
- **Owner.** herdr-completeness. **Verify.** `node scripts/check-assets.mjs`; open the image and the source side by side (author, once).

## HC-2-10 (low) Drift tooling for the Herdr snapshots and the cloned mods

- **Evidence.** `scripts/default-keys.json`, `commands.json` are hand snapshots of 0.1.12 ("Refresh when Herdr changes its defaults"); no command refreshes
  them. Today they are identical to herdr-app master (diffed). `cloned_from` pins `tabs`, `pane`, `files` and the layout `main` at 0.1.12; Herdr never updates a
  clone, and the NOTICE "Changes:" paragraphs are not checkable against the upstream.
- **Change.** `scripts/refresh-snapshots.mjs` (maintainer tool, Node's `fetch`, never run in CI or by installers): rewrites both snapshots from
  `defaults/keys*.json` and a given `herdr-app commands` output and prints a diff summary; a README-level line in PUBLISH.md ("re-run on every Herdr release;
  then `npm run check`"). Optional second mode `--clones`: fetch the four upstream files at the `cloned_from` tag and print `diff --stat` per clone to keep the
  NOTICE statement of changes honest. The script reaches the network; its header and CONTRIBUTING say so.
- **Keys note.** `cmd-b` on Linux and Windows: GPUI parses `cmd`, `super` and `win` as the platform key, so `cmd-b` binds Super+B / Win+B there, which the OS
  usually owns. It should not break the file (`src/keys.rs` hands each chord to GPUI's keystroke parser, which in my reading of its tests accepts `cmd` as the platform key on every OS; not run on Linux or Windows, so unverified), it is simply dead.
  RECIPE's Keys table should say "dead on Linux and Windows; use `ctrl-shift-g`".
- **Owner.** herdr-completeness. **Verify.** Run the refresh on a clean tree: `git diff --stat scripts/` is empty today.

## HC-2-11 (low) JSON hygiene and diff noise

- **Evidence.** `mods/portrait-pane/mod.json` and `mods/portrait-tabs/mod.json` have no final newline and a different layout from the one-line `mod.json` of
  the other mods; `layouts/portrait-bottom.json` lists the root keys in another order than `portrait.json` (the first 8 lines of `diff` are reordering only),
  so a real difference between the two is hard to review.
- **Change.** One rule in `validate.mjs`: every tracked `.json` ends with a newline and parses; rewrite `portrait-bottom.json` with the same key order as
  `portrait.json` (children of `left` reordered only). `.editorconfig` (utf-8, lf, final newline, 2 spaces) so editors agree with `.gitattributes`.
- **Owner.** herdr-completeness (layouts, mod.json, validate, .editorconfig). **Verify.** `diff layouts/portrait.json layouts/portrait-bottom.json` shows only the
  moved `bar`, the `preview` line and nothing else.

## HC-2-12 (low) Cross-platform facts that are stated but never exercised

- **Evidence.** RECIPE and docs state: PowerShell listing and Windows click preview, login-shell PATH under fish, window buttons on Linux and Windows. Round 1
  ran none of them (rules forbid driving the app). PUBLISH.md step 4 lists them for the author but without commands.
- **Change.** In PUBLISH.md step 4, give the author an exact scratch-home sequence per OS (`HERDR_APP_HOME=<empty dir> herdr-app`, copy folders, `herdr-app check` for each
  mod, `layout.switch`, then the Done-when list), and a "result" table to fill in (OS, Herdr version, pass/fail per Done-when item) pasted into the release notes. In
  RECIPE "Watch out", mark the three behaviors "not exercised on a live Linux/Windows build in this repository's history" until the table has been filled. A claim
  stays in RECIPE only as a hypothesis until someone has run it.
- **Owner.** herdr-completeness (PUBLISH.md, RECIPE.md). **Verify.** `node scripts/check-recipe.mjs`; author fills the table.

---

## Not proposed (checked, fine)

- `mod.json` fields (`place`, `title`, `overlay`, `cloned_from`): only fields in Herdr's docs; all `place: "none"` so Herdr does not dock copies on first sight (AGENTS.md:754).
- Keys: `ctrl-shift-g/y/j` and `cmd-b` against herdr-app master defaults: no collision; no `ctrl-b` chord; `bar-strip.attention` only in layout sections.
- LICENSE is the Apache-2.0 text with the copyright line; GitHub's API reports `Apache-2.0`. Herdr has no NOTICE file of its own to propagate.
- Topics: `herdr-layout` is listed in PUBLISH.md and not added by any agent.
- Herdr's `fs` module (portrait-tree spines) is documented (AGENTS.md:965: read in home, write under the app home); no Node API is used outside it.
