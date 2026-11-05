// Smoke test: load every mod's main.js with stand-ins for gpui-kit and herdr and run init() and
// render(). It can't judge the looks; it catches typos, undefined names and wrong shapes that
// `herdr-app check` (which renders the initial description only) does not reach, and it checks
// which elements and host calls each situation produces.
import { h, LIN } from "./fake-home.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, copyFileSync, rmSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const mods = join(dirname(fileURLToPath(import.meta.url)), "..", "mods");
const work = mkdtempSync(join(tmpdir(), "portrait-smoke-"));
process.on("exit", () => { try { rmSync(work, { recursive: true, force: true }); } catch {} });

// ---- the host stand-ins ---------------------------------------------------------------------

const log = { ids: [], calls: [], texts: [] };
function element() {
  const self = new Proxy(function () {}, {
    get(_t, key) {
      if (key === "then") return undefined;
      if (key === Symbol.toPrimitive) return () => "[element]";
      if (key === "when") return (cond, fn) => { if (cond) fn(self); return self; };
      if (key === "hover") return (fn) => { fn(self); return self; };
      if (key === "id") return (id) => { log.ids.push(String(id)); return self; };
      if (key === "child") return (c) => { if (typeof c === "string") log.texts.push(c); return self; };
      return () => self;
    },
    apply() { return self; },
  });
  return self;
}
const state = {};
const host = {
  spaces: () => state.spaces,
  machines: () => state.machines ?? [{ name: null, layout: "ready" }],
  agents: () => state.agents,
  panes: () => state.panes,
  terminals: () => state.terminals ?? [],
  layout: () => state.layout,
  layouts: () => ["portrait"],
  theme: () => new Proxy({}, { get: () => state.color ?? "#808080" }),
  settings: () => ({ zoom: state.zoom ?? 1, ...(state.dark === undefined ? {} : { dark: state.dark }) }),
  window: () => ({ platform: state.platform ?? "macos", titlebar: "none", buttons: true, maximized: false, fullscreen: false, active: true }),
  shared: (k) => state.shared?.[k],
  setShared: (k, v) => { (state.shared ??= {})[k] = v; log.calls.push(["setShared", k, v]); },
  home: () => h("@LIN"),
  appHome: () => join(work, "app-home"),
  run: (...a) => log.calls.push(["run", ...a]),
  exec: async (...a) => { log.calls.push(["exec", ...a]); return { code: 0, stdout: "", stderr: "" }; },
  hc: async (...a) => { log.calls.push(["hc", ...a]); return { code: 0, stdout: "{}", stderr: "" }; },
  notify: (...a) => log.calls.push(["notify", ...a]),
  openOverlay: (...a) => { log.calls.push(["openOverlay", ...a]); return "ov1"; },
  closeOverlay: (...a) => log.calls.push(["closeOverlay", ...a]),
  setAgentOrder: () => {},
  keys: () => state.keys ?? [],
  props: () => state.props,
  focused: () => state.focused ?? { space: "s1", tab: "tab1", pane: "p2", terminal: "t2", cwd: h("@LIN/proj") },
  nextCommand: () => new Promise(() => {}),
  updates: () => ({ app: { ready: false } }),
  watchFolder: () => new Promise(() => {}),
  readTextFile: async () => "text",
  pickFolder: async () => state.picked ?? null,
};
globalThis.__host = host;
globalThis.__element = element;
globalThis.localStorage = { _d: {}, getItem(k) { return k in this._d ? this._d[k] : null; }, setItem(k, v) { this._d[k] = String(v); } };

let mounts = 0;
function build(mod) {
  // A folder per mount: each gets its own copy of logic.mjs, so module-level caches don't leak between tests.
  const dir = join(work, `${mod}-${++mounts}`);
  const { mkdirSync } = require_fs();
  mkdirSync(dir, { recursive: true });
  for (const f of readdirSync(join(mods, mod))) if (f.endsWith(".mjs")) copyFileSync(join(mods, mod, f), join(dir, f));
  let src = readFileSync(join(mods, mod, "main.js"), "utf8");
  src = src.replace(/import\s*\{([^}]*)\}\s*from\s*"(gpui-kit|gpui-base|herdr)";?/g, (_m, names, from) => {
    const list = names.split(",").map((n) => n.trim()).filter(Boolean);
    return list.map((n) => {
      if (n === "View") return "const View = class { constructor() { this.handle = { focus() {} }; } };";
      if (n === "Scrollbar") return "const Scrollbar = { vertical: () => globalThis.__element() };";
      if (n === "InputState" || n === "Input" || n === "Editor" || n === "EditorState") return `const ${n} = { new: () => globalThis.__element(), release() {} };`;
      if (from === "herdr") return `const ${n} = (...a) => globalThis.__host.${n}(...a);`;
      return `const ${n} = () => globalThis.__element();`;
    }).join("\n");
  });
  src = src.replace(/import\s+\*\s+as\s+fs\s+from\s+"fs\/promises";?/, 'import * as fs from "node:fs/promises";');
  writeFileSync(join(dir, "main.js"), src);
  return pathToFileURL(join(dir, "main.js")).href;
}
import { createRequire } from "node:module";
const require_fs = () => createRequire(import.meta.url)("node:fs");

const cx = () => {
  const c = { notify() {}, stop_propagation() {}, focus_handle: () => ({ focus() {} }), spawn: (fn) => Promise.resolve(fn(c)), sleep: (ms) => new Promise((r) => setTimeout(r, ms)), timer: { every(ms, fn) { (c.timers ??= []).push([ms, fn]); }, after() {} } };
  return c;
};
async function mount(mod, props = {}) {
  const { default: Mod } = await import(build(mod));
  const m = new Mod();
  state.props = props;
  const c = cx();
  m.init?.(props, c);
  return { m, c };
}
const reset = () => { log.ids.length = 0; log.calls.length = 0; log.texts.length = 0; };

