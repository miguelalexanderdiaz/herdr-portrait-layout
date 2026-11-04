# Portrait layout for Herdr

A [Herdr](https://herdr.dev) layout for tall, vertical monitors. Your spaces sit side by side as columns in a strip at the top, each a tree of its tabs and panes with the state of every agent. The work area gets the rest of the screen, and a side panel brings Files and Changes when you want them.

![Illustration of the portrait layout with made-up content: three space columns (api, web, docs) with agent rows and state words and a folded fourth (infra) in a strip on top, a tab bar, a large terminal pane with an agent running tests, a shell pane, and a status line.](preview.png)

*An illustration with made-up content, not a screenshot of anyone's setup.*

Docs for humans: the [documentation site](https://miguelalexanderdiaz.github.io/herdr-portrait-layout/) (GitHub Pages from `docs/`; the address is live once the repository is public and Pages is on; until then open `docs/index.html` from a clone). Docs for agents: [AGENTS.md](AGENTS.md) and [llms.txt](llms.txt). Herdr's build brief: [RECIPE.md](RECIPE.md).

## What you get

| Part | What it is |
|---|---|
| Layouts `portrait`, `portrait-bottom` | Bar (strip plus space tree) on top, then tab bar, work area, status line. The second puts the bar between the work area and the status line. A side panel on the right is hidden until opened. |
| `portrait-tree` | One column per space: tabs, panes, every agent with its state and time in it (an agent without a pane gets a row under its tab). Spaces fold into thin strips and open by themselves when an agent in them gets focus. |
| `bar-strip` | Search, Add machine, Settings; a bell that says who needs you; Files, Changes and (optional) Vault buttons. |
| `portrait-tabs`, `portrait-pane` | Tab bar and pane header, cloned from Herdr's shipped mods. They remember the side panel per space. |
| `portrait-files`, `nvim-float` | Files for the focused pane's folder with git marks; click a file to edit it in a floating nvim (macOS and Linux). |
| `attention-picker` | The *Agents waiting* list (bundled copy of the herdr-agents-waiting mod). |
| Vault panel (optional) | Works without the Obsidian mods. To add it, install `vault` and `vault-reader` from herdr-obsidian-vault and paste `snippets/vault-panel.json` into the `children` of the `panel-body` stack in each layout you use. The Vault button, tab and note rows appear only when the mod and the panel are both there. |

## Requirements

The Herdr desktop app, 0.1.12 or newer (built and used on 0.1.12). `git` (change marks) and `nvim` (click-to-edit) are optional. No network, no account.

| Feature | macOS | Linux | Windows |
|---|---|---|---|
| Layouts, tree, tab bar, pane headers, bell, waiting list | Works | Not run, expected to work | Not run, expected to work |
| Files listing and git marks | Works | Not run, expected to work | Not run, expected to work (PowerShell listing) |
| Click a file to edit in nvim | Works | Not run, expected to work | No: opens the read-only preview and says so once |
| Keys | `cmd-` and `ctrl-shift-` | `ctrl-shift-` | `ctrl-shift-` |

Developed and used on macOS only. Linux and Windows are described from the code, not from a test run; no CI run has been reported yet. The layouts keep the system title bar, so no window buttons are drawn on Linux and Windows. Details, and the code that decides each row: [Platforms](https://miguelalexanderdiaz.github.io/herdr-portrait-layout/platforms.html).

## Install

### With an agent

Tell the agent in your Herdr:

```
install https://github.com/miguelalexanderdiaz/herdr-portrait-layout
```

It follows Herdr's protocol for shared layouts: tells you what runs, never overwrites, renames on a clash, asks before changing your `keys.json`, checks each mod, then switches the layout. Steps for agents: [AGENTS.md](AGENTS.md).

### By hand, macOS and Linux

Tried in a scratch Herdr home on macOS (`HERDR_APP_HOME=<empty folder>`): everything copied, `herdr-app check` passed for all seven mods.

```sh
git clone https://github.com/miguelalexanderdiaz/herdr-portrait-layout.git
cd herdr-portrait-layout

# The Herdr home folder (herdr-app --help prints it on the last line).
H="${HERDR_APP_HOME:-$HOME/.config/herdr-app}"
mkdir -p "$H/layouts" "$H/mods"

# Never overwrite: anything that already exists is reported and skipped.
# Includes the layouts' .svg thumbnails. Rename a layout together with its "preview" field.
for f in layouts/*; do
  if [ -e "$H/$f" ]; then echo "exists, rename first: $f"; else cp "$f" "$H/layouts/"; fi
done
for m in mods/*; do
  n="${m#mods/}"
  if [ -e "$H/mods/$n" ]; then echo "exists, skip or rename: $n"; else cp -R "$m" "$H/mods/$n"; fi
done

for m in mods/*; do herdr-app check "$H/mods/${m#mods/}"; done   # check every mod you now have
herdr-app do layout.switch --name portrait                          # switch to the layout
```

### By hand, Windows (PowerShell)

```powershell
git clone https://github.com/miguelalexanderdiaz/herdr-portrait-layout.git
cd herdr-portrait-layout

# The Herdr home folder. If herdr-app --help prints another folder, set $H to it.
$H = if ($env:HERDR_APP_HOME) { $env:HERDR_APP_HOME } else { Join-Path $HOME ".config\herdr-app" }
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

The PowerShell block follows its documentation and has not been run on Windows; the default home folder there is unconfirmed, so trust what `herdr-app --help` prints. Then merge the repository's `keys.json` into yours (next section). If you already have `attention-picker` from herdr-agents-waiting, keep yours and skip the bundled one.

## Keys

| Section | Key | Action | What it does |
|---|---|---|---|
| `layout:portrait` | `ctrl-shift-g` | `layout.toggle:bar` | Show or hide the bar (strip and space tree) |
| `layout:portrait` | `cmd-b` | `layout.toggle:bar` | macOS alias of the bar toggle (Herdr's macOS default for the sidebar toggle, which these layouts have no node for) |
| `layout:portrait` | `ctrl-shift-y` | `layout.switch:portrait-bottom` | Switch to portrait-bottom |
| `layout:portrait` | `ctrl-shift-j` | `mod.open:attention-picker` | Open or close the Agents waiting list, with its search box |
| `layout:portrait-bottom` | `ctrl-shift-g` | `layout.toggle:bar` | Show or hide the bar (strip and space tree) |
| `layout:portrait-bottom` | `cmd-b` | `layout.toggle:bar` | macOS alias of the bar toggle (Herdr's macOS default for the sidebar toggle, which these layouts have no node for) |
| `layout:portrait-bottom` | `ctrl-shift-y` | `layout.switch:portrait` | Switch to the portrait layout |
| `layout:portrait-bottom` | `ctrl-shift-j` | `mod.open:attention-picker` | Open or close the Agents waiting list, with its search box |

`cmd-b` is macOS only; it does nothing on Linux and Windows, where the `ctrl-shift-` keys do the work. If you rename a layout, rename its `layout:<name>` section and the `layout.switch:` values with it. The bell's tooltip prints the key really bound on your machine. `ctrl-b` chords are not shipped (they take `ctrl-b` from your terminals); the optional set is on the [Configuration page](https://miguelalexanderdiaz.github.io/herdr-portrait-layout/configuration.html#tmux) and in [AGENTS.md](AGENTS.md).

## Theme

No theme is pinned: Settings decides, and every Herdr theme names the same colours, so any theme works. Chrome, text and state colours come from the theme (`foreground`, `background`, `muted`, `dim`, `chrome`, `raised`, `hover`, `selected`, `border`, `accent`, `working`, `blocked`, `done`, `idle`; Files also uses `ansi1` to `ansi6`). The exceptions are the space marks, six fixed colours that look the same on every theme, with a white or near-black letter chosen per colour by contrast. The mark colour is also the title rule and the active folded space's name; on a light theme that name is mixed toward the text colour for contrast (how it looks on `paper` has not been seen). To fix a theme in the layout, add `"theme": { "light": "paper", "dark": "graphite" }` to the layout's root, or carry your own `themes/<name>.json`.

## Privacy

Nothing here uses the network (`rg -n "fetch|XMLHttpRequest|WebSocket" mods` prints nothing). What each mod reads, runs and writes:

- `bar-strip` reads agents, the layout tree and your key bindings, and whether `mods/vault/main.js` exists (existence only, every 60 seconds). It runs nothing. It writes the shared key `mods.vault`.
- `portrait-tree` reads spaces, machines, tabs, panes and agents. It stores which spaces are folded, and when each agent's state last changed (an agent that is gone loses its entry after 7 days). It writes one small SVG per space name under `data/portrait-tree-spines/` in the Herdr home folder.
- `portrait-tabs` stores which side panel each space last had open. `portrait-pane` reads its own pane and stores nothing.
- `portrait-files` lists the focused pane's folder (500 entries per folder, 5,000 in all), runs `sh` or `powershell`, `git status` and your login shell once for its PATH, and starts nvim; nothing runs while the panel is closed. It reads one file's text when you alt-click it (or click it where nvim is unavailable). nvim sockets go to `/tmp`; the nvim terminal carries labels with the full file path, which `hc ls` shows.
- `nvim-float` runs `nvim --remote` commands against an nvim this layout started, only from its close button or Keep menu.
- `attention-picker` (bundled) reads the screen text of blocked or finished agents with `hc read` (60 lines each, every 3 seconds, only while the list is open) and keeps one question or message line per agent. It remembers when it first saw each agent's state in local storage (`attention.seen`: agent address, state group, time; no screen text). It writes the shared key `attention.sort`.

The full table with the function that does each thing: [Privacy](https://miguelalexanderdiaz.github.io/herdr-portrait-layout/privacy.html).

## Troubleshooting

- **Layout won't load.** Read `layout.error` in the Herdr home folder; `ctrl-alt-shift-escape` always returns to the default layout.
- **The waiting-list key does nothing.** Check `keys.error`, that the key is in the section of the shown layout, and that the mod is named `attention-picker`.
- **A click shows a preview or "Couldn't open nvim".** nvim is not on your login shell's PATH, `hc run` failed, or the terminal did not appear within 10 seconds. On Windows a click opens the preview.
- **No Vault button.** It needs the `vault` mod and the `vault` panel node, both.
- **Columns cut off.** Each needs 290 px; use the arrow markers, swipe sideways, fold spaces, or widen the bar. A folded space is 34 px wide.

More: [Troubleshooting](https://miguelalexanderdiaz.github.io/herdr-portrait-layout/troubleshooting.html).

## Uninstall

Switch to another layout (`ctrl-shift-l` cycles), delete `layouts/portrait*.json` and `.svg` and the mod folders you copied from the Herdr home folder, remove the keys you merged, and delete `data/portrait-tree-spines/` there. Leftover `/tmp/herdr-nvim-*.sock` files vanish on reboot.

## What is original, cloned, bundled

`portrait-tree`, `bar-strip` and `nvim-float` are original. The two layouts and `portrait-tabs`, `portrait-pane`, `portrait-files` are clones of Herdr's shipped 0.1.12 layout and mods (`cloned_from`), changed. `attention-picker` is a bundled copy; its source is the herdr-agents-waiting repository, so change it there, not here. Small icons are carried inside each mod: Lucide icons (ISC; a few also MIT), art copied from Herdr's shipped mods (Apache-2.0), and two drawings made for this layout; [NOTICE](NOTICE) lists every file. What the layout needs from Herdr (its status line, Changes tab, search and menu overlays) is on [How it works](https://miguelalexanderdiaz.github.io/herdr-portrait-layout/how-it-works.html).

[CONTRIBUTING.md](CONTRIBUTING.md), [CHANGELOG.md](CHANGELOG.md). Apache-2.0, see [LICENSE](LICENSE) and [NOTICE](NOTICE).
