// The Changes panel, for any checkout: the worktrees of the focused pane's repo, the repo the
// space was started in and the folders you added, as a list. Click one and it opens in place with
// its changed files, the diff and a commit box; click it again, or another, and it folds. Portrait
// copy of the shipped `changes`, which only ever shows the focused pane's repo.
//
// "Add folder" keeps a folder of this computer in shared "changes.folders". Work happens only
// while the panel is on screen (changesVisible): no git and no folder watch while it is closed.
import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex, InputState, Input, Scrollbar, v_virtual_list } from "gpui-base";
import { spaces, panes, focused, window, exec, readTextFile, watchFolder, pickFolder, theme, settings, layout, shared, setShared, home, notify } from "herdr";
import { changesVisible, watchable, tilde, baseName, parseWorktrees, parseStatus, fileOf, addNumstat, countLines, diffRows,
  addFolder, removeFolder, mergeRows, rowKey, rowTitle, rowMeta, sortRows, splitRows, applyOrder, MAX_STATTED, statArgs, newestOf, MAX_FOLDERS, CANT_READ, nestedPaths, addArgs, withoutNested, commitBlock, createPacer } from "./logic.mjs";

function location() {
  const space = spaces().find((s) => s.active), f = focused();
  const pane = f?.pane ? panes().find((p) => p.pane === f.pane) : null;
  const on = f?.pane === null ? (f.terminal?.includes("/") ? f.terminal.split("/")[0] : null) : space?.machine ?? null;
  return { cwd: pane?.cwd || f?.cwd || space?.folder, on, folder: space?.folder ?? null, folderOn: space?.machine ?? null };
}
// Reads write nothing under .git (no index refresh or lock, no fsmonitor cookie):
// the folder watch would see it, and every refresh would start the next one.
const READ = ["--no-optional-locks", "-c", "core.fsmonitor=false", "-c", "diff.autoRefreshIndex=false"];
const STATUS = ["status", "--porcelain=v1", "-z", "--branch", "--no-renames", "--untracked-files=all"];
const FOLDERS = "changes.folders", QUIET_FOLDED = "changes.quietFolded";
// A watch can't be cancelled: it ends at the folder's next change. Folders you left hold their slot
// until then, and this panel moves between folders often. A folder over the cap has the 10 s timer.
const MAX_WATCHERS = 6;
// A pass over the rows is at most this often, unless the list changes or you commit.
const PASS_GAP = 50000;
const NOTE_H = 60, ROW_H = 30, QUIET_H = 26, QUIET_LABEL_H = 32, QUIET_MIN = 104, GROUP_H = 180, HEADER_H = 42, COMMIT_H = 76, LINE_H = 20;

const groupHeight = (count) => Math.min(GROUP_H, count * ROW_H);

export default class Changes extends View {
  init(_props, cx) {
    this.worktrees = []; this.facts = new Map(); this.top = null; this.listContext = null;
    this.openRow = null; this.context = null; this.watching = new Set(); this.ticks = 0; this.pacer = createPacer(); this.passEnded = -Infinity;
    this.files = []; this.rows = []; this.diffWidth = 0; this.message = ""; this.handle = cx.focus_handle();
    this.input = InputState.new({ placeholder: "Commit message" });
    this.input.on("change", (_e, cx) => {
      const hadMessage = Boolean(this.message.trim());
      this.message = this.input.value();
      if (hadMessage !== Boolean(this.message.trim())) cx.notify();
    });
    this.input.on("submit", (_e, cx) => this.commit(cx));
    this.input.on("focus", (_e, cx) => { this.typing = true; cx.notify(); });
    this.input.on("blur", (_e, cx) => { this.typing = false; cx.notify(); });
    cx.timer.every(10000, (cx) => {
      if (!this.visible()) return;
      this.refresh(cx);
      if (++this.ticks % 6 === 0) this.refreshList(cx); // no new pass while one is on, or within PASS_GAP
    });
  }

  visible() { return changesVisible(layout()); }
  listed() { return applyOrder(mergeRows(this.worktrees, shared(FOLDERS), this.openRow, this.start), this.order); }