function world() {
  state.shared = { layout: "portrait" };
  state.spaces = [
    { id: "s1", name: "Alpha", active: true, folder: h("@LIN/proj"), tabs: [{ id: "tab1", index: 1, name: "tb1", named: false, active: true, status: "blocked", zoomed: false }, { id: "tab2", index: 2, name: "docs", named: true, active: false, status: "working" }] },
    { id: "s2", name: "Beta \u0001 & <b>", active: false, machine: "devbox", tabs: [{ id: "tab3", index: 1, name: "x", named: true, active: false, status: "idle" }] },
    { id: "s3", name: "Gamma", active: false, tabs: [] },
  ];
  state.agents = [
    { address: "t1", pane: "p1", space: "s1", tab: "tab1", status: "blocked", title: "Fix it", program: { name: "Claude", agent: true }, focused: true, seq: 2 },
    { address: "t5", pane: "p1b", space: "s1", tab: "tab1", status: "working", title: "Fix it", program: { name: "Claude", agent: true }, seq: 1 },
    { address: "t6", pane: null, space: "s2", tab: "tab3", status: "done", program: { name: "Codex" }, seq: 3 }, // no pane: must not collide
    { address: "t7", pane: "", space: "s2", tab: "tab3", status: "idle", program: { name: "Codex" }, seq: 4 },
  ];
  state.panes = [
    { pane: "p1", tab: "tab1", terminal: "t1", program: { name: "Claude" }, status: "blocked" },
    { pane: "p1b", tab: "tab1", terminal: "t5", program: { name: "Claude" }, status: "working" },
    { pane: "p2", tab: "tab1", terminal: "t2", cwd: h("@LIN/proj"), title: "zsh", program: { name: "zsh", shell: true }, focused: false },
    { pane: "p3", tab: "tab2", terminal: null, mod: "some-addon", title: "note" },
    { pane: "p4", tab: "tab2", terminal: "t9", cwd: h("@LIN"), program: { name: "nvim" } },
  ];
  state.terminals = [{ address: "t9", name: "nvim", state: "live", labels: { "editor.file": h("@LIN/proj/a.js") } }];
  state.layout = { id: "root", children: [{ id: "panel", hidden: true, children: [{ id: "panel-body", active: "files", children: [{ id: "files" }, { id: "changes" }] }] }] };
}

// ---- tests ----------------------------------------------------------------------------------

test("portrait-tree renders: open and folded columns, windowed row, pane-less agents, a mod's pane", async () => {
  world();
  const { m, c } = await mount("portrait-tree");
  for (const width of [0, 1500, 900, 300]) {
    m.width = width;
    assert.doesNotThrow(() => m.render(c), `width ${width}`);
  }
  assert.ok(log.ids.includes("space-new"));
  assert.ok(log.ids.includes("tab-tab1"));
  assert.ok(log.ids.includes("pn-p3"), "the mod's pane has a row");
  assert.ok(log.ids.includes("ag-p1") && log.ids.includes("ag-p1b"));
  // Agents without a pane (sub-agents) get a row of their own under their tab.
  assert.ok(log.ids.includes("ag-t6") && log.ids.includes("ag-t7"), "pane-less agents have rows");
  // Folded space: strip with a spine; the write goes through the store.
  m.folded.add("s3");
  m.width = 1500;
  m.render(c);
  assert.ok(log.ids.includes("strip-s3"));
  // Zoom 3 on a tiny bar with no spaces used to throw.
  state.spaces = []; state.zoom = 3; m.width = 90;
  assert.doesNotThrow(() => m.render(c));
  state.zoom = 1;
});

test("portrait-tree: a mod's pane is named after its mod, without the terminal glyph", async () => {
  world();
  state.panes = [{ pane: "p3", tab: "tab1", terminal: null, mod: "some-addon", title: "note" }];
  const { m, c } = await mount("portrait-tree");
  m.width = 1500; reset(); m.render(c);
  assert.ok(log.ids.includes("pn-p3"));
  assert.ok(log.texts.includes("some-addon"), "the row names the mod");
  assert.ok(!log.texts.includes(">_"), "no terminal glyph for a mod's pane");
  // A terminal without a program icon keeps its glyph.
  state.panes.push({ pane: "p2", tab: "tab1", terminal: "t2", cwd: h("@LIN"), program: { name: "zsh" } });
  reset(); m.render(c);
  assert.ok(log.texts.includes(">_"));
});

test("portrait-tree: terminals() is only read when a plain terminal row needs it", async () => {
  world();
  state.panes = [{ pane: "p1", tab: "tab1", terminal: "t1", program: { name: "Claude" } }]; // agent pane only
  let reads = 0;
  const real = host.terminals; host.terminals = () => { reads++; return real(); };
  const { m, c } = await mount("portrait-tree");
  m.width = 1500; m.render(c);
  assert.equal(reads, 0);
  state.panes.push({ pane: "p2", tab: "tab1", terminal: "t2", cwd: h("@LIN"), program: { name: "zsh" } });
  m.render(c);
  assert.equal(reads, 1);
  host.terminals = real;
});

test("portrait-tree: the 30 s timer only redraws when there are agents", async () => {
  world();
  const { m, c } = await mount("portrait-tree");
  m.width = 1500; m.render(c);
  let n = 0; const [, tick] = c.timers[0];
  tick({ notify: () => n++ });
  assert.equal(n, 1);
  state.agents = []; m.render(c);
  tick({ notify: () => n++ });
  assert.equal(n, 1);
});

test("portrait-tree survives corrupt persisted state", async () => {
  world();
  localStorage._d = { folded: "{oops", peeked: '{"a":1}', changed: "[]" };
  const { m, c } = await mount("portrait-tree");
  assert.equal(m.folded.size, 0);
  assert.doesNotThrow(() => { m.width = 1500; m.render(c); });
  localStorage._d = {};
});

test("bar-strip: Files and Changes buttons, and no other panel button", async () => {
  world();
  const { m } = await mount("bar-strip");
  reset(); m.render();
  assert.deepEqual(log.ids.filter((id) => id.startsWith("panel-")), ["panel-files", "panel-changes"]);
  // The shell's panel list decides: one that offers only Files gets only the Files button.
  state.shared["workspace.panels"] = ["files"];
  reset(); m.render();
  assert.deepEqual(log.ids.filter((id) => id.startsWith("panel-")), ["panel-files"]);
});

test("bar-strip: the tooltip names the real key; one picker at a time; nothing is published", async () => {
  world();
  state.keys = [{ section: "layout:portrait", keys: "ctrl-shift-j", action: "bar-strip.attention" }];
  const { m } = await mount("bar-strip");
  reset(); m.render();
  assert.ok(!log.calls.some((x) => x[0] === "setShared"));
  m.picker(true); m.picker(true);
  const opens = log.calls.filter((x) => x[0] === "openOverlay"), closes = log.calls.filter((x) => x[0] === "closeOverlay");
  assert.equal(opens.length, 2);
  assert.equal(closes.length, 1, "the second picker closes the first");
  assert.equal(opens[0][1].mod, "attention-picker");
  m.attention();
  assert.ok(log.calls.some((x) => x[0] === "run" && x[1] === "agent.focus"));
});

