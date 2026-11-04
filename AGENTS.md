# AGENTS.md

For coding agents asked to install, adapt, test or edit this repository. Humans: [README.md](README.md).

## What this is

A Herdr layout for vertical (portrait) monitors, plus the mods it needs. Herdr is a desktop app whose whole interface is files in its home folder (`herdr-app --help` prints it on its last line; `~/.config/herdr-app` by default; `HERDR_APP_HOME` overrides). Mods are JavaScript on gpui-kit (native GPUI): no DOM, no CSS, no Node APIs inside a mod. The types are `herdr.d.ts` and `gpui-kit.d.ts` in the Herdr home folder, and they are the truth for this Herdr version.

```
layouts/portrait.json            bar on top
layouts/portrait-bottom.json     bar between the work area and the status line
layouts/*.svg                    thumbnails for Settings
mods/bar-strip/                  strip: Search, Add machine, Settings, bell, panel buttons
mods/portrait-tree/              one column per space: tabs, panes, agents; folding
mods/portrait-tabs/              tab bar (clone of shipped tabs 0.1.12) + panel memory per space
mods/portrait-pane/              pane header (clone of shipped pane 0.1.12)
mods/portrait-files/             Files panel (clone of shipped files 0.1.12); click opens nvim
mods/nvim-float/                 title bar and Keep menu of the floating nvim
mods/attention-picker/           BUNDLED COPY of herdr-agents-waiting; do not edit here
snippets/vault-panel.json        optional Vault panel node
keys.json                        keys to merge
tests/                           node --test tests/
scripts/                         validators (see CONTRIBUTING.md)
RECIPE.md, preview.png           Herdr's build brief and picture; not copied on install
docs/                            GitHub Pages site (plain HTML and CSS)
```

Each mod has `main.js`, `mod.json`, its own icons, and often a `logic.mjs` of pure functions that tests import.

## Before you install: tell the person

Say this in plain words before writing anything.

- No mod uses the network.
- The mods run: `sh` (`powershell` for a local Windows machine) to list folders; `git rev-parse` and `git status`; `hc run` to start nvim; `nvim` through the login shell; `hc read` for blocked or finished agents while the Agents waiting list is open.
- They read: the folder of the focused pane, one file's text when the person alt-clicks it, agent and space data from Herdr.
- They write: `data/portrait-tree-spines/*.svg` in the Herdr home folder (space names), a socket under `/tmp` per nvim they start (macOS and Linux), and labels on that nvim terminal with the full file path.
- Full table: [docs/privacy.html](docs/privacy.html).

## Install (Herdr's protocol for layouts other people made)

