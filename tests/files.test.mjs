// portrait-files and nvim-float: pure logic (mods/portrait-files/logic.mjs). `node --test`
import { h, LIN } from "./fake-home.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  filesVisible, watchable, createGate, createPacer, REFRESH_GAP, freeName, markOf, parseStatus, bubble, arrange,
  loginPath, nvimArgv, nvimFound, platformMode, find,
  fileKind, canOpen, systemOpen, EDITORS, DETECT, parseDetect, editorChoices, pickEditor, appCommand, editorScript,
} from "../mods/portrait-files/logic.mjs";
import { canOpen as viewerCanOpen, viewKind } from "../mods/portrait-viewer/logic.mjs";

const layoutWith = ({ hidden, active } = {}) => ({
  id: "root", children: [
    { id: "left", children: [] },
    { id: "panel", hidden, children: [{ id: "panel-body", active, children: [{ id: "files" }, { id: "changes" }] }] },
  ],
});

test("filesVisible: only when the panel is shown with the files child active", () => {
  assert.equal(filesVisible(layoutWith({ hidden: false, active: "files" })), true);
  assert.equal(filesVisible(layoutWith({ hidden: undefined, active: "files" })), true);
  assert.equal(filesVisible(layoutWith({ hidden: true, active: "files" })), false);
  assert.equal(filesVisible(layoutWith({ hidden: false, active: "changes" })), false);
  assert.equal(filesVisible(layoutWith({ hidden: false, active: "vault" })), false);
  assert.equal(filesVisible(layoutWith({ hidden: false, active: undefined })), false);
});

test("filesVisible: missing nodes", () => {
  // The mod used in a layout without our ids: nothing says it is hidden, so it works.
  assert.equal(filesVisible(null), true);
  assert.equal(filesVisible(undefined), true);
  assert.equal(filesVisible({ id: "root", children: [] }), true);
  // Only a panel node: shown means visible.
  assert.equal(filesVisible({ id: "root", children: [{ id: "panel", hidden: false }] }), true);
  assert.equal(filesVisible({ id: "root", children: [{ id: "panel", hidden: true }] }), false);
  // Only a stack: its active child decides.
  assert.equal(filesVisible({ id: "root", children: [{ id: "panel-body", active: "changes" }] }), false);
});

test("find walks the layout tree", () => {
  const root = layoutWith({ active: "files" });
  assert.equal(find(root, "files").id, "files");
  assert.equal(find(root, "nope"), null);
  assert.equal(find(undefined, "x"), null);
});

test("watchable: not the home folder, not a drive or filesystem root", () => {
  assert.equal(watchable(h("@LIN/code"), h("@LIN")), true);
  assert.equal(watchable(h("@LIN"), h("@LIN")), false);
  assert.equal(watchable(h("@LIN/"), h("@LIN")), false);
  assert.equal(watchable("/", h("@LIN")), false);
  assert.equal(watchable("C:\\", h("@WIN")), false);
  assert.equal(watchable(h("@WIN"), h("@WIN")), false);
  assert.equal(watchable(h("@WIN\\code"), h("@WIN")), true);
  assert.equal(watchable("", h("@LIN")), false);
  assert.equal(watchable(undefined, h("@LIN")), false);
});

test("createGate admits one editor at a time and re-opens by itself", () => {
  let clock = 0;
  const gate = createGate(1000, () => clock);
  assert.equal(gate.enter(), true);
  assert.equal(gate.busy, true);
  assert.equal(gate.enter(), false); // double click
  assert.equal(gate.enter(), false);
  gate.leave();
  assert.equal(gate.busy, false);
  assert.equal(gate.enter(), true);
  clock = 999; assert.equal(gate.enter(), false);
  clock = 1001; assert.equal(gate.enter(), true); // a lost event can't lock it
});

test("freeName picks nvim, nvim-2, nvim-3", () => {
  assert.equal(freeName([]), "nvim");
  assert.equal(freeName(["zsh"]), "nvim");
  assert.equal(freeName(["nvim"]), "nvim-2");
  assert.equal(freeName(["nvim", "nvim-2", "x"]), "nvim-3");
  assert.equal(freeName(["nvim-2"]), "nvim");
});