test("portrait-tabs: renders, remembers panels, and never restores a panel the shell does not offer", async () => {
  world();
  const { m } = await mount("portrait-tabs");
  assert.doesNotThrow(() => m.render());
  assert.deepEqual(Object.keys(m.panels), ["s1"]);
  // A stored choice that is not one of the enabled panels (say, one a removed add-on had) is not restored.
  m.panels = { s1: "gone" }; m.space = undefined; reset();
  state.layout.children[0].hidden = true;
  m.render();
  assert.ok(!log.calls.some((x) => x[0] === "run" && x[1] === "layout.select" && x[2].child === "gone"));
  // A stored Files choice is.
  m.panels = { s1: "files" }; m.space = undefined; reset();
  m.render();
  assert.ok(log.calls.some((x) => x[0] === "run" && x[1] === "layout.select" && x[2].child === "files"));
  // Corrupt storage on init.
  localStorage._d = { panels: "[1,2" };
  const again = await mount("portrait-tabs");
  assert.deepEqual(again.m.panels, {});
  localStorage._d = {};
});

test("portrait-pane renders agents, plain terminals and a mod's pane", async () => {
  world();
  for (const pane of ["p1", "p2", "p3", "nope"]) {
    const { m, c } = await mount("portrait-pane", { pane });
    assert.doesNotThrow(() => m.render(c), pane);
  }
  // A mod's pane without a title is named after its mod, not "shell".
  state.panes = [{ pane: "p3", tab: "tab2", terminal: null, mod: "some-addon" }];
  const { m, c } = await mount("portrait-pane", { pane: "p3" });
  reset(); m.render(c);
  assert.ok(log.texts.includes("some-addon"));
  assert.ok(!log.texts.includes("shell"));
});

test("nvim-float renders its bar and its menu", async () => {
  world();
  state.terminals = [{ address: "t9", name: "nvim", state: "live", title: "a.js", labels: { "editor.socket": "/tmp/x.sock", "editor.file": h("@LIN/proj/a.js") } }];
  const base = { terminal: "t8", socket: "/tmp/y.sock", file: h("@LIN/proj/b.js"), space: "s1", overlay: "o1" };
  for (const props of [base, { ...base, menu: true }, { ...base, on: "devbox", file: "/srv/b.js" }, {}]) {
    const { m, c } = await mount("nvim-float", props);
    assert.doesNotThrow(() => m.render(c), JSON.stringify(props));
  }
});

test("portrait-files does no work while the panel is closed, and loads when it opens", async () => {
  world();
  const { m, c } = await mount("portrait-files");
  const [, tick] = c.timers[0];
  reset();
  m.render(c); tick(c); tick(c);
  await new Promise((r) => setImmediate(r));
  assert.equal(log.calls.filter((x) => x[0] === "exec").length, 0, "no sh/git while hidden");
  // Open the panel: the next render loads the folder and runs git.
  state.layout.children[0].hidden = false;
  reset();
  m.render(c);
  await new Promise((r) => setTimeout(r, 20));
  const cmds = log.calls.filter((x) => x[0] === "exec").map((x) => x[1]);
  assert.ok(cmds.includes("sh"), "lists the folder");
  assert.ok(cmds.includes("git"), "asks git");
  const git = log.calls.find((x) => x[0] === "exec" && x[1] === "git" && x[2].includes("status"));
  assert.ok(git[2].includes("--") && git[2].includes("."), "status is limited to the shown folder");
});

test("portrait-files: a click opens one editor in the picked or found editor; Windows has the default app and the preview", async () => {
  world();
  state.layout.children[0].hidden = false;
  const realExec = host.exec, realHc = host.hc;
  // What the machine has installed: nvim and VS Code (as an app, macOS).
  const machine = (stdout) => async (cmd, args, o) => {
    log.calls.push(["exec", cmd, args, o]);
    const script = args?.[1] ?? "";
    if (script.includes("printenv")) return { code: 0, stdout: "/opt/bin:/usr/bin\n", stderr: "" };
    if (script.includes("command -v")) return { code: 0, stdout, stderr: "" };
    return { code: 0, stdout: "", stderr: "" };
  };
  host.hc = async (...a) => { log.calls.push(["hc", ...a]); return { code: 0, stdout: '{"address":"t42"}', stderr: "" }; };

  // Windows, local folder: no hc run; a script opens in the preview (with one notice), a document in the system's app.
  state.platform = "windows";
  let { m, c } = await mount("portrait-files");
  m.render(c);
  await new Promise((r) => setTimeout(r, 10));
  reset();
  await m.edit("a.js", c); await m.edit("b.js", c);
  assert.equal(log.calls.filter((x) => x[0] === "hc").length, 0);
  assert.equal(log.calls.filter((x) => x[0] === "notify").length, 1, "one notice for both");
  assert.equal(m.file, "b.js");
  reset();
  await m.edit("notes.txt", c);
  assert.ok(log.calls.some((x) => x[0] === "exec" && x[1] === "rundll32"), "text goes to the default app");

  // macOS with nvim: two quick clicks start one nvim, through the login shell's PATH.
  state.platform = "macos";
  host.exec = machine("bin:nvim\napp:Visual Studio Code\n");
  ({ m, c } = await mount("portrait-files"));
  m.render(c);
  await new Promise((r) => setTimeout(r, 10));
  reset();
  await Promise.all([m.edit("a.js", c), m.edit("a.js", c)]);
  const runs = log.calls.filter((x) => x[0] === "hc");
  assert.equal(runs.length, 1, "double click: one editor");
  const args = runs[0][1];
  assert.ok(args.includes("--rm") && args.includes("--no-parent"));
  assert.ok(args.some((a) => a.startsWith("editor.socket=")), "nvim gets a socket");
  const dash = args.indexOf("--");
  assert.equal(args[dash + 1], "sh");
  assert.equal(args[dash + 5], "/opt/bin:/usr/bin");
  assert.ok(m.peekFor && m.peekFor.terminal === "t42" && m.peekFor.editor === "nvim");
  // The terminal never shows up: after 10 s it is killed, the gate re-opens.
  m.peekFor.since -= 11000;
  reset();
  m.peekWhenReady();
  assert.ok(log.calls.some((x) => x[0] === "run" && x[1] === "terminal.kill" && x[2].terminal === "t42"));
  assert.equal(m.gate.busy, false);

  // The picked app: VS Code through open -a; a choice that isn't installed falls back to nvim.
  state.shared["files.editor"] = "code";
  reset();
  await m.edit("a.js", c);
  assert.ok(log.calls.some((x) => x[0] === "exec" && x[1] === "open" && x[2][0] === "-a" && x[2][1] === "Visual Studio Code"));
  state.shared["files.editor"] = "zed";
  reset();
  await m.edit("a.js", c);
  assert.equal(log.calls.filter((x) => x[0] === "hc").length, 1, "zed is not installed: nvim");
  m.peekFor = null; m.gate.leave();

  // Linux: an app runs by its command through the login shell's PATH, the file as an argument (run in a real sh).
  state.platform = "linux";
  host.exec = machine("bin:nvim\nbin:zed\n");
  ({ m, c } = await mount("portrait-files"));
  m.render(c);
  await new Promise((r) => setTimeout(r, 10));
  reset();
  await m.edit("a.js", c, "zed");
  const zed = log.calls.find((x) => x[0] === "exec" && x[1] === "sh" && x[2].includes("zed"));
  assert.ok(zed, "zed through sh");
  if (process.platform !== "win32") {
    const { spawnSync } = await import("node:child_process");
    const echo = [...zed[2]];
    echo[1] = echo[1].replace('exec "$1" "$2"', 'printf "%s|%s" "$1" "$2"');
    const r = spawnSync("sh", echo, { encoding: "utf8" });
    assert.equal(r.stdout, `zed|${h("@LIN/proj/a.js")}`, "the command is $1 and the file $2 after the PATH shift");
  }
  state.platform = "macos";

  // Helix from Open with: its own name, no socket.
  host.exec = machine("bin:nvim\nbin:hx\n");
  ({ m, c } = await mount("portrait-files"));
  m.render(c);
  await new Promise((r) => setTimeout(r, 10));
  reset();
  await m.edit("a.js", c, "hx");
  const hx = log.calls.find((x) => x[0] === "hc")[1];
  assert.equal(hx[hx.indexOf("--name") + 1], "hx");
  assert.ok(!hx.some((a) => String(a).startsWith("editor.socket=")));
  m.peekFor = null; m.gate.leave();

  // Pictures and PDFs open in the viewer (inside the home folder); documents in the system's app; programs never.
  reset();
  await m.edit("logo.png", c);
  await m.edit("docs/report.pdf", c);
  const viewers = log.calls.filter((x) => x[0] === "openOverlay" && x[1].mod === "portrait-viewer");
  assert.deepEqual(viewers.map((x) => x[1].props.file), [h("@LIN/proj/logo.png"), h("@LIN/proj/docs/report.pdf")]);
  reset();
  await m.edit("slides.pptx", c);
  assert.ok(log.calls.some((x) => x[0] === "exec" && x[1] === "open" && x[2][0] === h("@LIN/proj/slides.pptx")));
  reset();
  await m.edit("setup.exe", c);
  assert.equal(log.calls.filter((x) => x[0] === "exec" && x[1] === "open").length, 0, "a program is never started");
  assert.ok(log.calls.some((x) => x[0] === "notify" && x[1].title === "Not opened"));
  reset();
  await m.edit("logo.png", c, "default");
  assert.ok(log.calls.some((x) => x[0] === "exec" && x[1] === "open"), "Open with, Default app");

  // Nothing installed: the default app (a script: the preview).
  host.exec = machine("");
  state.shared["files.editor"] = undefined;
  ({ m, c } = await mount("portrait-files"));
  m.render(c);
  await new Promise((r) => setTimeout(r, 10));
  reset();
  await m.edit("README.md", c);
  assert.equal(log.calls.filter((x) => x[0] === "hc").length, 0);
  assert.ok(log.calls.some((x) => x[0] === "exec" && x[1] === "open" && x[2][0] === h("@LIN/proj/README.md")));
  reset();
  await m.edit("run.sh", c);
  assert.equal(m.file, "run.sh", "a script: the preview");
  host.exec = realExec; host.hc = realHc;
});