  // The list: the focused pane's repo and its checkouts, then how many files each row has changed.
  refreshList(cx, force = false) {
    const { cwd, on, folder, folderOn } = location(), context = JSON.stringify(location());
    this.listContext = context;
    cx.spawn(async (cx) => {
      // This can start from render, where notifying isn't allowed: leave that frame first.
      await cx.sleep(0);
      // A machine that doesn't answer keeps the list you had, rather than emptying it.
      let worktrees = [], top = null, unreachable = false;
      try {
        if (cwd) {
          const r = await exec("git", [...READ, "rev-parse", "--show-toplevel"], { cwd, on });
          if (r.code === 0) {
            top = r.stdout.trim();
            const list = await exec("git", [...READ, "worktree", "list", "--porcelain"], { cwd: top, on });
            worktrees = list.code === 0 ? parseWorktrees(list.stdout) : [];
            if (!worktrees.length) worktrees = [{ path: top, branch: null }];
          }
        }
      } catch { worktrees = this.worktrees; top = this.top; unreachable = true; }
      // The folder the space was started in, when it is a repo: always listed, whatever has the focus.
      let start = null;
      try {
        if (folder) {
          const r = await exec("git", [...READ, "rev-parse", "--show-toplevel"], { cwd: folder, on: folderOn });
          if (r.code === 0 && r.stdout.trim()) start = { path: r.stdout.trim(), on: folderOn };
        }
      } catch {}
      if (this.listContext !== context) return;
      this.start = start;
      this.top = top; if (!unreachable) this.topOn = on ?? null;
      this.worktrees = worktrees.map((w) => ({ ...w, on: w.on !== undefined ? w.on : on ?? null }));
      this.listLoaded = true; this.unreachable = unreachable && !worktrees.length;
      cx.notify();
      // Moving the focus inside the same list costs nothing: a pass runs when the list changes,
      // and otherwise only at its own pace, never restarting one that is on.
      const list = this.listed().map(rowKey).sort().join();
      if (!force && list === this.passList && (this.passing || Date.now() - this.passEnded < PASS_GAP)) return;
      this.passList = list;
      await this.count(cx);
    });
  }

  // When a row last changed: the newest of its uncommitted files, or its last commit. Windows on
  // this computer has no `stat`, so there it goes by the commit. A file that is gone has no date.
  async changedAt(row, entries) {
    const log = await exec("git", [...READ, "log", "-1", "--format=%ct"], { cwd: row.path, on: row.on }).catch(() => null);
    const commit = log?.code === 0 ? newestOf(log.stdout) : null;
    const paths = entries.slice(0, MAX_STATTED).map((e) => e.slice(3));
    if (!paths.length || (!row.on && window()?.platform === "windows")) return commit;
    let files = null;
    for (const flavor of ["bsd", "gnu"]) {
      const [cmd, args] = statArgs(flavor, paths);
      const r = await exec(cmd, args, { cwd: row.path, on: row.on }).catch(() => null);
      files = newestOf(r?.stdout);
      if (files !== null) break;
    }
    return files === null ? commit : Math.max(files, commit ?? 0);
  }

  // One row at a time, so a repo with many worktrees never runs them all at once. The results land
  // together when the pass ends, so rows move once; the order holds while a row is open. Closing
  // the panel stops it, and opening starts a new one.
  async count(cx) {
    const run = (this.countRun = {}), next = new Map();
    this.passing = true;
    for (const row of this.listed()) {
      if (!this.visible()) { if (this.countRun === run) { this.passing = false; this.passList = null; } return; }
      let fact;
      try {
        const own = row.checkout ? null : await exec("git", [...READ, "rev-parse", "--show-cdup"], { cwd: row.path, on: row.on });
        if (own && own.code === 0 && own.stdout.trim()) fact = { error: "not a repo" };
        else {
          const r = await exec("git", [...READ, ...STATUS], { cwd: row.path, on: row.on });
          if (r.code === 0) {
            const s = parseStatus(r.stdout), entries = withoutNested(s.entries, nestedPaths(row.path, this.worktrees));
            fact = { files: entries.length, branch: s.branch, at: await this.changedAt(row, entries) };
          }
          else fact = { error: /not a git repository/i.test(r.stderr) ? "not a repo" : CANT_READ };
        }
      } catch { fact = { error: CANT_READ }; }
      if (this.countRun !== run) return;
      next.set(rowKey(row), fact);
    }
    // The open row is watched, so what it knows is newer than what this pass read earlier.
    const live = this.context && this.facts.get(this.context);
    if (live && !live.error) next.set(this.context, { ...live, at: next.get(this.context)?.at ?? live.at });
    // Rows outside this pass keep what was last known, for when the focus comes back to them.
    this.facts = new Map([...this.facts, ...next]); this.passing = false; this.passEnded = Date.now();
    if (!this.openRow) this.sort();
    cx.notify();
  }