test("markOf: conflicts first, then new, deleted, modified", () => {
  for (const xy of ["DD", "AU", "UD", "UA", "DU", "AA", "UU"]) assert.equal(markOf(xy), "U", xy);
  for (const xy of ["??", "A ", " A", "AM"]) assert.equal(markOf(xy), "A", xy);
  for (const xy of [" D", "D ", "MD"]) assert.equal(markOf(xy), "D", xy);
  for (const xy of [" M", "M ", "MM", "R ", "C ", "T "]) assert.equal(markOf(xy), "M", xy);
});

// A realistic `git status --porcelain=v1 -z --no-renames --untracked-files=all` output.
const STATUS = [" M README.md", "AA both.txt", "?? new file.txt", "A  src/lib/added.js", " D src/gone.js",
  " M src/main.js", "?? tools/x.sh", "UU src/lib/conflict.js", "M  docs/a b/c.md"].join("\0") + "\0";

test("parseStatus at the top of the repository", () => {
  const marks = parseStatus(STATUS, "");
  assert.equal(marks["README.md"], "M");
  assert.equal(marks["both.txt"], "U"); // AA is a conflict, not an addition
  assert.equal(marks["new file.txt"], "A"); // spaces survive -z
  assert.equal(marks["src/gone.js"], "D");
  assert.equal(marks["src/lib/conflict.js"], "U");
  assert.equal(marks["docs/a b/c.md"], "M");
  assert.equal(Object.keys(marks).length, 9);
});

test("parseStatus below a prefix keeps paths relative to the shown folder and ignores the rest", () => {
  const marks = parseStatus(STATUS, "src/");
  assert.deepEqual(marks, { "lib/added.js": "A", "gone.js": "D", "main.js": "M", "lib/conflict.js": "U" });
  assert.deepEqual(parseStatus(STATUS, "src/lib/"), { "added.js": "A", "conflict.js": "U" });
  assert.deepEqual(parseStatus(STATUS, "nothing/"), {});
});

test("parseStatus ignores junk and honours the limit", () => {
  assert.deepEqual(parseStatus("", ""), {});
  assert.deepEqual(parseStatus("\0\0", ""), {});
  assert.deepEqual(parseStatus("XX", ""), {});
  const many = Array.from({ length: 50 }, (_, i) => ` M f${i}.txt`).join("\0");
  assert.equal(Object.keys(parseStatus(many, "", 10)).length, 10);
});

test("bubble marks every ancestor folder; a conflict wins", () => {
  const marks = bubble(parseStatus(STATUS, ""));
  assert.equal(marks.src, "U"); // holds a conflict somewhere below
  assert.equal(marks["src/lib"], "U");
  assert.equal(marks.docs, "M");
  assert.equal(marks["docs/a b"], "M");
  assert.equal(marks.tools, "M");
  assert.equal(marks["README.md"], "M");
  assert.equal(marks.nothing, undefined);
  assert.deepEqual(bubble({}), {});
  assert.deepEqual(bubble({ "a.txt": "A" }), { "a.txt": "A" });
  assert.equal(bubble({ "a/b/c.txt": "D", "a/x.txt": "M" }).a, "M");
});

test("arrange sorts (folders first) before it cuts, over 600 mixed entries", () => {
  const entries = [];
  for (let i = 0; i < 520; i++) entries.push({ name: `file-${String(i).padStart(4, "0")}.txt`, dir: false });
  for (let i = 0; i < 80; i++) entries.push({ name: `dir-${String(i).padStart(3, "0")}`, dir: true });
  entries.push({ name: ".hidden", dir: false });
  const { list, limited } = arrange(entries, 500, 5000);
  assert.equal(list.length, 500);
  assert.equal(limited, true);
  assert.equal(list.slice(0, 80).every((e) => e.dir), true); // every folder made it
  assert.equal(list[80].dir, false);
  assert.equal(entries[0].name, "file-0000.txt"); // input untouched
  // The budget of what is left for all open folders:
  assert.equal(arrange(entries, 500, 30).list.length, 30);
  assert.equal(arrange(entries, 500, 30).limited, true);
  assert.deepEqual(arrange(entries, 500, 0).list, []);
  assert.deepEqual(arrange(entries, 500, -5).list, []);
  const small = arrange([{ name: "b", dir: false }, { name: "a", dir: false }, { name: "z", dir: true }], 500, 5000);
  assert.deepEqual(small.list.map((e) => e.name), ["z", "a", "b"]);
  assert.equal(small.limited, false);
});

