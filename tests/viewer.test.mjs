// portrait-viewer: the picture cache (mods/portrait-viewer/logic.mjs) with a fake exec and fs.
import { test } from "node:test";
import { LIN } from "./fake-home.mjs";
import assert from "node:assert/strict";
import { createViewer, pruneList, parseStamp, viewKind, REL, PDF_MAX_PAGES } from "../mods/portrait-viewer/logic.mjs";

// A 1x1 PNG header (the size is all imageInfo reads) and a tiny SVG.
const png = (w, h) => { const b = new Uint8Array(32); b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]); new DataView(b.buffer).setUint32(16, w); new DataView(b.buffer).setUint32(20, h); return b; };

function world({ platform = "linux", tools = {}, files = {} } = {}) {
  const disk = new Map(Object.entries(files)), calls = [];
  const fs = {
    readFile: async (p) => { if (!disk.has(p)) throw new Error("ENOENT " + p); return disk.get(p); },
    readText: async (p) => { if (!disk.has(p)) throw new Error("ENOENT"); return String(disk.get(p)); },
    writeFile: async (p, d) => { disk.set(p, d); },
    mkdir: async () => {}, unlink: async (p) => { disk.delete(p); }, rmdir: async () => {},
    readdir: async (dir) => [...disk.keys()].filter((k) => k.startsWith(dir + "/")).map((k) => k.slice(dir.length + 1)).filter((k) => !k.includes("/")),
  };
  const exec = async (cmd, args) => {
    calls.push([cmd, args]);
    const name = cmd.split("/").pop();
    if (args?.[0] === "-v" || args?.[0] === "--version") return tools[name] ? { code: 0, stdout: "" } : Promise.reject(new Error("not found"));
    if (name === "stat") return { code: 0, stdout: args.slice(2).map((p) => `1700000000:10 ${p}`).join("\n") };
    if (name === "pdfinfo") return { code: 0, stdout: `Title: x\nPages:          ${tools.pages ?? 3}\n` };
    if (name === "pdftoppm") { const out = args.at(-1); disk.set(`${out}.png`, png(1224, 1584)); return { code: 0, stdout: "" }; }
    if (name === "sh" || name === "where") return { code: 1, stdout: "" };
    return { code: 0, stdout: "" };
  };
  const v = createViewer({ exec, fs, appHome: "/app", home: `${LIN}`, platform, now: () => 1_800_000_000_000 });
  return { v, disk, calls };
}

test("viewKind: pictures and PDFs only", () => {
  assert.equal(viewKind("a/b.PNG"), "image");
  assert.equal(viewKind("x.pdf"), "pdf");
  assert.equal(viewKind("x.md"), null);
  assert.equal(viewKind(null), null);
});

test("a picture is copied into the cache at its pixel size, once", async () => {
  const { v, disk } = world({ files: { [`${LIN}/p/logo.png`]: png(640, 480) } });
  const st = await v.stamp(`${LIN}/p/logo.png`);
  assert.equal(st, "1700000000:10");
  const a = await v.image(`${LIN}/p/logo.png`, st);
  assert.equal(a.w, 640); assert.equal(a.h, 480);
  assert.ok(a.path.startsWith(`${REL}/`) && a.path.endsWith(".png"));
  assert.ok(disk.has(`/app/${a.path}`));
  disk.delete(`${LIN}/p/logo.png`);
  assert.deepEqual(await v.image(`${LIN}/p/logo.png`, st), a, "the second time comes from the cache");
});

test("not a picture: the error is cached until the file changes", async () => {
  const { v } = world({ files: { [`${LIN}/p/bad.png`]: new Uint8Array(40) } });
  const a = await v.image(`${LIN}/p/bad.png`, "1:40");
  assert.match(a.error, /Not a picture/);
  assert.match((await v.image(`${LIN}/p/bad.png`, "1:40")).error, /Not a picture/);
});

test("PDF pages: pdfinfo counts, pdftoppm draws each at 2x; without Poppler the hint, not cached", async () => {
  const yes = world({ tools: { pdfinfo: true, pdftoppm: true, pages: 3 } });
  assert.deepEqual(await yes.v.pdfInfo(`${LIN}/a.pdf`, "1:2"), { pages: 3 });
  const p2 = await yes.v.pdfPage(`${LIN}/a.pdf`, "1:2", 2);
  assert.deepEqual([p2.w, p2.h], [612, 792]);
  const draw = yes.calls.find(([c, args]) => c === "pdftoppm" && args[0] === "-png");
  assert.deepEqual(draw[1].slice(0, 7), ["-png", "-r", "144", "-f", "2", "-l", "2"]);
  assert.equal(draw[1][8], `${LIN}/a.pdf`, "the file is an argument");
  const no = world({ platform: "linux" });
  const info = await no.v.pdfInfo(`${LIN}/a.pdf`, "1:2");
  assert.equal(info.missing, "poppler");
  assert.match(info.error, /Poppler/);
  assert.equal((await no.v.quickLook(`${LIN}/a.pdf`, "1:2")).missing, "poppler", "Quick Look is macOS only");
  assert.ok(PDF_MAX_PAGES >= 100);
});

test("prune drops old entries and the oldest past the size limit", () => {
  const now = 100 * 86_400_000;
  const files = [
    { name: "a.png", ms: 0, size: 10 }, { name: "a.json", ms: 0, size: 1 },
    { name: "b.png", ms: now - 1000, size: 300 }, { name: "b.json", ms: now - 1000, size: 1 },
    { name: "c.png", ms: now - 500, size: 300 }, { name: "c.json", ms: now - 500, size: 1 },
  ];
  assert.deepEqual(pruneList(files, now, 30 * 86_400_000, 400), ["a.json", "a.png", "b.json", "b.png"]);
  assert.deepEqual(parseStamp("1700000000:12"), { ms: 1_700_000_000_000, size: 12 });
});

test("openOutside: Preview on macOS, the default app elsewhere", async () => {
  const mac = world({ platform: "macos" });
  await mac.v.openOutside(`${LIN}/a.pdf`);
  assert.deepEqual(mac.calls.at(-1), ["open", ["-a", "Preview", `${LIN}/a.pdf`]]);
  const lin = world({ platform: "linux" });
  await lin.v.openOutside(`${LIN}/a.pdf`);
  assert.deepEqual(lin.calls.at(-1), ["xdg-open", [`${LIN}/a.pdf`]]);
});
