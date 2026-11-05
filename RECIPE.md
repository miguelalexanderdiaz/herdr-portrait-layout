# Portrait

A layout for vertical monitors. A full-width bar across the top holds one column per space, each a small tree of
its tabs and panes with every agent's status; the tab strip and the panes fill the rest of the window; Files and
Changes open in a panel on the right. A second layout, Portrait bottom, puts the same bar at the bottom.

![Portrait](preview.png)

This file is the brief: enough to build Portrait from an empty folder. The files next to it are one build of it. If
they don't work on your Herdr, or you want it different, build it again from here. The picture is drawn from invented
content (`scripts/make-preview.mjs`); it is not a screenshot of anyone's window.

Made for Herdr 0.1.12. It sets no theme and no fonts (the person's own settings decide the look) and adds four keys, see
Keys. Linux, Windows and fish-shell behaviour is written down but was never run on a live build, see Watch out.

## What you see

Top to bottom, the whole window width. The window keeps the system title bar on every system (the layouts set no
`titlebar`), so the minimize, maximize and close buttons are the system's own. The tab strip draws its own three buttons
only if Herdr reports that the window has none (`window().buttons`), which neither layout causes.

1. **The bar**, 246px tall (the drag handle under it resizes it: 90px to 1400px), background `chrome`, a 1px `border`
   rule under it.
   - **The strip**, 26px, `chrome`, text 11.5px. On the left three outlined buttons with a 13px icon: *Search*,
     *Add machine*, *Settings* (a 6px `accent` dot appears on Settings while an app update is downloaded). On the right
     the *bell* chip, then the panel buttons *Files* and *Changes*.
     The bell reads "Needs you" when no agent waits, "1 needs you" and/or "2 done" otherwise, in `blocked` (asking)
     or `done` (finished) with a 12% tint of the same color behind it. A panel button is lit (`selected`
     background, `foreground` text) while its tab is open in the right panel.
   - **The space columns**, the rest of the bar's height. One column per space, side by side, each at least 290px
     wide and sharing the width equally, with a 1px `border` rule between them; the active space's column is
     `raised`. A folded space is a 34px strip. After the last column a 34px strip with a `+` makes a new space.
     - The **header**, 40px: a fold button, an 18px badge (radius 5) with the space's first letter on the space's
       color (white or near-black, whichever contrasts), the name at 15px semibold (`foreground` if active,
       otherwise `muted`) with a 2px rule under it in the space's color exactly as wide as the name (softened
       while another space is active), the machine's name with a server icon when the space lives on another
       machine, the state counts (`! 1  ⟳ 2`), and a `+`.
     - Under the header, per tab a 24px **tab row** (tree line `├─` or `└─` in `dim` monospace 12px, the tab's name
       or "Tab N" at 12px medium, a 14px glyph when an agent in it is not idle) and per pane a 26px **pane row**:
       the tree lines, the program's 15px icon, the name at 12.5px, then for agents the state word ("needs you",
       "done", "working", "idle"; dropped when the column is narrower than 320px), the time since the state last
       changed ("<1m", "5m", "3h", "2d") and a 14px state glyph. A plain terminal or mod pane shows its program
       or mod name and its folder (path shortened with `~`, losing its start when short of room). The focused
       pane's row is `selected`, the shown tab's row `hover`. An agent that has no pane of its own (a sub-agent)
       gets a row under its tab with the program icon, name, state and time; a click focuses it (`agent.focus`), and it has no
       right-click menu.
     - A **folded space** is a 34px strip: its badge on the header line, one 14px glyph per agent (six at most, then
       `+N`), and its name running down the strip like a book spine, in the space's color when active and `muted`
       otherwise (on a light theme the active name is mixed halfway toward `foreground`, which keeps it readable; this was
       measured against sample light colors, not seen on a shipped light theme).
     - When the columns don't fit, a whole run of columns is shown, with 28px `‹` and `›` markers at the ends that say
       how many spaces are off that side and the most urgent state among them, and a 5px track under the columns
       whose thumb shows where the run sits.
