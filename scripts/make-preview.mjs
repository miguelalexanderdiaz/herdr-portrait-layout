#!/usr/bin/env node
// Draws the synthetic preview of the portrait layout: preview.png (1080x1920) and the two small
// thumbnails Settings shows (layouts/portrait.svg, layouts/portrait-bottom.svg).
//
// Everything on the picture is invented ("api", "web", "docs" spaces, a few made-up agent and tab names); nothing
// comes from a real window. Sizes follow layouts/portrait.json (bar 246px, tabs 42px, panes radius 10 / gap 8 /
// header 30px, status 28px); colors approximate Herdr's built-in "graphite" theme.
//
//   node scripts/make-preview.mjs            write the SVG files, then render preview.png when `rsvg-convert` is installed
//   node scripts/make-preview.mjs --svg-only write only the SVG files (also written to scripts/preview-source.svg)
//
// The committed preview.png is the deliverable; CI does not render it (check-assets.mjs only inspects it).
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { abs } from "./lib.mjs";

const C = {
  canvas: "#13151a", chrome: "#1a1d23", pane: "#0f1115", border: "#2a2e36", accent: "#a7b4c6",
  fg: "#d9dde4", muted: "#8e95a1", dim: "#5d6470", hover: "#232730",
  working: "#e2b765", blocked: "#e8737d", done: "#78c28b", idle: "#6a7280",
  s1: "#22a99a", s2: "#e3814f", s3: "#5b8def", s4: "#8b7cf6",
};
const UI = "Geist, 'Helvetica Neue', Helvetica, Arial, sans-serif";
const MONO = "'JetBrains Mono', Menlo, Consolas, 'DejaVu Sans Mono', monospace";
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const W = 1080, H = 1920;
const BAR = 246, TABS = 42, STATUS = 28, STRIP = 26;

const text = (x, y, s, { size = 12, fill = C.fg, weight = 400, font = UI, anchor = "start", opacity = 1 } = {}) =>
  `<text x="${x}" y="${y}" font-family="${font}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}" opacity="${opacity}">${esc(s)}</text>`;
const rect = (x, y, w, h, fill, { r = 0, stroke, sw = 1 } = {}) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}"${stroke ? ` stroke="${stroke}" stroke-width="${sw}"` : ""}/>`;

// Status glyph, 14px box with its top-left at (x, y).
function glyph(x, y, status) {
  const cx = x + 7, cy = y + 7;
  if (status === "working") return `<circle cx="${cx}" cy="${cy}" r="5.2" fill="none" stroke="${C.working}" stroke-width="1.6" stroke-opacity=".25"/><path d="M${cx} ${cy - 5.2}A5.2 5.2 0 0 1 ${cx + 5.2} ${cy}" fill="none" stroke="${C.working}" stroke-width="1.8" stroke-linecap="round"/>`;
  if (status === "blocked") return rect(x, y, 14, 14, C.blocked + "40", { r: 4 }) + text(cx, cy + 4, "!", { size: 10.5, fill: C.blocked, weight: 700, anchor: "middle" });
  if (status === "done") return `<circle cx="${cx}" cy="${cy}" r="3.5" fill="${C.done}"/>`;
  return `<circle cx="${cx}" cy="${cy}" r="3" fill="none" stroke="${C.idle}" stroke-width="1.4"/>`;
}

function barStrip(x0, y0, w) {
  let o = rect(x0, y0, w, STRIP, C.chrome) + rect(x0, y0 + STRIP - 1, w, 1, C.border);
  const btn = (x, label, wd) => rect(x, y0 + 3, wd, 20, "none", { r: 5, stroke: C.border }) + text(x + 8, y0 + 17, label, { size: 11.5, fill: C.muted });
  o += btn(x0 + 8, "Search", 56) + btn(x0 + 68, "Add machine", 84) + btn(x0 + 156, "Settings", 60);
  // bell chip with a count, then the panel buttons
  const bx = x0 + w - 8 - 62 - 62 - 4 - 4 - 96;
  o += rect(bx, y0 + 3, 96, 20, C.blocked + "26", { r: 5 }) + text(bx + 11, y0 + 17, "1 · Needs you", { size: 11.5, fill: C.blocked, weight: 600 });
  o += btn(x0 + w - 8 - 62 - 62 - 4, "Files", 62) + btn(x0 + w - 8 - 62, "Changes", 62);
  return o;
}

