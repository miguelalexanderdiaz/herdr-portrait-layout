# Portrait layout for Herdr

A [Herdr](https://herdr.dev) layout for tall, vertical monitors. Your spaces sit side by side as columns in a strip at the top, each a tree of its tabs and panes with the state of every agent. The work area gets the rest of the screen, and a side panel brings Files and Changes when you want them.

![Illustration of the portrait layout with made-up content: three space columns (api, web, docs) with agent rows and state words and a folded fourth (infra) in a strip on top, a tab bar, a large terminal pane with an agent running tests, a shell pane, and a status line.](preview.png)

*An illustration with made-up content, not a screenshot of anyone's setup.*

Docs for humans: the [documentation site](docs/index.html) (published with GitHub Pages from `docs/`). Docs for agents: [AGENTS.md](AGENTS.md) and [llms.txt](llms.txt). The build brief Herdr asks for is [RECIPE.md](RECIPE.md).

## What you get

| Part | What it is |
|---|---|
| Layout `portrait` | Bar (strip plus space tree) on top, then tab bar, work area, status line. Side panel on the right, hidden until opened. |
| Layout `portrait-bottom` | The same, with the bar between the work area and the status line. |
| `portrait-tree` | One column per space: tabs, panes, every agent with its state and time in it. Spaces fold into thin strips and open by themselves when an agent in them gets focus. |
| `bar-strip` | Search, Add machine, Settings; a bell that says who needs you; Files, Changes and (optional) Vault buttons. |
| `portrait-tabs`, `portrait-pane` | Tab bar and pane header, cloned from Herdr's shipped mods. They remember the side panel per space. |
| `portrait-files`, `nvim-float` | Files for the focused pane's folder with git marks; click a file to edit it in a floating nvim (macOS and Linux). |
| `attention-picker` | The *Agents waiting* list (bundled copy of the herdr-agents-waiting mod). |

## Requirements

- The Herdr desktop app, 0.1.12 or newer (built and used on 0.1.12).
- `git` for change marks in Files; `nvim` for click-to-edit (both optional).
- No network, no account, nothing to install. macOS, Linux or Windows: see the table below.

| Feature | macOS | Linux | Windows |
|---|---|---|---|
| Layouts, tree, tab bar, pane headers, bell, waiting list | Works | Expected to work | Expected to work |
| Files listing and git marks | Works | Expected to work | Expected to work (PowerShell listing) |
| Click a file to edit in nvim | Works | Expected to work | No: opens the read-only preview and says so once |
| Keys | `cmd-` and `ctrl-shift-` | `ctrl-shift-` | `ctrl-shift-` |

Developed and used on macOS. Linux and Windows are described from the code, not from a test run. Details and the code that decides each row: [Platforms](docs/platforms.html).

## Install

### With an agent

Tell the agent in your Herdr:

```
install https://github.com/miguelalexanderdiaz/herdr-portrait-layout
```

It follows Herdr's protocol for shared layouts: tells you what runs, never overwrites, renames on a clash, asks before changing your `keys.json`, checks each mod, then switches the layout. Steps for agents: [AGENTS.md](AGENTS.md).

### By hand, macOS and Linux

```sh
git clone https://github.com/miguelalexanderdiaz/herdr-portrait-layout.git
cd herdr-portrait-layout

# The Herdr home folder (herdr-app --help prints it on the last line).
H="${HERDR_APP_HOME:-$HOME/.config/herdr-app}"
mkdir -p "$H/layouts" "$H/mods"

# Never overwrite: anything that already exists is reported and skipped.
for f in layouts/*; do
  if [ -e "$H/$f" ]; then echo "exists, rename first: $f"; else cp "$f" "$H/layouts/"; fi
done
for m in mods/*; do
  n="${m#mods/}"
  if [ -e "$H/mods/$n" ]; then echo "exists, skip or rename: $n"; else cp -R "$m" "$H/mods/$n"; fi
done

# Check every mod you now have.
for m in mods/*; do herdr-app check "$H/mods/${m#mods/}"; done

# Switch to the layout.
herdr-app do layout.switch --name portrait
```

### By hand, Windows (PowerShell)

```powershell
git clone https://github.com/miguelalexanderdiaz/herdr-portrait-layout.git
cd herdr-portrait-layout

# The Herdr home folder: the "Home:" line of  herdr-app --help
$H = "<the path printed by herdr-app --help>"
New-Item -ItemType Directory -Force "$H\layouts", "$H\mods" | Out-Null

foreach ($f in Get-ChildItem layouts) {
  if (Test-Path "$H\layouts\$($f.Name)") { "exists, rename first: $($f.Name)" }
  else { Copy-Item $f.FullName "$H\layouts\" }
}
foreach ($m in Get-ChildItem mods -Directory) {
  if (Test-Path "$H\mods\$($m.Name)") { "exists, skip or rename: $($m.Name)" }
  else { Copy-Item $m.FullName "$H\mods\$($m.Name)" -Recurse }
}

foreach ($m in Get-ChildItem mods -Directory) { herdr-app check "$H\mods\$($m.Name)" }
herdr-app do layout.switch --name portrait
```

The PowerShell commands follow its documentation and have not been run on Windows. Then merge the repository's `keys.json` into yours (below). If you already have `attention-picker` from herdr-agents-waiting, keep yours and skip the bundled one.

## Keys

| Section | Key | Action | What it does |
|---|---|---|---|
| `layout:portrait` | `ctrl-shift-g` | `layout.toggle:bar` | Show or hide the bar (strip and space tree) |
| `layout:portrait` | `cmd-b` | `layout.toggle:bar` | macOS alias of the bar toggle. It is also Herdr's macOS default for the sidebar toggle, which these layouts have no node for, so the layout section re-points it |
| `layout:portrait` | `ctrl-shift-y` | `layout.switch:portrait-bottom` | Switch to portrait-bottom (bar between the work area and the status line) |
| `layout:portrait` | `ctrl-shift-j` | `bar-strip.attention` | Open the Agents waiting list, with its search box |
| `layout:portrait-bottom` | `ctrl-shift-g` | `layout.toggle:bar` | Show or hide the bar (strip and space tree) |
| `layout:portrait-bottom` | `cmd-b` | `layout.toggle:bar` | macOS alias of the bar toggle. It is also Herdr's macOS default for the sidebar toggle, which these layouts have no node for, so the layout section re-points it |
| `layout:portrait-bottom` | `ctrl-shift-y` | `layout.switch:portrait` | Switch to the portrait layout (bar on top) |
| `layout:portrait-bottom` | `ctrl-shift-j` | `bar-strip.attention` | Open the Agents waiting list, with its search box |

`cmd-` keys are macOS. `bar-strip.attention` is delivered only to a shown bar-strip, so it is bound inside the two layout sections. If you rename a layout, rename its `layout:<name>` section and the `layout.switch:` values with it. The bell's tooltip prints the key really bound on your machine.

### Optional: tmux-style chords

Not shipped, because a bound `ctrl-b` prefix takes `ctrl-b` from the programs in your terminals (readline, tmux). Chords are not described in Herdr's written reference; this is the form the author used on macOS with 0.1.12. After saving, look for `keys.error` in the Herdr home folder.

```json
{
  "layout:portrait": {
    "ctrl-b a": "bar-strip.attention",
    "ctrl-b b": "layout.toggle:bar",
    "ctrl-b shift-b": "layout.switch:portrait-bottom"
  },
  "layout:portrait-bottom": {
    "ctrl-b a": "bar-strip.attention",
    "ctrl-b b": "layout.toggle:bar",
    "ctrl-b shift-b": "layout.switch:portrait"
  }
}
```

## Optional: Vault panel

The layouts work without the Obsidian mods. To add the Vault panel, install `vault` and `vault-reader` from herdr-obsidian-vault and paste `snippets/vault-panel.json` into the `children` of the `panel-body` stack in each layout you use. The Vault button, tab and note rows appear only when both the mod and the panel are there.

## Theme

No theme is pinned: Settings decides. Any Herdr theme works, because the mods use only theme colours. To fix one in the layout, add `"theme": { "light": "paper", "dark": "graphite" }` to the layout's root, or carry your own `themes/<name>.json`.

## Privacy

Nothing here uses the network. This is everything the mods read, run and write:

| Mod | Reads | Runs | Writes or stores | Where to check |
|---|---|---|---|---|
| bar-strip | Agent list and status, the layout tree, the key bindings (to print the bell's key), whether an app update is ready, and whether the file `mods/vault/main.js` exists in the Herdr home folder (existence only, at start and every 60 seconds). | Nothing. Opens Herdr's own dialogs and runs Herdr commands (`agent.focus`, `layout.select`, `layout.show`, `layout.hide`, `mod.open`, `app.settings`). | Shared key `mods.vault` (a yes or no). | `probeVault`, `keyHint`, `attention`, `picker` |
| portrait-tree | Spaces, tabs, panes, agents and their state, terminal labels (`editor.file`), shared keys `space.colors` and `vault.panes`. | Nothing. | The mod's local storage: `folded` and `peeked` (space ids, dropped when the space is gone) and `changed` (agent address and the time its state last changed; an agent that is gone loses its entry after 7 days). Shared key `agents.since`. One small SVG per space name under `data/portrait-tree-spines/` in the Herdr home folder (the rotated name on a folded space); files of names that no longer exist are deleted once when the tree starts. | `track`, `reveal`, `createSpineStore`, `pruneChanged` |
| portrait-tabs | Spaces, tabs, panes, layout tree, window info. | Nothing. | Local storage `panels`: which side panel each space last had open (dropped when the space is gone). | `syncPanel`, `prunePanels` |
| portrait-pane | The one pane it heads: program, folder, state, zoom. | Nothing. | Nothing. | `render` |
| portrait-files | Folder listings of the focused pane's folder (500 entries per folder, 5,000 in all), the git state of that folder, and, on alt-click only, the text of one file (up to 400,000 characters shown). | `sh` to list a folder (macOS, Linux, remote machines), `powershell` on a Windows local machine, `git rev-parse --show-prefix` and `git status` (read-only flags, no lock), your login shell once per machine to read its PATH (`printenv PATH`), `command -v nvim`, `hc run` to start nvim, and `nvim` in a terminal Herdr shows. Nothing runs while the Files panel is closed. | A socket file for each nvim it starts, in `/tmp` on macOS and Linux. Labels on that terminal: `editor.file` (the full file path), `editor.socket` and `editor.space`; `hc ls` shows them. | `directory`, `refresh`, `edit`, `loginPath`, `nvimArgv`, `show` |
| nvim-float | Terminal list and labels, spaces, panes. | `sh` running `nvim --server ... --remote-send`, `--remote` and `--remote-expr` against the socket of an nvim this layout started, only when you use its close button or Keep menu. | Nothing. | `nvim`, `keptEditors` |
| attention-picker (bundled) | Agent list. While the list is open, the visible screen text of every agent that is blocked or done, read with `hc read`; only the last question or message line is kept and shown. | `hc read` every 2 seconds while the list is open. | Shared key `attention.sort` (the sort order you picked). | `readPreviews` |

Fuller text: [Privacy](docs/privacy.html).

## Troubleshooting

- **Layout won't load.** Read `layout.error` in the Herdr home folder; `ctrl-alt-shift-escape` always returns to the default layout.
- **Bell key does nothing.** The command reaches only a shown bar-strip: bound per layout, and not while the bar is hidden.
- **A click shows a preview or "Couldn't open nvim".** nvim is not on your login shell's PATH (you get "nvim not found on PATH" and the preview), `hc run` failed, or the terminal did not appear within 10 seconds. On Windows a click opens the preview instead.
- **No Vault button.** It needs the `vault` mod and the `vault` panel node, both.
- **Columns cut off.** Each needs 290 px; use the arrow markers, swipe sideways, fold spaces, or widen the bar.

More: [Troubleshooting](docs/troubleshooting.html).

## Uninstall

Switch to another layout (`ctrl-shift-l` cycles), delete `layouts/portrait*.json` (and `.svg`) and the mod folders you copied from the Herdr home folder, remove the keys you merged, and delete `data/portrait-tree-spines/` there. Leftover `/tmp/herdr-nvim-*.sock` files vanish on reboot.

## What is original, cloned, bundled

| Piece | Kind | Origin |
|---|---|---|
| layouts `portrait`, `portrait-bottom` | Cloned | Started from Herdr's shipped `main` layout (0.1.12, `cloned_from` in the file), then changed heavily. |
| `portrait-tree` | Original | Written for this layout. |
| `bar-strip` | Original | Written for this layout. |
| `nvim-float` | Original | Written for this layout. |
| `portrait-tabs` | Cloned | From Herdr's shipped `tabs` mod, 0.1.12 (`cloned_from` in its mod.json): the Files and Changes buttons moved to the strip, per-space panel memory kept, the optional Vault panel allowed. |
| `portrait-pane` | Cloned | From Herdr's shipped `pane` mod, 0.1.12: shows a note's name and folder for panes of the optional Vault reader. |
| `portrait-files` | Cloned | From Herdr's shipped `files` mod, 0.1.12: a click opens nvim in a floating window instead of a preview (alt-click keeps the preview), git marks, listing caps. |
| Icons | Copied | Small SVG icons carried inside each mod's folder: Lucide icons (ISC licence) and art copied from Herdr's shipped mods (Apache-2.0). [NOTICE](NOTICE) lists each file. |
| `attention-picker` | Bundled copy | Canonical source: the herdr-agents-waiting repository. This copy is synced by the maintainer; change it there, not here. |

Needs from Herdr (shipped mods and overlays):

| Needs | Used by | If it is gone |
|---|---|---|
| `workspace-status` (shipped mod) | Layout: the 28 px status line. | The status line is empty. |
| `changes` (shipped mod) | Layout: the Changes tab of the side panel. | That tab is empty. |
| `picker` (shipped overlay) | bar-strip: the Search button. | Search does nothing. |
| `machine-add` (shipped overlay) | bar-strip: the Add machine button. | The button does nothing. |
| `menu` and `new-menu` (shipped overlays) | portrait-tree and portrait-tabs: right-click menus and the + button. | Menus and + do nothing. |
| Theme colors (`chrome`, `canvas`, `raised`, `hover`, `selected`, `border`, `accent`, `working`, `blocked`, `done`, `idle`) | Everything. Any Herdr theme has them. | Not applicable: every theme defines them. |
| `hc` (herdr-core) and `nvim` on the login shell's PATH | Click-to-edit in portrait-files, the waiting list's previews. | Files: a message and the read-only preview instead of nvim. The waiting list shows no question text. |

## Contributing, changelog, licence

[CONTRIBUTING.md](CONTRIBUTING.md), [CHANGELOG.md](CHANGELOG.md). Apache-2.0, see [LICENSE](LICENSE) and [NOTICE](NOTICE).