test("platformMode: Windows previews, unless the folder is on a remote machine", () => {
  assert.equal(platformMode("windows", null), "preview");
  assert.equal(platformMode("windows", undefined), "preview");
  assert.equal(platformMode("windows", "vps"), "nvim");
  assert.equal(platformMode("macos", null), "nvim");
  assert.equal(platformMode("linux", null), "nvim");
});

test("nvimArgv puts the file in an argument, never in code", () => {
  const argv = nvimArgv("/usr/bin:/bin", 'exec nvim --listen "$1" -- "$2"', "/tmp/a.sock", "/p/it's \"x\" $(touch pwned).txt");
  assert.equal(argv[0], "sh");
  assert.equal(argv[1], "-c");
  assert.equal(argv[3], "sh");
  assert.equal(argv[4], "/usr/bin:/bin");
  assert.deepEqual(argv.slice(5), ["/tmp/a.sock", "/p/it's \"x\" $(touch pwned).txt"]);
  assert.ok(!argv[2].includes("pwned"));
  assert.ok(argv[2].includes('exec nvim --listen "$1"'));
  assert.equal(nvimArgv(null, "true")[4], ""); // no login PATH: the app's own stays
});

// Skipped on Windows: an MSYS sh there rewrites PATH and path-like arguments, which is not what nvim sees.
test("nvimArgv runs in a real sh (skipped where there is none)", { skip: process.platform === "win32" || spawnSync("sh", ["-c", "true"]).status !== 0 }, () => {
  const file = "/p/it's a \"quoted\" $(echo pwned) `echo pwned`.txt";
  const run = (pathValue) => {
    const argv = nvimArgv(pathValue, 'printf "%s\\n%s\\n%s" "$PATH" "$1" "$2"', "/tmp/s.sock", file);
    const r = spawnSync(argv[0], argv.slice(1), { encoding: "utf8", env: { PATH: process.env.PATH } });
    assert.equal(r.status, 0, r.stderr);
    return r.stdout.split("\n");
  };
  const [path, sock, got] = run("/custom/bin:/usr/bin:/bin");
  assert.equal(path, "/custom/bin:/usr/bin:/bin:" + process.env.PATH);
  assert.equal(sock, "/tmp/s.sock");
  assert.equal(got, file);
  assert.equal(run("")[0], process.env.PATH); // empty login PATH leaves the app's own
  // The login PATH goes in front; the inherited one stays behind it (a short profile PATH keeps sh and friends).
  assert.equal(run("/custom/bin")[0], "/custom/bin:" + process.env.PATH);
});

const scriptedExec = (calls, reply) => async (cmd, args, opts) => { calls.push({ cmd, args, opts }); return reply(cmd, args, opts); };

test("loginPath asks once per machine, uses the last line, retries after a failure", async () => {
  const calls = [];
  const exec = scriptedExec(calls, () => ({ code: 0, stdout: "welcome banner\n/opt/homebrew/bin:/usr/bin\n", stderr: "" }));
  assert.equal(await loginPath(exec, null), "/opt/homebrew/bin:/usr/bin");
  assert.equal(await loginPath(exec, undefined), "/opt/homebrew/bin:/usr/bin");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].cmd, "sh");
  assert.ok(calls[0].args[1].includes("printenv PATH"));
  assert.equal(await loginPath(exec, "devbox"), "/opt/homebrew/bin:/usr/bin");
  assert.equal(calls.length, 2);
  assert.equal(calls[1].opts.on, "devbox");
  // A failure is not remembered.
  let fail = true;
  const flaky = scriptedExec([], () => (fail ? { code: 1, stdout: "", stderr: "x" } : { code: 0, stdout: "/ok\n", stderr: "" }));
  assert.equal(await loginPath(flaky, "flaky"), null);
  fail = false;
  assert.equal(await loginPath(flaky, "flaky"), "/ok");
  const throwing = async () => { throw new Error("no sh"); };
  assert.equal(await loginPath(throwing, "nosh"), null);
});