test("portrait-files: the Open with popups hand the choice back, and the panel opens it", async () => {
  world();
  state.layout.children[0].hidden = false;
  const popup = await mount("portrait-files", { menu: "open", choices: ["nvim", "preview"], path: "a.js", root: h("@LIN/proj"), on: null, overlay: "o9" });
  reset();
  assert.doesNotThrow(() => popup.m.render(popup.c));
  assert.ok(log.ids.includes("files-menu-0") && log.ids.includes("files-menu-1"));
  const editor = await mount("portrait-files", { menu: "editor", choices: ["nvim", "code", "default", "preview"], current: "nvim", overlay: "o8" });
  reset();
  assert.doesNotThrow(() => editor.m.render(editor.c));
  assert.ok(log.texts.includes("VS Code"));
  // A request from the popup: the panel showing that folder takes it once.
  state.props = {};
  const { m, c } = await mount("portrait-files");
  m.render(c);
  await new Promise((r) => setTimeout(r, 10));
  state.shared["files.request"] = { at: Date.now(), root: h("@LIN/proj"), on: null, path: "a.js", editor: "preview" };
  m.render(c);
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(m.file, "a.js");
  m.show(null);
  m.render(c);
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(m.file, null, "not taken twice");
  state.shared["files.request"] = undefined;
});

test("portrait-viewer renders a picture, a PDF and nothing", async () => {
  world();
  for (const props of [{ file: h("@LIN/proj/logo.png"), overlay: "o1" }, { file: h("@LIN/proj/a.pdf"), overlay: "o1" }, {}]) {
    const { m, c } = await mount("portrait-viewer", props);
    assert.doesNotThrow(() => m.render(c), JSON.stringify(props));
    m.pages = [{ path: "data/portrait-viewer/cache/x.png", w: 3000, h: 2000 }];
    assert.doesNotThrow(() => m.render(c));
    m.close();
  }
});

test("portrait-tree: the drop line follows the pointer, not the press", async () => {
  world();
  state.spaces = state.spaces.map((s) => ({ ...s, machine: null })); // one machine: any header can be a target
  const { m, c } = await mount("portrait-tree");
  m.width = 2000;
  reset(); m.pressed = 0; m.render(c);
  assert.ok(!log.ids.some((id) => id.startsWith("drop-")), "a press alone shows no line");
  reset(); m.pressed = 0; m.over = 2; m.render(c);
  assert.deepEqual(log.ids.filter((id) => id.startsWith("drop-")), ["drop-s3"]);
  // Over the pressed header itself: no line.
  reset(); m.pressed = 0; m.over = 0; m.render(c);
  assert.ok(!log.ids.some((id) => id.startsWith("drop-")));
  // A tab row: the same.
  reset(); m.pressed = null; m.over = null; m.tabPressed = { id: "tab1", space: "s1" }; m.render(c);
  assert.ok(!log.ids.some((id) => id.startsWith("drop-")));
  reset(); m.tabOver = "tab2"; m.render(c);
  assert.deepEqual(log.ids.filter((id) => id.startsWith("drop-")), ["drop-tab2"]);
  // Another space's tab is not a target.
  reset(); m.tabOver = "tab3"; m.render(c);
  assert.ok(!log.ids.some((id) => id.startsWith("drop-")));
});

