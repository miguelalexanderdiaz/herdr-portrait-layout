# Changelog

All notable changes to this repository, in the style of Keep a Changelog. Built against Herdr app 0.1.12 and its shipped mods.

## [Unreleased]

Every merged round adds its lines here; tagging a release moves them under the new version. Round 2 reviewed round 1 and hardened it.

### Added

- Files opens each file where it makes sense. Text opens in the editor picked with the new `▾` in the panel header (nvim, Helix, Vim, micro, nano, VS Code, Zed, Sublime Text, the default app or the read-only preview; only what is installed is listed; nvim stays the default when installed). Right-click a file for *Open with*.
- `portrait-viewer`: pictures and PDFs open in a viewer window (PDF pages drawn with Poppler, the first page through Quick Look on macOS without it), with *Open in Preview*. Its code is copied from the herdr-obsidian-vault reader.
- Documents, media and archives open in the system's app; programs are never started.

- `scripts/ci.workflow.yml`, the CI definition (tests and `npm run check` on Ubuntu, Windows and macOS; actions pinned to commits). It becomes active when the maintainer copies it to `.github/workflows/ci.yml` (see `scripts/PUBLISH.md`); no run has been reported yet. `package.json` gives the short names `npm test`, `npm run check` and `npm run check:history`; `.github/dependabot.yml` keeps the action pins current.
- `scripts/bundled.json` and `scripts/bundled.mjs`: the bundled `attention-picker` is hash-checked, so a hand edit or a forgotten file fails `validate`.
- `tests/api.test.mjs` (every Herdr function the mods import exists in the app's type files; skipped without them) and `tests/docs-claims.test.mjs` (the numbers in the docs equal the constants in the code).
- Rows for sub-agents (agents without a pane) under their parent's tab in the space tree.
- Documentation: a "Maintenance" section in CONTRIBUTING (when Herdr updates, when the picker is re-synced), a rendered-site link in the README and `llms.txt`, a menu that folds on narrow screens, table captions, a stand-alone 404 page.

### Changed

- `attention-picker` is synced to the first release of its own repository: it polls every 3 seconds (it was 2) and reads 60 lines per agent, keeps a first-seen record in local storage (`attention.seen`), uses `agents.since` from the tree when present and its own times otherwise, and carries its own icons.
- `ctrl-shift-j` now runs `mod.open:attention-picker`, so it works while the bar is hidden and a second press closes the list. `bar-strip.attention` and `bar-strip.jump` are still served.
- The saved fold, peek and side-panel state of a remote machine is kept while that machine is loading or offline. The bell's order follows `agents.since` when it is published. A mouse wheel moves one tab or column per notch (a trackpad still needs 40 px). A title that starts with a dot keeps it.
- Files re-reads a busy folder at most every 1.5 seconds and watches at most three folders; the `editor.space` label is no longer set on the nvim terminal.
- On a light theme the rotated name of the active folded space is mixed toward the text colour for contrast. `fold.svg` and `unfold.svg` are redrawn as original drawings.
- README shortened (one privacy summary; the long tables are on the site). The PowerShell block now sets the Herdr home folder without a placeholder.

### Fixed

- Documentation that the code did not back: "the mods use only theme colours" (the six space marks are fixed colours), the picker's poll interval, "`agent.next` skips folded spaces" (it appends them), the ids list ("never rename" now names what the mods look up), "folders before files" on Windows with more than 500 entries, and the Windows window buttons (not shown with the system title bar).

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
