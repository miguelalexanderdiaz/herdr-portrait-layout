// portrait-tree: pure logic (mods/portrait-tree/logic.mjs). `node --test tests/`
import { h, LIN } from "./fake-home.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  rgb, hex, inkOn, mix, clean, duration, nameOf, dedupeNames, tilde, basename, dirname, noteParts,
  safeStorage, readJson, writeJson, isStringArray, isChangedMap, pruneIds, pruneChanged,
  spineFile, spineSvg, xml, joinPath, createSpineStore, SPINE_DIR,
  planColumns, wheelSteps, MIN_COL, FOLDED_COL, MARKER,
} from "../mods/portrait-tree/logic.mjs";

test("colors: rgb/hex round trip, bad input is grey, inkOn picks the readable ink", () => {
  assert.deepEqual(rgb("#22a99a"), [0x22, 0xa9, 0x9a]);
  assert.deepEqual(rgb(undefined), [128, 128, 128]);
  assert.deepEqual(rgb("nonsense"), [128, 128, 128]);
  assert.equal(hex([255, 0, 300]), "#ff00ff");
  assert.equal(hex(rgb("#5b8def")), "#5b8def");
  assert.equal(inkOn("#ffffff"), "#141414");
  assert.equal(inkOn("#000000"), "#ffffff");
  assert.equal(inkOn("#22a99a"), "#141414");
  assert.equal(mix("#000000", "#ffffff", 0.5), "#808080");
  assert.equal(mix("#102030", "#102030", 0.7), "#102030");
});

test("clean strips leading symbols; duration formats", () => {
  assert.equal(clean("✳ Fix the bug "), "Fix the bug");
  assert.equal(clean(undefined), "");
  assert.equal(duration(0), "<1m");
  assert.equal(duration(59 * 60000), "59m");
  assert.equal(duration(60 * 60000), "1h");
  assert.equal(duration(23 * 3600000), "23h");
  assert.equal(duration(48 * 3600000), "2d");
});

test("nameOf prefers a telling title, then a named tab, then the program", () => {
  assert.equal(nameOf({ title: "✳ Refactor tests", tab_name: "3", program: { name: "Claude" } }), "Refactor tests");
  assert.equal(nameOf({ title: "~/code/app", tab_name: "backend", program: { name: "Claude" } }), "backend");
  assert.equal(nameOf({ title: "me@host", tab_name: "7", program: { name: "Claude" } }), "Claude");
  assert.equal(nameOf({ title: h("@WINx"), program: { name: "Codex" } }), "Codex");
  assert.equal(nameOf({ title: "Claude", program: { name: "Claude" } }), "Claude");
  assert.equal(nameOf({}), "agent");
  assert.equal(nameOf({ app: "thing" }), "thing");
});

test("dedupeNames numbers a name repeated within one tab only", () => {
  const list = [
    { address: "t1", tab: "a", name: "Claude" },
    { address: "t2", tab: "a", name: "Claude" },
    { address: "t3", tab: "b", name: "Claude" },
    { address: "t4", tab: "a", name: "Codex" },
    { address: "t5", tab: "a", name: "Claude" },
  ];
  const names = dedupeNames(list);
  assert.equal(names.get("t1"), "Claude (1)");
  assert.equal(names.get("t2"), "Claude (2)");
  assert.equal(names.get("t5"), "Claude (3)");
  assert.equal(names.get("t3"), "Claude");
  assert.equal(names.get("t4"), "Codex");
  assert.equal(dedupeNames([]).size, 0);
});

test("tilde: macOS, Linux, Windows with mixed separators, '/' home, siblings, trailing slash", () => {
  assert.equal(tilde(h("@MAC/code/app"), h("@MAC")), "~/code/app");
  assert.equal(tilde(h("@LIN"), h("@LIN")), "~");
  assert.equal(tilde(h("@LIN/"), h("@LIN")), "~");
  assert.equal(tilde(h("@LIN/proj/"), h("@LIN/")), "~/proj/");
  assert.equal(tilde(h("@LINabel/code"), h("@LIN")), h("@LINabel/code")); // sibling prefix
  assert.equal(tilde("/usr/local/bin", "/"), "/usr/local/bin"); // home "/" never matches
  assert.equal(tilde("/usr/local/bin", ""), "/usr/local/bin");
  assert.equal(tilde(h("/x@LIN/y"), h("@LIN")), h("/x@LIN/y")); // only the start counts
  assert.equal(tilde(h("@WIN\\code"), h("@WIN")), "~/code");
  assert.equal(tilde(h("@WINF/code"), h("@WIN")), "~/code"); // mixed
  assert.equal(tilde(h("@WINL\\code"), h("@WIN")), "~/code"); // drive paths ignore case
  assert.equal(tilde(h("@WINabel"), h("@WIN")), h("@WINabel"));
  assert.equal(tilde("", h("@LIN")), "");
  assert.equal(tilde(undefined, h("@LIN")), "");
  assert.equal(tilde(h("@LIN/x"), undefined), h("@LIN/x"));
  // Case matters on POSIX.
  assert.equal(tilde(LIN.replace("ann", "Ann") + "/x", LIN), LIN.replace("ann", "Ann") + "/x");
});

