# Changelog

All notable changes to this repository, in the style of Keep a Changelog. Built against Herdr app 0.1.12 and its shipped mods.

## [Unreleased]

Nothing yet.

## [0.1.0] - not yet tagged

The first public release: the layouts and mods imported from a working Herdr setup, made shareable in round 1.

### Added

- Layouts `portrait` (bar on top) and `portrait-bottom` (bar between the work area and the status line).
- Mods `bar-strip`, `portrait-tree`, `portrait-tabs`, `portrait-pane`, `portrait-files`, `nvim-float`, and a bundled copy of `attention-picker`.
- `keys.json`: `ctrl-shift-g` and `cmd-b` toggle the bar, `ctrl-shift-y` flips the layout, `ctrl-shift-j` opens the Agents waiting list.
- `snippets/vault-panel.json`: the Vault panel as an opt-in.
- `RECIPE.md`, `preview.png` (an illustration with made-up content), `LICENSE` (Apache-2.0) and `NOTICE`.
- README, a documentation site under `docs/` for GitHub Pages (overview, install, usage, configuration, platforms, privacy, how it works, troubleshooting, for agents), `AGENTS.md`, `llms.txt`, `CONTRIBUTING.md` and this changelog.
- Tests (`node --test`, no dependencies) and checks in `scripts/`.

### Changed

- The layouts do not contain the Vault panel; the Vault button, panel memory and note rows appear only when the `vault` mod is installed and the layout has the `vault` node.
- Keys no longer use `ctrl-b` chords or a macOS-only key alone: `ctrl-shift-` keys work everywhere, `cmd-b` stays as a macOS alias, and `bar-strip.attention` is bound only in the two layout sections.
- Icons are carried inside each mod's folder instead of being read from Herdr's shipped mods; the Obsidian logo is replaced by a plain note icon.
- The Files panel does nothing while closed, watches one folder per root and never the home folder, limits `git status` to the shown folder, lists folders before files and marks folders that hold a change.
- Click-to-edit starts nvim with the login shell's PATH through a plain `sh` command and starts one editor per click. On Windows, or when nvim is not found, it shows the read-only preview and says why.
- The spine store writes a failed file at most once a minute (no render loop) and deletes spines of spaces that are gone; saved state is validated and pruned.
- The bell's tooltip shows the key that is really bound, and a second key press replaces an open list.
- The tab bar's wheel needs 40 px of scroll per tab.

### Fixed

- A space title that looked like a path (such as a shell prompt) was taken for an agent name.
- Stale comments about a peek and a "keep" button, and a missing `title` in the Files mod.