  sort() { this.order = sortRows(this.listed(), (row) => this.facts.get(rowKey(row))).map(rowKey); }

  toggle(row, cx) {
    const k = rowKey(row);
    this.closed = false; this.openFile = null; this.files = []; this.setLines([]); this.diffLines = 0; this.note = null; this.error = null; this.limited = false;
    this.message = ""; this.input.set_value(""); this.commitWanted = false; this.nested = null;
    if (this.context === k) { this.openRow = null; this.context = null; this.sort(); }
    else { this.openRow = { path: row.path, on: row.on ?? null, branch: row.branch ?? null }; this.context = k; this.refresh(cx); }
    cx.notify();
  }

  watch(row, cx) {
    const root = row.path;
    if (row.on || this.watching.has(root) || this.watching.size >= MAX_WATCHERS || !watchable(root, home())) return;
    this.watching.add(root);
    cx.spawn(async (cx) => {
      try {
        // Runs until the first change after the row stops being the open one or the panel closes.
        while (this.openRow?.path === root && this.visible()) {
          await watchFolder(root);
          if (this.openRow?.path === root && this.visible()) this.refreshSoon(cx);
        }
      } catch {} finally { this.watching.delete(root); }
    });
  }

  refreshSoon(cx, trailing = false) {
    const verdict = this.pacer.request(trailing);
    if (verdict === "now") this.refresh(cx);
    else if (verdict === "later") cx.spawn(async (cx) => { await cx.sleep(this.pacer.wait()); this.refreshSoon(cx, true); });
  }

  // What the person can see of the open row, to redraw only when it changes.
  shown() { return JSON.stringify([this.context, this.files, this.error, this.limited, this.openFile, this.diffText, this.facts.get(this.context)]); }

  // Clears the open row and says why.
  fail(message, fact, context) {
    this.files = []; this.setLines([]); this.diffLines = 0; this.openFile = null; this.limited = false; this.error = message;
    this.facts.set(context, fact);
  }