test("nvimFound: yes is remembered, 127 is not found", async () => {
  const calls = [];
  const missing = scriptedExec(calls, (cmd, args) => (args[1]?.includes("command -v nvim") ? { code: 127, stdout: "", stderr: "" } : { code: 0, stdout: "/usr/bin\n", stderr: "" }));
  assert.equal(await nvimFound(missing, "m1"), false);
  assert.equal(await nvimFound(missing, "m1"), false);
  const present = scriptedExec([], (cmd, args) => (args[1]?.includes("command -v nvim") ? { code: 0, stdout: "", stderr: "" } : { code: 0, stdout: "/usr/bin\n", stderr: "" }));
  const seen = [];
  const counting = scriptedExec(seen, (cmd, args, o) => present(cmd, args, o));
  assert.equal(await nvimFound(counting, "m2"), true);
  const before = seen.length;
  assert.equal(await nvimFound(counting, "m2"), true);
  assert.equal(seen.length, before);
});

test("createPacer: a burst of requests is one run per gap, a request during a run is not lost", () => {
  let t = 0;
  const p = createPacer({ gap: 1500, now: () => t });
  // 100 requests while idle for the first time: the first runs, the rest are skipped while it runs.
  assert.equal(p.request(), "now");
  p.start();
  for (let i = 0; i < 100; i++) assert.equal(p.request(), "skip");
  t = 300; // the run took 300 ms
  assert.equal(p.finish(), true, "asked again meanwhile: one more run");
  // The trailing request must wait for the gap, and books itself once.
  assert.equal(p.request(true), "later");
  assert.equal(p.wait(), 1200);
  for (let i = 0; i < 50; i++) assert.equal(p.request(), "skip", "already booked");
  t = 1500;
  assert.equal(p.wait(), 0);
  assert.equal(p.request(true), "now");
  p.start();
  t = 1600;
  assert.equal(p.finish(), false, "nothing asked during that run");
  assert.equal(p.request(), "later");
});

test("createPacer: a long run is followed at once, a quiet watcher never waits", () => {
  let t = 0;
  const p = createPacer({ gap: 1500, now: () => t });
  assert.equal(p.request(), "now"); p.start();
  p.request(); // asked mid-run
  t = 4000; // the run took longer than the gap
  assert.equal(p.finish(), true);
  assert.equal(p.request(true), "now");
  p.start(); p.finish();
  t = 10000;
  assert.equal(p.request(), "now");
  assert.equal(REFRESH_GAP, 1500);
  assert.equal(p.busy, false);
});

// ---- what a click opens -------------------------------------------------------------------

test("fileKind: pictures, PDFs, documents and programs; anything else is text", () => {
  for (const f of ["a.png", "b.JPG", "c.jpeg", "d.gif", "e.webp", "f.svg", "g.tiff"]) assert.equal(fileKind(f), "image", f);
  assert.equal(fileKind("doc/Report.PDF"), "pdf");
  for (const f of ["a.docx", "b.zip", "c.mp4", "d.sqlite", "e.woff2", "setup.exe", "App.dmg", "x.jar"]) assert.equal(fileKind(f), "other", f);
  for (const f of ["main.rs", "README.md", "Makefile", ".env.example", "run.sh", "a.min.js", "noext"]) assert.equal(fileKind(f), "text", f);
});

test("canOpen refuses programs, and agrees with the viewer's copy", () => {
  const sample = ["a.pdf", "b.png", "c.docx", "d.sh", "e.app", "f.exe", "g.py", "h.md", "i.command", "j.jar", "k.txt", "l.js"];
  for (const f of sample) assert.equal(canOpen(f), viewerCanOpen(f), f);
  assert.equal(canOpen("x.sh"), false);
  assert.equal(canOpen("x.md"), true);
  for (const f of ["a.png", "b.pdf", "c.svg"]) assert.equal(viewKind(f) === null, fileKind(f) !== "image" && fileKind(f) !== "pdf", f);
});

