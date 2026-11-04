# Round 1, herdr-completeness: apply log

Branch `feat/round-1-share-ready--herdr-completeness` (pushed). Tasks HC-1-1 to HC-1-12 and the script half of
DOC-1-15, in plan order. Nothing was merged. `mods/attention-picker` and the other roles' files were not touched.

## What was done, by task

- **HC-1-4** `LICENSE` is the Apache-2.0 text of Herdr's own repositories with the copyright line filled in
  (`Copyright 2026 <git author name>`, the only place the name appears). `NOTICE` lists: the two layouts and three mods
  cloned from Herdr 0.1.12 with a statement of changes (Apache-2.0 section 4(b)); the Herdr art copied into mod folders
  (spinner, search, server, changes, close, split/zoom, win-*); the Lucide icons (ISC, plus the MIT text for the
  Feather-derived plus and chevrons), split by evidence (class marker or exact geometry, per the code-review
  correction); the bundled attention-picker; that no theme, font or Obsidian logo is shipped.
  Verified facts: `herdrdev/herdr-app` and `herdr-layout-examples` are Apache-2.0 (GitHub license API); Herdr's
  `defaults/icons/LICENSE-Lucide.txt` carries the Lucide and Feather texts that NOTICE reproduces. The spinner is a
  two-path ring in Herdr's `defaults/mods/workspace-chrome`, so it is Herdr art under Apache-2.0: redistribution is fine
  (D9 closed; no own-drawn replacement needed). The Herdr docs tell people to clone shipped mods, so redistributing
  clones with NOTICE is allowed (answer to DOC-1-13).
- **HC-1-11** `.gitignore` widened (OS and editor files, app-written typings, `/data/`, `*.corrupt-*`, `.env*`,
  `.privacy-denylist`, `.wt/`). `git status` stays clean after `herdr-app check` of all 7 mods (verified in a scratch
  clone). Extra, outside the ownership table: a new `.gitattributes` (`* text=auto eol=lf`, PNG binary) so a Windows
  checkout byte-matches the other systems (the `llms.txt` parity check and the RECIPE parsing depend on LF).
- **HC-1-10** `mods/portrait-files/mod.json` got `"title": "Files (portrait)"`. Every mod.json has only known fields
  (`place, title, overlay, focusable, size, cloned_from`), enforced by `validate.mjs`. `herdr-app check` passes for all 7
  mod folders in this worktree and in a scratch merge of the three role branches.
- **HC-1-2** Both layouts lost the `vault` child and gained the root `preview` field; `snippets/vault-panel.json` is the
  one stack child to paste into `panel-body`. `validate.mjs` fails if a layout has a `vault` node, if a `content.mod` is
  neither in `mods/` nor on the shipped allowlist, if a required id is missing (`root left bar bar-strip tree work tabs main
  status panel panel-body files changes`), if the snippet's id collides, or if portrait-bottom differs from portrait by more
  than the order of `left`'s children.
- **HC-1-3** `keys.json`: sections `layout:portrait` and `layout:portrait-bottom` only; `ctrl-shift-g` and `cmd-b`
  toggle the bar, `ctrl-shift-y` flips the layout, `ctrl-shift-j` runs `bar-strip.attention`. Proven free against
  `scripts/default-keys.json` (snapshot of `defaults/keys.json` and `defaults/keys.macos.json` of herdr-app 0.1.12, fetched from
  the official repo) and `scripts/commands.json` (snapshot of `herdr-app commands`). Rules enforced by `validate.mjs`: no
  chord Herdr already binds (the one deliberate exception is the macOS `cmd-b` re-point, written down in the script),
  no plain `ctrl` letter, no `ctrl-alt`, no alt-letter, no multi-key prefix chord, no duplicate within a section, no
  `bar-strip.*` outside a layout section, not `ctrl-shift-a` (standalone attention-picker repo), every action a Herdr
  command or `<mod>.<command>` of a mod in `mods/`. `ctrl-shift-u` and `-i` were skipped on purpose (Unicode input on
  Linux GTK/IBus). The obsidian-vault repo's completeness agent already used the snapshot to move its key off `ctrl-shift-e`.