  // The open row: its files and the diff shown.
  refresh(cx) {
    if (!this.openRow || this.busy === this.context || !this.visible()) return;
    if (this.loading) { this.pacer.request(); return; } // not lost: it runs again when this load ends
    const row = this.openRow, context = this.context, root = row.path, on = row.on, before = this.shown();
    this.loading = true; this.pacer.start();
    cx.spawn(async (cx) => {
      try {
        const git = (args) => exec("git", [...READ, ...args], { cwd: root, on });
        const own = await git(["rev-parse", "--show-cdup"]);
        if (this.context !== context) return;
        if (own.code === 0 && own.stdout.trim()) { this.fail("This folder is no longer a checkout of its own.", { error: "not a repo" }, context); return; }
        const status = await git(STATUS);
        if (this.context !== context) return;
        if (status.code !== 0) {
          const none = /not a git repository/i.test(status.stderr);
          this.fail(none ? "Not a git repository" : (status.stderr.trim() || "Cannot read this folder"), { error: none ? "not a repo" : CANT_READ }, context);
          return;
        }
        const head = await git(["rev-parse", "--verify", "HEAD"]);
        const stats = {};
        const results = head.code === 0 ? [await git(["diff", "HEAD", "--numstat", "-z", "--no-renames"])] : [await git(["diff", "--cached", "--numstat", "-z", "--no-renames"]), await git(["diff", "--numstat", "-z", "--no-renames"])];
        for (const result of results) {
          if (result.code !== 0) throw new Error(result.stderr);
          addNumstat(stats, result.stdout);
        }
        // Its own worktrees, once per opening: it may be another repo than the focused pane's.
        if (!this.nested) {
          const list = await git(["worktree", "list", "--porcelain"]);
          if (this.context !== context) return;
          this.nested = nestedPaths(root, list.code === 0 ? parseWorktrees(list.stdout) : []);
        }
        const parsed = parseStatus(status.stdout), branch = parsed.branch, entries = withoutNested(parsed.entries, this.nested);
        const files = entries.slice(0, 1000).map((entry) => fileOf(entry, stats));
        if (this.context !== context) return;
        this.hasHead = head.code === 0; this.files = files; this.limited = entries.length > 1000; this.error = null;
        const { error: _gone, ...known } = this.facts.get(context) ?? {};
        this.facts.set(context, { ...known, files: entries.length, branch });
        this.watch(row, cx);
        if (this.openFile && !files.some((f) => f.path === this.openFile)) { this.openFile = null; this.setLines([]); }
        // The first file's diff shows until you pick another.
        if (!this.openFile && !this.closed && files.length) this.openFile = files[0].path;
        if (this.openFile) {
          try { await this.load(this.openFile, context); }
          catch { if (this.context === context) this.setLines(["Cannot preview this diff (too large or unreadable)"]); }
        }
      } catch (e) { if (this.context === context) this.fail(String(e), { error: CANT_READ }, context); }
      finally {
        this.loading = false;
        const more = this.pacer.finish();
        // Another row was opened while this one was loading, or the folder changed again.
        if (this.context && this.context !== context) this.refresh(cx);
        else if (this.commitWanted && this.context === context) { this.commitWanted = false; this.commit(cx); }
        else if (more) this.refreshSoon(cx, true);
        // A frame drawn during the load says so ("Loading changes…"): it must be drawn again.
        if (this.drewLoading || this.context !== context || this.shown() !== before) cx.notify();
      }
    });
  }

  async load(path, context) {
    const file = this.files.find((f) => f.path === path), root = this.openRow?.path, on = this.openRow?.on;
    if (!file || !root) return;
    let lines;
    if (file.fresh || (!this.hasHead && file.status === "A")) {
      const text = await readTextFile(`${root}/${path}`, { on }).catch(() => null);
      if (text === null) lines = ["Cannot preview this file (binary, too large, or unreadable)"];
      else if (text.includes("\0")) lines = ["Binary file · no text diff"];
      else {
        file.add = countLines(text);
        lines = [`@@ -0,0 +1,${file.add} @@`, ...text.slice(0, 400000).replace(/\n$/, "").split("\n").slice(0, 1500).map((l) => `+${l}`)];
      }
    } else {
      const r = await exec("git", [...READ, "diff", ...(this.hasHead ? ["HEAD"] : []), "--no-ext-diff", "--no-textconv", "--no-color", "--", path], { cwd: root, on });
      if (r.code !== 0) throw new Error(r.stderr);
      const all = r.stdout.replace(/\n$/, "").split("\n"), first = all.findIndex((l) => l.startsWith("@@"));
      lines = first < 0 ? [file.binary ? "Binary file changed" : "No text diff available"] : all.slice(first);
    }
    if (this.context === context && this.openFile === path) this.setLines(lines.slice(0, 1500).map((line) => (line.length > 4000 ? line.slice(0, 4000) + "… (line truncated)" : line)));
  }

  setLines(lines) {
    this.rows = diffRows(lines); this.diffText = lines.join("\n");
    if (lines.length) this.diffLines = lines.length;
    this.diffWidth = Math.max(300, ...lines.map((line) => line.length * 7 + 50));
  }

  pick(path, cx) {
    this.openFile = this.openFile === path ? null : path; this.setLines([]); this.note = null;
    this.closed = !this.openFile;
    const context = this.context;
    if (this.openFile) cx.spawn(async (cx) => {
      try { await this.load(path, context); }
      catch (e) { if (this.context === context && this.openFile === path) this.note = `Cannot preview this diff (too large or unreadable): ${e}`; }
      cx.notify();
    });
    cx.notify();
  }