test("basename/dirname accept both separators and never throw", () => {
  assert.equal(basename("/a/b/c.txt"), "c.txt");
  assert.equal(basename("C:\\a\\b\\c.txt"), "c.txt");
  assert.equal(basename("c.txt"), "c.txt");
  assert.equal(basename(undefined), "");
  assert.equal(dirname("/a/b/c.txt"), "/a/b");
  assert.equal(dirname("C:\\a\\b\\c.txt"), "C:\\a\\b");
  assert.equal(dirname("c.txt"), "");
  assert.equal(dirname("/c.txt"), "");
  assert.equal(dirname(null), "");
});

test("noteParts survives malformed vault records", () => {
  assert.deepEqual(noteParts({ vault: "/x/My Vault", file: "Daily/2026-01-02.md", id: "1" }),
    { name: "2026-01-02", dir: "Daily", vault: "My Vault", path: "My Vault/Daily" });
  assert.deepEqual(noteParts({ vault: "C:\\Notes\\Work", file: "Plan.excalidraw.md" }),
    { name: "Plan", dir: "", vault: "Work", path: "Work" });
  for (const bad of [undefined, null, {}, { vault: 1 }, { file: 5 }, { vault: {}, file: [] }, "str", 7]) {
    const p = noteParts(bad);
    assert.equal(p.name, "Note");
    assert.equal(p.dir, "");
    assert.equal(p.path, p.vault);
  }
  assert.equal(noteParts({ vault: "/v", file: "x" }).name, "x");
  assert.equal(noteParts({ vault: "/v" }).path, "v"); // missing file
  assert.equal(noteParts({ file: "a/b.canvas" }).name, "b");
});

function fakeStorage(initial = {}, { failRead = false, failWrite = false } = {}) {
  const data = { ...initial };
  return {
    data,
    getItem(k) { if (failRead) throw new Error("blocked"); return k in data ? data[k] : null; },
    setItem(k, v) { if (failWrite) throw new Error("full"); data[k] = String(v); },
  };
}

test("readJson: corrupt, wrong shape, missing, blocked storage all give the fallback", () => {
  const ok = isStringArray;
  assert.deepEqual(readJson(fakeStorage({ k: '["a","b"]' }), "k", [], ok), ["a", "b"]);
  assert.deepEqual(readJson(fakeStorage({ k: '["a",' }), "k", ["x"], ok), ["x"]); // truncated
  assert.deepEqual(readJson(fakeStorage({ k: '{"a":1}' }), "k", [], ok), []); // object where an array is expected
  assert.deepEqual(readJson(fakeStorage({ k: "[1,2]" }), "k", [], ok), []);
  assert.deepEqual(readJson(fakeStorage({}), "k", ["x"], ok), ["x"]);
  assert.deepEqual(readJson(fakeStorage({ k: "[]" }, { failRead: true }), "k", ["x"], ok), ["x"]);
  assert.deepEqual(readJson(fakeStorage({ k: "null" }), "k", {}, isChangedMap), {});
  assert.deepEqual(readJson(fakeStorage({ k: '{"t1":{"s":"idle","at":5}}' }), "k", {}, isChangedMap), { t1: { s: "idle", at: 5 } });
  assert.deepEqual(readJson(fakeStorage({ k: '{"t1":{"s":"idle"}}' }), "k", {}, isChangedMap), {}); // no timestamp
  assert.deepEqual(readJson(fakeStorage({ k: '{"t1":[]}' }), "k", {}, isChangedMap), {});
});

test("safeStorage/writeJson never throw", () => {
  const s = safeStorage(() => fakeStorage({}, { failRead: true, failWrite: true }));
  assert.equal(s.getItem("x"), null);
  assert.equal(s.setItem("x", "1"), false);
  assert.equal(safeStorage(() => { throw new Error("no localStorage"); }).getItem("x"), null);
  const mem = fakeStorage();
  assert.equal(writeJson(safeStorage(() => mem), "k", [1]), true);
  assert.equal(mem.data.k, "[1]");
});