test("portrait-tree and portrait-tabs keep the state of a remote machine that is offline at start", async () => {
  world();
  state.spaces = state.spaces.filter((s) => s.id !== "s2"); // the remote machine's spaces are not listed
  state.machines = [{ name: null, layout: "ready" }, { name: "devbox", layout: "unavailable" }];
  localStorage._d = { folded: JSON.stringify(["devbox/s2", "gone"]), peeked: JSON.stringify(["devbox/s2"]), panels: JSON.stringify({ "devbox/s2": "files", s1: "changes", old: "files" }) };
  const tree = await mount("portrait-tree");
  tree.m.width = 1500; tree.m.render(tree.c);
  assert.ok(tree.m.folded.has("devbox/s2"), "folded stays");
  assert.ok(!tree.m.folded.has("gone"), "a local id that is gone is pruned");
  assert.ok(JSON.parse(localStorage._d.folded).includes("devbox/s2"), "and so does what was saved");
  const tabs = await mount("portrait-tabs");
  tabs.m.render();
  assert.ok("devbox/s2" in tabs.m.panels, "panel choice stays");
  assert.ok(!("old" in tabs.m.panels));
  // Once the machine is ready and still does not list it, it goes.
  state.machines = [{ name: null, layout: "ready" }, { name: "devbox", layout: "ready" }];
  tree.m.render(tree.c); tabs.m.render();
  assert.ok(!tree.m.folded.has("devbox/s2") && !("devbox/s2" in tabs.m.panels));
  state.machines = undefined;
  localStorage._d = {};
});

test("portrait-files: a refresh asked for during a load is not lost, and not repeated", async () => {
  world();
  state.layout.children[0].hidden = false;
  const { m, c } = await mount("portrait-files");
  // Slow git: the first load stays in flight while two more refreshes are asked for.
  const realExec = host.exec;
  let release; const gate = new Promise((r) => { release = r; });
  host.exec = async (cmd, args, o) => { log.calls.push(["exec", cmd, args, o]); if (cmd === "git" && args.includes("status")) await gate; return { code: 0, stdout: cmd === "git" ? "" : "", stderr: "" }; };
  const { createPacer } = await import("../mods/portrait-files/logic.mjs");
  m.pacer = createPacer({ gap: 30 });
  reset();
  m.render(c);
  m.refresh(c); m.refresh(c);
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(log.calls.filter((x) => x[0] === "exec" && x[1] === "git" && x[2].includes("status")).length, 1, "one load in flight");
  release();
  await new Promise((r) => setTimeout(r, 150));
  assert.equal(log.calls.filter((x) => x[0] === "exec" && x[1] === "git" && x[2].includes("status")).length, 2, "exactly one more after it, not zero and not three");
  host.exec = realExec;
});

test("portrait-changes: lists the checkouts, opens one in place, commits there, keeps added folders", async () => {
  world();
  state.layout = { id: "root", children: [{ id: "panel", hidden: false, children: [{ id: "panel-body", active: "changes", children: [{ id: "files" }, { id: "changes" }] }] }] };
  state.focused = { space: "s1", tab: "tab1", pane: "p2", terminal: "t2", cwd: h("@LIN/proj") };
  const main = h("@LIN/proj"), other = h("@LIN/proj/.wt/fix"), added = h("@LIN/notes");
  const realExec = host.exec;
  host.exec = async (cmd, args, opts) => {
    log.calls.push(["exec", cmd, args, opts]);
    if (args.includes("rev-parse") && args.includes("--show-toplevel")) return { code: 0, stdout: opts.cwd === added ? `${added}\n` : `${main}\n`, stderr: "" };
    if (args.includes("worktree")) return { code: 0, stdout: `worktree ${main}\nbranch refs/heads/main\n\nworktree ${other}\nbranch refs/heads/fix\n`, stderr: "" };
    if (args.includes("status")) return { code: 0, stdout: opts.cwd === other ? "## fix\0 M a.js\0" : "## main\0", stderr: "" };
    if (args.includes("--numstat")) return { code: 0, stdout: "2\t1\ta.js\0", stderr: "" };
    if (args.includes("--verify")) return { code: 0, stdout: "abc\n", stderr: "" };
    if (args.includes("diff")) return { code: 0, stdout: "@@ -1 +1 @@\n-a\n+b\n", stderr: "" };
    return { code: 0, stdout: "", stderr: "" };
  };
  try {
    const settle = () => new Promise((r) => setTimeout(r, 20));
    const { m, c } = await mount("portrait-changes");
    reset(); m.render(c); await settle();
    reset(); m.render(c);
    assert.ok(log.texts.includes("main") && log.texts.includes("fix"), "both checkouts are rows");
    assert.ok(log.texts.includes("No changes") && log.texts.includes("1") && log.texts.includes("1 file"), "changes on top, the rest in the darker part");
    assert.equal(m.openRow, null, "it starts with everything folded");

    const fix = m.listed().find((r) => r.path === other);
    m.toggle(fix, c); await settle();
    assert.deepEqual(m.files.map((f) => f.path), ["a.js"]);
    assert.equal(m.rows.length, 3, "the diff of the first file shows");
    reset(); m.render(c);
    assert.ok(log.texts.some((t) => t.startsWith("Commits in fix")), "the commit box says where it commits");

    m.message = "work"; reset(); m.commit(c); await settle();
    const commits = log.calls.filter((x) => x[0] === "exec" && (x[2][0] === "add" || x[2][0] === "commit"));
    assert.equal(commits.length, 2);
    for (const x of commits) assert.equal(x[3].cwd, other, "the commit runs in the open row, not in the focused pane's folder");

    state.focused = { space: "s1", tab: "tab1", pane: "p2", terminal: "t2", cwd: h("@LIN/elsewhere") };
    state.panes.find((p) => p.pane === "p2").cwd = h("@LIN/elsewhere");
    host.exec = async () => ({ code: 128, stdout: "", stderr: "fatal: not a git repository" });
    m.render(c); await settle();
    assert.ok(m.listed().some((r) => r.path === other), "moving the focus does not close what is open");
    host.exec = realExec;

    m.toggle(m.listed().find((r) => r.path === other), c);
    assert.equal(m.openRow, null, "a second click folds it");

    state.picked = added;
    host.exec = async (_c, _a, o) => (o.cwd === added ? { code: 0, stdout: `${added}\n`, stderr: "" } : { code: 128, stdout: "", stderr: "fatal: not a git repository" });
    m.add(c); await settle();
    assert.deepEqual(state.shared["changes.folders"], [added]);
    assert.equal(m.openRow?.path, added, "an added folder opens");
    m.remove(m.listed().find((r) => r.path === added), c);
    assert.deepEqual(state.shared["changes.folders"], []);
    assert.equal(m.openRow, null);
  } finally { host.exec = realExec; delete state.picked; delete state.focused; }
});