2. **The work area**, between the bar and the status line, background `canvas`.
   - **The tab strip**, 42px, `chrome`, 1px `border` rule below, draggable (moves the window, double-click maximizes).
     Tabs are pills 29px high (radius 7, 1px border, 12.8px text) of the active space only; the active one has the
     `raised` background, a `border` outline, `foreground` text and a close icon; the others are `muted` on
     `chrome`. A tab shows the program's icon (14px), its name (170px at most; "Name Z" when zoomed) and, when an
     agent in it works, a 12px spinner in `working`, or when it is blocked or done a 6px dot in `blocked` or `done`.
     At the end a 26px `+` (and, only when Herdr reports a window without system buttons, the three window buttons).
   - **The panes**, in a 8px padding with 8px between cards: the active tab's terminals. Each pane is a card with
     radius 10, a 1px `border` outline (1px `accent` when focused), background `background`, and a 30px header
     that is always shown. Terminals have 14px top and bottom, 12px left and right padding inside the card; one
     pane alone is also framed.
   - **The pane header**, 30px, `background`, 1px `border` rule below, text 12px: the program's icon (14px), the
     agent's name, or the terminal's title, in `foreground` medium (260px at most), then the folder in `dim` (with
     `~`), then the status: a 12px spinner when working, a "Needs you" chip (18px high, radius 5, `blocked` text
     on a 15% `blocked` tint, 10.5px semibold) when blocked, a 7px `done` dot when done.