  // Commits in the open row's folder, which need not be where the focused pane is.
  commit(cx) {
    if (!this.message.trim() || !this.openRow || this.busy || this.error) return;
    // A background refresh is on: commit as soon as it ends, on what it found.
    if (this.loading) { this.commitWanted = true; return; }
    const row = this.openRow, { path: root, on } = row, context = this.context, message = this.message.trim();
    const name = rowTitle(row, this.facts.get(context)).name, files = this.files;
    this.busy = context; this.note = null;
    cx.spawn(async (cx) => {
      try {
        const run = (args) => exec("git", args, { cwd: root, on });
        const own = await run(["rev-parse", "--show-cdup"]);
        if (own.code !== 0) throw new Error((own.stderr || own.stdout).trim());
        const block = commitBlock(files, own.stdout);
        if (block) throw new Error(block);
        // Asked at the moment of the commit, of this folder's own repo.
        const list = await run(["worktree", "list", "--porcelain"]);
        let nested = nestedPaths(root, list.code === 0 ? parseWorktrees(list.stdout) : []);
        if (nested.length) {
          const ignored = await run(["check-ignore", "--", ...nested]); // exits 1 when none is
          if (ignored.code > 1) throw new Error((ignored.stderr || ignored.stdout).trim());
          const skip = new Set(ignored.stdout.split("\n").map((l) => l.trim()));
          nested = nested.filter((p) => !skip.has(p));
        }
        for (const args of [addArgs(nested), ["commit", "-m", message]]) {
          const r = await run(args);
          if (r.code !== 0) throw new Error((r.stderr || r.stdout).trim());
        }
        if (this.context === context) { this.message = ""; this.input.set_value(""); }
      } catch (e) {
        const text = String(e?.message ?? e);
        // You moved to another row while it ran: the note would never show there.
        if (this.context === context) this.note = `Commit failed: ${text}`;
        else notify({ title: `Commit failed in ${name}`, body: text, level: "error" });
      }
      finally { this.busy = false; this.refresh(cx); this.refreshList(cx, true); cx.notify(); }
    });
    cx.notify();
  }

  // The system's folder picker; a folder inside a repo adds the repo, and opens it right away.
  add(cx) {
    cx.spawn(async (cx) => {
      const picked = await pickFolder({ prompt: "Add a folder to Changes" });
      if (!picked) return;
      let path = picked;
      try {
        const r = await exec("git", [...READ, "rev-parse", "--show-toplevel"], { cwd: picked });
        if (r.code === 0 && r.stdout.trim()) path = r.stdout.trim();
      } catch {}
      const folders = addFolder(shared(FOLDERS), path);
      if (!folders.includes(path)) { notify({ title: "Changes", body: `At most ${MAX_FOLDERS} folders can be added. Remove one first.`, level: "warning" }); return; }
      setShared(FOLDERS, folders);
      const row = this.listed().find((r) => r.path === path && !r.on);
      if (row && this.context !== rowKey(row)) this.toggle(row, cx);
      this.refreshList(cx);
    });
  }

  remove(row, cx) {
    setShared(FOLDERS, removeFolder(shared(FOLDERS), row.path));
    if (this.context === rowKey(row) && !row.checkout) this.toggle(row, cx);
    if (!this.listed().some((r) => rowKey(r) === rowKey(row))) this.facts.delete(rowKey(row));
    cx.notify();
  }

  diffRow({ kind, number, text }, t) {
    if (kind === "@") return div().w_full().px(12).h(20).flex_none().truncate().bg(t.raised).text_color(t.dim).child(text);
    return h_flex().w_full().h(20).flex_none().gap(10).when(kind === "+", (e) => e.bg(t.ansi2 + "18")).when(kind === "-", (e) => e.bg(t.ansi1 + "18"))
      .child(div().w(30).flex_none().text_right().text_color(t.dim).child(number === undefined ? "" : String(number)))
      .child(div().flex_1().min_w(0).truncate().child(text));
  }

  quietFolded() { return shared(QUIET_FOLDED) === true; }

  // Folds the darker part, remembered across restarts. A row open in it folds with it.
  toggleQuiet(cx) {
    const fold = !this.quietFolded();
    setShared(QUIET_FOLDED, fold);
    const fact = this.facts.get(this.context);
    if (fold && this.openRow && !(fact?.files > 0 || fact?.error === CANT_READ)) this.toggle(this.openRow, cx);
    cx.notify();
  }