test("portrait-changes: the space's own repo stays listed when the focus is outside any repo", async () => {
  world();
  state.layout = { id: "root", children: [{ id: "panel", hidden: false, children: [{ id: "panel-body", active: "changes", children: [{ id: "changes" }] }] }] };
  const start = h("@LIN/proj"), away = h("@LIN/elsewhere");
  state.panes.find((p) => p.pane === "p2").cwd = away;
  const realExec = host.exec;
  host.exec = async (_c, args, o) => {
    if (o.cwd !== start) return { code: 128, stdout: "", stderr: "fatal: not a git repository" };
    if (args.includes("--show-cdup")) return { code: 0, stdout: "\n", stderr: "" };
    return { code: 0, stdout: args.includes("--show-toplevel") ? `${start}\n` : "## main\0", stderr: "" };
  };
  try {
    const { m, c } = await mount("portrait-changes");
    m.render(c); await new Promise((r) => setTimeout(r, 20));
    assert.deepEqual(m.listed().map((r) => r.path), [start]);
    assert.equal(m.listed()[0].added, false, "no remove button");
    assert.equal(m.facts.get(rowKey0(m.listed()[0])).branch, "main");
  } finally { host.exec = realExec; }
});

const rowKey0 = (row) => JSON.stringify([row.on ?? null, row.path]);

test("portrait-changes: the darker part folds, remembers it, and closes a row open in it", async () => {
  world();
  state.layout = { id: "root", children: [{ id: "panel", hidden: false, children: [{ id: "panel-body", active: "changes", children: [{ id: "changes" }] }] }] };
  const realExec = host.exec, repo = h("@LIN/proj");
  host.exec = async (_c, args) => ({ code: 0, stdout: args.includes("--show-toplevel") ? `${repo}\n` : args.includes("status") ? "## main\0" : "", stderr: "" });
  try {
    const settle = () => new Promise((r) => setTimeout(r, 20));
    const { m, c } = await mount("portrait-changes");
    m.render(c); await settle();
    reset(); m.render(c);
    assert.ok(log.ids.some((i) => i.startsWith("row-")), "open at first: its rows are drawn");
    m.toggle(m.listed()[0], c); await settle();
    assert.ok(m.openRow, "a clean row is open");

    m.toggleQuiet(c);
    assert.equal(state.shared["changes.quietFolded"], true);
    assert.equal(m.openRow, null, "folding closes the row open in it");
    reset(); m.render(c);
    assert.ok(log.texts.includes("No changes") && log.texts.includes("1"), "the count stays");
    assert.ok(!log.ids.some((i) => i.startsWith("row-")), "no rows while folded");

    const again = await mount("portrait-changes");
    assert.equal(again.m.quietFolded(), true, "a new copy finds it folded");
    m.toggleQuiet(c);
    assert.equal(state.shared["changes.quietFolded"], false);
  } finally { host.exec = realExec; }
});

// A git stand-in for portrait-changes: `dirty` lists what status reports per folder, `slow` holds
// status calls until released.
function changesWorld({ repo = h("@LIN/proj"), others = [], dirty = {} } = {}) {
  world();
  state.layout = { id: "root", children: [{ id: "panel", hidden: false, children: [{ id: "panel-body", active: "changes", children: [{ id: "changes" }] }] }] };
  const list = [`worktree ${repo}\nbranch refs/heads/main\n`, ...others.map((p) => `worktree ${p}\nbranch refs/heads/${p.split("/").pop()}\n`)].join("\n");
  const calls = [];
  const git = { cdup: {}, reject: new Set(), gate: null };
  host.exec = async (cmd, args, o) => {
    calls.push({ cmd, args, cwd: o?.cwd });
    if (git.reject.has(o?.cwd)) throw new Error("no such folder");
    if (git.gate && args.includes("status")) await git.gate;
    if (args.includes("--show-cdup")) return { code: 0, stdout: `${git.cdup[o?.cwd] ?? ""}\n`, stderr: "" };
    if (args.includes("--show-toplevel")) return { code: 0, stdout: `${repo}\n`, stderr: "" };
    if (args.includes("worktree")) return { code: 0, stdout: list, stderr: "" };
    if (args.includes("status")) return { code: 0, stdout: `## b\0${(dirty[o?.cwd] ?? []).join("\0")}${dirty[o?.cwd]?.length ? "\0" : ""}`, stderr: "" };
    if (args.includes("diff") && !args.includes("--numstat")) return { code: 0, stdout: "@@ -1 +1 @@\n-a\n+b\n", stderr: "" };
    return { code: 0, stdout: "", stderr: "" };
  };
  return { calls, git, dirty, statuses: () => calls.filter((c) => c.args.includes("status")).length };
}
const settle = () => new Promise((r) => setTimeout(r, 20));
const closePanel = () => { state.layout = { id: "root", children: [{ id: "panel", hidden: true, children: [{ id: "panel-body", active: "changes", children: [{ id: "changes" }] }] }] }; };

test("portrait-changes does no work while the panel is closed: not on render, not on a timer", async () => {
  const realExec = host.exec;
  try {
    const { calls } = changesWorld();
    closePanel();
    const timers = [];
    const { m, c } = await mount("portrait-changes");
    c.timer = { every: (_ms, fn) => timers.push(fn) };
    m.init({}, c);
    m.render(c);
    for (const fn of timers) for (let i = 0; i < 6; i++) fn(c);
    await settle();
    assert.equal(calls.length, 0);
  } finally { host.exec = realExec; }
});

test("portrait-changes: moving the focus inside the list does not restart a pass", async () => {
  const realExec = host.exec, repo = h("@LIN/proj"), other = h("@LIN/proj/.wt/fix");
  try {
    const g = changesWorld({ others: [other] });
    let open; g.git.gate = new Promise((r) => { open = r; });
    const { m, c } = await mount("portrait-changes");
    m.render(c); await settle();
    assert.equal(m.passing, true);
    const run = m.countRun;
    state.panes.find((p) => p.pane === "p2").cwd = other;
    m.render(c); await settle();
    assert.equal(m.countRun, run, "the same pass goes on");
    open(); await settle();
    assert.equal(m.passing, false);
    const after = g.statuses();
    state.panes.find((p) => p.pane === "p2").cwd = repo;
    m.render(c); await settle();
    assert.equal(g.statuses(), after, "and a pass that just ended is not run again");
  } finally { host.exec = realExec; }
});

test("portrait-changes: closing the panel stops a pass; rows move only when it ends", async () => {
  const realExec = host.exec, repo = h("@LIN/proj"), other = h("@LIN/proj/.wt/fix"), third = h("@LIN/proj/.wt/zed");
  try {
    const g = changesWorld({ others: [other, third], dirty: { [third]: [" M a"] } });
    let open; g.git.gate = new Promise((r) => { open = r; });
    const { m, c } = await mount("portrait-changes");
    m.render(c); await settle();
    reset(); m.render(c);
    assert.ok(log.texts.includes("Checking…"), "nothing checked yet is not called No changes");
    assert.ok(!log.texts.includes("No changes"));
    closePanel(); m.render(c); open(); await settle();
    assert.ok(g.statuses() <= 1, "stopped after the row it was on");
    assert.equal(m.passing, false);
    state.layout = { id: "root", children: [{ id: "panel", hidden: false, children: [{ id: "panel-body", active: "changes", children: [{ id: "changes" }] }] }] };
    reset(); m.render(c); await settle();
    assert.equal(m.facts.get(JSON.stringify([null, third])).files, 1, "opening runs it again");
    reset(); m.render(c);
    assert.ok(log.texts.includes("No changes"));
    assert.equal(m.listed().length, 3);
    assert.equal(repo, m.worktrees[0].path);
  } finally { host.exec = realExec; }
});