// One space column of the tree. `rows`: [indent, label, status|null, kind]
function column(x, y, w, h, space, active) {
  let o = rect(x, y, w, h, "none") + rect(x + w - 1, y, 1, h, C.border);
  const color = space.color;
  o += rect(x + 10, y + 10, 18, 18, color, { r: 5 }) + text(x + 19, y + 23, space.name[0].toUpperCase(), { size: 10.5, fill: "#10141a", weight: 700, anchor: "middle" });
  o += text(x + 38, y + 24, space.name, { size: 15, weight: 600, fill: active ? C.fg : C.muted });
  const nameW = space.name.length * 8.4;
  o += rect(x + 38, y + 29, nameW, 2, active ? color : color + "73", { r: 1 });
  // counts + plus
  o += text(x + w - 44, y + 24, space.counts, { size: 11, fill: C.muted, anchor: "end" });
  o += `<path d="M${x + w - 24} ${y + 19.5}h9M${x + w - 19.5} ${y + 15}v9" stroke="${C.dim}" stroke-width="1.6" stroke-linecap="round"/>`;
  let ry = y + 50;
  for (const row of space.rows) {
    if (row.tab) {
      o += text(x + 14, ry + 4, "▾", { size: 9, fill: C.dim });
      o += text(x + 28, ry + 4, row.tab, { size: 12, weight: 500, fill: row.shown ? C.fg : C.muted });
      ry += 22;
      for (const p of row.panes) {
        o += text(x + 34, ry + 4, "└", { size: 12, fill: C.dim, font: MONO });
        if (p.status) o += glyph(x + 48, ry - 7, p.status);
        else o += `<path d="M${x + 49} ${ry - 4}l3 3-3 3M${x + 54} ${ry + 2}h4" fill="none" stroke="${C.dim}" stroke-width="1.3" stroke-linecap="round"/>`;
        o += text(x + 68, ry + 4, p.label, { size: 12, fill: p.status ? C.fg : C.muted });
        if (p.age) o += text(x + w - 14, ry + 4, p.age, { size: 10.5, fill: p.status === "blocked" ? C.blocked : C.dim, anchor: "end" });
        ry += 22;
      }
    }
  }
  return o;
}

function spine(x, y, w, h, name, color) {
  return rect(x, y, w, h, "none") + rect(x + w - 1, y, 1, h, C.border) +
    rect(x + 8, y + 12, 18, 18, color, { r: 5 }) + text(x + 17, y + 25, name[0].toUpperCase(), { size: 10.5, fill: "#10141a", weight: 700, anchor: "middle" }) +
    `<g transform="translate(${x + 21} ${y + 46}) rotate(90)">${text(0, 0, name, { size: 13, weight: 500, fill: C.muted })}</g>`;
}

const SPACES = [
  { name: "api", color: C.s1, counts: "! 1  ⟳ 1", rows: [
    { tab: "Tab 1", shown: true, panes: [{ label: "claude", status: "working", age: "2m" }, { label: "~/code/api", status: null }] },
    { tab: "tests", panes: [{ label: "codex", status: "blocked", age: "6m" }] },
  ] },
  { name: "web", color: C.s2, counts: "⟳ 1", rows: [
    { tab: "Tab 1", panes: [{ label: "gemini", status: "working", age: "40s" }, { label: "~/code/web", status: null }] },
    { tab: "storybook", panes: [{ label: "~/code/web", status: null }] },
  ] },
  { name: "docs", color: C.s3, counts: "", rows: [
    { tab: "Tab 1", panes: [{ label: "claude", status: "done", age: "14m" }] },
  ] },
];