1. Read `RECIPE.md` and every file you will copy before writing anything.
2. Copy `layouts/*` into `<home>/layouts/` and each folder of `mods/` into `<home>/mods/`. Leave `RECIPE.md`, `preview.png`, `docs/`, `tests/`, `scripts/` out. **Never overwrite.** If a name is taken (the person's or Herdr's), rename the new one, using the checklist below.
3. If the person already has an `attention-picker` (from herdr-agents-waiting), keep theirs, do not copy the bundled one, and check that its props still work: `bar-strip` opens it with `{ search: <boolean> }`.
4. Merge `keys.json` into `<home>/keys.json` (create it if missing). Add the sections and keys. If a key is already used for something else, ask the person before replacing it, or leave it out and tell them which. Never delete their keys. No `ctrl-b` chords are shipped; the optional tmux-style set is in [README.md](README.md#optional-tmux-style-chords) and is added only if the person asks.
5. For each mod folder: `herdr-app check <absolute path of the folder in <home>/mods>`. Fix or report any failure.
6. Switch: `herdr-app do layout.switch --name portrait` (only if the person asked to switch; otherwise tell them how: Settings, or `ctrl-shift-l`). Their own layout stays as it was.
7. Optional Vault panel: only if the person has (or wants) the `vault` and `vault-reader` mods from herdr-obsidian-vault. Insert `snippets/vault-panel.json` into the `children` of the stack `panel-body` in the layout files they use.
8. Tell the person what you copied, what you renamed, what you skipped, and which keys you added.

## Rename checklist (name clash)

- Layout file renamed: change the keys sections `layout:portrait` and `layout:portrait-bottom` to the new names, and the values `layout.switch:portrait` and `layout.switch:portrait-bottom`.
- Mod folder renamed: change every `mods/<old>/` path in its `svg()` and `image()` calls, the `mod` name wherever a layout or another mod refers to it (`"mod": "<old>"` in layouts; `PICKER` at the top of `mods/bar-strip/main.js` for `attention-picker`; `nvim-float` is opened by name from `portrait-files`), and `mod.open`/`openOverlay({ mod })` calls.
- Never rename these layout ids: `root`, `bar`, `panel`, `panel-body`, `vault`. The mods find them by id, and the toggle key is `layout.toggle:bar`.
- Mod commands in keys (`bar-strip.attention`) follow the mod's folder name.

## Adapt to the person's setup

- Theme: the layouts set none. To pin: add `"theme": { "light": "paper", "dark": "graphite" }` to the layout root, or add `themes/<name>.json`. Do not assume the author's settings.
- Sizes: all in the layout files (bar 246 px, strip 26, tab bar 42, status 28, panel 368, pane header 30).
- Keys for other systems: `cmd-` is macOS only; the `ctrl-shift-` keys work everywhere. Avoid plain `ctrl-<letter>` (programs use ctrl+c d l r w a e u k z and `[`) and `ctrl-alt-` (AltGr on Windows). Check a new key against `herdr-app commands` and the person's `keys.json`.
- Without nvim or on Windows: nothing to do, a click opens the read-only preview.
- Without the Obsidian mods: nothing to do. Do not add the Vault node.

## Test

- `herdr-app check <absolute mod folder>` for every changed mod. It loads the mod once and renders it once; it does not lay out, run async states or exercise clicks. Say so; do not call a mod done on this alone.
- `node --test tests/` (Node 18 or newer, no install). Pure logic lives in `mods/<mod>/logic.mjs` with no gpui imports so tests can load it.
- JSON files: parse them (`node -e "JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'))" file`).
- `node scripts/validate.mjs`, `privacy-scan.mjs`, `check-recipe.mjs`, `check-assets.mjs`, `check-docs.mjs` from the repository root.
- Never run `herdr-app do`, `shot` or `status` against a running app that is not yours, and never write into a live Herdr home from a checkout. Use a scratch copy: `HERDR_APP_HOME=<scratch> herdr-app check <scratch>/mods/<name>`.

## Edit safely (gotchas)

- Saving any file in a mod folder reloads every copy of that mod on the person's screen at once, and Herdr keeps the old version if the new one is broken. Never write runtime output inside a mod folder; `portrait-tree` writes spines to `<home>/data/portrait-tree-spines/` for this reason.
- A mod copy keeps running while hidden: keep timers conditional (Files refreshes only while its panel is open).
- `<mod>.<command>` key actions reach shown copies only, so `bar-strip.attention` is bound in the `layout:*` sections, not `global`.
- `mods/attention-picker` is a bundled copy. Do not edit it here; change it in herdr-agents-waiting.
- `portrait-tabs`, `portrait-pane`, `portrait-files` are clones of the shipped 0.1.12 mods (`cloned_from` in `mod.json`). Herdr never updates a clone; after a Herdr update re-run the checks.
- Do not reference another mod's files (`mods/workspace-chrome/...`, `mods/pane/...`): Herdr replaces its shipped mods on update. Icons are vendored in each mod's folder. The only allowlisted outside asset is `mods/vault/icons/book-open.svg` (optional mod).
- The nvim socket is under `/tmp` on purpose: macOS temp folders plus a long home path exceed the 104-byte unix socket limit.
- `herdr-app check` cannot see runtime behaviour (vault gating, polling, nvim). Pure functions carry that in tests.
- Elements cannot rotate in GPUI; folded space names are rotated-text SVGs (`spineSvg` in `portrait-tree`).
- No personal data in files or commits: no real names (except the LICENSE copyright line), no absolute home-folder paths of any system (write `~` or `<home>`), no e-mail addresses, no host names, nothing from a real vault or window.
- Commit messages: a subject, a body, and the attribution trailer lines your tooling gives.

## Escape hatch

`ctrl-alt-shift-escape` sets the shown layout and `keys.json` aside and returns to the default layout. Herdr writes `layout.error` and `keys.error` when a file is invalid and keeps the last good version.

## Uninstall

Switch to another layout; delete `layouts/portrait*.json` and `.svg`, the mod folders you copied, the merged keys, and `<home>/data/portrait-tree-spines/`.