3. **The status line**, 28px, the shipped `workspace-status` mod.
4. **The right panel** (hidden at first), 368px wide (280px to 1600px, resizable) to the right of everything, 8px
   padding, holding one of: **Files** (a card, radius 10, 1px `border`, `background`: a 42px header "Files" with the
   folder's name on the right, then the folder tree) or **Changes** (the shipped `changes` mod).

**Portrait bottom** is the same layout with the bar moved: the work area first, then the bar, then the status line. Nothing
else differs.

Colors are all theme names (`canvas`, `chrome`, `raised`, `background`, `border`, `accent`, `foreground`, `muted`,
`dim`, `hover`, `selected`, `working`, `blocked`, `done`, `idle`), so any light or dark theme works. The only fixed colors
are the space marks (`#22a99a`, `#e3814f`, `#5b8def`, `#8b7cf6`, `#3fae6a`, `#d9649a`, used for the shared
`space.colors` names `ansi6`, `ansi3`, `ansi4`, `ansi5`, `ansi2`, `ansi1`) and the badge ink (`#ffffff` or `#141414`).
Text is the person's UI font; the tree lines use JetBrains Mono and the folded names Geist, both shipped with Herdr.

## How it behaves

| Agent status | Tree row | Tab | Pane header |
| --- | --- | --- | --- |
| working | 12px spinner in `working`, turning once in 0.9s; word "working" | 12px spinner | 12px spinner |
| blocked (needs you) | 14px chip, `!` in `blocked` on a 15% tint; word "needs you" | 6px `blocked` dot | "Needs you" chip |
| done | 7px `done` dot; word "done" | 6px `done` dot | 7px `done` dot |
| idle | 7px ring in `idle`; word "idle"; the name is `muted` unless focused | nothing | nothing |

The time next to a state is how long ago the agent last changed between working, blocked and idle (done counts as
idle); it is kept per agent and published to other mods as the shared `agents.since`. The tree redraws every 30s so
the times move.

**The bar's strip**
- *Search* opens the shipped `picker`; *Add machine* the shipped `machine-add`; *Settings* runs `app.settings`.
- The *bell*: a click goes to the agent that has waited longest, asking agents before finished ones, with
  `agent.focus`; clicking again moves to the next, wrapping. Shift-click, or the key `ctrl-shift-j`
  (`mod.open:attention-picker`, which works even while the bar is hidden and closes the list when pressed again), opens
  the "Agents waiting" list (`attention-picker`) with a search box. The bell's tooltip names the real key. The mod
  commands `bar-strip.attention` (the same list, with the box on) and `bar-strip.jump` (what a plain click does) are still
  served for anyone who binds them in a `layout:` section; they reach a shown strip only. Idle bell: dimmed, nothing
  happens on a plain click.
- *Files* and *Changes* open the right panel on that tab (`layout.select` on `panel-body`, then `layout.show` on
  `panel`); clicking the lit one hides the panel (`layout.hide`). The panel choice is remembered **per space**: switch
  spaces and the panel comes back as that space had it, or closed if it never had one.

**The space columns**
- Click a header: select the space. Drag a header onto another: reorder (`space.move`, within one machine). Right-click
  a header, tab row or pane row: the shipped `menu` for it. The fold button (or a click on a strip) folds a column into
  a strip and back; hovering a strip swaps its badge for an unfold icon.
- Click a tab row: show that tab (selecting its space first). Double-click: rename. Drag onto another tab of the same
  space: reorder (`tab.move`).
- Click an agent or pane row: `pane.focus`.
- The `+` in a header opens the shipped `new-menu` for that space (a terminal or an agent, new space, worktrees); the `+`
  strip at the end runs `space.new`.
- A folded space opens when one of its agents gets focus (by the bell, the waiting list, a notification or
  `agent.next`), and folds again once you move to another space. Opening or folding one by hand keeps it as you left it.
  Folding the space you are in keeps it folded.
- `agent.next` and `agent.prev` follow the tree's order (`setAgentOrder`). Herdr appends the agents it was not given in
  its own order, so agents of folded spaces come last rather than being skipped; focusing one opens its space.
- The wheel: a horizontal swipe, or Shift plus the wheel, moves the run of columns by one column per notch of a mouse wheel, or per 40px of a trackpad or any device that reports pixels; plain vertical
  scrolling stays with the column. The markers do the same on click. The run follows the active space.
- A pane that a mod draws (not a terminal) shows the mod's name in its tree row, with an empty icon slot instead of
  the `>_` of a terminal without an icon; its pane header shows its title, or the mod's name when it has none.

**The tab strip**
- Click a tab: select. Double-click: rename. Drag onto another: reorder. Right-click: the shipped `menu`. The active
  tab's `x`: `tab.close`. `+`: the shipped `new-menu`. The wheel over the strip: previous or next tab (see below).
- The window buttons (Linux and Windows) run `window.minimize`, `window.maximize` and `window.close`; Windows uses
  vector icons (with a restore icon when maximized), Linux plain glyphs.
- The wheel moves one tab per notch of a mouse wheel, or per 40px of a trackpad swipe, at most three per event.

**The pane header**
- Click: focus the pane. Hover: four 14px buttons appear: split right, split down, zoom (unzoom while zoomed), close
  (`pane.split`, `pane.zoom`, `pane.close`).

**The Files panel**
- Shows the focused pane's folder (on its machine when the space lives on another), loaded lazily: a folder's contents
  load when it is opened. Rows are 28px with a chevron, folder or file icon and the name; git changes show a letter
  mark (`A` new, `M`, `D`, `U` conflict) and a closed folder shows a dot (the conflict color when something below it is in conflict, otherwise the modified color). Limits: 500
  entries per folder (folders listed first), 5,000 in all; previews stop at 400,000 characters.
- The panel does nothing while it is closed: no listing, no `git`, no folder watching; opening it refreshes once. While it
  is open a change in the folder refreshes it, at most once every 1.5 seconds; up to three folders are watched and a
  fourth relies on a 10-second timer.
- Click a folder: expand or collapse. Click a file and it opens where it makes sense:
  - **Text** opens in the editor picked with the `▾` at the right of the panel's header (saved in shared
    `files.editor`). The menu lists only what is installed on the folder's machine: terminal editors (nvim, Helix, Vim,
    micro, nano) open in a floating window over the app, one editor per click even on a double click; apps (VS Code,
    Zed, Sublime Text) open in their own window; *Default app* hands the file to the system; *Preview only* keeps the
    read-only preview in the panel. With nothing picked, nvim when it is installed, else the default app.
  - **Pictures** (PNG, JPEG, GIF, WebP, BMP, SVG; AVIF and TIFF on macOS) and **PDFs** open in a viewer window
    (`portrait-viewer`): a picture fits the window, a PDF shows its pages one under another (up to 200). It has
    *Open in Preview* (macOS; *Open in the default app* elsewhere) and `x`; Esc closes it.
  - **Documents, media and archives** (Office files, audio, video, zip, ...) open in the system's app.
  - **Programs are never started** (scripts, `.app`, `.exe`, ...): text ones open in the editor, or in the preview
    when the default app is picked.
