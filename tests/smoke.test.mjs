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
  agents: () => state.agents,
  panes: () => state.panes,
  terminals: () => state.terminals ?? [],
  layout: () => state.layout,
  layouts: () => ["portrait"],
  theme: () => new Proxy({}, { get: () => "#808080" }),
  settings: () => ({ zoom: state.zoom ?? 1 }),
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
      if (n === "Editor" || n === "EditorState") return `const ${n} = { new: () => globalThis.__element(), release() {} };`;
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
  const c = { notify() {}, stop_propagation() {}, spawn: (fn) => Promise.resolve(fn(c)), timer: { every(ms, fn) { (c.timers ??= []).push([ms, fn]); } } };
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
    { pane: "p3", tab: "tab2", terminal: null, mod: "vault-reader", title: "note" },
    { pane: "p4", tab: "tab2", terminal: "t9", cwd: h("@LIN"), program: { name: "nvim" } },
  ];
  state.terminals = [{ address: "t9", name: "nvim", state: "live", labels: { "editor.file": h("@LIN/proj/a.js") } }];
  state.layout = { id: "root", children: [{ id: "panel", hidden: true, children: [{ id: "panel-body", active: "files", children: [{ id: "files" }, { id: "changes" }] }] }] };
}

// ---- tests ----------------------------------------------------------------------------------