  // `quiet`: a row of the darker part, without changes: shorter and less loud.
  row(row, t, quiet = false) {
    const k = rowKey(row), open = this.context === k, fact = this.facts.get(k), { name, sub: branch } = rowTitle(row, fact);
    // The same path can be on two machines: a row elsewhere says where.
    const away = (row.on ?? null) !== (this.topOn ?? null) ? `on ${row.on ?? "this computer"}` : "", sub = [branch, away].filter(Boolean).join(" · ");
    const here = this.top === row.path && this.topOn === (row.on ?? null);
    const add = open ? this.files.reduce((n, f) => n + f.add, 0) : 0, del = open ? this.files.reduce((n, f) => n + f.del, 0) : 0;
    return h_flex().id(`row-${k}`).h(quiet ? QUIET_H : ROW_H).flex_none().px(8).gap(6).items_center().cursor_pointer().when(open, (e) => e.bg(t.selected)).hover((s) => s.bg(t.hover)).on_click((_e, cx) => this.toggle(row, cx))
      .child(svg(`mods/portrait-changes/chevron-${open ? "down" : "right"}.svg`).size(12).flex_none().text_color(t.dim))
      .child(h_flex().flex_1().min_w(0).gap(6).items_center()
        .child(div().min_w(0).truncate().when(open, (e) => e.font_semibold()).when(quiet && !open, (e) => e.text_size(12).text_color(t.muted)).child(name))
        .when(here, (e) => e.child(div().size(6).flex_none().rounded(3).bg(t.accent)))
        .when(Boolean(sub), (e) => e.child(div().min_w(0).truncate().text_size(11).text_color(t.muted).child(sub))))
      .when(open && add > 0, (e) => e.child(div().flex_none().text_size(11).text_color(t.ansi2).child(`+${add}`)))
      .when(open && del > 0, (e) => e.child(div().flex_none().text_size(11).text_color(t.ansi1).child(`−${del}`)))
      .when(!open || (!add && !del), (e) => e.child(div().flex_none().text_size(11).text_color(t.muted).child(rowMeta(fact))))
      .when(row.added, (e) => e.child(div().id(`remove-${k}`).flex_none().w(16).h(16).flex().items_center().justify_center().rounded(4).text_size(12).text_color(t.dim).hover((s) => s.bg(t.raised).text_color(t.foreground))
        .on_click((_e, cx) => { cx.stop_propagation(); this.remove(row, cx); }).child("×")));
  }

  // The rows above or below the open one: they stay short so the diff keeps the room.
  group(id, rows, t) {
    return v_flex().id(id).flex_none().h(groupHeight(rows.length)).overflow_y_scrollbar().children(rows.map((row) => this.row(row, t)));
  }

  // As tall as the diff, so the commit box sits right under a short one, and never so tall that
  // the rows below lose their room. Before the first layout there is no size: it fills instead.
  diffHeight(above, below, quietRoom) {
    const height = this.size?.height;
    if (!height) return null;
    const list = Math.min(200, Math.max(44, this.files.length * 28 + 12));
    const room = height - HEADER_H - groupHeight(above) - ROW_H - list - COMMIT_H - (this.note ? NOTE_H : 0) - (this.limited ? 24 : 0) - groupHeight(below) - quietRoom - 4;
    return Math.max(LINE_H * 3, Math.min((this.diffLines || 2) * LINE_H + 8, room));
  }

  // The darker part below: the folders with nothing to review. The open one unfolds in place.
  quiet(rows, t) {
    const folded = this.quietFolded(), open = rows.find((row) => rowKey(row) === this.context);
    // Rows not checked yet have earned no "No changes".
    const checking = rows.some((row) => !this.facts.has(rowKey(row)));
    return v_flex().id("changes-quiet").when(folded, (e) => e.flex_none()).when(!folded, (e) => e.flex_1().min_h(this.quietRoom(rows.length))).bg(t.canvas).border_t(1).border_color(t.border)
      .child(h_flex().id("changes-quiet-label").h(QUIET_LABEL_H).flex_none().px(8).gap(6).items_center().cursor_pointer().hover((s) => s.bg(t.hover)).on_click((_e, cx) => this.toggleQuiet(cx))
        .child(svg(`mods/portrait-changes/chevron-${folded ? "right" : "down"}.svg`).size(12).flex_none().text_color(t.dim))
        .child(div().flex_none().font_semibold().child(checking ? "Checking…" : "No changes"))
        .child(div().min_w(0).truncate().text_size(11).text_color(t.muted).child(String(rows.length))))
      // Folded, a row that became quiet while open (you committed, say) still shows.
      .when(folded && Boolean(open), (e) => e.child(this.row(open, t)).child(this.body(open, t, LINE_H * 6)))
      .when(!folded, (e) => e.child(v_flex().id("changes-quiet-rows").flex_1().min_h(0).overflow_y_scrollbar().children(rows.flatMap((row) =>
        rowKey(row) === this.context ? [this.row(row, t), this.body(row, t, LINE_H * 6)] : [this.row(row, t, true)]))));
  }

