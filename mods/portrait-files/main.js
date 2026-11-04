// A lazy file browser for the focused pane's folder, with bounded read-only previews.
// Portrait copy: clicking a file opens it in nvim, in a floating window
// (mods/nvim-float: Keep ▾ → new tab or add to a kept nvim; ✕ or :q closes it);
// alt-click keeps the read-only preview in the panel. On Windows (no nvim launch) every
// click shows the read-only preview.
//
// Work happens only while the panel is on screen (filesVisible): no timer refresh, git
// status or folder watch while it is closed.
import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex, Editor, EditorState } from "gpui-base";
import { spaces, panes, focused, exec, readTextFile, watchFolder, theme, settings, window, hc, run, notify, terminals, openOverlay, layout, home } from "herdr";
import { filesVisible, watchable, createGate, freeName, markOf, parseStatus, bubble, arrange, loginPath, nvimArgv, nvimFound, platformMode } from "./logic.mjs";

function location() {
  const space = spaces().find(s => s.active), f = focused();
  const pane = f?.pane ? panes().find(p => p.pane === f.pane) : null;
  const on = f?.pane === null ? (f.terminal?.includes("/") ? f.terminal.split("/")[0] : null) : space?.machine ?? null;
  return { cwd: pane?.cwd || f?.cwd || space?.folder, on, space: space?.id };
}
const key = () => JSON.stringify(location());
const LANG = { ts: "js", tsx: "js", mts: "js", cts: "js", jsx: "js", mjs: "js", toml: "yaml", jsonc: "json", svelte: "html", vue: "html" };
const PER_FOLDER = 500, TOTAL = 5000;

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
    this.wasVisible = false;
    // Slow safety net; it does nothing while the panel is closed.
    cx.timer.every(10000, cx => { this.peekWhenReady(); if (this.visible()) this.refresh(cx); });
  }

  visible() {
    return filesVisible(layout());
  }

  watch(root, cx) {
    if (this.on || this.watching.has(root) || !watchable(root, home())) return;
    this.watching.add(root);
    cx.spawn(async cx => {
      try {
        // Ends when the folder is no longer the shown one or the panel is closed; the next refresh starts it again.
        while (this.root === root && !this.on && this.visible()) {
          await watchFolder(root);
          if (this.root === root && this.visible()) this.refresh(cx);
        }
      } catch {}
      this.watching.delete(root);
    });
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
    if (!cwd || this.loading || !this.visible()) return;
    const context = this.context;
    this.loading = true;
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
      finally { if (this.context === context) this.loading = false; cx.notify(); }
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

  // nvim on the file, in a terminal of its own on the folder's machine, shown in a
  // floating window (nvim-float's title bar above it). It runs in plain sh with the login
  // shell's PATH (the app's own PATH lacks Homebrew); see logic.mjs (nvimArgv). The app
  // learns of a new terminal a moment after hc starts it, so the window waits for it in
  // peekWhenReady() (render() and a timer call it). One click opens one editor: the gate
  // stays shut until the window is up or gave up. Windows has no nvim launch: it previews.
  async edit(path, cx) {
    const root = this.root, on = this.on;
    if (!root || !this.gate.enter()) return;
    const file = `${root}/${path}`;
    try {
      if (platformMode(window()?.platform, on) === "preview") {
        this.gate.leave();
        if (!this.toldPreview) {
          this.toldPreview = true;
          notify({ title: "Showing a read-only preview", body: "Editing in nvim needs macOS or Linux (or a remote machine).", level: "info" });
        }
        this.show(path, cx); cx.notify();
        return;
      }
      if (!(await nvimFound(exec, on))) {
        this.gate.leave();
        notify({ title: "nvim not found on PATH", body: "Showing a read-only preview instead.", level: "warning" });
        this.show(path, cx); cx.notify();
        return;
      }
      // Every file gets a new nvim, in a floating window (mods/nvim-float). Named "nvim" (then nvim-2, ...:
      // hc names are unique among live terminals), so "Keep" makes a tab called nvim. It listens on
      // a socket (label editor.socket) so its window can hand its file to a kept nvim and close it,
      // and sets its title to the current file, which the space tree shows.
      const name = freeName(terminals().map((t) => t.name).filter(Boolean));
      const socket = `/tmp/herdr-nvim-${Date.now().toString(36)}.sock`;
      const space = spaces().find((s) => s.active)?.id;
      const args = ["run", "--bg", "--json", "--no-parent", "--rm", "--name", name,
        "--label", `editor.file=${file}`, "--label", `editor.socket=${socket}`,
        "--label", `editor.space=${space ?? ""}`, "--cwd", root];
      if (on) args.push("--on", on);
      args.push("--", ...nvimArgv(await loginPath(exec, on), 'exec nvim --listen "$1" -c "set title titlestring=%t" -- "$2"', socket, file));
      const r = await hc(args);
      const out = JSON.parse(r.stdout || "{}"), terminal = out.address ?? out.terminal;
      if (r.code !== 0 || !terminal) throw new Error(r.stderr || r.stdout || "hc run failed");
      this.peekFor = { terminal: on && !terminal.includes("/") ? `${on}/${terminal}` : terminal, since: Date.now(),
        socket, file, on, space };
      cx.notify();
    } catch (err) {
      this.gate.leave();
      notify({ title: "Couldn't open nvim", body: String(err?.message ?? err), level: "error" });
    }
  }

  // Show the nvim terminal's window once the app lists it; give up after 10 s (and end that terminal).
  peekWhenReady() {
    const want = this.peekFor;
    if (!want) return;
    const bare = want.terminal.split("/").pop();
    const seen = terminals().some((t) => (t.address === want.terminal || t.address === bare) && t.state === "live");
    if (seen) {
      this.peekFor = null;
      this.gate.leave();
      // A window: nvim-float's title bar (name, Keep, close) above the terminal.
      // It closes by itself when nvim ends.
      openOverlay({ kind: "window", width: 0.9, height: 0.85, layout: { type: "column", children: [
        { type: "block", size: { px: 34 }, content: { mod: "nvim-float", props: {
          terminal: want.terminal, socket: want.socket, file: want.file, space: want.space, on: want.on } } },
        { type: "block", content: { terminal: want.terminal } },
      ] } });
    }
    else if (Date.now() - want.since > 10000) {
      this.peekFor = null;
      this.gate.leave();
      try { run("terminal.kill", { terminal: want.terminal }); } catch {}
      notify({ title: "Couldn't open nvim", body: `${want.terminal} didn't show up`, level: "error" });
    }
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
        .child(entry.dir ? svg(`mods/portrait-files/chevron-${open ? "down" : "right"}.svg`).size(12).flex_none().text_color(t.dim) : div().w(12).flex_none())
        .child(svg(`mods/portrait-files/${entry.dir ? "folder" : "file"}.svg`).size(14).flex_none().text_color(t.muted))
        .child(div().flex_1().min_w(0).truncate().child(entry.name))
        // A folder shows a dot when something inside changed; a file shows its letter.
        .when(Boolean(mark), el => el.child(div().text_size(11).text_color(mark === "A" ? t.ansi2 : mark === "D" || mark === "U" ? t.ansi1 : t.blocked).child(entry.dir ? "\u2022" : mark))));
      if (entry.dir && open) this.rows(path, depth + 1, out, t);
    }
    return out;
  }

  render(cx) {
    this.peekWhenReady();
    // Opening the panel loads it; a folder change while it is open does too.
    const visible = this.visible();
    if (key() !== this.context?.key || (visible && !this.wasVisible)) this.refresh(cx);
    this.wasVisible = visible;
    const t = theme();
    return v_flex().id("files").size_full().min_h(0).rounded(10).overflow_hidden().bg(t.background).border_1().border_color(t.border).text_color(t.foreground).text_size(13)
      .child(h_flex().h(42).flex_none().px(14).gap(8).items_center().border_b(1).border_color(t.border)
        .when(Boolean(this.file), el => el.child(div().id("files-back").w(20).cursor_pointer().text_color(t.muted).on_click((_e, cx) => { this.show(null); cx.notify(); }).child("←")))
        .child(div().font_semibold().child("Files"))
        .child(div().flex_1().min_w(0).truncate().text_right().text_size(12).text_color(t.dim).child(this.file ?? this.root?.split(/[\\/]/).pop() ?? "")))
      .when(!this.file, el => el.child(v_flex().id("files-tree").flex_1().min_h(0).overflow_y_scrollbar().p(6).children(this.rows("", 0, [], t))
        .when(Boolean(this.error) || !this.entries.get("")?.length, el => el.child(div().p(8).text_size(12).text_color(t.dim).child(this.error || (this.loading ? "Loading files…" : this.root ? "No files" : "No folder"))))
        .when(this.limited, el => el.child(div().p(8).text_size(11).text_color(t.dim).child("File list limited to 500 entries per folder and 5,000 total")))))
      .when(Boolean(this.file), el => el.child(this.code ? Editor.new(this.code).flex_1().min_h(0) : div().p(12).text_color(t.dim).child(this.fileError || "Loading file…")));
  }
}