test("portrait-tree renders: open and folded columns, windowed row, pane-less agents, malformed notes", async () => {
  world();
  state.shared["vault.panes"] = { p3: { vault: 1 } }; // malformed record
  const { m, c } = await mount("portrait-tree");
  for (const width of [0, 1500, 900, 300]) {
    m.width = width;
    assert.doesNotThrow(() => m.render(c), `width ${width}`);
  }
  assert.ok(log.ids.includes("space-new"));
  assert.ok(log.ids.includes("tab-tab1"));
  assert.ok(log.ids.includes("pn-p3"), "the vault-reader pane has a row");
  assert.ok(log.ids.includes("ag-p1") && log.ids.includes("ag-p1b"));
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

test("bar-strip: the Vault button needs the mod AND the layout node", async () => {
  world();
  const vaultLayout = { id: "root", children: [{ id: "panel", hidden: false, children: [{ id: "panel-body", active: "files", children: [{ id: "files" }, { id: "vault" }] }] }] };
  const cases = [
    [false, state.layout, false], [true, state.layout, false], [false, vaultLayout, false], [true, vaultLayout, true], [undefined, vaultLayout, false],
  ];
  const { m } = await mount("bar-strip");
  for (const [installed, layout, shown] of cases) {
    state.shared["mods.vault"] = installed; state.layout = layout;
    reset(); m.render();
    assert.equal(log.ids.includes("panel-vault"), shown, JSON.stringify([installed, Boolean(layout.children[0].children[0].children.find((c) => c.id === "vault"))]));
    assert.ok(log.ids.includes("panel-files") && log.ids.includes("panel-changes"));
  }
});

test("bar-strip: the tooltip names the real key; one picker at a time; the probe publishes mods.vault", async () => {
  world();
  state.keys = [{ section: "layout:portrait", keys: "ctrl-shift-j", action: "bar-strip.attention" }];
  const { m, c } = await mount("bar-strip");
  reset(); m.render();
  m.picker(true); m.picker(true);
  const opens = log.calls.filter((x) => x[0] === "openOverlay"), closes = log.calls.filter((x) => x[0] === "closeOverlay");
  assert.equal(opens.length, 2);
  assert.equal(closes.length, 1, "the second picker closes the first");
  assert.equal(opens[0][1].mod, "attention-picker");
  delete state.shared["mods.vault"];
  await m.probeVault(c);
  assert.equal(state.shared["mods.vault"], false); // no mods/vault in the fake app home
  m.attention();
  assert.ok(log.calls.some((x) => x[0] === "run" && x[1] === "agent.focus"));
});

test("portrait-tabs: renders, remembers panels, and never offers the vault without it", async () => {
  world();
  const { m } = await mount("portrait-tabs");
  state.shared["mods.vault"] = false;
  assert.doesNotThrow(() => m.render());
  assert.deepEqual(Object.keys(m.panels), ["s1"]);
  // A stored "vault" choice for a space is not restored when the vault is unavailable.
  m.panels = { s1: "vault" }; m.space = undefined; reset();
  state.layout.children[0].hidden = true;
  m.render();
  assert.ok(!log.calls.some((x) => x[0] === "run" && x[1] === "layout.select" && x[2].child === "vault"));
  // Corrupt storage on init.
  localStorage._d = { panels: "[1,2" };
  const again = await mount("portrait-tabs");
  assert.deepEqual(again.m.panels, {});
  localStorage._d = {};
});

test("portrait-pane renders agents, plain terminals and malformed notes", async () => {
  world();
  for (const [pane, shared] of [["p1", {}], ["p2", {}], ["p3", { "vault.panes": { p3: {} } }], ["p3", { "vault.panes": { p3: { vault: "/v/My Vault", file: "a/b.md" } } }], ["nope", {}]]) {
    state.shared = { ...shared };
    const { m, c } = await mount("portrait-pane", { pane });
    assert.doesNotThrow(() => m.render(c), pane);
  }
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

test("portrait-files: a click opens one editor, Windows previews, a missing nvim falls back", async () => {
  world();
  state.layout.children[0].hidden = false;
  // Windows, local folder: no hc run, a one-time toast, the preview.
  state.platform = "windows";
  let { m, c } = await mount("portrait-files");
  m.render(c);
  await new Promise((r) => setTimeout(r, 10));
  reset();
  await m.edit("a.js", c); await m.edit("b.js", c);
  assert.equal(log.calls.filter((x) => x[0] === "hc").length, 0);
  assert.equal(log.calls.filter((x) => x[0] === "notify").length, 1);
  assert.equal(m.file, "b.js");
  // macOS: two quick clicks start one nvim.
  state.platform = "macos";
  ({ m, c } = await mount("portrait-files"));
  m.render(c);
  await new Promise((r) => setTimeout(r, 10));
  const realExec = host.exec;
  host.exec = async (cmd, args, o) => { log.calls.push(["exec", cmd, args, o]); return { code: 0, stdout: args[1]?.includes("printenv") ? "/opt/bin:/usr/bin\n" : "", stderr: "" }; };
  const realHc = host.hc;
  host.hc = async (...a) => { log.calls.push(["hc", ...a]); return { code: 0, stdout: '{"address":"t42"}', stderr: "" }; };
  reset();
  await Promise.all([m.edit("a.js", c), m.edit("a.js", c)]);
  const runs = log.calls.filter((x) => x[0] === "hc");
  assert.equal(runs.length, 1, "double click: one editor");
  const args = runs[0][1];
  assert.ok(args.includes("--rm") && args.includes("--no-parent"));
  const dash = args.indexOf("--");
  assert.equal(args[dash + 1], "sh");
  assert.equal(args[dash + 5], "/opt/bin:/usr/bin");
  assert.ok(m.peekFor && m.peekFor.terminal === "t42");
  // The terminal never shows up: after 10 s it is killed, the gate re-opens.
  m.peekFor.since -= 11000;
  reset();
  m.peekWhenReady();
  assert.ok(log.calls.some((x) => x[0] === "run" && x[1] === "terminal.kill" && x[2].terminal === "t42"));
  assert.equal(m.gate.busy, false);
  // nvim missing: falls back to the preview with a toast.
  host.exec = async (cmd, args, o) => { log.calls.push(["exec", cmd, args, o]); return args[1]?.includes("command -v nvim") ? { code: 127, stdout: "", stderr: "" } : { code: 0, stdout: "/opt/bin\n", stderr: "" }; };
  ({ m, c } = await mount("portrait-files"));
  m.render(c);
  await new Promise((r) => setTimeout(r, 10));
  reset();
  await m.edit("a.js", c);
  assert.equal(log.calls.filter((x) => x[0] === "hc").length, 0);
  assert.ok(log.calls.some((x) => x[0] === "notify" && /nvim not found/.test(x[1].title)));
  assert.equal(m.file, "a.js");
  host.exec = realExec; host.hc = realHc;
});