  // What the darker part keeps while a diff is open.
  quietRoom(count) {
    if (!count) return 0;
    return QUIET_LABEL_H + (this.quietFolded() ? 0 : Math.min(QUIET_MIN, count * QUIET_H));
  }

  body(row, t, diffH) {
    const enabled = Boolean(this.message.trim() && !this.busy && !this.error);
    const { name } = rowTitle(row, this.facts.get(rowKey(row)));
    return v_flex().when(diffH === null && this.files.length > 0, (e) => e.flex_1().min_h(0)).when(diffH !== null || !this.files.length, (e) => e.flex_none()).border_t(1).border_color(t.border)
      .child(v_flex().id("changes-list").flex_none().h(Math.min(200, Math.max(44, this.files.length * 28 + 12))).overflow_y_scrollbar().p(6).border_b(1).border_color(t.border).children(this.files.map((f) => {
        const parts = f.path.split("/"), file = parts.pop();
        return h_flex().id(`change-${f.path}`).h(28).flex_none().px(8).gap(8).items_center().rounded(7).cursor_pointer().when(this.openFile === f.path, (e) => e.bg(t.selected)).hover((s) => s.bg(t.hover)).on_click((_e, cx) => this.pick(f.path, cx))
          .child(div().w(14).text_size(11).text_color(f.status === "A" ? t.ansi2 : f.status === "D" ? t.ansi1 : f.status === "U" ? t.ansi1 : t.blocked).child(f.status))
          .child(h_flex().flex_1().min_w(0).child(div().text_color(t.dim).truncate().child(parts.length ? parts.join("/") + "/" : "")).child(div().max_w(260).min_w(0).truncate().child(file)))
          .when(f.add > 0, (e) => e.child(div().text_size(11).text_color(t.ansi2).child(`+${f.add}`))).when(f.del > 0, (e) => e.child(div().text_size(11).text_color(t.ansi1).child(`−${f.del}`)));
      })).when(!this.files.length, (e) => e.child(div().p(8).text_color(t.dim).child(this.error || (this.loading ? "Loading changes…" : "No uncommitted changes")))))
      .when(this.limited, (el) => el.child(div().px(12).py(4).text_size(11).text_color(t.dim).child("Showing the first 1,000 changed files")))
      .when(this.files.length > 0, (e) => e.child(div().when(diffH === null, (e) => e.flex_1().min_h(0)).when(diffH !== null, (e) => e.h(diffH).flex_none()).relative().font_family(settings().font_family ?? "JetBrains Mono").text_size(11)
        .child(div().id("changes-diff-x").size_full().overflow_x_scrollbar()
          .child(div().w_full().min_w(this.diffWidth).h_full().child(v_virtual_list("changes-diff", this.rows.length, 20, (i) => String(i),
            (range) => this.rows.slice(range.start, range.end).map((row) => this.diffRow(row, t))).size_full())))
        .child(Scrollbar.vertical("changes-diff").viewport_from_layout().absolute().inset_0())
        .when(!this.openFile && this.files.length > 0, (e) => e.child(div().absolute().top(6).px(12).text_color(t.dim).child("Select a file to view its changes")))))
      .when(Boolean(this.note), (e) => e.child(div().id("changes-note").flex_none().max_h(NOTE_H).overflow_y_scrollbar().px(10).pb(8).text_size(11).text_color(t.ansi1).child(this.note)))
      // Nothing changed, nothing to commit: the row says so and takes no more room.
      .when(this.files.length > 0, (e) => e.child(v_flex().flex_none().p(10).gap(6).border_t(1).border_color(t.border)
        .child(div().text_size(11).text_color(t.muted).truncate().child(`Commits in ${name} · ${tilde(row.path, home())}${row.on ? ` on ${row.on}` : ""}`))
        .child(h_flex().gap(8)
          .child(div().id("commit-message").flex_1().min_w(0).h(32).px(10).flex().items_center().rounded(8).border_1().border_color(this.typing ? t.accent : t.border).cursor_text().on_mouse_down("left", (_e, cx) => cx.stop_propagation()).child(Input.new(this.input).h_full().text_size(12).text_color(t.foreground)))
          .child(div().id("commit").h(32).px(14).flex().items_center().rounded(8).bg(enabled ? t.solid : t.raised).text_color(enabled ? t.solid_foreground : t.dim).text_size(12).when(enabled, (e) => e.cursor_pointer()).on_click((_e, cx) => this.commit(cx)).child(this.busy === this.context ? "Committing…" : "Commit")))));
  }

