// A lazy file browser for the focused pane's folder, with bounded read-only previews.
// Portrait copy: a click opens the file where it makes sense.
//   text      the editor picked with the header's ▾ (saved in shared "files.editor"): a terminal
//             editor (nvim, Helix, ...) in a floating window (mods/nvim-float: Keep ▾ → new tab,
//             or add to a kept nvim), an app (VS Code, Zed, ...), the system's app, or the
//             read-only preview here. Unset: nvim when installed, else the system's app.
//   picture   the viewer window (mods/portrait-viewer); PDFs too, page by page.
//   other     the system's app (documents, media, archives). Programs are never started.
// Right-click a file: "Open with" for that one file. Alt-click: the read-only preview.
// The popups are this mod opened with props { menu }; they hand their choice back through
// shared "files.request", so the panel itself does the opening.
//
// Work happens only while the panel is on screen (filesVisible): no timer refresh, git
// status or folder watch while it is closed.
import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex, Editor, EditorState } from "gpui-base";
import { spaces, panes, focused, exec, readTextFile, watchFolder, theme, settings, window, hc, run, notify, terminals, openOverlay, closeOverlay, layout, home, props, shared, setShared } from "herdr";
import { filesVisible, watchable, createGate, createPacer, freeName, parseStatus, bubble, arrange, loginPath, nvimArgv, tilde,
  fileKind, canOpen, systemOpen, EDITORS, DETECT, parseDetect, editorChoices, pickEditor, appCommand, editorScript } from "./logic.mjs";

function location() {
  const space = spaces().find(s => s.active), f = focused();
  const pane = f?.pane ? panes().find(p => p.pane === f.pane) : null;
  const on = f?.pane === null ? (f.terminal?.includes("/") ? f.terminal.split("/")[0] : null) : space?.machine ?? null;
  return { cwd: pane?.cwd || f?.cwd || space?.folder, on, space: space?.id };
}
const key = () => JSON.stringify(location());
const LANG = { ts: "js", tsx: "js", mts: "js", cts: "js", jsx: "js", mjs: "js", toml: "yaml", jsonc: "json", svelte: "html", vue: "html" };
const PER_FOLDER = 500, TOTAL = 5000;
// A watch loop only ends at its next event and cannot be cancelled, so the folders you leave
// keep theirs for a while: at most this many at once (macOS and Windows watch recursively, Linux
// spends inotify watches). A folder over the cap relies on the 10 s timer.
const MAX_WATCHERS = 3;
const MENU_W = 250;
const label = (id) => EDITORS.find((e) => e.id === id)?.label ?? id;

// What is installed on a machine ("" = this computer): asked once a minute at most, so an
// editor installed while Herdr runs shows up. Windows, this computer: nothing to ask (no sh).
const installed = new Map();
function detect(on) {
  const key = on ?? "", hit = installed.get(key);
  if (hit && Date.now() - hit.at < 60000) return hit.found;
  const found = (async () => {
    if (!on && window()?.platform === "windows") return { bins: [], apps: [] };
    const argv = nvimArgv(await loginPath(exec, on), DETECT);
    const r = await exec(argv[0], argv.slice(1), { on: on || undefined }).catch(() => null);
    return parseDetect(r?.stdout);
  })();
  installed.set(key, { at: Date.now(), found });
  return found;
}
const choicesOn = async (on) => editorChoices({ platform: window()?.platform, on, found: await detect(on) });
const insideHome = (file) => tilde(file, home()).startsWith("~");