test("portrait-changes: a folder deleted while open clears it and stops commits", async () => {
  const realExec = host.exec, other = h("@LIN/proj/.wt/fix");
  try {
    const g = changesWorld({ others: [other], dirty: { [other]: [" M a.js"] } });
    const { m, c } = await mount("portrait-changes");
    m.render(c); await settle();
    m.toggle(m.listed().find((r) => r.path === other), c); await settle();
    assert.equal(m.files.length, 1);
    g.git.reject.add(other);
    m.refresh(c); await settle();
    assert.deepEqual(m.files, []);
    assert.equal(m.rows.length, 0);
    assert.ok(m.error);
    g.calls.length = 0;
    m.message = "work"; m.commit(c); await settle();
    assert.equal(g.calls.filter((x) => x.args.includes("commit")).length, 0, "no commit on a row in error");
  } finally { host.exec = realExec; }
});

test("portrait-changes: a commit is refused when git would walk up to a parent, or over conflicts", async () => {
  const realExec = host.exec, other = h("@LIN/proj/.wt/fix");
  try {
    const g = changesWorld({ others: [other], dirty: { [other]: [" M a.js"] } });
    const { m, c } = await mount("portrait-changes");
    m.render(c); await settle();
    m.toggle(m.listed().find((r) => r.path === other), c); await settle();
    g.git.cdup[other] = "../../";
    m.message = "work"; m.commit(c); await settle();
    assert.equal(g.calls.filter((x) => x.args.includes("add") || x.args.includes("commit")).length, 0);
    assert.match(m.note, /no longer a checkout/);
    assert.ok(m.message, "the message is kept");
    g.git.cdup[other] = "";
    g.dirty[other] = ["UU a.js"];
    m.refresh(c); await settle();
    m.note = null; m.commit(c); await settle();
    assert.equal(g.calls.filter((x) => x.args.includes("add") || x.args.includes("commit")).length, 0);
    assert.match(m.note, /conflicts/);
  } finally { host.exec = realExec; }
});

test("portrait-changes: a failed commit is told even after moving to another row", async () => {
  const realExec = host.exec, repo = h("@LIN/proj"), other = h("@LIN/proj/.wt/fix");
  try {
    const g = changesWorld({ others: [other], dirty: { [other]: [" M a.js"] } });
    const base = host.exec;
    host.exec = async (cmd, args, o) => (args[0] === "commit" ? { code: 1, stdout: "", stderr: "hook said no" } : base(cmd, args, o));
    const { m, c } = await mount("portrait-changes");
    m.render(c); await settle();
    m.toggle(m.listed().find((r) => r.path === other), c); await settle();
    m.message = "work"; reset(); m.commit(c);
    m.busy = true;
    m.toggle(m.listed().find((r) => r.path === repo), c);
    await settle();
    const told = log.calls.filter((x) => x[0] === "notify");
    assert.equal(told.length, 1);
    assert.match(told[0][1].body, /hook said no/);
    assert.equal(g.calls.length > 0, true);
  } finally { host.exec = realExec; }
});

test("portrait-changes: opening another row during a slow load shows only the new row", async () => {
  const realExec = host.exec, other = h("@LIN/proj/.wt/fix"), third = h("@LIN/proj/.wt/zed");
  try {
    const g = changesWorld({ others: [other, third], dirty: { [other]: [" M old.js"], [third]: [" M new.js"] } });
    const { m, c } = await mount("portrait-changes");
    m.render(c); await settle();
    let open; g.git.gate = new Promise((r) => { open = r; });
    m.toggle(m.listed().find((r) => r.path === other), c); await settle();
    m.toggle(m.listed().find((r) => r.path === third), c); await settle();
    open(); await settle();
    assert.deepEqual(m.files.map((f) => f.path), ["new.js"]);
    assert.equal(m.loading, false);
  } finally { host.exec = realExec; }
});

test("portrait-changes: with the darker part folded, a row that just became clean stays visible", async () => {
  const realExec = host.exec, other = h("@LIN/proj/.wt/fix");
  try {
    const g = changesWorld({ others: [other], dirty: { [other]: [" M a.js"] } });
    state.shared["changes.quietFolded"] = true;
    const { m, c } = await mount("portrait-changes");
    m.render(c); await settle();
    m.toggle(m.listed().find((r) => r.path === other), c); await settle();
    g.dirty[other] = [];
    m.message = "work"; m.commit(c); await settle();
    assert.ok(m.openRow, "still open");
    reset(); m.render(c);
    assert.ok(log.ids.some((i) => i.startsWith("row-") && i.includes("fix")), "and still drawn");
    assert.ok(log.texts.includes("No uncommitted changes"));
  } finally { host.exec = realExec; }
});