  render(cx) {
    const visible = this.visible(), { cwd } = location();
    if (visible && (!this.wasVisible || JSON.stringify(location()) !== this.listContext)) { this.refreshList(cx); this.refresh(cx); }
    this.wasVisible = visible; this.drewLoading = this.loading;
    if (!visible) return div().id("changes").size_full();
    const t = theme(), rows = this.listed(), { changed, quiet } = splitRows(rows, (row) => this.facts.get(rowKey(row)));
    const at = changed.findIndex((r) => rowKey(r) === this.context);
    // Nothing open in the top part: it takes what its rows need, up to most of the panel.
    const folded = this.quietFolded(), height = this.size?.height ?? 600;
    const topH = Math.min(changed.length * ROW_H, this.context ? GROUP_H : folded ? Math.max(ROW_H, height - HEADER_H - QUIET_LABEL_H - 2) : Math.floor(height * 0.6));
    const repo = this.worktrees[0] ? baseName(this.worktrees[0].path) : "";
    return v_flex().id("changes").on_size_change((size, cx) => { this.size = size; cx.notify(); }).size_full().min_h(0).rounded(10).overflow_hidden().bg(t.background).border_1().border_color(t.border).text_color(t.foreground).text_size(13).track_focus(this.handle)
      .on_key_down((e, cx) => {
        if (e.key === "escape" && this.typing) { this.typing = false; this.handle.focus(); cx.stop_propagation(); cx.notify(); }
      })
      .child(h_flex().h(42).flex_none().px(14).gap(8).items_center().border_b(1).border_color(t.border)
        .child(div().flex_none().font_semibold().child("Changes"))
        .child(div().flex_1().min_w(0).truncate().text_size(11).text_color(t.muted).child(repo))
        .child(div().id("add-folder").flex_none().h(24).px(8).flex().items_center().rounded(6).text_size(11).text_color(t.muted).cursor_pointer().hover((s) => s.bg(t.hover).text_color(t.foreground)).on_click((_e, cx) => this.add(cx)).child("Add folder")))
      .when(!rows.length, (e) => e.child(div().p(14).text_color(t.dim).child(!this.listLoaded ? "Loading…" : this.unreachable ? "Can't reach this machine." : cwd ? "Not a git repository. Add a folder to see its changes." : "No folder")))
      .when(at < 0 && changed.length > 0, (e) => e.child(v_flex().id("changes-rows").flex_none().h(topH).overflow_y_scrollbar().children(changed.map((row) => this.row(row, t)))))
      .when(at >= 0, (e) => e
        .when(at > 0, (el) => el.child(this.group("changes-above", changed.slice(0, at), t)))
        .child(this.row(changed[at], t))
        .child(this.body(changed[at], t, this.diffHeight(at, changed.length - at - 1, this.quietRoom(quiet.length))))
        .when(at < changed.length - 1, (el) => el.child(v_flex().flex_none().border_t(1).border_color(t.border).child(this.group("changes-below", changed.slice(at + 1), t)))))
      .when(quiet.length > 0, (e) => e.child(this.quiet(quiet, t)));
  }
}