async function directory(path, on) {
  if (!on && window()?.platform === "windows") {
    // Windows PowerShell otherwise uses the console code page; exec decodes UTF-8.
    // Reparse points keep directory attributes even when dangling; check their target.
    const r = await exec("powershell", ["-NoProfile", "-Command", "[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false); & { param($p) @(Get-ChildItem -LiteralPath $p -Force -ErrorAction Stop | Where-Object Name -ne '.git' | Select-Object -First 501 | ForEach-Object { @{ name=$_.Name; dir=($_.PSIsContainer -and (-not ($_.Attributes -band [IO.FileAttributes]::ReparsePoint) -or ($_.Target -and [IO.Directory]::Exists(([IO.Path]::Combine([IO.Path]::GetDirectoryName($_.FullName), $_.Target[0])))))) } }) | ConvertTo-Json -Compress } '" + path.replaceAll("'", "''") + "'"]);
    if (r.code !== 0) throw new Error(r.stderr || "Cannot list this folder");
    const result = JSON.parse(r.stdout || "[]");
    return Array.isArray(result) ? result : [result];
  }
  // Folders in the first pass, files in the second: the 501-entry cap (a memory guard) can't drop a folder for files.
  const script = 'n=0; for want in d f; do for p in "$1"/* "$1"/.[!.]* "$1"/..?*; do [ -e "$p" ] || [ -L "$p" ] || continue; name=${p##*/}; [ "$name" = .git ] && continue; if [ -d "$p" ]; then kind=d; else kind=f; fi; [ "$kind" = "$want" ] || continue; printf "%s\\0%s\\0" "$kind" "$name"; n=$((n+1)); [ "$n" -gt 500 ] && break 2; done; done; test -d "$1"';
  const r = await exec("sh", ["-c", script, "files", path], { on });
  if (r.code !== 0) throw new Error(r.stderr || "Cannot list this folder");
  const fields = r.stdout.split("\0"), out = [];
  for (let i = 0; i + 1 < fields.length; i += 2) out.push({ name: fields[i + 1], dir: fields[i] === "d" });
  return out;
}

export default class Files extends View {
  init(_props, cx) {
    this.saved = new Map();
    this.entries = new Map(); this.folders = new Set(); this.pending = new Set(); this.marks = {};
    this.watching = new Set(); // roots with a watch loop running (one per root)
    this.gate = createGate();
    this.pacer = createPacer();
    this.wasVisible = false;
    // Slow safety net; it does nothing while the panel is closed.
    cx.timer.every(10000, cx => { this.peekWhenReady(); if (this.visible()) this.refresh(cx); });
  }

  visible() {
    return filesVisible(layout());
  }

  watch(root, cx) {
    if (this.on || this.watching.has(root) || this.watching.size >= MAX_WATCHERS || !watchable(root, home())) return;
    this.watching.add(root);
    cx.spawn(async cx => {
      try {
        // Ends when the folder is no longer the shown one or the panel is closed; the next refresh starts it again.
        while (this.root === root && !this.on && this.visible()) {
          await watchFolder(root);
          if (this.root === root && this.visible()) this.refreshSoon(cx);
        }
      } catch {}
      this.watching.delete(root);
    });
  }

  // A refresh asked for by the folder watch or a request that arrived mid-load: at most one run
  // per REFRESH_GAP, and one more after a run that was asked again meanwhile.
  refreshSoon(cx, trailing = false) {
    const verdict = this.pacer.request(trailing);
    if (verdict === "now") this.refresh(cx);
    else if (verdict === "later") {
      cx.spawn(async cx => {
        await cx.sleep(this.pacer.wait());
        this.refreshSoon(cx, true);
      });
    }
  }

  current(context) {
    return this.context === context && key() === context.key;
  }

  async loadFolder(path, context) {
    const { on, cwd: root } = context;
    const entries = await directory(path ? `${root}/${path}` : root, on);
    if (!this.current(context) || (path && !this.folders.has(path))) return;
    const used = [...this.entries.entries()].filter(([p]) => p !== path).reduce((n, [, e]) => n + e.length, 0);
    const { list, limited } = arrange(entries, PER_FOLDER, TOTAL - used);
    this.entries.set(path, list);
    if (limited) this.limited = true;
  }

