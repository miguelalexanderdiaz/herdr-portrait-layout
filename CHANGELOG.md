# Changelog

All notable changes to this repository. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Built against Herdr app 0.1.12 and its shipped mods.

## [Unreleased]

Round 1: make the layout shareable. Items land as the round's roles merge; this list is the plan's result.

### Added

- README, a documentation site under `docs/` for GitHub Pages (overview, install, usage, configuration, platforms, privacy, how it works, troubleshooting, for agents), `AGENTS.md`, `llms.txt`, `CONTRIBUTING.md` and this changelog.
- `RECIPE.md`, `preview.png` (an illustration with made-up content), `LICENSE` (Apache-2.0) and `NOTICE`.
- `snippets/vault-panel.json`: the Vault panel as an opt-in.
- Tests (`node --test tests/`), validators in `scripts/`, and a CI workflow on Ubuntu, Windows and macOS.

### Changed

- The layouts no longer contain the Vault panel; the Vault button, tab and note rows appear only when the `vault` mod is installed and the layout has the `vault` node.
- `keys.json` no longer has `ctrl-b` chords or macOS-only keys alone: `ctrl-shift-` keys work everywhere, `cmd-` stays as a macOS alias, and `bar-strip.attention` is bound only in the two layout sections.
- Icons are carried inside each mod's folder instead of read from Herdr's shipped mods.
- The Files panel does not poll, refresh or watch while closed; the spine store no longer loops when a write fails and prunes names of spaces that are gone; saved state is validated and pruned.
- Click-to-edit starts nvim through a plain `sh` command with the login shell's PATH; on Windows a click opens the read-only preview and says so once.
- The bell's tooltip shows the key that is really bound.

### Fixed

- Stale comments and a missing `title` in the Files mod.

## [0.1.0]

The import from a working Herdr setup.

- Layouts `portrait` and `portrait-bottom`.
- Mods `bar-strip`, `portrait-tree`, `portrait-tabs`, `portrait-pane`, `portrait-files`, `nvim-float` and a bundled `attention-picker`.
- `keys.json` with macOS-oriented keys and `ctrl-b` chords.

[Unreleased]: https://github.com/miguelalexanderdiaz/herdr-portrait-layout/compare/main...HEAD