// Real git from here on: the pathspecs and the status forms are git's to judge, not a stand-in's.
function realGit(setup) {
  const { spawnSync } = require_fs_cp();
  const { mkdtempSync, writeFileSync: write } = require_fs();
  const dir = mkdtempSync(join(tmpdir(), "portrait-changes-git-"));
  const git = (args, cwd = dir) => { const r = spawnSync("git", args, { cwd, encoding: "utf8" }); return { code: r.status, stdout: r.stdout, stderr: r.stderr }; };
  git(["init", "-q", "-b", "main"]);
  for (const [k, v] of [["user.name", "t"], ["user.email", ["t", "example.invalid"].join("@")], ["commit.gpgsign", "false"]]) git(["config", k, v]);
  setup({ git, write: (name, text) => write(join(dir, name), text) });
  const root = git(["rev-parse", "--show-toplevel"]).stdout.trim();
  host.exec = async (cmd, args, o) => {
    if (cmd !== "git") return { code: 1, stdout: "", stderr: "" };
    return git(args, o?.cwd ?? root);
  };
  return { git, root, dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}
const require_fs_cp = () => createRequire(import.meta.url)("node:child_process");
const openMain = async (root) => {
  world();
  state.layout = { id: "root", children: [{ id: "panel", hidden: false, children: [{ id: "panel-body", active: "changes", children: [{ id: "changes" }] }] }] };
  state.panes.find((p) => p.pane === "p2").cwd = root;
  const { m, c } = await mount("portrait-changes");
  const wait = () => new Promise((r) => setTimeout(r, 150));
  m.render(c); await wait();
  m.toggle(m.listed().find((r) => r.path === root), c); await wait();
  return { m, c, wait };
};

test("portrait-changes, real git: Commit works with an ignored worktree inside the repo", async () => {
  const realExec = host.exec;
  const g = realGit(({ git, write }) => {
    write(".gitignore", ".wt/\n"); write("a", "1\n");
    git(["add", "-A"]); git(["commit", "-qm", "first"]);
    git(["worktree", "add", "-q", ".wt/x", "-b", "x"]);
    write("a", "2\n");
  });
  try {
    const { m, c, wait } = await openMain(g.root);
    assert.deepEqual(m.files.map((f) => f.path), ["a"]);
    m.message = "second"; m.commit(c); await wait();
    assert.equal(m.note, null);
    assert.equal(g.git(["log", "-1", "--format=%s"]).stdout.trim(), "second");
    assert.equal(g.git(["status", "--porcelain"]).stdout, "");
  } finally { host.exec = realExec; g.cleanup(); }
});

test("portrait-changes, real git: a worktree inside the repo that isn't ignored is no change and is never committed", async () => {
  const realExec = host.exec;
  const g = realGit(({ git, write }) => {
    write("a", "1\n");
    git(["add", "-A"]); git(["commit", "-qm", "first"]);
    git(["worktree", "add", "-q", ".wt/x", "-b", "x"]);
    write("a", "2\n");
  });
  try {
    const { m, c, wait } = await openMain(g.root);
    assert.deepEqual(m.files.map((f) => f.path), ["a"], "no phantom row for the worktree");
    m.message = "second"; m.commit(c); await wait();
    assert.equal(m.note, null);
    assert.equal(g.git(["log", "-1", "--format=%s"]).stdout.trim(), "second");
    assert.doesNotMatch(g.git(["ls-tree", "-r", "HEAD", "--name-only"]).stdout, /\.wt/);
  } finally { host.exec = realExec; g.cleanup(); }
});

test("portrait-changes: a frame drawn during a load is drawn again after it, even if nothing changed", async () => {
  const realExec = host.exec, other = h("@LIN/proj/.wt/fix");
  try {
    const g = changesWorld({ others: [other] });
    const { m, c } = await mount("portrait-changes");
    m.render(c); await settle();
    let open; g.git.gate = new Promise((r) => { open = r; });
    m.toggle(m.listed().find((r) => r.path === other), c); await settle();
    reset(); m.render(c);
    assert.ok(log.texts.includes("Loading changes…"));
    let notified = 0; c.notify = () => { notified++; };
    open(); await settle();
    assert.ok(notified > 0, "or the panel stays on Loading");
    reset(); m.render(c);
    assert.ok(log.texts.includes("No uncommitted changes"));
  } finally { host.exec = realExec; }
});

test("portrait-changes: a pass stopped by closing runs again on opening, even right after another", async () => {
  const realExec = host.exec, other = h("@LIN/proj/.wt/fix");
  try {
    const g = changesWorld({ others: [other] });
    const { m, c } = await mount("portrait-changes");
    m.render(c); await settle();
    assert.equal(m.passing, false);
    m.passList = "something else";
    let open; g.git.gate = new Promise((r) => { open = r; });
    m.refreshList(c); await settle();
    assert.equal(m.passing, true);
    closePanel(); m.render(c); open(); await settle();
    assert.equal(m.passing, false);
    g.git.gate = null;
    const before = g.statuses();
    state.layout = { id: "root", children: [{ id: "panel", hidden: false, children: [{ id: "panel-body", active: "changes", children: [{ id: "changes" }] }] }] };
    m.render(c); await settle();
    assert.ok(g.statuses() > before);
  } finally { host.exec = realExec; }
});

test("portrait-changes: a slow commit doesn't blank another row, and Commit during a load runs after it", async () => {
  const realExec = host.exec, other = h("@LIN/proj/.wt/fix"), third = h("@LIN/proj/.wt/zed");
  try {
    const g = changesWorld({ others: [other, third], dirty: { [other]: [" M a.js"], [third]: [" M b.js"] } });
    const { m, c } = await mount("portrait-changes");
    m.render(c); await settle();
    m.toggle(m.listed().find((r) => r.path === other), c); await settle();
    m.busy = m.context;
    m.toggle(m.listed().find((r) => r.path === third), c); await settle();
    assert.deepEqual(m.files.map((f) => f.path), ["b.js"]);
    m.busy = false;

    let open; g.git.gate = new Promise((r) => { open = r; });
    m.refresh(c); await settle();
    assert.equal(m.loading, true);
    m.message = "work"; m.commit(c);
    assert.equal(g.calls.filter((x) => x.args[0] === "commit").length, 0, "it waits");
    open(); await settle();
    const commits = g.calls.filter((x) => x.args[0] === "commit");
    assert.equal(commits.length, 1);
    assert.equal(commits[0].cwd, third);
  } finally { host.exec = realExec; }
});

test("portrait-changes: focus moving to a machine that doesn't answer leaves local rows local", async () => {
  const realExec = host.exec, repo = h("@LIN/proj");
  try {
    const g = changesWorld();
    const { m, c } = await mount("portrait-changes");
    m.render(c); await settle();
    assert.equal(m.worktrees[0].on, null);
    state.spaces[0].machine = "devbox";
    const base = host.exec;
    host.exec = async (cmd, args, o) => { if (o?.on === "devbox") throw new Error("unreachable"); return base(cmd, args, o); };
    m.render(c); await settle();
    assert.deepEqual(m.worktrees.map((w) => [w.path, w.on]), [[repo, null]]);
    assert.equal(m.topOn, null);
    assert.ok(g.calls.length > 0);
  } finally { host.exec = realExec; }
});

test("portrait-changes: last known state stays when the focus comes back; folding keeps a row that can't be read", async () => {
  const realExec = host.exec, repo = h("@LIN/proj");
  try {
    const g = changesWorld({ dirty: { [repo]: [" M a"] } });
    const { m, c } = await mount("portrait-changes");
    m.render(c); await settle();
    const k = JSON.stringify([null, repo]);
    assert.equal(m.facts.get(k).files, 1);
    m.worktrees = []; m.passList = null; m.start = null;
    await m.count(c);
    assert.equal(m.facts.get(k).files, 1, "a pass over other rows keeps it");
    m.worktrees = [{ path: repo, branch: "main", on: null }];
    m.toggle(m.listed()[0], c); await settle();
    g.git.reject.add(repo);
    m.refresh(c); await settle();
    m.toggleQuiet(c);
    assert.ok(m.openRow, "the row with the error stays open");
  } finally { host.exec = realExec; }
});