  refresh(cx) {
    const { cwd, on } = location(), next = key();
    if (next !== this.context?.key) {
      if (this.context) this.saved.set(this.context.key, { folders: this.folders, file: this.file });
      const saved = this.saved.get(next);
      this.context = { key: next, cwd, on }; this.root = cwd; this.on = on; this.entries = new Map(); this.folders = new Set(saved?.folders);
      this.pending = new Set(); this.marks = {}; this.show(null); this.error = null; this.limited = false;
      this.loading = false;
      if (saved?.file) this.show(saved.file, cx);
    }
    if (!cwd || !this.visible()) return;
    // What the header's ▾ shows: the editor a click would use on this folder's machine.
    if (this.choicesKey !== (on ?? "")) {
      this.choicesKey = on ?? "";
      cx.spawn(async (cx) => { const c = await choicesOn(on); if ((this.on ?? "") === (on ?? "")) { this.choicesNow = c; cx.notify(); } });
    }
    if (this.loading) { this.pacer.request(); return; } // not lost: it runs again when this load ends
    const context = this.context;
    this.loading = true;
    this.pacer.start();
    this.limited = false;
    cx.spawn(async cx => {
      try {
        for (const path of ["", ...this.folders]) {
          if (!this.current(context)) return;
          await this.loadFolder(path, context);
        }
        // `git status` runs for the shown folder only (the pathspec), and its paths are made relative to it
        // (show-prefix), so a monorepo, a symlinked folder or a Windows drive letter can't make marks miss.
        const top = await exec("git", ["rev-parse", "--show-prefix"], { cwd, on }).catch(() => null);
        let marks = {};
        if (top?.code === 0) {
          // Writes nothing under .git (index lock, fsmonitor cookie): the folder watch would refresh again.
          const status = await exec("git", ["--no-optional-locks", "-c", "core.fsmonitor=false", "status", "--porcelain=v1", "-z", "--no-renames", "--untracked-files=all", "--", "."], { cwd, on }).catch(() => null);
          if (status?.code === 0) marks = bubble(parseStatus(status.stdout, top.stdout.trim(), TOTAL));
        }
        if (!this.current(context)) return;
        this.marks = marks; this.error = null; this.watch(cwd, cx);
      } catch (e) { if (this.current(context)) this.error = String(e); }
      finally {
        if (this.context === context) this.loading = false;
        const more = this.pacer.finish();
        cx.notify();
        if (more && this.context === context) this.refreshSoon(cx, true);
      }
    });
  }

  toggle(path, cx) {
    if (this.folders.has(path)) {
      for (const folder of [...this.folders]) if (folder === path || folder.startsWith(path + "/")) {
        this.folders.delete(folder);
        this.entries.delete(folder);
      }
    } else {
      this.folders.add(path);
      if (!this.entries.has(path) && !this.pending.has(path)) {
        const context = this.context;
        this.pending.add(path);
        cx.spawn(async cx => {
          try { await this.loadFolder(path, context); }
          catch (e) { if (this.current(context)) this.error = String(e); }
          finally { if (this.context === context) this.pending.delete(path); cx.notify(); }
        });
      }
    }
    cx.notify();
  }

  // A click on a file: see the top of this file. `editor` (from the Open with popup) overrides
  // the saved choice for this one file.
  async edit(path, cx, editor = null) {
    const root = this.root, on = this.on;
    if (!root) return;
    const file = `${root}/${path}`, kind = fileKind(path), platform = window()?.platform;
    const outside = (what) => {
      if (on) return notify({ title: `Can't open ${what} from another machine`, body: "Only text opens from there, in a terminal editor.", level: "info" });
      if (!canOpen(file)) return notify({ title: "Not opened", body: `${path.split("/").pop()} is a program; the Files panel doesn't start programs.`, level: "warning" });
      const [cmd, args] = systemOpen(platform, file);
      exec(cmd, args).then((r) => { if (r?.code) notify({ title: "Couldn't open the file", body: r.stderr || path, level: "error" }); })
        .catch((e) => notify({ title: "Couldn't open the file", body: String(e?.message ?? e), level: "error" }));
    };
    if (kind === "image" || kind === "pdf") {
      if (editor === "default" || on || !insideHome(file)) return outside(kind === "pdf" ? "PDFs" : "pictures");
      // The viewer reads the file, and mods can only read inside the home folder.
      openOverlay({ mod: "portrait-viewer", kind: "window", key: "portrait-viewer", width: 0.8, height: 0.88, props: { file } });
      return;
    }
    if (kind === "other") return outside("this file");
    const choice = editor ?? pickEditor(shared("files.editor"), await choicesOn(on));
    if (choice === "preview") { this.show(path, cx); cx.notify(); return; }
    if (choice === "default") {
      if (canOpen(file)) return outside("this file");
      // A script would run in its system app: the preview instead.
      if (!this.toldProgram) {
        this.toldProgram = true;
        notify({ title: "Showing a read-only preview", body: `${path.split("/").pop()} could run as a program in its system app. Pick an editor with the ▾ in the Files header.`, level: "info" });
      }
      this.show(path, cx); cx.notify();
      return;
    }
    const app = appCommand(platform, choice, file);
    if (app) {
      try {
        const [cmd, args] = app;
        const argv = platform === "macos" ? [cmd, ...args] : nvimArgv(await loginPath(exec, on), 'exec "$1" "$2"', cmd, ...args);
        const r = await exec(argv[0], argv.slice(1));
        if (r.code !== 0) throw new Error(r.stderr || `${label(choice)} didn't start`);
      } catch (err) { notify({ title: `Couldn't open ${label(choice)}`, body: String(err?.message ?? err), level: "error" }); }
      return;
    }
    await this.terminalEditor(choice, path, cx);
  }