test("pruneIds keeps live ids and never prunes against an empty list", () => {
  assert.deepEqual(pruneIds(["a", "b", "c"], ["a", "c", "z"]), ["a", "c"]);
  assert.deepEqual(pruneIds(new Set(["a", "b"]), []), ["a", "b"]);
  assert.deepEqual(pruneIds([], ["a"]), []);
});

test("pruneChanged: keeps live and recent, drops old dead ones, empty live list prunes nothing", () => {
  const DAY = 24 * 3600 * 1000, now = 100 * DAY;
  const changed = {
    live: { s: "idle", at: now - 30 * DAY },
    recent: { s: "working", at: now - 2 * DAY },
    old: { s: "idle", at: now - 8 * DAY },
  };
  const kept = pruneChanged(changed, ["live"], now);
  assert.deepEqual(Object.keys(kept).sort(), ["live", "recent"]);
  assert.equal(pruneChanged(changed, [], now), changed); // same object: nothing to write
  assert.equal(pruneChanged(changed, ["live", "recent", "old"], now), changed);
  assert.equal(pruneChanged({ a: { s: "x", at: now } }, ["a"], now).a.at, now);
});

test("spineFile is stable and distinct; xml escapes and drops forbidden characters", () => {
  assert.equal(spineFile("api"), spineFile("api"));
  assert.notEqual(spineFile("api"), spineFile("web"));
  assert.match(spineFile("api"), new RegExp(`^${SPINE_DIR}/[0-9a-z]+\\.svg$`));
  assert.match(spineFile("日本語 🚀"), /\.svg$/u);
  assert.equal(xml(`a<b>&"c'`), "a&lt;b&gt;&amp;&quot;c&#39;");
  assert.equal(xml("a\u0001b\u0008c\u000bd\u001fe"), "abcde");
  assert.equal(xml("tab\tnl\ncr\r"), "tab\tnl\ncr\r"); // allowed in XML
  const svg = spineSvg("Q&A <1>\u0002");
  assert.ok(svg.includes(">Q&amp;A &lt;1&gt;</text>"));
  assert.ok(!/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(svg));
  assert.ok(svg.includes("Segoe UI") && svg.includes("sans-serif"));
});

test("joinPath uses the separator of its base", () => {
  assert.equal(joinPath(h("@LIN/.config/herdr-app"), "data", "x.svg"), h("@LIN/.config/herdr-app/data/x.svg"));
  assert.equal(joinPath("/base/", "data/spines", "x.svg"), "/base/data/spines/x.svg");
  assert.equal(joinPath(h("@WIN\\herdr"), "data/portrait-tree-spines", "x.svg"), h("@WIN\\herdr\\data\\portrait-tree-spines\\x.svg"));
  assert.equal(joinPath(h("@WINF"), "data"), h("@WINF/data"));
});

function fakeFs({ failWrite = false, files = {} } = {}) {
  const calls = { write: 0, mkdir: 0, unlink: [] };
  const fs = {
    files, calls, failWrite,
    async readFile(p) { if (p in fs.files) return fs.files[p]; throw new Error("ENOENT"); },
    async writeFile(p, c) { calls.write++; if (fs.failWrite) throw new Error("EACCES"); fs.files[p] = c; },
    async mkdir() { calls.mkdir++; if (fs.failWrite) throw new Error("EACCES"); },
    async readdir(dir) { return Object.keys(fs.files).filter((p) => p.startsWith(dir + "/")).map((p) => p.slice(dir.length + 1)); },
    async unlink(p) { calls.unlink.push(p); delete fs.files[p]; },
  };
  return fs;
}

test("spine store writes once and reports ready", async () => {
  const fs = fakeFs();
  const store = createSpineStore({ fs, root: () => "/app" });
  assert.equal(store.ready("api"), false);
  const w = store.request("api");
  assert.ok(w);
  assert.equal(store.request("api"), null); // already in flight
  assert.equal(await w, true);
  assert.equal(store.ready("api"), true);
  assert.equal(store.request("api"), null);
  assert.equal(fs.calls.write, 1);
  assert.equal(fs.files[`/app/${spineFile("api")}`], spineSvg("api"));
});

