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
tests/                           node --test
scripts/                         validators, snapshots of Herdr 0.1.12, ci.workflow.yml, PUBLISH.md
package.json                     only gives `npm test` and `npm run check` names; no dependencies
RECIPE.md, preview.png           Herdr's build brief and picture; not copied on install
docs/                            GitHub Pages site (plain HTML and CSS)
NOTICE, LICENSE                  Apache-2.0 and what is derived from where
plans/                           process notes of the improvement rounds; not part of the layout
```

Each mod has `main.js`, `mod.json`, its own icons, and often a `logic.mjs` of pure functions that tests import.

## Before you install: tell the person

Say this in plain words before writing anything.

- No mod uses the network.
- The mods run: `sh` (`powershell` for a local Windows machine) to list folders; `git rev-parse` and `git status`; the login shell once per machine, to read its PATH; `hc run` to start nvim; `nvim`; and, only while the Agents waiting list is open, `hc read` (the last 60 lines of each blocked or finished agent's screen, every 3 seconds).
- They read: the folder of the focused pane; one file's text for the read-only preview (alt-click, and also a plain click on Windows or when nvim is not found); whether `<home>/mods/vault/main.js` exists (existence only, every 60 seconds); agent, space, tab, pane and key-binding data from Herdr.
- They write: `data/portrait-tree-spines/*.svg` in the Herdr home folder (space names); a socket under `/tmp` per nvim they start (macOS and Linux) and labels on that nvim terminal with the full file path; records in the mods' local storage (fold state, state-change times, the open side panel per space, and `attention.seen`: agent address, state group, time; no screen text); the shared keys `agents.since`, `attention.sort`, `mods.vault`.
- Full table, mod by mod, with the function that does each thing: the Privacy page of the site (`docs/privacy.html`; after publication at `https://miguelalexanderdiaz.github.io/herdr-portrait-layout/privacy.html`) and the disclosure in [RECIPE.md](RECIPE.md).

## Install (Herdr's protocol for layouts other people made)

1. Read `RECIPE.md` and every file you will copy before writing anything.
2. Copy `layouts/*` into `<home>/layouts/` and each folder of `mods/` into `<home>/mods/`. Leave `RECIPE.md`, `preview.png`, `docs/`, `tests/`, `scripts/`, `plans/`, `package.json` out. **Never overwrite.** If a name is taken (the person's or Herdr's), rename the new one, using the checklist below.
3. If the person already has an `attention-picker` (from herdr-agents-waiting), keep theirs, do not copy the bundled one, and check that its props still work: `bar-strip` opens it with `{ search: <boolean> }`, and the key `ctrl-shift-j` runs `mod.open:attention-picker`. The bundled copy ships no key of its own; the herdr-agents-waiting repository binds `ctrl-shift-a` to it, which does not clash.
4. Merge `keys.json` into `<home>/keys.json` (create it if missing). Add the sections and keys. If a key is already used for something else, ask the person before replacing it, or leave it out and tell them which. Never delete their keys. `cmd-b` is macOS only (dead on Linux and Windows). No `ctrl-b` chords are shipped; add the optional tmux-style set (below) only if the person asks.
5. For each mod folder: `herdr-app check <absolute path of the folder in <home>/mods>`. Fix or report any failure.
6. Switch: `herdr-app do layout.switch --name portrait` (only if the person asked to switch; otherwise tell them how: Settings, or `ctrl-shift-l`). Their own layout stays as it was.
7. Optional Vault panel: only if the person has (or wants) the `vault` and `vault-reader` mods from herdr-obsidian-vault. Insert `snippets/vault-panel.json` into the `children` of the stack `panel-body` in the layout files they use.
8. Tell the person what you copied, what you renamed, what you skipped, and which keys you added.

## Rename checklist (name clash)

- Layout file renamed: rename its `.svg` thumbnail too and set the layout's root field `preview` to the new thumbnail name (`layouts/<name>.svg`; `validate` requires it to match); change the keys sections `layout:portrait` and `layout:portrait-bottom` to the new names, and the values `layout.switch:portrait` and `layout.switch:portrait-bottom`.
- Mod folder renamed: change every `mods/<old>/` path in its `svg()` and `image()` calls, the `mod` name wherever a layout or another mod refers to it (`"mod": "<old>"` in layouts; `PICKER` at the top of `mods/bar-strip/main.js` for `attention-picker`; `nvim-float` is opened by name from `portrait-files`), and `mod.open`/`openOverlay({ mod })` calls.
- Never rename the layout ids the mods look up: `panel`, `panel-body`, `files`, `changes` (children of `panel-body`) and `vault` (when the Vault panel is added). `bar` is named only by the key `layout.toggle:bar`: rename it only together with that key. Renaming `files` or `changes` also needs the `enabledPanels` defaults in `mods/portrait-tabs/logic.mjs`. The full load-bearing list is in `RECIPE.md`.
- Mod names in keys (`mod.open:attention-picker`, and `bar-strip.attention` if someone bound it) follow the mod's folder name.

## Adapt to the person's setup

- Theme: the layouts set none. To pin: add `"theme": { "light": "paper", "dark": "graphite" }` to the layout root, or add `themes/<name>.json`. Do not assume the author's settings.
- Sizes: all in the layout files (bar 246 px, strip 26, tab bar 42, status 28, panel 368, pane header 30).
- Keys for other systems: `cmd-` is macOS only (`cmd-b` does nothing on Linux and Windows); the `ctrl-shift-` keys are meant to work everywhere (not tested on Linux or Windows). Avoid plain `ctrl-<letter>` (programs use ctrl+c d l r w a e u k z and `[`) and `ctrl-alt-` (AltGr on Windows). Check a new key against `herdr-app commands` and the person's `keys.json`.
- Without nvim or on Windows: nothing to do, a click shows the read-only preview and says why.
- Linux and Windows have not been run by the author; say so rather than promise. The PowerShell install block is unverified.

Optional tmux-style chords (not shipped: a bound `ctrl-b` prefix takes `ctrl-b` from the person's programs; Herdr's written reference does not describe chords, this is the form the author used on macOS with 0.1.12; afterwards look for `keys.error` in `<home>`):

```json
{
  "layout:portrait": {
    "ctrl-b a": "mod.open:attention-picker",
    "ctrl-b b": "layout.toggle:bar",
    "ctrl-b shift-b": "layout.switch:portrait-bottom"
  },
  "layout:portrait-bottom": {
    "ctrl-b a": "mod.open:attention-picker",
    "ctrl-b b": "layout.toggle:bar",
    "ctrl-b shift-b": "layout.switch:portrait"
  }
}
```
- Without the Obsidian mods: nothing to do. Do not add the Vault node.

## Test

- `herdr-app check <absolute mod folder>` for every changed mod. It loads the mod once and renders it once; it does not lay out, run async states or exercise clicks. Say so; do not call a mod done on this alone.
- `node --test` with no argument (Node 18 or newer, no install; on Node 22 and later `node --test tests/` fails because the argument is read as a file); `npm test` is the same. With Herdr's `herdr.d.ts` present in the Herdr home folder (or `HERDR_APP_HOME`) the API test also checks that every Herdr function the mods import exists; it is skipped without the file. Pure logic lives in `mods/<mod>/logic.mjs` with no gpui imports so tests can load it.
- JSON files: parse them (`node -e "JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'))" file`).
- `npm run check` runs `scripts/validate.mjs`, `check-recipe.mjs`, `check-assets.mjs`, `check-docs.mjs` and `privacy-scan.mjs` from the repository root in one go (each also runs alone). `npm run check:history` scans the commit history.
- CI: the definition is `scripts/ci.workflow.yml`; it is active only after the maintainer copies it to `.github/workflows/ci.yml` (needs a workflow-scoped login). Never commit anything under `.github/workflows/`.
- Never run `herdr-app do`, `shot` or `status` against a running app that is not yours, and never write into a live Herdr home from a checkout. Use a scratch copy: `HERDR_APP_HOME=<scratch> herdr-app check <scratch>/mods/<name>`.

## Edit safely (gotchas)

- Saving any file in a mod folder reloads every copy of that mod on the person's screen at once, and Herdr keeps the old version if the new one is broken. Never write runtime output inside a mod folder; `portrait-tree` writes spines to `<home>/data/portrait-tree-spines/` for this reason.
- A mod copy keeps running while hidden: keep timers conditional (Files refreshes only while its panel is open).
- `<mod>.<command>` key actions reach shown copies only, so a key for `bar-strip.attention` would be dead while the bar is hidden. The shipped `ctrl-shift-j` uses `mod.open:attention-picker` instead (a Herdr command; pressing it again closes the dialog); the keys sit in the `layout:*` sections, not `global`.
- `mods/attention-picker` is a bundled copy, frozen and hash-checked (`scripts/bundled.json`; `validate` fails on any difference). Do not edit it here; change it in herdr-agents-waiting and re-sync (below).
- `portrait-tabs`, `portrait-pane`, `portrait-files` are clones of the shipped 0.1.12 mods (`cloned_from` in `mod.json`). Herdr never updates a clone; after a Herdr update re-run the checks.
- The layouts keep the system title bar. `portrait-tabs` draws window buttons only when `window().buttons` is true, which is never with a system title bar, so there are none on Linux and Windows.
- Mods import only from `herdr`, `gpui-kit`, `gpui-base` and `fs/promises`; RECIPE.md lists each imported Herdr function and `check-recipe` fails on a new import, `run(...)` command or `exec(...)` program that RECIPE does not name.
- Do not reference another mod's files (`mods/workspace-chrome/...`, `mods/pane/...`): Herdr replaces its shipped mods on update. Icons are vendored in each mod's folder. The only allowlisted outside asset is `mods/vault/icons/book-open.svg` (optional mod).
- The nvim socket is under `/tmp` on purpose: macOS temp folders plus a long home path exceed the 104-byte unix socket limit.
- `herdr-app check` cannot see runtime behaviour (vault gating, polling, nvim). Pure functions carry that in tests.
- Herdr's script engine has no `Intl`; a mod that touches it fails `herdr-app check`.
- Blocks between `<shared:...>` markers in the `logic.mjs` files are identical copies of each other (`tests/shared.test.mjs` keeps them equal): change every copy.
- Elements cannot rotate in GPUI; folded space names are rotated-text SVGs (`spineSvg` in `portrait-tree`).
- No personal data in files or commits: no real names (except the LICENSE copyright line), no absolute home-folder paths of any system (write `~` or `<home>`), no e-mail addresses, no host names, nothing from a real vault or window.
- Commit messages: a subject, a body, and the attribution trailer lines your tooling gives.

## When Herdr updates, and when the bundled picker is re-synced

Both procedures, with the commands, are in [CONTRIBUTING.md](CONTRIBUTING.md) (section Maintenance): run `node --test` with the new `.d.ts` files present, `herdr-app check` for each mod, compare the three clones with Herdr's shipped mods (read-only), refresh the three snapshots in `scripts/` (`default-keys.json`, `commands.json`, `shipped-mods.json`); for the picker `git archive` from the herdr-agents-waiting repository, `node scripts/bundled.mjs <commit>`, `herdr-app check`, then re-read the privacy text against the picker's constants.

## Escape hatch

`ctrl-alt-shift-escape` sets the shown layout and `keys.json` aside and returns to the default layout. Herdr writes `layout.error` and `keys.error` when a file is invalid and keeps the last good version.

## Uninstall

Switch to another layout; delete `layouts/portrait*.json` and `.svg`, the mod folders you copied, the merged keys, and `<home>/data/portrait-tree-spines/`.