  // A terminal editor on the file, in a terminal of its own on the folder's machine, shown in a
  // floating window (nvim-float's title bar above it). It runs in plain sh with the login
  // shell's PATH (the app's own PATH lacks Homebrew); see logic.mjs (nvimArgv). The app
  // learns of a new terminal a moment after hc starts it, so the window waits for it in
  // peekWhenReady() (render() and a timer call it). One click opens one editor: the gate
  // stays shut until the window is up or gave up.
  async terminalEditor(editor, path, cx) {
    const root = this.root, on = this.on;
    if (!this.gate.enter()) return;
    const file = `${root}/${path}`;
    try {
      // Named after the editor ("nvim", then nvim-2, ...: hc names are unique among live terminals),
      // so "Keep" makes a tab with that name. nvim listens on a socket (label editor.socket) so its
      // window can hand its file to a kept nvim and close it, and sets its title to the current file,
      // which the space tree shows.
      const name = freeName(terminals().map((t) => t.name).filter(Boolean), editor);
      const socket = editor === "nvim" ? `/tmp/herdr-nvim-${Date.now().toString(36)}.sock` : "";
      const space = spaces().find((s) => s.active)?.id;
      const args = ["run", "--bg", "--json", "--no-parent", "--rm", "--name", name, "--label", `editor.file=${file}`];
      if (socket) args.push("--label", `editor.socket=${socket}`);
      args.push("--cwd", root);
      if (on) args.push("--on", on);
      args.push("--", ...nvimArgv(await loginPath(exec, on), editorScript(editor), socket, file));
      const r = await hc(args);
      const out = JSON.parse(r.stdout || "{}"), terminal = out.address ?? out.terminal;
      if (r.code !== 0 || !terminal) throw new Error(r.stderr || r.stdout || "hc run failed");
      this.peekFor = { terminal: on && !terminal.includes("/") ? `${on}/${terminal}` : terminal, since: Date.now(),
        socket: socket || null, file, on, space, editor: label(editor) };
      cx.notify();
    } catch (err) {
      this.gate.leave();
      notify({ title: `Couldn't open ${label(editor)}`, body: String(err?.message ?? err), level: "error" });
    }
  }

  // Show the editor's terminal window once the app lists it; give up after 10 s (and end that terminal).
  peekWhenReady() {
    const want = this.peekFor;
    if (!want) return;
    const bare = want.terminal.split("/").pop();
    const seen = terminals().some((t) => (t.address === want.terminal || t.address === bare) && t.state === "live");
    if (seen) {
      this.peekFor = null;
      this.gate.leave();
      // A window: nvim-float's title bar (name, Keep, close) above the terminal.
      // It closes by itself when the editor ends.
      openOverlay({ kind: "window", width: 0.9, height: 0.85, layout: { type: "column", children: [
        { type: "block", size: { px: 34 }, content: { mod: "nvim-float", props: {
          terminal: want.terminal, socket: want.socket, file: want.file, space: want.space, on: want.on, editor: want.editor } } },
        { type: "block", content: { terminal: want.terminal } },
      ] } });
    }
    else if (Date.now() - want.since > 10000) {
      this.peekFor = null;
      this.gate.leave();
      try { run("terminal.kill", { terminal: want.terminal }); } catch {}
      notify({ title: `Couldn't open ${want.editor}`, body: `${want.terminal} didn't show up`, level: "error" });
    }
  }