test("systemOpen: open, xdg-open, rundll32 (never cmd), the file as an argument", () => {
  const f = "/p/a & b.docx";
  assert.deepEqual(systemOpen("macos", f), ["open", [f]]);
  assert.deepEqual(systemOpen("linux", f), ["xdg-open", [f]]);
  assert.deepEqual(systemOpen("windows", f), ["rundll32", ["url.dll,FileProtocolHandler", f]]);
});

test("parseDetect reads bin: and app: lines and ignores the rest", () => {
  assert.deepEqual(parseDetect("Welcome!\nbin:nvim\r\nbin:hx\napp:Zed\nbin:nvim\n"), { bins: ["nvim", "hx"], apps: ["Zed"] });
  assert.deepEqual(parseDetect(null), { bins: [], apps: [] });
});

test("editorChoices: what is installed, per machine and system", () => {
  const ids = (o) => editorChoices(o).map((e) => e.id);
  const found = { bins: ["nvim", "hx", "code"], apps: ["Zed"] };
  assert.deepEqual(ids({ platform: "macos", on: null, found }), ["nvim", "hx", "code", "zed", "default", "preview"]);
  assert.deepEqual(ids({ platform: "linux", on: null, found }), ["nvim", "hx", "code", "default", "preview"], "no macOS apps on Linux");
  assert.deepEqual(ids({ platform: "windows", on: null, found }), ["default", "preview"]);
  assert.deepEqual(ids({ platform: "windows", on: "devbox", found }), ["nvim", "hx", "preview"], "another machine: its terminal editors");
  assert.deepEqual(ids({ platform: "macos", on: null, found: null }), ["default", "preview"]);
});

test("pickEditor: the saved choice when offered, else nvim, else the default app, else a terminal editor, else the preview", () => {
  const of = (...list) => list.map((id) => EDITORS.find((e) => e.id === id));
  assert.equal(pickEditor("code", of("nvim", "code", "default", "preview")), "code");
  assert.equal(pickEditor("zed", of("nvim", "code", "default", "preview")), "nvim");
  assert.equal(pickEditor(undefined, of("code", "default", "preview")), "default");
  assert.equal(pickEditor(undefined, of("micro", "preview")), "micro");
  assert.equal(pickEditor("default", of("preview")), "preview");
});

test("appCommand and editorScript: the file is an argument, never code", () => {
  const f = "/p/$(touch pwned).txt";
  assert.deepEqual(appCommand("macos", "code", f), ["open", ["-a", "Visual Studio Code", f]]);
  assert.deepEqual(appCommand("linux", "zed", f), ["zed", [f]]);
  assert.equal(appCommand("macos", "nvim", f), null);
  assert.equal(appCommand("macos", "default", f), null);
  for (const e of EDITORS.filter((x) => x.term)) {
    const s = editorScript(e.id);
    assert.ok(s.includes('"$2"') && !s.includes("pwned"), e.id);
    assert.ok(s.startsWith(`exec ${e.id} `), e.id);
  }
  assert.ok(editorScript("nvim").includes('--listen "$1"'));
});

test("DETECT runs in a real sh and finds what is on PATH (skipped where there is none)", { skip: process.platform === "win32" || spawnSync("sh", ["-c", "true"]).status !== 0 }, () => {
  const r = spawnSync("sh", ["-c", DETECT], { encoding: "utf8", env: { PATH: process.env.PATH, HOME: "/nonexistent" } });
  assert.equal(r.status, 0, r.stderr);
  const got = parseDetect(r.stdout);
  for (const b of got.bins) assert.ok(EDITORS.some((e) => e.id === b), b);
  const none = spawnSync("sh", ["-c", DETECT], { encoding: "utf8", env: { PATH: "/nonexistent", HOME: "/nonexistent" } });
  assert.deepEqual(parseDetect(none.stdout).bins, [], "nothing on an empty PATH");
});

test("freeName follows the editor", () => {
  assert.equal(freeName(["hx"], "hx"), "hx-2");
  assert.equal(freeName([], "micro"), "micro");
});