test("spine store skips a write when the file is already right", async () => {
  const fs = fakeFs({ files: { [`/app/${spineFile("api")}`]: spineSvg("api") } });
  const store = createSpineStore({ fs, root: () => "/app" });
  assert.equal(await store.request("api"), true);
  assert.equal(fs.calls.write, 0);
});

test("spine store: a failing fs is not retried before the cool-down (no render loop)", async () => {
  const fs = fakeFs({ failWrite: true });
  let clock = 1000;
  const store = createSpineStore({ fs, root: () => "/app", now: () => clock, cooldown: 60000 });
  assert.equal(await store.request("api"), false);
  assert.equal(fs.calls.write, 0); // mkdir failed first
  for (let frame = 0; frame < 50; frame++) assert.equal(store.request("api"), null); // every render in the next minute
  clock += 59999;
  assert.equal(store.request("api"), null);
  clock += 2;
  fs.failWrite = false;
  assert.equal(await store.request("api"), true); // retried after the cool-down
  assert.equal(store.ready("api"), true);
});

test("spine store: an app home that throws does not throw out of request", async () => {
  const store = createSpineStore({ fs: fakeFs(), root: () => { throw new Error("no app home"); } });
  assert.equal(await store.request("api"), false);
});

test("spine store prune deletes only unknown *.svg files", async () => {
  const dir = `/app/${SPINE_DIR}`;
  const fs = fakeFs({ files: {
    [`/app/${spineFile("keep")}`]: "x", [`/app/${spineFile("gone")}`]: "x", [`${dir}/notes.txt`]: "keep me",
  } });
  const store = createSpineStore({ fs, root: () => "/app" });
  const removed = await store.prune(["keep", "other"]);
  assert.deepEqual(removed, [spineFile("gone").slice(SPINE_DIR.length + 1)]);
  assert.ok(`${dir}/notes.txt` in fs.files);
  assert.ok(`/app/${spineFile("keep")}` in fs.files);
  assert.deepEqual(await store.prune([]), []); // empty list: nothing known, delete nothing
  assert.equal(fs.calls.unlink.length, 1);
  const none = createSpineStore({ fs: { readdir: async () => { throw new Error("ENOENT"); } }, root: () => "/app" });
  assert.deepEqual(await none.prune(["a"]), []);
});

// ---- planColumns -----------------------------------------------------------------------

// The windowing code as it was inline in render() before round 1 (kept as the reference).
function oldPlan({ widths, width, zoom, active, lastActive, start: startIn }) {
  const sp = widths.map((w, i) => ({ id: `s${i}`, active: i === active }));
  const widthOf = (s) => widths[sp.indexOf(s)];
  const avail = width / (Number(zoom) || 1) - FOLDED_COL;
  const total = sp.reduce((n, s) => n + widthOf(s), 0);
  const windowed = width > 0 && total > avail;
  const room = windowed ? avail - 2 * MARKER : avail;
  let st = startIn, lastStart = 0, start = 0, end = sp.length, la = lastActive;
  if (windowed) {
    let last = sp.length - 1;
    for (let used = widthOf(sp[last]); last > 0 && used + widthOf(sp[last - 1]) <= room; last--) used += widthOf(sp[last - 1]);
    lastStart = last;
    const fits = (from) => { let e = from, used = 0; while (e < sp.length && used + widthOf(sp[e]) <= room) used += widthOf(sp[e++]); return Math.max(e, from + 1); };
    const act = sp.findIndex((s) => s.active), actId = sp[act]?.id;
    if (actId && actId !== la) {
      la = actId;
      if (act < st) st = act;
      else if (act >= fits(st)) {
        let from = act;
        for (let used = widthOf(sp[act]); from > 0 && used + widthOf(sp[from - 1]) <= room; from--) used += widthOf(sp[from - 1]);
        st = from;
      }
    }
    st = Math.max(0, Math.min(st, lastStart));
    start = st; end = fits(start);
  } else { st = 0; lastStart = 0; }
  return { windowed, room, start, end, lastStart };
}