function terminalPane(x, y, w, h, o) {
  let s = rect(x, y, w, h, C.pane, { r: 10, stroke: o.focus ? C.accent : C.border, sw: 1 });
  s += `<path d="M${x} ${y + 30}h${w}" stroke="${C.border}"/>`;
  s += glyph(x + 12, y + 8, o.status ?? "idle") + text(x + 34, y + 20, o.title, { size: 12.5, weight: 500 });
  if (o.status === "blocked") s += rect(x + 34 + o.title.length * 7.4 + 8, y + 6, 66, 18, C.blocked + "26", { r: 5 }) + text(x + 34 + o.title.length * 7.4 + 41, y + 19, "Needs you", { size: 10.5, fill: C.blocked, weight: 600, anchor: "middle" });
  const ix = x + w - 20 - 4 * 26, iy = y + 8;
  const ic = (dx, d) => `<path transform="translate(${ix + dx} ${iy})" d="${d}" fill="none" stroke="${C.dim}" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>`;
  s += ic(0, "M2 2h12v12H2zM8 2v12") + ic(26, "M2 2h12v12H2zM2 8h12") + ic(52, "M9.5 2.5h4v4M6.5 13.5h-4v-4M13.5 2.5 9 7M2.5 13.5 7 9") + ic(78, "M4 4l8 8M12 4l-8 8");
  o.lines.forEach((l, i) => { s += text(x + 18, y + 56 + i * 20, l.t, { size: 13, font: MONO, fill: l.c ?? C.fg }); });
  return s;
}