- Right-click a file: *Open with* for that one file (the editors above for text; *Viewer* or *Default app* for a
  picture or PDF). Alt-click: a read-only, syntax-highlighted preview in the panel, with a back arrow.
- A terminal editor's floating window has a title bar with the program's icon, the file's name and its folder and
  *Keep*, a menu with "New tab" (the editor becomes a tab of the space, `terminal.keep`). For nvim it also lists, for
  every nvim tab already kept in the space, "Add to <tab>" (the file opens there as a buffer, that tab is focused and
  the float quits), and has `x`, which quits the float's nvim (`:confirm qa`, so unsaved changes ask first). Other
  editors are closed the way they close. The window closes when the editor ends.
- The editors started here are labeled with their file (`editor.file`), nvim also with its socket (`editor.socket`); the
  tree shows the file as the pane's name.

**What moves:** the tree and the strip follow focus and status live; the panel, the folded set and each agent's time
are remembered across restarts (the mods' own `localStorage`).

### Keys

`keys.json` has two identical sections, `layout:portrait` and `layout:portrait-bottom` (a key works only while that
layout shows):

| Key | Action | What it does |
| --- | --- | --- |
| `ctrl-shift-g` | `layout.toggle:bar` | show or hide the bar |
| `cmd-b` | `layout.toggle:bar` | the same, a macOS alias (it replaces Herdr's macOS sidebar toggle, which these layouts have no sidebar for); on Linux and Windows expect it to do nothing (`cmd` is the Super or Windows key there), so use `ctrl-shift-g` |
| `ctrl-shift-y` | `layout.switch:portrait-bottom` (in Portrait), `layout.switch:portrait` (in Portrait bottom) | flip the bar to the other edge |
| `ctrl-shift-j` | `mod.open:attention-picker` | the Agents waiting list (a second press closes it) |

None of these is a Herdr default (`cmd-b` is a macOS default that this layout re-points on purpose), a plain `ctrl` letter
(programs in terminals use those), or `ctrl-alt` (AltGr on Windows). Rename the sections if you rename the layout files.

## Built from

**The layouts** (`layouts/portrait.json`, `layouts/portrait-bottom.json`, each with a small drawn thumbnail,
`layouts/portrait.svg` and `layouts/portrait-bottom.svg`, named by the root `preview` field). Both are clones of Herdr's
`main` 0.1.12 (`cloned_from`). Root: a `row` with `background: "canvas"`, `terminal_padding: [14, 12]`, a 1px `border`
divider, and no theme, colors or fonts (the person's settings apply). Node tree (ids are used by the mods):

```
root (row)
├─ left (column, divider 1px border, resizable)
│  ├─ bar (column, 246px high, min 90, max 1400, background chrome)
│  │  ├─ bar-strip (block, 26px)  mod bar-strip
│  │  └─ tree (block)             mod portrait-tree
│  ├─ work (column, not resizable)
│  │  ├─ tabs (block, 42px, window_drag)  mod portrait-tabs
│  │  └─ work-body (row, padding 8, gap 8)
│  │     └─ main (block)  content { tab: "active", pane: { header: { content: { mod: "portrait-pane" },
│  │                       reveal: "always", height: 30, position: "top" }, background: "background",
│  │                       border: { width: 1, color: "border" }, focus: { width: 1, color: "accent" },
│  │                       radius: 10, gap: 8, lone: true } }
│  └─ status (block, 28px)  mod workspace-status (shipped)
└─ panel (column, 368px, min 280, max 1600, hidden, padding 8)
   └─ panel-body (stack, active "files")
      ├─ files (block)    mod portrait-files
      └─ changes (block)  mod changes (shipped)
```

Portrait bottom lists `left`'s children as `work`, `bar`, `status`; every other node is the same, and `validate.mjs`
fails if the two files drift apart.

**The mods** (every folder in `mods/`; all have `place: "none"`: the layout or another mod puts them where they show):

| Mod | Role | `props` / commands it reads |
| --- | --- | --- |
| `portrait-tree` | the space columns, the tab and pane rows, the folded spines; publishes `agents.since`; sets the agent order | none; uses `spaces()`, `agents()`, `panes()`, `terminals()` |
| `bar-strip` | the 26px strip, the bell and the panel buttons | commands `attention` (the list) and `jump` (what a bell click does) through `nextCommand()`; opens `attention-picker` with props `{ search }`; its bell tooltip reads the person's bindings with `keys()` |
| `portrait-tabs` | the tab pills, window buttons, per-space panel memory (clone of the shipped `tabs` 0.1.12) | none |
| `portrait-pane` | the pane header (clone of the shipped `pane` 0.1.12) | `props()` = `{ pane, terminal }` from the app |
| `portrait-files` | the Files panel: opens each file in the picked editor, the viewer or the system's app, and the read-only preview (clone of the shipped `files` 0.1.12) | none in the panel; as its own popups `props()` = `{ menu: "editor", choices, current }` or `{ menu: "open", choices, path, root, on }` |
| `nvim-float` | the title bar of a floating terminal editor and its Keep menu; opened only through `openOverlay` | `props()` = `{ terminal, socket, file, space, on, editor, overlay }` or `{ menu: true, window, ... }` |
| `portrait-viewer` | the window that shows a picture or a PDF clicked in Files; opened only through `openOverlay` | `props()` = `{ file }` |
| `attention-picker` | the Agents waiting dialog (640px wide, `overlay` in its own `mod.json`); a frozen copy, hash-checked in `scripts/bundled.json`, do not edit | `props()` = `{ search }` (the search box is on unless it is `false`; `mod.open` passes no props); reads shared `agents.since` (when `portrait-tree` publishes it, otherwise it times states itself), `attention.sort` (also written), `space.colors` |

**Shipped mods it needs** (Herdr 0.1.12 or newer; they are replaced whole on every Herdr start, never edited here):
`workspace-status` (the status block), `changes` (the panel child), and opened by name as overlays `picker`,
`machine-add`, `menu`, `new-menu`. No other shipped file is read: the icons are copied into the mods that use them (see
`NOTICE`).

**Shared state:** writes `files.editor` (the editor text files open with, an id such as `nvim` or `code`),
`files.request` (the last *Open with* choice: `{ at, root, on, path, editor }`, read by the panel and ignored after 10
seconds), `agents.since` (agent address to the time of its last state change) and `attention.sort` (the Agents waiting order); reads `workspace.panels` (which panel tabs
the person has enabled, default `["files", "changes"]`), `space.colors` (space id to a color name or `#rrggbb`) and
`layout` (the shown layout's name). Each mod also keeps its own `localStorage`: `folded`, `peeked`, `changed` (`portrait-tree`), `panels`
(`portrait-tabs`) and `attention.seen` (`attention-picker`: for each agent address its state group and the time it was
first seen in it; no screen text); corrupt or foreign values fall back to empty, and ids of spaces and agents that are gone are dropped.

**Functions and commands used:** from `herdr`: `spaces, agents, panes, terminals, focused, run, shared, setShared,
setAgentOrder, theme, settings, layout, updates, window, home, appHome, keys, machines, props, nextCommand,
openOverlay, closeOverlay, notify, exec, hc, readTextFile, watchFolder`; from Node-style modules, only `fs/promises`
(`portrait-tree`: `readFile`, `readdir`, `mkdir`, `writeFile` and `unlink` on its spine SVGs under
`<app home>/data/portrait-tree-spines/`; `portrait-viewer`:
`readFile` on the clicked picture, and `readFile`, `writeFile`, `mkdir`, `readdir`, `unlink` and `rmdir` under
`<app home>/data/portrait-viewer/cache/`); commands `agent.focus`, `layout.show`, `layout.hide`, `layout.select`,
`layout.toggle`, `layout.switch`, `mod.open`, `app.settings`, `space.select`, `space.move`, `space.new`, `tab.select`,
`tab.move`, `tab.rename`, `tab.close`, `pane.focus`, `pane.split`, `pane.zoom`, `pane.close`, `terminal.keep`,
`terminal.kill` (ends an nvim terminal that did not start in time), `overlay.close` (`attention-picker` closes itself),
`window.minimize`, `window.maximize`, `window.close`.

**What it reaches outside itself (read this before installing):**
- **Network:** none. No mod calls `fetch`, `WebSocket`, `XMLHttpRequest` or any other network API (`node scripts/check-recipe.mjs`
  fails if one appears). `hc` and `exec` reach other machines only through Herdr's own machine connections.
- **Runs programs:** `git` (`rev-parse`, `status`, read-only, for the Files marks, only while the panel is open); `sh`
  (lists a folder; looks up which editors are installed with `command -v` and, on macOS, whether their apps are in
  `/Applications` or `~/Applications`, at most once a minute; launches terminal editors on macOS and Linux and on remote
  POSIX machines; starts the person's login shell to read its `PATH` with `printenv PATH` and to look up the viewer's tools with
  `command -v`, so **that shell's startup files run**, once per machine for the `PATH` and per tool lookup, a failed
  lookup retrying after 30 seconds); `powershell` (lists a folder on Windows; reads file stamps for the viewer's cache); the editor
  you pick (`nvim`, `hx`, `vim`, `micro`, `nano`, `code`, `zed` or `subl`) on the file you click; `open` (macOS),
  `xdg-open` (Linux) or `rundll32` (Windows) to hand a file to the system's app, never a program; for the viewer
  `pdfinfo` and `pdftoppm` (Poppler, when installed), `qlmanage` and `sips` (macOS, without Poppler or for AVIF and
  TIFF sizes), `stat` (file stamps) and `where` (finding Poppler on Windows); `hc` (`hc run` to start the editor's terminal; `hc read <agent> --lines 60` in `attention-picker`
  only, for each blocked or finished agent every 3 seconds while its list is open, to find the question on screen). Files,
  `git`, `sh`, `nvim` and `hc run` run on the machine of the folder that is shown (`on`), which may be a remote one;
  `hc read` reads agents on any machine Herdr lists.
- **Reads outside its folder:** the folders shown in the Files panel and the file you click (through `exec` and
  `readTextFile`, on the folder's own machine); terminal
  text through `hc read` (`attention-picker` only; kept in memory while the list is open, not stored); the person's key
  bindings (`bar-strip`, for the bell's tooltip); the shared values above; the app's own list of spaces, tabs, panes,
  terminals and agents (names, folders, titles); the picture or PDF you click (the viewer, only inside the home
  folder). An editor's terminal is labeled with `editor.file=<full path>` (nvim also with `editor.socket=<socket
  path>`), which any other mod can read.
- **Writes outside its folder:** copies of the pictures and drawn PDF pages the viewer shows, under
  `<app home>/data/portrait-viewer/cache/` (Herdr draws pictures only from the app's folder; entries over 30 days old
  or past 200 MB are deleted); one small SVG per space name under `<app home>/data/portrait-tree-spines/` (the
  rotated name of a folded space; the folder is not inside the mod because Herdr reloads a mod when its files
  change; stale ones of removed spaces are deleted); a unix socket `/tmp/herdr-nvim-<id>.sock` per nvim started from the
  panel (macOS and Linux; nvim itself creates it); the mods' `localStorage` (folded spaces, remembered panels, state times, and `attention.seen`: agent address, state
  group and time, no screen text). Nothing is written into the person's projects:
  the nvims write only what the person saves.

**Art:** icons are small SVGs inside the mod that uses them (provenance and licenses in `NOTICE`); the preview and thumbnails
are drawn by `scripts/make-preview.mjs`.

## Watch out

- **The bar is 246px high, not wide.** `size.px` on a child of a column is its height. Making the bar a left column
  turns this into another layout. Three open columns need 3 × 290px plus the 34px `+` strip; a 1080px-wide window just
  fits three open columns and one strip, and anything more brings the `‹ ›` markers.
- **No theme, no fonts.** The preview uses colors close to Herdr's `graphite`; on `paper` or a theme from `themes/` the
  same layout takes that theme's colors. Do not pin a theme in the layout: Settings decides.
- **Not exercised on a live Linux or Windows build in this repository's history.** The PowerShell folder listing, the
  read-only preview that a Windows click opens, the login-shell `PATH` lookup under fish, and the window-button rules
  below are written from the code and from Herdr's documentation; checks and tests run on all three systems in CI, but
  CI does not start Herdr. Treat these as hypotheses until `scripts/PUBLISH.md` step 4's result table is filled in.
- **Terminal editors work on macOS and Linux and on remote POSIX machines; on Windows (this computer) the choice is the
  default app or the preview.** The editor must be installed on the machine of the folder; the `PATH` of the person's
  login shell is read once (`printenv PATH`, which also works in fish) and the launch runs in plain `sh`, so Homebrew and
  similar installs are found. A folder on another machine offers its terminal editors only, and its pictures, PDFs and
  documents don't open (the viewer and the system's app run here). A click that cannot start the editor in 10 seconds
  ends the terminal it started and says so.
- **The viewer reads only inside the home folder** (a limit of Herdr mods): a picture or PDF elsewhere opens in the
  system's app. Every PDF page needs Poppler (`brew install poppler`, `apt install poppler-utils`, `scoop install
  poppler`); without it macOS shows the first page and the other systems the install hint. The socket stays under `/tmp` because macOS temp folders can exceed the 104-byte
  limit of a unix socket path.
- **Herdr's script engine has no `Intl`.** `new Intl.Collator()` fails `herdr-app check`; sort with `localeCompare`.
- **Keys:** `cmd-b` is macOS only: on Linux and Windows `cmd` is read as the Super or Windows key (not tried on a live build), which the
  system usually keeps, so expect it to do nothing there; use `ctrl-shift-g`. The chords are `ctrl-shift` letters because no
  plain `ctrl` letter is free (programs use them) and `ctrl-alt` is AltGr on Windows. A terminal program that wants
  `ctrl-shift-g`, `-y` or `-j` loses them while one of the two layouts shows; rebind in `keys.json`. Chords with a
  prefix such as `ctrl-b a` make every plain `ctrl-b` a prefix in every terminal (tmux, readline); this repo ships none.
- **Layout and section names are load-bearing.** If an installer renames a layout because the name is taken, rename the
  `layout:<name>` sections in `keys.json`, the `layout.switch:<name>` actions and the root `preview` field of the layout
  (it must read `layouts/<new name>.svg`) with it, and copy the `.svg` thumbnails along with the `.json` files. If you already have a
  mod named `attention-picker`, keep yours instead of renaming the new one, the one exception to Herdr's rule:
  `bar-strip` and `ctrl-shift-j` open it by that name.
- **The per-space right panel is the mods' own memory, not Herdr's.** It lives in `portrait-tabs`' `localStorage` and is
  applied when the active space changes, so the tab strip (`tabs`) must be present for it to work; the panel buttons
  themselves are in `bar-strip`.
- **A folded space's name is an SVG written at run time.** It is generated under `<app home>/data/`; if that folder is not
  writable the strip shows the badge and glyphs but no name.
- **Limits:** at most 500 entries per folder and 5,000 rows in the Files panel; previews of 400,000 characters;
  six glyphs per folded strip; 170px tab names; 260px pane names.

### Load-bearing names

Other pieces look these up by name. A build or a rename that drops one breaks something silently.

- **Layout ids:** `root`, `left`, `bar`, `bar-strip`, `tree`, `work`, `tabs`, `work-body`, `main`, `status`, `panel`, `panel-body`, `files`, `changes`
- **Mods:** `portrait-tree`, `bar-strip`, `portrait-tabs`, `portrait-pane`, `portrait-files`, `nvim-float`, `portrait-viewer`, `attention-picker`, `workspace-status`, `changes`, `picker`, `machine-add`, `menu`, `new-menu`
- **Key sections:** `layout:portrait`, `layout:portrait-bottom`
- **Shared keys:** `agents.since`, `workspace.panels`, `space.colors`
- **Commands:** `bar-strip.attention`, `mod.open`, `layout.toggle`, `layout.switch`, `layout.select`, `layout.show`, `layout.hide`, `agent.focus`

## Done when

- [ ] `herdr-app check <app home>/mods/<mod>` passes for each of the eight mod folders, and `herdr-app commands` lists every
  command named in `keys.json` (`layout.toggle`, `layout.switch`, `mod.open`).
- [ ] With the layout `portrait` shown: the window is, top to bottom, a 246px bar (26px strip with Search, Add machine,
  Settings, the bell, Files, Changes; then the space columns), a 42px tab strip, the pane cards, and a 28px status line.
- [ ] With three spaces, each is a column of at least 290px with its badge, name and rule; a fourth makes `‹`/`›` markers and a
  track appear (in a 1080px window); a folded space is a 34px strip with its name written down it.
- [ ] A working agent shows a spinning 12px ring in its tree row, its tab and its pane header; a blocked one shows the `!` chip in the
  tree, a 6px dot on the tab and the "Needs you" chip in the header, and the bell says "1 needs you"; clicking the bell focuses
  that agent and opens its folded space if it was folded.
- [ ] Pressing `ctrl-shift-y` switches to `portrait-bottom` and back; `ctrl-shift-g` hides and shows the bar; `ctrl-shift-j` (or a
  shift-click on the bell) opens the Agents waiting list with a search box, also while the bar is hidden, and a second
  press of `ctrl-shift-j` closes it.
- [ ] The Files button opens a 368px panel with the focused folder's tree; closing it and switching space restores that space's
  choice; while it is closed no `git` or `sh` process runs. On macOS or Linux with nvim installed a click on a file opens it in
  a floating window whose Keep menu offers "New tab". On Windows, or without nvim on the `PATH`, the click hands the file to the default app;
  alt-click, or picking *Preview only*, shows the read-only preview.
- [ ] No mod writes anything but `<app home>/data/portrait-tree-spines/*.svg`, `<app home>/data/portrait-viewer/cache/`, the nvim sockets and its own
  `localStorage`; no mod reaches the network; `git status` of the person's projects is unchanged after browsing them.
