# Contributing

Thanks for helping. This repository is a Herdr layout and its mods; there is nothing to build or install.

## Principles

- **No personal data.** No real names (except the LICENSE copyright line), no usernames, no absolute home-folder paths of any system (write `~` or `<home>`), no e-mail addresses, no host names, nothing from a real vault, window or terminal. Examples are invented ("api", "web", "docs").
- **Say what runs.** Any new `exec`, `hc` call, file read outside the mod's folder, or file written must be added to the privacy table ([docs/privacy.html](docs/privacy.html), README) in the same change. No mod may use the network without a very good reason and a loud note.
- **Work on every system.** Keys, paths and shell commands must have a plan for macOS, Linux and Windows. If something is one system only, say so in [docs/platforms.html](docs/platforms.html).
- **Do not claim what was not tested.**

## Setup

```sh
git clone https://github.com/miguelalexanderdiaz/herdr-portrait-layout.git
cd herdr-portrait-layout
```

No dependencies. Node 18 or newer for the tests and scripts, and the `herdr-app` command for `check`.

## Never test against your live Herdr

Herdr reloads a file the moment it changes. Do not symlink this checkout into your real home folder, and do not run scripts from a checkout that write there. Copy into a scratch folder and point Herdr's tools at it:

```sh
export HERDR_APP_HOME="$(mktemp -d)"
mkdir -p "$HERDR_APP_HOME/mods" && cp -R mods/portrait-tree "$HERDR_APP_HOME/mods/"
herdr-app check "$HERDR_APP_HOME/mods/portrait-tree"
```

## Checks

Run from the repository root before you push:

| What | Command |
|---|---|
| Tests (pure logic, repo invariants) | `node --test` |
| Each mod loads and renders once | `for m in mods/*; do herdr-app check "$PWD/$m"; done` |
| Layouts, keys, mod.json, assets | `node scripts/validate.mjs` |
| No personal data in files | `node scripts/privacy-scan.mjs` |
| RECIPE.md has its six sections | `node scripts/check-recipe.mjs` |
| Preview and SVGs are valid | `node scripts/check-assets.mjs` |
| Docs: links, no external hosts, llms.txt copy | `node scripts/check-docs.mjs` |

When `.github/workflows/ci.yml` is in the tree, CI runs the same on Ubuntu, Windows and macOS. `herdr-app check` cannot see runtime behaviour, so the manual checklist below still matters.

## Manual checklist (in a scratch Herdr that is yours)

Fold and unfold a space; focus an agent in a folded space; the bell (click, shift-click, the key); the waiting list; Files: open a folder, click a file, alt-click a file, git marks; Keep menu in the floating nvim; flip the layout; toggle the bar; open and close the side panel on two spaces and switch between them; a layout without the Vault mods.

## Don't touch

- `mods/attention-picker/` is a bundled copy of herdr-agents-waiting. Change it there; the maintainer syncs it here.
- `portrait-tabs`, `portrait-pane`, `portrait-files` keep `cloned_from`; they are copies of Herdr 0.1.12 mods.
- Layout ids `bar`, `panel`, `panel-body`, `vault` are looked up by the mods.

## Adding a mod to the layout

Put it in `mods/<name>/` with a `main.js` and `mod.json`; carry its own icons; add it to the layout files (both) and to [RECIPE.md](RECIPE.md) and the docs; run every check above.

## Docs

`README.md`, `docs/`, `AGENTS.md`, `llms.txt` and `docs/llms.txt` (an identical copy) must match the code. Docs refer to function names, not line numbers. The site is plain HTML and CSS: no scripts, no external fonts, no CDNs, no trackers. Keep one `h1` per page, alt text on images, and test at 360 px and 1280 px wide in light and dark.

## Commits

A clear subject, a body that says why, and no personal data. One logical change per commit.

## Publishing

The checklist (topic, visibility, GitHub Pages from `main` and `/docs`, scans, CI, tag) is in [scripts/PUBLISH.md](scripts/PUBLISH.md). Repository settings are the maintainer's to change.