function mock(variant) {
  const top = variant === "top";
  const barY = top ? 0 : H - STATUS - BAR, workY = top ? BAR : 0;
  const workH = H - BAR - STATUS;
  let o = rect(0, 0, W, H, C.canvas);
  // bar
  o += rect(0, barY, W, BAR, C.chrome) + rect(0, barY + (top ? BAR - 1 : 0), W, 1, C.border);
  o += barStrip(0, barY, W);
  const ty = barY + STRIP;
  const th = BAR - STRIP - 1;
  const cw = 262;
  SPACES.forEach((s, i) => { o += column(i * cw, ty, cw, th, s, i === 0); });
  o += spine(3 * cw, ty, 34, th, "infra", C.s4);
  o += `<path d="M${3 * cw + 17} ${ty + th - 20}v-8M${3 * cw + 13} ${ty + th - 24}l-4 4 4 4" fill="none" stroke="${C.dim}" stroke-width="1.4"/>`;
  o += rect(3 * cw + 34 + 12, ty + 10, 90, 22, "none", { r: 6, stroke: C.border }) + text(3 * cw + 34 + 22, ty + 25, "+ New space", { size: 11.5, fill: C.muted });
  // tabs
  o += rect(0, workY, W, TABS, C.canvas) + rect(0, workY + TABS - 1, W, 1, C.border);
  o += rect(10, workY + 7, 96, 28, C.hover, { r: 8 }) + text(26, workY + 26, "Tab 1", { size: 13, weight: 500 }) + `<path d="M88 ${workY + 17}l7 7m0-7l-7 7" stroke="${C.dim}" stroke-width="1.3" stroke-linecap="round"/>`;
  o += text(130, workY + 26, "tests", { size: 13, fill: C.muted }) + text(190, workY + 26, "logs", { size: 13, fill: C.muted });
  o += text(250, workY + 27, "+", { size: 18, fill: C.muted });
  o += text(W - 120, workY + 26, "−    □    ✕", { size: 14, fill: C.dim });
  // panes (two cards stacked, as a down split)
  const px = 8, pw = W - 16, py = workY + TABS + 8, gap = 8;
  const total = workH - TABS - 16;
  const h1 = Math.round((total - gap) * 0.56), h2 = total - gap - h1;
  o += terminalPane(px, py, pw, h1, { focus: true, status: "working", title: "claude", lines: [
    { t: "> add pagination to the /items endpoint", c: C.muted },
    { t: "" },
    { t: "● Reading src/items/list.ts" },
    { t: "● Reading src/items/query.ts" },
    { t: "● Editing src/items/list.ts", c: C.working },
    { t: "    + const page = Math.max(1, Number(req.query.page ?? 1));", c: C.done },
    { t: "    + const size = Math.min(100, Number(req.query.size ?? 25));", c: C.done },
    { t: "    - return db.items.all();", c: C.blocked },
    { t: "    + return db.items.page({ page, size });", c: C.done },
    { t: "" },
    { t: "● Running the tests…" },
    { t: "" },
    { t: "● Test run finished: 1 failure in src/items/page.test.ts", c: C.working },
    { t: "  page.test.ts expects the default page size to be 25;" },
    { t: "  the query helper still defaults to 100." },
    { t: "" },
    { t: "● Editing src/items/query.ts", c: C.working },
    { t: "    - const DEFAULT_SIZE = 100;", c: C.blocked },
    { t: "    + const DEFAULT_SIZE = 25;", c: C.done },
    { t: "" },
    { t: "● Running the tests…" },
  ] });
  o += terminalPane(px, py + h1 + gap, pw, h2, { title: "~/code/api", lines: [
    { t: "$ npm test", c: C.muted },
    { t: "" },
    { t: " PASS  src/items/list.test.ts" },
    { t: " PASS  src/items/query.test.ts" },
    { t: " FAIL  src/items/page.test.ts", c: C.blocked },
    { t: "   expected 25 items, received 100", c: C.blocked },
    { t: "" },
    { t: "Tests: 1 failed, 14 passed", c: C.muted },
    { t: "$ ", c: C.fg },
  ] });
  // status
  const sy = H - STATUS;
  o += rect(0, sy, W, STATUS, C.chrome) + rect(0, sy, W, 1, C.border);
  o += text(12, sy + 18, "api · main  ↑1", { size: 11.5, fill: C.muted }) + text(W - 12, sy + 18, "3 agents working · 1 needs you", { size: 11.5, fill: C.muted, anchor: "end" });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${o}</svg>\n`;
}

// Thumbnail for Settings: wireframe of the same layout at 1/5 scale (216x384).
function thumb(variant) {
  const top = variant === "top";
  const s = 0.2, w = W * s, h = H * s;
  const bar = BAR * s, tabs = TABS * s, st = STATUS * s;
  const bY = top ? 0 : h - st - bar, wY = top ? bar : 0;
  let o = rect(0, 0, w, h, C.canvas) + rect(0, bY, w, bar, C.chrome);
  const cw = 262 * s;
  [C.s1, C.s2, C.s3].forEach((c, i) => { o += rect(i * cw + 4, bY + 6, 8, 8, c, { r: 2 }) + rect(i * cw + 16, bY + 8, 26, 4, C.muted, { r: 2 }) + rect(i * cw + 8, bY + 20, 36, 3, C.dim, { r: 1.5 }) + rect(i * cw + 12, bY + 28, 30, 3, C.dim, { r: 1.5 }) + rect(i * cw + 12, bY + 36, 24, 3, C.dim, { r: 1.5 }); });
  o += rect(3 * cw + 4, bY + 6, 7, bar - 12, C.s4 + "80", { r: 2 });
  o += rect(0, wY, w, tabs, C.canvas) + rect(4, wY + 2, 20, 5, C.hover, { r: 2 });
  const py = wY + tabs + 2, ph = h - bar - tabs - st - 4;
  const h1 = Math.round((ph - 2) * 0.56);
  o += rect(2, py, w - 4, h1, C.pane, { r: 2, stroke: C.accent, sw: 0.6 }) + rect(2, py + h1 + 2, w - 4, ph - h1 - 2, C.pane, { r: 2, stroke: C.border, sw: 0.6 });
  o += rect(0, h - st, w, st, C.chrome);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${o}</svg>\n`;
}

writeFileSync(abs("layouts/portrait.svg"), thumb("top"));
writeFileSync(abs("layouts/portrait-bottom.svg"), thumb("bottom"));
const full = mock("top");
writeFileSync(abs("scripts/preview-source.svg"), full);
console.log("wrote layouts/portrait.svg, layouts/portrait-bottom.svg, scripts/preview-source.svg");

if (!process.argv.includes("--svg-only")) {
  try {
    execFileSync("rsvg-convert", ["-w", String(W), "-h", String(H), "-o", abs("preview.png"), abs("scripts/preview-source.svg")]);
    console.log("rendered preview.png");
  } catch {
    console.log("rsvg-convert not found: kept the committed preview.png (render scripts/preview-source.svg yourself to change it)");
  }
}