- **HC-1-6** `preview.png` (1080x1920, PNG without text/time/EXIF chunks), `layouts/portrait.svg` and
  `layouts/portrait-bottom.svg` (Settings thumbnails) drawn from invented content by `scripts/make-preview.mjs`
  (`rsvg-convert` when present; `scripts/preview-source.svg` is the generator's output and is committed). Sizes follow the
  layout JSON and portrait-tree's constants (290px column minimum, 40/24/26px rows). Colors approximate Herdr's
  `graphite`: the exact values are inside the app binary, so they are approximations. The PNG was viewed before commit.
- **HC-1-1** `RECIPE.md`: the six sections in Herdr's order, written from the real files, with the keys table, the
  node tree, the mods table, the disclosure block (network none; programs; reads; writes), the per-OS facts and a
  "Load-bearing names" list. `check-recipe.mjs` verifies headings and order, preview embed, every layout and mod named, every
  key and the layout sizes quoted, the disclosure lines, no home path or e-mail.
- **HC-1-5** Scripts (dependency-free, Node 18+, no shell, LF-normalised reads): `validate.mjs`, `privacy-scan.mjs`
  (files plus, with `--commits`, commit messages and author addresses; optional `.privacy-denylist` and `PRIVACY_DENYLIST`;
  the repo's own github.com address is allowed), `check-recipe.mjs`, `check-assets.mjs`, `check-docs.mjs`, `lib.mjs`,
  `shipped-mods.json` (allowlist), `commands.json`, `default-keys.json`. **CI workflow: see "Denied" below.**
- **HC-1-7** NOTICE and RECIPE record the shipped-mod dependencies and the icon provenance; the allowlist is
  `workspace-status, changes, picker, machine-add, menu, new-menu` (plus the optional `vault`, `vault-reader` used only by the
  snippet). `validate.mjs` fails if any mod loads another mod's file (exceptions: the Vault icon, and the two icons the frozen
  attention-picker still loads), and if NOTICE does not account for a vendored icon or lists a stale one.
- **HC-1-8** RECIPE "Watch out" and the disclosure were rewritten against the code-review apply log and its landed
  state: Files panel idle while closed, `printenv PATH` through the login shell, Windows and missing nvim fall back to the read-only
  preview with a toast, `mods.vault` and `layout` shared keys, spine pruning, `Intl` missing in Herdr's script engine.
- **HC-1-9** Load-bearing names (layout ids, mods, key sections, shared keys, commands) are a list in RECIPE;
  `validate.mjs` extracts it and fails if a name is not in the layouts, `keys.json`, `mods/` or the mod sources.
- **HC-1-12** `scripts/PUBLISH.md`: checklist with every manual step marked **author**; the topic `herdr-layout` is listed,
  not added.
- **DOC-1-15 (script half)** `scripts/check-docs.mjs` per D14 plus the documentation role's list (one h1, lang, title, viewport,
  alt, skip link, no scripts or external loads, unique ids, `.nojekyll`, `llms.txt` parity, `docs/assets/preview.png` equal to
  `preview.png`). Proven to fail on a broken link and a missing anchor in a scratch copy.

## Checks run

| Check | Result |
|-------|--------|
| `node scripts/validate.mjs`, `check-recipe.mjs`, `check-assets.mjs`, `privacy-scan.mjs --commits` on my branch alone | validate fails only on the references that code-review's commit removes (expected before the merge) |
| Same four plus `check-docs.mjs` and `node --test` on a scratch clone with the three role branches merged | all green: 73 tests, 36 SVGs, 106 text files, 20 commit messages; only `CHANGELOG.md` linking keepachangelog.com remains in check-docs (posted to documentation) |
| `herdr-app check <absolute folder>` for the 7 mods, in this worktree and in the scratch merge | all pass; `git status` clean afterwards |
| Negative tests (scratch): duplicate and default chords, `ctrl-b a`, `ctrl-c`, `ctrl-alt-x`, unknown action, `bar-strip.*` in `global`, `ctrl-shift-a`, a theme in a layout, a renamed icon, a stale NOTICE line, a broken RECIPE heading and key, a home path, an e-mail and denylist terms in a file, a CRLF RECIPE | each is reported; the clean tree is `ok` |
| Privacy scan with the author's identity terms as a one-off denylist (not stored) | only the repo address in install lines and in the two plan files that quote it; no other name, no e-mail, no host |

## Denied (permission check, not worked around)

- `git push` of `.github/workflows/ci.yml` was refused by GitHub: the OAuth token has no `workflow` scope. The workflow
  (ubuntu, windows, macos; `node --test`, validate, check-recipe, check-assets, check-docs, privacy scan with history) is a
  single commit on the **local** branch `feat/round-1-share-ready--herdr-completeness-ci`, on top of the pushed branch.
  The author needs `gh auth refresh -s workflow -h github.com`, then `git push origin feat/round-1-share-ready--herdr-completeness-ci`
  (or to copy the file). Consequences: no `gh run list` legs to read (plan check 7), and the Windows leg is untested. Instead
  the scripts were run locally on macOS only and reviewed for Windows (forward-slash path handling, `node:path`, LF reads).

## Deferred, and why

- A first real CI run on three systems (above). Linux and Windows runs of the layout itself (rule 2, no live app).
- Keys-table-versus-`keys.json` comparison in `check-docs.mjs` (D14: needs final docs layout).
- Exact `graphite` colors in the preview (approximated; the values live in the app binary).
- PowerShell and fish paths of the nvim launch are code-review's and unverified (their log).
- The topic, visibility, Pages and the tag are author steps in `scripts/PUBLISH.md`.

## Handoffs for round 2

- documentation: re-copy `preview.png` to `docs/assets/preview.png` (check-docs fails otherwise); drop the keepachangelog.com
  link; use `node --test` (not `node --test tests/`, which fails on Node 22+).
- code-review: any new or renamed icon needs a NOTICE line (validate fails otherwise); `fold.svg` and `unfold.svg` have no recorded
  origin (asked on the board).
- round lead: push the CI branch with a workflow-scoped token and read the three legs; merge order does not matter, the scripts
  were run on the merge of all three branches.
- Candidates: add the keys-table comparison once docs settle; a Windows-only unit test job for the scripts if the first run fails;
  decide the published slug (the layout and keys section names are load-bearing); optional `themes/` file stays an author choice.