  // A choice made in an Open with popup (shared "files.request"), for the folder shown here.
  takeRequest(cx) {
    const req = shared("files.request");
    if (!req || req.at === this.lastRequest || Date.now() - req.at > 10000) return;
    if (req.root !== this.root || (req.on ?? null) !== (this.on ?? null)) return;
    this.lastRequest = req.at;
    cx.spawn(async (cx) => this.edit(req.path, cx, req.editor));
  }

  // The header's ▾ and a file's right-click open this mod as a popup under the pointer.
  openMenu(menu, extra) {
    openOverlay({ mod: "portrait-files", kind: "popup", width: MENU_W, at: "pointer", props: { menu, ...extra } });
  }

  // The header's ▾: which editor text files open with (on this folder's machine).
  async pickDefault() {
    const choices = await choicesOn(this.on);
    this.openMenu("editor", { choices: choices.map((e) => e.id), current: pickEditor(shared("files.editor"), choices) });
  }

  // Right-click a file: what this one file can open with.
  async openWith(path) {
    const kind = fileKind(path), local = !this.on;
    const ids = kind === "image" || kind === "pdf" ? [...(local ? ["viewer", "default"] : [])]
      : kind === "other" ? (local ? ["default"] : [])
      : (await choicesOn(this.on)).map((e) => e.id);
    this.openMenu("open", { choices: ids, path, root: this.root, on: this.on ?? null });
  }

  show(path, cx) {
    this.code?.release(); this.code = null; this.file = path; this.fileError = null;
    if (!path || !cx) return;
    const context = this.context, root = this.root, on = this.on;
    cx.spawn(async cx => {
      try {
        const text = await readTextFile(`${root}/${path}`, { on });
        if (this.file !== path || !this.current(context)) return;
        if (text === null) { this.fileError = "This file is no longer available"; return; }
        if (text.includes("\0")) { this.fileError = "Binary file · no text preview"; return; }
        const t = theme(), ext = path.includes(".") ? path.split(".").pop() : "txt";
        this.code = EditorState.new({ language: LANG[ext] ?? ext, readonly: true,
          value: text.length > 400000 ? text.slice(0, 400000) + "\n… (file truncated)" : text,
          font_family: settings().font_family, font_size: 12,
          syntax: { keyword: t.ansi5, string: t.ansi2, comment: t.dim, function: t.ansi4, type: t.ansi3, number: t.ansi1, constant: t.ansi6 } });
      } catch { if (this.file === path && this.current(context)) this.fileError = "Cannot preview this file (binary, too large, or unreadable)"; }
      finally { cx.notify(); }
    });
  }

  rows(prefix, depth, out, t) {
    if (out.length >= TOTAL || depth > 40) return out;
    for (const entry of this.entries.get(prefix) ?? []) {
      if (out.length >= TOTAL) break;
      const path = prefix ? `${prefix}/${entry.name}` : entry.name, open = this.folders.has(path), mark = this.marks[path];
      out.push(h_flex().id(`file-${path}`).h(28).flex_none().pl(8 + depth * 18).pr(8).gap(7).items_center().rounded(7).cursor_pointer().hover(s => s.bg(t.hover))
        .on_click((e, cx) => entry.dir ? this.toggle(path, cx) : e.modifiers?.alt ? this.show(path, cx) : cx.spawn(async (cx) => this.edit(path, cx)))
        .when(!entry.dir, (el) => el.on_mouse_down("right", (_e, cx) => { cx.stop_propagation(); cx.spawn(async () => this.openWith(path)); }))
        .child(entry.dir ? svg(`mods/portrait-files/chevron-${open ? "down" : "right"}.svg`).size(12).flex_none().text_color(t.dim) : div().w(12).flex_none())
        .child(svg(`mods/portrait-files/${entry.dir ? "folder" : "file"}.svg`).size(14).flex_none().text_color(t.muted))
        .child(div().flex_1().min_w(0).truncate().child(entry.name))
        // A folder shows a dot when something inside changed; a file shows its letter.
        .when(Boolean(mark), el => el.child(div().text_size(11).text_color(mark === "A" ? t.ansi2 : mark === "D" || mark === "U" ? t.ansi1 : t.blocked).child(entry.dir ? "\u2022" : mark))));
      if (entry.dir && open) this.rows(path, depth + 1, out, t);
    }
    return out;
  }