test("planColumns agrees with the old inline code on 400 random inputs", () => {
  let seed = 12345;
  const rnd = (n) => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };
  for (let i = 0; i < 400; i++) {
    const n = 1 + rnd(12);
    const widths = Array.from({ length: n }, () => (rnd(3) === 0 ? FOLDED_COL : MIN_COL));
    const width = rnd(5) === 0 ? 0 : 200 + rnd(3400);
    const zoom = [0.5, 0.8, 1, 1.25, 1.5, 3][rnd(6)];
    const active = rnd(n + 1) - 1; // -1: none
    const start = rnd(n);
    const lastActive = rnd(3) === 0 ? null : `s${rnd(n)}`;
    const old = oldPlan({ widths, width, zoom, active, lastActive, start });
    const actId = active >= 0 ? `s${active}` : undefined;
    const now = planColumns({ widths, width, zoom, active, follow: Boolean(actId) && actId !== lastActive, start });
    const label = JSON.stringify({ widths, width, zoom, active, start, lastActive });
    assert.equal(now.windowed, old.windowed, label);
    assert.equal(now.start, old.start, label);
    assert.equal(now.end, old.end, label);
    assert.equal(now.lastStart, old.lastStart, label);
    assert.equal(now.room, Math.max(0, old.room), label);
  }
});

test("planColumns: empty list never throws, tiny width is safe, room is never negative", () => {
  for (const width of [0, 50, 90, 400]) for (const zoom of [0.5, 1, 3]) {
    const p = planColumns({ widths: [], width, zoom });
    assert.equal(p.windowed, false);
    assert.equal(p.start, 0);
    assert.equal(p.end, 0);
    assert.ok(p.room >= 0);
  }
  // The old crash: bar at its minimum width, zoom 3, no spaces (avail = 90/3 - 34 < 0).
  assert.doesNotThrow(() => planColumns({ widths: [], width: 90, zoom: 3 }));
  const tiny = planColumns({ widths: [MIN_COL, MIN_COL], width: 90, zoom: 3 });
  assert.equal(tiny.windowed, true);
  assert.equal(tiny.room, 0);
  assert.ok(tiny.end > tiny.start);
});

test("planColumns: everything fits, one column wider than the room, active follows, all folded", () => {
  const fit = planColumns({ widths: [MIN_COL, FOLDED_COL], width: 1000 });
  assert.deepEqual([fit.windowed, fit.start, fit.end, fit.lastStart], [false, 0, 2, 0]);
  const wide = planColumns({ widths: [MIN_COL, MIN_COL, MIN_COL], width: 400 });
  assert.equal(wide.windowed, true);
  assert.equal(wide.end - wide.start, 1); // at least one column even when none fits
  const four = [MIN_COL, MIN_COL, MIN_COL, MIN_COL];
  const width = 2 * MIN_COL + 2 * MARKER + FOLDED_COL + 10; // two columns fit
  const first = planColumns({ widths: four, width, active: 0, follow: true, start: 0 });
  assert.deepEqual([first.start, first.end], [0, 2]);
  const follow = planColumns({ widths: four, width, active: 3, follow: true, start: 0 });
  assert.deepEqual([follow.start, follow.end], [2, 4]);
  const stay = planColumns({ widths: four, width, active: 3, follow: false, start: 0 });
  assert.deepEqual([stay.start, stay.end], [0, 2]); // no change of active space: the user's scroll wins
  const back = planColumns({ widths: four, width, active: 0, follow: true, start: 2 });
  assert.equal(back.start, 0);
  const clamped = planColumns({ widths: four, width, start: 99 });
  assert.equal(clamped.start, clamped.lastStart);
  const folded = planColumns({ widths: Array(30).fill(FOLDED_COL), width: 400 });
  assert.equal(folded.windowed, true);
  assert.ok(folded.end - folded.start > 5);
});

test("wheelSteps: accumulates, steps by 40, forgets on direction flip and after idle", () => {
  let s = null;
  s = wheelSteps(s, 15, 40, 0); assert.equal(s.steps, 0);
  s = wheelSteps(s, 15, 40, 10); assert.equal(s.steps, 0);
  s = wheelSteps(s, 15, 40, 20); assert.equal(s.steps, 1); assert.equal(s.accum, 5);
  s = wheelSteps(s, 100, 40, 30); assert.equal(s.steps, 2); assert.equal(s.accum, 25);
  // Direction flip: the 25 left over from before is dropped.
  s = wheelSteps(s, -30, 40, 40); assert.equal(s.steps, 0); assert.equal(s.accum, -30);
  s = wheelSteps(s, -30, 40, 50); assert.equal(s.steps, -1);
  // Idle: a stale remainder does not make the next swipe jump.
  s = wheelSteps(null, 30, 40, 0);
  s = wheelSteps(s, 30, 40, 1000); assert.equal(s.steps, 0); assert.equal(s.accum, 30);
  assert.equal(wheelSteps(s, 0, 40, 2000).steps, 0);
  assert.equal(wheelSteps(undefined, 80, 40, 5).steps, 2);
});
