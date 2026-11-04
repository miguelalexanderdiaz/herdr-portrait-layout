# Contributing

Thanks for helping. This repository is a Herdr layout and its mods; there is nothing to build or install.

## Principles

- **No personal data.** No real names (except the LICENSE copyright line), no usernames, no absolute home-folder paths of any system (write `~` or `<home>`), no e-mail addresses, no host names, nothing from a real vault, window or terminal. Examples are invented ("api", "web", "docs").
- **Say what runs.** Any new `exec`, `hc` call, file read outside the mod's folder, or file written must be added to the privacy text ([docs/privacy.html](docs/privacy.html), README, and the disclosure in [RECIPE.md](RECIPE.md)) in the same change. No mod may use the network without a very good reason and a loud note.
- **Work on every system.** Keys, paths and shell commands must have a plan for macOS, Linux and Windows. If something is one system only, say so in [docs/platforms.html](docs/platforms.html).
- **Do not claim what was not tested.**

## Setup

```sh
git clone https://github.com/miguelalexanderdiaz/herdr-portrait-layout.git
cd herdr-portrait-layout
```

No dependencies. Node 22 or newer for the tests and scripts (they load the mods' `.js` files as ES modules, which older Node refuses), and the `herdr-app` command for `check`.

## Never test against your live Herdr

Herdr reloads a file the moment it changes. Do not symlink this checkout into your real home folder, and do not run scripts from a checkout that write there. Copy into a scratch folder and point Herdr's tools at it:

```sh
export HERDR_APP_HOME="$(mktemp -d)"
mkdir -p "$HERDR_APP_HOME/mods" && cp -R mods/portrait-tree "$HERDR_APP_HOME/mods/"
herdr-app check "$HERDR_APP_HOME/mods/portrait-tree"
```

## Checks

Run from the repository root before you push. `npm test` and `npm run check` are only short names (there is no dependency to install):

| What | Command |
|---|---|
| Tests (pure logic, repo invariants, docs claims) | `npm test`, which is `node --test` |
| Everything below in one summary | `npm run check` |
| Each mod loads and renders once | `for m in mods/*; do herdr-app check "$PWD/$m"; done` |
| Layouts, keys, mod.json, assets, the bundled copy's hashes | `node scripts/validate.mjs` |
| No personal data in files | `node scripts/privacy-scan.mjs` |
| RECIPE.md has its six sections and names what the mods use | `node scripts/check-recipe.mjs` |
| Preview and SVGs are valid | `node scripts/check-assets.mjs` |
| Docs: links, no external hosts, keys table, llms.txt copy | `node scripts/check-docs.mjs` |
| Commit history carries no personal address | `npm run check:history` (see [scripts/PUBLISH.md](scripts/PUBLISH.md), step 0) |

The CI definition is [scripts/ci.workflow.yml](scripts/ci.workflow.yml): it runs the tests and `npm run check` on Ubuntu, Windows and macOS. It is not active until the maintainer copies it to `.github/workflows/ci.yml` with a login that has the workflow scope ([scripts/PUBLISH.md](scripts/PUBLISH.md), step 6); pull requests must not add files under `.github/workflows/`. `herdr-app check` cannot see runtime behaviour, so the manual checklist below still matters.

Two suites guard the docs against the code: `scripts/check-docs.mjs` (every key of `keys.json` has a row in the README and in the Configuration page, the names in the "Where to check" cells exist in `mods/`, every mod is named in the README and the Privacy page) and `tests/docs-claims.test.mjs` (the numbers in the text, such as `290 px`, `34 px`, `40 px` and `7 days`, equal the constants in the code). Keep each number next to its unit as plain text, one `<td>` per key, and no line breaks inside a table cell, so those checks can read them.

## Maintenance

### When Herdr updates

1. `herdr-app --version`; read what changed in Herdr's own `AGENTS.md`, `herdr.d.ts` and `gpui-kit.d.ts` in the Herdr home folder.
2. Run `node --test` with those `.d.ts` files present (`~/.config/herdr-app`, or the folder in `HERDR_APP_HOME`): `tests/api.test.mjs` checks that every name the mods import from Herdr and every builder method they call still exists there, and is skipped when the files are missing.
3. `herdr-app check` for every mod (above).
4. Herdr replaces its shipped mods whole and never updates a clone. Compare each clone with the shipped mod of the same name in the Herdr home folder (read-only): `portrait-tabs` with `tabs`, `portrait-pane` with `pane`, `portrait-files` with `files`, and the layouts with the shipped `main`. Port what you want; keep `cloned_from` and the NOTICE entry true.
5. Refresh the three snapshots in `scripts/` by hand (there is no network tool): `default-keys.json` is the `defaults/keys*.json` files of the Herdr release (github.com/herdrdev/herdr-app, folder `defaults/`); `commands.json` is the output of `herdr-app commands` (command names with their argument names); `shipped-mods.json` is the list of mod folders under `<app home>/mods/` that Herdr ships (today `workspace-status`, `changes`, `picker`, `machine-add`, `menu`, `new-menu`). Keep each file's `_about` and version fields true, then `npm run check`: a new Herdr default chord that clashes with a key in `keys.json`, or a command that no longer exists, fails `validate`.
6. Update "built and used on" in README, `docs/` and CHANGELOG only after you used it on that version.

### When attention-picker is re-synced

`mods/attention-picker` is read-only here. Its source is the herdr-agents-waiting repository. To take a new version:

```sh
git rm -r mods/attention-picker
git -C <path to herdr-agents-waiting> archive <commit or branch> mods/attention-picker | tar -x -C .
herdr-app check "$PWD/mods/attention-picker"
node scripts/bundled.mjs <the 40-character commit that was archived>   # rewrites scripts/bundled.json
npm test && npm run check
```

The same steps are in [scripts/PUBLISH.md](scripts/PUBLISH.md), step 7.

Never copy `gpui-kit.d.ts` or `jsconfig.json` (Herdr writes them). `bundled.json` records the hash of every file, so a hand edit or a forgotten file fails `validate`. Then re-read the privacy text in README, `docs/privacy.html` and RECIPE.md against the picker's constants (how often it reads, how many lines, what it stores), update NOTICE if the file list changed, and check that `bar-strip` still opens it by name with the props the new version reads.

## Manual checklist (in a scratch Herdr that is yours)

Fold and unfold a space; focus an agent in a folded space; the bell (click, shift-click, the key); the waiting list; Files: open a folder, click a file, alt-click a file, git marks; Keep menu in the floating nvim; flip the layout; toggle the bar; open and close the side panel on two spaces and switch between them; a layout without the Vault mods.

## Don't touch

- `mods/attention-picker/` is a bundled copy of herdr-agents-waiting. Change it there; the maintainer syncs it here.
- `portrait-tabs`, `portrait-pane`, `portrait-files` keep `cloned_from`; they are copies of Herdr 0.1.12 mods.
- Layout ids `panel`, `panel-body`, `files`, `changes` and `vault` are looked up by the mods, and `bar` by the toggle key.

## Adding a mod to the layout

Put it in `mods/<name>/` with a `main.js` and `mod.json`; carry its own icons; add it to the layout files (both) and to [RECIPE.md](RECIPE.md) and the docs; run every check above.

## Docs

`README.md`, `docs/`, `AGENTS.md`, `llms.txt` and `docs/llms.txt` (an identical copy) must match the code. Docs refer to function names, not line numbers. The site is plain HTML and CSS written by hand (there is no generator, so the menu and footer repeat on every page; change all pages): no scripts, no external fonts, no CDNs, no trackers. Keep one `h1` per page, alt text on images, a `<caption>` on every table, and test at 360 px and 1280 px wide in light and dark. README and `llms.txt` link the rendered pages through the GitHub Pages address, which is live only after publication; links inside `docs/` stay relative. When `preview.png` changes, copy it to `docs/assets/preview.png` (`check-docs` compares them).

## Commits

A clear subject, a body that says why, and no personal data. One logical change per commit. Commit with a GitHub noreply address (the author's own commits use their public blog address, which the check allows); a personal address in the history is what `npm run check:history` is there to catch.

## Publishing

The checklist (topic, visibility, GitHub Pages from `main` and `/docs`, scans, CI, tag) is in [scripts/PUBLISH.md](scripts/PUBLISH.md). Repository settings are the maintainer's to change.