  // The popups: { menu: "editor", choices, current } or { menu: "open", choices, path, root, on }.
  menu(p) {
    const t = theme();
    const close = () => closeOverlay(p.overlay);
    const item = (id, i) => {
      const e = EDITORS.find((x) => x.id === id) ?? { id, label: id === "viewer" ? "Viewer" : id };
      const hint = id === "viewer" ? "in a window of its own" : e.term ? "terminal" : e.hint ?? (e.mac ? "app" : "");
      return h_flex().id(`files-menu-${i}`).px(10).py(6).gap(8).items_center().rounded(6).cursor_pointer().hover((el) => el.bg(t.hover))
        .on_click(() => {
          if (p.menu === "editor") setShared("files.editor", id);
          else setShared("files.request", { at: Date.now(), root: p.root, on: p.on, path: p.path, editor: id === "viewer" ? null : id });
          close();
        })
        .child(div().w(12).flex_none().text_color(t.accent).child(p.menu === "editor" && id === p.current ? "\u2713" : ""))
        .child(div().flex_1().min_w(0).text_size(12.5).text_color(t.foreground).child(e.label))
        .when(Boolean(hint), (el) => el.child(div().flex_none().text_size(11).text_color(t.dim).child(hint)));
    };
    const title = p.menu === "editor" ? "Open text files with" : `Open ${String(p.path ?? "").split("/").pop()} with`;
    return v_flex().id("files-menu").w_full().p(4).gap(1).bg(t.raised)
      .child(div().px(10).pt(4).pb(6).text_size(11).text_color(t.dim).truncate().child(title))
      .children((p.choices ?? []).map(item))
      .when(!(p.choices ?? []).length, (el) => el.child(div().px(10).py(6).text_size(12).text_color(t.dim).child("Nothing on that machine can open it")));
  }

  render(cx) {
    const p = props() ?? {};
    if (p.menu) return this.menu(p);
    this.peekWhenReady();
    this.takeRequest(cx);
    // Opening the panel loads it; a folder change while it is open does too.
    const visible = this.visible();
    if (key() !== this.context?.key || (visible && !this.wasVisible)) this.refresh(cx);
    this.wasVisible = visible;
    const t = theme();
    return v_flex().id("files").size_full().min_h(0).rounded(10).overflow_hidden().bg(t.background).border_1().border_color(t.border).text_color(t.foreground).text_size(13)
      .child(h_flex().h(42).flex_none().px(14).gap(8).items_center().border_b(1).border_color(t.border)
        .when(Boolean(this.file), el => el.child(div().id("files-back").w(20).cursor_pointer().text_color(t.muted).on_click((_e, cx) => { this.show(null); cx.notify(); }).child("←")))
        .child(div().font_semibold().child("Files"))
        .child(div().flex_1().min_w(0).truncate().text_right().text_size(12).text_color(t.dim).child(this.file ?? this.root?.split(/[\\/]/).pop() ?? ""))
        // Which editor text opens with on this folder's machine.
        .child(h_flex().id("files-editor").h(22).px(6).gap(3).flex_none().items_center().rounded(5).cursor_pointer().text_size(11.5).text_color(t.muted)
          .hover((el) => el.bg(t.hover).text_color(t.foreground)).tooltip("Open text files with")
          .on_click((_e, cx) => cx.spawn(async () => this.pickDefault()))
          .child(this.choicesNow ? label(pickEditor(shared("files.editor"), this.choicesNow)) : "Open with").child(svg("mods/portrait-files/chevron-down.svg").size(11))))
      .when(!this.file, el => el.child(v_flex().id("files-tree").flex_1().min_h(0).overflow_y_scrollbar().p(6).children(this.rows("", 0, [], t))
        .when(Boolean(this.error) || !this.entries.get("")?.length, el => el.child(div().p(8).text_size(12).text_color(t.dim).child(this.error || (this.loading ? "Loading files…" : this.root ? "No files" : "No folder"))))
        .when(this.limited, el => el.child(div().p(8).text_size(11).text_color(t.dim).child("File list limited to 500 entries per folder and 5,000 total")))))
      .when(Boolean(this.file), el => el.child(this.code ? Editor.new(this.code).flex_1().min_h(0) : div().p(12).text_color(t.dim).child(this.fileError || "Loading file…")));
  }
}
