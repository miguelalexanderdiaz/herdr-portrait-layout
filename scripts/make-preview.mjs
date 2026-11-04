#!/usr/bin/env node
// Draws every picture of this repository from the parts the layout really uses, with made-up content:
//   preview.png (1080x1920, rendered from scripts/preview-source.svg), its copy docs/assets/preview.png,
//   the two Settings thumbnails (layouts/portrait.svg, layouts/portrait-bottom.svg, 320x200),
//   and one picture per feature in docs/assets/pictures/ (used by docs/ and README.md).
//
// Drawn from the real parts, not captured:
//   - Geometry: layouts/portrait*.json (bar 246 px = strip 26 + tree, tabs 42, work-body padding 8 / gap 8, pane
//     radius 10 / border 1 / focus 1 accent / header 30, status 28, side panel 368 with padding 8, 1 px dividers) and
//     the mods' own drawing code (row heights, paddings, gaps, font sizes, colors by theme name, what each row shows
//     and in which order). Each function below names the mod code it follows.
//   - Icons: the mods' own SVG files (mods/*/*.svg), and, copied in scripts/picture-icons/, the Herdr program icons
//     the made-up content uses (claude, codex, gemini, nvim, shell) and the Vault mod's book-open (NOTICE, section 7).
//     They are inlined as <symbol>s: no <image>, no external reference.
//   - Colors: Herdr's built-in "graphite" theme (the layouts pin no theme, so a new install shows graphite).
//     EXACT: the theme colors in G below are what theme() returns on Herdr 0.1.12 with graphite (read through a mod);
//     the space marks (MARK) are portrait-tree's own constants.
//   - APPROXIMATED: text widths (a Helvetica width table: Geist, Herdr's UI font, is not available to the renderer,
//     so the pictures use Geist when installed and Helvetica or Arial otherwise); the frames Herdr draws around
//     windows, dialogs and popups (radius, shadow); the status line (Herdr's shipped workspace-status mod, not in this
//     repository); which colors Herdr's space list gives new spaces (here: the marks in order); program names
//     ("Claude Code", "Codex", "Gemini", "Neovim"); and what the terminals show (Claude Code, a shell, nvim).
//   - Content: invented ("api", "web", "docs", "infra" spaces; made-up tabs, agent titles, files and times).
//
//   node scripts/make-preview.mjs            write every SVG, then render preview.png when `rsvg-convert` is installed
//   node scripts/make-preview.mjs --svg-only write only the SVG files
//
// The committed preview.png is the deliverable; CI does not render it (check-assets.mjs only inspects it, and compares
// scripts/preview.sha256, written when rsvg-convert rendered it, with the hash of scripts/preview-source.svg). CI does
// run --svg-only and fails when layouts/ or scripts/preview-source.svg differ from what this script writes.
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { abs, sha256 } from "./lib.mjs";

// ---- theme: graphite (exact, see above) ---------------------------------------------------------------------------
const G = {
  accent: "#96b2d7", background: "#17191d", blocked: "#f0705f", border: "#ffffff18", canvas: "#131518", chrome: "#101114",
  dim: "#696a6d", done: "#76a8ff", foreground: "#eeeeef", hover: "#ffffff0e", idle: "#696a6d", muted: "#98999b",
  popover: "#25272b", raised: "#2c2e31", selected: "#ffffff17", working: "#e5c07b", input: "#ffffff24",
  terminal: "#d2d4d9", ansi1: "#dc8c95", ansi2: "#a6bd91", ansi3: "#d8be87", ansi4: "#96b2d7", ansi5: "#b5a2ce",
  ansi6: "#8cbdc3", ansi8: "#818793",
};
// portrait-tree's space marks (MARK in mods/portrait-tree/main.js).
const MARK = { ansi6: "#22a99a", ansi3: "#e3814f", ansi4: "#5b8def", ansi5: "#8b7cf6", ansi2: "#3fae6a", ansi1: "#d9649a" };

const UI = "Geist, 'Helvetica Neue', Helvetica, Arial, sans-serif";
const MONO = "'JetBrains Mono', Menlo, Consolas, 'DejaVu Sans Mono', monospace";

// ---- colors (the same arithmetic as mods/portrait-tree/logic.mjs) --------------------------------------------------
const rgb = (h) => { const n = parseInt(/^#?([0-9a-f]{6})/i.exec(h)[1], 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const hex = (c) => "#" + c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");
const mix = (a, b, k) => hex(rgb(a).map((v, i) => v + (rgb(b)[i] - v) * k));
const lum = (h) => { const l = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; const [r, g, b] = rgb(h); return 0.2126 * l(r) + 0.7152 * l(g) + 0.0722 * l(b); };
const inkOn = (h) => (1.05 / (lum(h) + 0.05) >= (lum(h) + 0.05) / (0.007 + 0.05) ? "#ffffff" : "#141414");
const alpha = (c, a) => c.slice(0, 7) + Math.round(a * 255).toString(16).padStart(2, "0");
// "#rrggbbaa" as an SVG paint: the color and its opacity as separate attributes (every renderer reads those).
function paint(attr, c) {
  if (!c || c === "none") return `${attr}="none"`;
  if (c.length === 9) return `${attr}="${c.slice(0, 7)}" ${attr}-opacity="${+(parseInt(c.slice(7), 16) / 255).toFixed(3)}"`;
  return `${attr}="${c}"`;
}

// ---- text ------------------------------------------------------------------------------------------------------------
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
// Helvetica advance widths (1/1000 em), for laying out labels; anything missing counts as 0.6 em.
const AFM = {
  " ": 278, a: 556, b: 556, c: 500, d: 556, e: 556, f: 278, g: 556, h: 556, i: 222, j: 222, k: 500, l: 222, m: 833, n: 556,
  o: 556, p: 556, q: 556, r: 333, s: 500, t: 278, u: 556, v: 500, w: 722, x: 500, y: 500, z: 500, A: 667, B: 667, C: 722,
  D: 722, E: 667, F: 611, G: 778, H: 722, I: 278, J: 500, K: 667, L: 556, M: 833, N: 722, O: 778, P: 667, Q: 778, R: 722,
  S: 667, T: 611, U: 722, V: 667, W: 944, X: 667, Y: 667, Z: 611, ".": 278, ",": 278, "-": 333, ":": 278, "/": 278,
  "~": 584, "(": 333, ")": 333, "·": 278, "!": 278, "_": 556, "'": 191, "+": 584, "<": 584, "↑": 600, "↓": 600, "–": 556, "…": 1000,
};
const width = (s, size, weight = 400) => [...String(s)].reduce((n, ch) => n + (/\d/.test(ch) ? 556 : AFM[ch] ?? 600), 0) / 1000 * size * (weight >= 700 ? 1.07 : weight >= 600 ? 1.05 : weight >= 500 ? 1.02 : 1);
const monoWidth = (s, size) => [...String(s)].length * size * 0.6;

const text = (x, y, s, { size = 12, fill = G.foreground, weight = 400, font = UI, anchor = "start" } = {}) =>
  `<text x="${r2(x)}" y="${r2(y)}" class="${font === MONO ? "m" : "u"}" font-size="${size}"${weight !== 400 ? ` font-weight="${weight}"` : ""} ${paint("fill", fill)}${anchor !== "start" ? ` text-anchor="${anchor}"` : ""}>${esc(s)}</text>`;
// Text set on a row whose vertical centre is cy.
const textMid = (x, cy, s, o = {}) => text(x, cy + (o.size ?? 12) * 0.36, s, o);
// Text clipped to `w` px with an ellipsis (truncate()), from the end or, for paths, from the start.
function fit(s, size, w, { weight = 400, mono = false, start = false } = {}) {
  const m = (v) => (mono ? monoWidth(v, size) : width(v, size, weight));
  if (m(s) <= w) return s;
  let t = [...s];
  while (t.length > 1 && m((start ? "…" : "") + t.join("") + (start ? "" : "…")) > w) start ? t.shift() : t.pop();
  return start ? "…" + t.join("") : t.join("") + "…";
}
const r2 = (v) => +(+v).toFixed(2);
// Ids for clip paths, unique within a document (a picture may hold the window twice).
let uidN = 0;
const uid = (k) => `${k}-${++uidN}`;

// ---- shapes ------------------------------------------------------------------------------------------------------------
const rect = (x, y, w, h, fill, { r = 0, stroke, sw = 1 } = {}) =>
  `<rect x="${r2(x)}" y="${r2(y)}" width="${r2(w)}" height="${r2(h)}"${r ? ` rx="${r}"` : ""} ${paint("fill", fill)}${stroke ? ` ${paint("stroke", stroke)} stroke-width="${sw}"` : ""}/>`;
// A box with a 1 px border drawn inside it (as GPUI draws borders).
const boxed = (x, y, w, h, fill, border, r = 0, sw = 1) => rect(x + sw / 2, y + sw / 2, w - sw, h - sw, fill, { r: Math.max(0, r - sw / 2), stroke: border, sw });
const hline = (x, y, w, c = G.border) => rect(x, y, w, 1, c);
const vline = (x, y, h, c = G.border) => rect(x, y, 1, h, c);

// ---- icons ----------------------------------------------------------------------------------------------------------------
const ICONS = {
  search: "mods/bar-strip/search.svg", server: "mods/bar-strip/server.svg", settings: "mods/bar-strip/settings.svg",
  bell: "mods/bar-strip/bell.svg", file: "mods/bar-strip/file.svg", changes: "mods/bar-strip/changes.svg",
  spinner: "mods/portrait-tree/spinner.svg", fold: "mods/portrait-tree/fold.svg", plus: "mods/portrait-tree/plus.svg",
  "chevron-right": "mods/portrait-files/chevron-right.svg", "chevron-down": "mods/portrait-files/chevron-down.svg",
  folder: "mods/portrait-files/folder.svg", close: "mods/portrait-tabs/close.svg",
  "split-right": "mods/portrait-pane/split-right.svg", "split-down": "mods/portrait-pane/split-down.svg", zoom: "mods/portrait-pane/zoom.svg",
  "book-open": "scripts/picture-icons/book-open.svg", claude: "scripts/picture-icons/claude.svg", codex: "scripts/picture-icons/codex.svg",
  gemini: "scripts/picture-icons/gemini.svg", nvim: "scripts/picture-icons/nvim.svg", shell: "scripts/picture-icons/shell.svg",
};
// A program from Herdr's program table: a one-color glyph tinted like text (tint), or a picture in its own colors.
const PROGRAM = {
  claude: { name: "Claude Code", icon: "claude", tint: false, agent: true },
  codex: { name: "Codex", icon: "codex", tint: false, agent: true },
  gemini: { name: "Gemini", icon: "gemini", tint: true, agent: true },
  nvim: { name: "Neovim", icon: "nvim", tint: true },
  zsh: { name: "zsh", icon: "shell", tint: true, shell: true },
};
function symbolOf(name) {
  const src = readFileSync(abs(ICONS[name]), "utf8");
  const root = /<svg\b([^>]*)>/i.exec(src)[1];
  const attr = (k) => new RegExp(`\\s${k}\\s*=\\s*"([^"]*)"`).exec(root)?.[1];
  const inner = src.slice(src.indexOf(">", src.search(/<svg\b/i)) + 1, src.lastIndexOf("</svg>"))
    .replace(/<title>[\s\S]*?<\/title>/g, "").replace(/\s+class="[^"]*"/g, "").replace(/>\s+</g, "><").trim();
  const g = ["fill", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin"].map((k) => (attr(k) ? ` ${k}="${attr(k)}"` : "")).join("");
  return `<symbol id="i-${name}" viewBox="${attr("viewBox") ?? "0 0 24 24"}"><g${g.includes("fill=") ? g : ` fill="currentColor"${g}`}>${inner}</g></symbol>`;
}
// Each document collects the symbols it uses.
let used = new Set();
const icon = (name, x, y, size, color) => { used.add(name); return `<use href="#i-${name}" x="${r2(x)}" y="${r2(y)}" width="${size}" height="${size}"${color ? ` color="${color.slice(0, 7)}"` : ""}${color?.length === 9 ? ` opacity="${+(parseInt(color.slice(7), 16) / 255).toFixed(3)}"` : ""}/>`; };
const programIcon = (p, x, y, size, tint) => icon(p.icon, x, y, size, p.tint ? tint : undefined);
function svgDoc(w, h, body, { scale = 1 } = {}) {
  const defs = [...used].sort().map(symbolOf).join("");
  used = new Set();
  uidN = 0;
  // The two font stacks as classes (shorter than repeating them on every text); mono text keeps its spaces.
  const style = `<style>.u{font-family:${UI.replace(/'/g, '"')}}.m{font-family:${MONO.replace(/'/g, '"')};white-space:pre}</style>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${r2(w * scale)}" height="${r2(h * scale)}" viewBox="0 0 ${r2(w)} ${r2(h)}">${style}${defs ? `<defs>${defs}</defs>` : ""}${body}</svg>\n`;
}

// ---- state glyphs (portrait-tree glyph(): spinner 12, "!" box 14, dots 7 with 3 px margins) -------------------------------
function glyph(x, cy, status) { // x: left edge of the glyph
  if (status === "working") return { w: 12, s: icon("spinner", x, cy - 6, 12, G.working) };
  if (status === "blocked") return { w: 14, s: rect(x, cy - 7, 14, 14, alpha(G.blocked, 0.15), { r: 4 }) + text(x + 7, cy + 3.8, "!", { size: 10.5, weight: 700, fill: G.blocked, anchor: "middle" }) };
  if (status === "done") return { w: 13, s: `<circle cx="${r2(x + 6.5)}" cy="${r2(cy)}" r="3.5" ${paint("fill", G.done)}/>` };
  return { w: 13, s: `<circle cx="${r2(x + 6.5)}" cy="${r2(cy)}" r="2.75" fill="none" ${paint("stroke", G.idle)} stroke-width="1.5"/>` };
}
const glyphH = { working: 12, blocked: 14, done: 7, idle: 7 };
const centred = (x, w, cy, status) => { const g = glyph(0, 0, status); return glyph(x + (w - g.w) / 2, cy, status).s; };
const WORD = { blocked: "needs you", done: "done", working: "working", idle: "idle" };

// ---- made-up content -------------------------------------------------------------------------------------------------------
// Agents: program, title (the session's name), state, minutes in that state. Panes without an agent: program, folder.
const SPACES = [
  { name: "api", mark: "ansi6", active: true, tabs: [
    { name: "server", active: true, rows: [
      { agent: "claude", title: "add pagination", status: "working", age: "4m", focused: true },
      { program: "zsh", cwd: "~/code/api" },
    ] },
    { name: "tests", rows: [
      { agent: "codex", title: "flaky page test", status: "blocked", age: "6m" },
      { program: "nvim", cwd: "~/code/api/src" },
    ] },
  ] },
  { name: "web", mark: "ansi3", tabs: [
    { name: "ui", rows: [{ agent: "gemini", title: "dark mode toggle", status: "idle", age: "38m" }, { program: "zsh", cwd: "~/code/web" }] },
    { name: "dev server", rows: [{ program: "zsh", cwd: "~/code/web" }] },
  ] },
  { name: "docs", mark: "ansi4", tabs: [
    { name: "release notes", rows: [{ agent: "claude", title: "draft 0.4 notes", status: "idle", age: "1d" }] },
  ] },
  { name: "infra", mark: "ansi5", folded: true, agents: ["working", "idle"] },
];
const agentsOf = (s) => (s.folded ? s.agents : s.tabs.flatMap((t) => t.rows.filter((r) => r.agent).map((r) => r.status)));
const RANKED = ["blocked", "done", "working", "idle"];
const tabStatus = (tab) => RANKED.find((st) => tab.rows.some((r) => r.status === st)) ?? null;

// ---- bar strip (mods/bar-strip/main.js): h 26, px 8, gap 4, text 11.5; buttons h 20, px 6, gap 5, icon 13, rounded 5 -------
function barStrip(x0, y0, w, { vault = false, lit = null, bell = "1 needs you" } = {}) {
  let o = rect(x0, y0, w, 26, G.chrome) + hline(x0, y0 + 25, w);
  const cy = y0 + 12.5;
  const button = (x, ic, label, on = false) => {
    const bw = 6 + 13 + 5 + width(label, 11.5) + 6;
    return { w: bw, s: (on ? rect(x, cy - 10, bw, 20, G.selected, { r: 5 }) : "") + icon(ic, x + 6, cy - 6.5, 13, on ? G.foreground : G.muted) + textMid(x + 24, cy, label, { size: 11.5, fill: on ? G.foreground : G.muted }) };
  };
  let x = x0 + 8;
  for (const [ic, label] of [["search", "Search"], ["server", "Add machine"], ["settings", "Settings"]]) { const b = button(x, ic, label); o += b.s; x += b.w + 4; }
  // Right side, from the right edge: Vault, Changes, Files, then the bell.
  const right = [["file", "Files", "files"], ["changes", "Changes", "changes"], ...(vault ? [["book-open", "Vault", "vault"]] : [])];
  let rx = x0 + w - 8;
  for (const [ic, label, id] of right.reverse()) { const bw = 6 + 13 + 5 + width(label, 11.5) + 6; rx -= bw; o += button(rx, ic, label, lit === id).s; rx -= 4; }
  const color = bell ? G.blocked : G.dim;
  const label = bell || "Needs you";
  const bw = 6 + 13 + 5 + width(label, 11.5) + 6;
  rx -= bw;
  if (bell) o += rect(rx, cy - 10, bw, 20, alpha(color, 0.12), { r: 5 });
  o += icon("bell", rx + 6, cy - 6.5, 13, color) + textMid(rx + 24, cy, label, { size: 11.5, fill: color });
  return o;
}

// ---- space tree (mods/portrait-tree/main.js) -------------------------------------------------------------------------------
// header(): h 40, px 10, gap 8: fold button (14 + 2 padding), letter badge 18 (rounded 5, text 10.5 bold), name 15
// semibold with a 2 px rule in the mark color under it, the state counts (text 11.5, gap 8), the + (22 box, icon 13).
function header(x, y, w, s) {
  const color = MARK[s.mark];
  const cy = y + 20;
  let o = hline(x, y + 39, w);
  o += icon("fold", x + 12, cy - 7, 14, G.dim);
  o += rect(x + 36, cy - 9, 18, 18, color, { r: 5 }) + textMid(x + 45, cy, s.name[0].toUpperCase(), { size: 10.5, weight: 700, fill: inkOn(color), anchor: "middle" });
  // The + and the counts, from the right.
  let rx = x + w - 10 - 22;
  o += icon("plus", rx + 4.5, cy - 6.5, 13, G.dim);
  rx -= 8;
  const by = {};
  for (const st of agentsOf(s)) by[st] = (by[st] ?? 0) + 1;
  const groups = RANKED.filter((st) => by[st]).map((st) => ({ st, n: String(by[st]), w: glyph(0, 0, st).w + 3 + width(String(by[st]), 11.5) }));
  let cx0 = rx - groups.reduce((n, g) => n + g.w, 0) - 8 * Math.max(0, groups.length - 1);
  const nameRoom = cx0 - 8 - (x + 62);
  for (const g of groups) {
    const gl = glyph(cx0, cy, g.st);
    o += gl.s + textMid(cx0 + gl.w + 3, cy, g.n, { size: 11.5, fill: g.st === "idle" ? G.dim : G[g.st] });
    cx0 += g.w + 8;
  }
  const name = fit(s.name, 15, nameRoom, { weight: 600 });
  o += textMid(x + 62, cy, name, { size: 15, weight: 600, fill: s.active ? G.foreground : G.muted });
  o += rect(x + 62, y + 32.5, width(name, 15, 600), 2, s.active ? color : mix(color, G.chrome, 0.45), { r: 1 });
  return o;
}

// The tree lines in front of a row, JetBrains Mono 12 in dim (lines()).
const lines = (x, cy, s) => textMid(x, cy, s, { size: 12, font: MONO, fill: G.dim });

// tabRow(): h 24, pl 12, pr 10, gap 6, rounded 6; the shown tab on hover color; name 12 medium; state glyph in a 14 box.
function tabRow(x, y, w, s, tab, last) {
  const shown = s.active && tab.active;
  const cy = y + 12;
  let o = shown ? rect(x, y, w, 24, G.hover, { r: 6 }) : "";
  o += lines(x + 12, cy, last ? "└─" : "├─");
  const st = tabStatus(tab);
  const room = w - 12 - monoWidth("└─", 12) - 6 - 10 - (st && st !== "idle" ? 20 : 0);
  o += textMid(x + 12 + monoWidth("└─", 12) + 6, cy, fit(tab.name, 12, room, { weight: 500 }), { size: 12, weight: 500, fill: shown ? G.foreground : G.muted });
  if (st && st !== "idle") o += centred(x + w - 10 - 14, 14, cy, st);
  return o;
}

// agentRow(): h 26, pl 12, pr 10, gap 6; focused on selected; program icon 15; name 12.5 (muted when idle and not
// focused); the state word (columns 320 px or wider) and the time in it, 11; the glyph in a 14 box.
// paneRow(): the program's icon 15 (tinted muted), its name 12.5 muted, the folder 11.5 dim, cut from the start.
function treeRow(x, y, w, row, prefix, wordy) {
  const cy = y + 13;
  let o = row.focused ? rect(x, y, w, 26, G.selected, { r: 6 }) : "";
  o += lines(x + 12, cy, prefix);
  let lx = x + 12 + monoWidth(prefix, 12) + 6;
  if (row.agent) {
    const p = PROGRAM[row.agent];
    o += programIcon(p, lx, cy - 7.5, 15, G.foreground);
    lx += 15 + 6;
    let rx = x + w - 10;
    o += centred(rx - 14, 14, cy, row.status);
    rx -= 14 + 6;
    o += text(rx, cy + 11 * 0.36, row.age, { size: 11, fill: G.dim, anchor: "end" });
    rx -= width(row.age, 11) + 6;
    if (wordy) {
      o += text(rx, cy + 11 * 0.36, WORD[row.status], { size: 11, fill: row.status === "idle" ? G.dim : G[row.status], anchor: "end" });
      rx -= width(WORD[row.status], 11) + 6;
    }
    const quiet = row.status === "idle" && !row.focused;
    o += textMid(lx, cy, fit(row.title, 12.5, rx - lx), { size: 12.5, fill: quiet ? G.muted : G.foreground });
  } else {
    const p = PROGRAM[row.program];
    o += programIcon(p, lx, cy - 7.5, 15, G.muted);
    lx += 15 + 6;
    o += textMid(lx, cy, p.name, { size: 12.5, fill: G.muted });
    lx += width(p.name, 12.5) + 6;
    o += textMid(lx, cy, fit(row.cwd, 11.5, x + w - 10 - lx, { start: true }), { size: 11.5, fill: G.dim });
  }
  return o;
}

// An open column: raised while it is the active space, a 1 px rule on its right; the list has px 4, py 4.
function column(x, y, w, h, s, { wordy = w >= 320, rule = true } = {}) {
  let o = s.active ? rect(x, y, w, h, G.raised) : "";
  if (rule) o += vline(x + w - 1, y, h);
  const cw = rule ? w - 1 : w;
  o += header(x, y, cw, s);
  let ry = y + 40 + 4;
  const lx = x + 4, lw = cw - 8;
  s.tabs.forEach((tab, ti) => {
    const lastTab = ti === s.tabs.length - 1;
    o += tabRow(lx, ry, lw, s, tab, lastTab);
    ry += 24;
    tab.rows.forEach((row, ri) => {
      const prefix = (lastTab ? "   " : "│  ") + (ri === tab.rows.length - 1 ? "└─" : "├─");
      o += treeRow(lx, ry, lw, row, prefix, wordy);
      ry += 26;
    });
  });
  const id = uid("col");
  return `<g><clipPath id="${id}"><rect x="${r2(x)}" y="${r2(y)}" width="${r2(w)}" height="${r2(h)}"/></clipPath><g clip-path="url(#${id})">${o}</g></g>`;
}

// strip(): a folded space, 34 px (FOLDED_COL): the badge on the header line, one glyph per agent (pt 10, gap 7), then its
// name running down the strip (the spine SVG: Geist 13 medium, rotated, muted).
function strip(x, y, h, s) {
  const color = MARK[s.mark];
  let o = vline(x + 33, y, h) + hline(x, y + 39, 33);
  o += rect(x + 8, y + 11, 18, 18, color, { r: 5 }) + textMid(x + 17, y + 20, s.name[0].toUpperCase(), { size: 10.5, weight: 700, fill: inkOn(color), anchor: "middle" });
  let gy = y + 40 + 10;
  for (const st of s.agents) { o += centred(x, 33, gy + glyphH[st] / 2, st); gy += glyphH[st] + 7; }
  const top = gy - 7 + (s.agents.length ? 12 : 8);
  o += `<g transform="translate(${r2(x + 9)} ${r2(top)})"><text x="0" y="-4" transform="rotate(90)" class="u" font-size="13" font-weight="500" ${paint("fill", G.muted)}>${esc(s.name)}</text></g>`;
  return o;
}

// After the last column, the thin + for a new space (34 px, pt 8, icon 14, a rule on its left).
const addColumn = (x, y, h) => vline(x, y, h) + icon("plus", x + 10, y + 8, 14, G.dim);

function tree(x, y, w, h, spaces) {
  let o = rect(x, y, w, h, G.chrome);
  const open = spaces.filter((s) => !s.folded);
  const cw = (w - 34 - 34 * (spaces.length - open.length)) / open.length;
  let cx = x;
  for (const s of spaces) {
    if (s.folded) { o += strip(cx, y, h, s); cx += 34; } else { o += column(cx, y, cw, h, s); cx += cw; }
  }
  o += addColumn(x + w - 34, y, h);
  return o;
}

// ---- tab bar (mods/portrait-tabs/main.js): chrome, px 10, gap 3; a tab h 29, px 10, gap 7, rounded 7, text 12.8;
// the shown tab raised with a border; the program icon 14; working: spinner 12; needs you or done: a 6 px dot; close 12.
function tabBar(x, y, w, tabs) {
  let o = rect(x, y, w, 42, G.chrome) + hline(x, y + 41, w);
  let tx = x + 10;
  const cy = y + 20.5;
  for (const t of tabs) {
    const p = PROGRAM[t.program];
    const tw = 10 + 14 + 7 + width(t.name, 12.8) + (t.status === "working" ? 7 + 12 : t.status === "blocked" || t.status === "done" ? 7 + 6 : 0) + (t.active ? 7 + 12 : 0) + 10;
    o += boxed(tx, cy - 14.5, tw, 29, t.active ? G.raised : G.chrome, t.active ? G.border : G.chrome, 7);
    let ix = tx + 10;
    o += programIcon(p, ix, cy - 7, 14, G.muted);
    ix += 14 + 7;
    o += textMid(ix, cy, t.name, { size: 12.8, fill: t.active ? G.foreground : G.muted });
    ix += width(t.name, 12.8) + 7;
    if (t.status === "working") { o += icon("spinner", ix, cy - 6, 12, G.working); ix += 12 + 7; }
    if (t.status === "blocked" || t.status === "done") { o += `<circle cx="${r2(ix + 3)}" cy="${r2(cy)}" r="3" ${paint("fill", G[t.status])}/>`; ix += 6 + 7; }
    if (t.active) o += icon("close", ix, cy - 6, 12, G.dim);
    tx += tw + 3;
  }
  o += textMid(tx + 13, cy, "+", { size: 15, fill: G.dim, anchor: "middle" });
  return o;
}

// ---- a pane (layout: radius 10, border 1, focus 1 accent, background; header 30 from mods/portrait-pane) -------------------
// Header: px 10, gap 8, text 12; the program icon 14 (dim), the name medium, the folder dim, the state; on hover the
// split, zoom and close buttons (p 3, icon 14).
function pane(x, y, w, h, o) {
  const p = PROGRAM[o.program];
  const cid = uid("pane");
  let s = `<clipPath id="${cid}"><rect x="${r2(x)}" y="${r2(y)}" width="${r2(w)}" height="${r2(h)}" rx="10"/></clipPath>`;
  s += rect(x, y, w, h, G.background, { r: 10 });
  let inner = hline(x, y + 29, w);
  const cy = y + 14.5;
  let lx = x + 10;
  inner += programIcon(p, lx, cy - 7, 14, G.dim);
  lx += 14 + 8;
  const name = p.agent || p.shell ? p.name : o.title ?? p.name;
  inner += textMid(lx, cy, name, { size: 12, weight: 500, fill: G.foreground });
  lx += width(name, 12, 500) + 8;
  let rx = x + w - 10;
  if (o.hovered) {
    for (const b of ["close", "zoom", "split-down", "split-right"]) { rx -= 20; inner += icon(b, rx + 3, cy - 7, 14, G.dim); rx -= 8; }
    rx += 8;
  }
  if (o.status === "working") { rx -= 12; inner += icon("spinner", rx, cy - 6, 12, G.working); rx -= 8; }
  if (o.status === "blocked") { const bw = 12 + width("Needs you", 10.5, 600); rx -= bw; inner += rect(rx, cy - 9, bw, 18, alpha(G.blocked, 0.15), { r: 5 }) + textMid(rx + 6, cy, "Needs you", { size: 10.5, weight: 600, fill: G.blocked }); rx -= 8; }
  inner += textMid(lx, cy, fit(o.cwd, 12, rx - lx), { size: 12, fill: G.dim });
  // The terminal: JetBrains Mono 14 (Herdr's default), the layout's terminal padding (14 px, 12 px), 18 px lines.
  (o.lines ?? []).forEach((l, i) => {
    let tx = x + 14;
    const ty = y + 30 + 12 + 14 + i * 18;
    for (const [t, c] of Array.isArray(l) ? l : [[l, G.terminal]]) { inner += text(tx, ty, t, { size: 14, font: MONO, fill: c }); tx += monoWidth(t, 14); }
  });
  if (o.after) inner += o.after(x, y, w, h);
  s += `<g clip-path="url(#${cid})">${inner}</g>`;
  s += boxed(x, y, w, h, "none", o.focus ? G.accent : G.border, 10);
  return s;
}

// What the panes show (made up).
const CLAUDE = [
  [["> ", G.ansi8], ["add pagination to the /items endpoint", G.ansi8]],
  "",
  [["● ", G.ansi2], ["Read", G.foreground], ["(src/items/list.ts)", G.terminal]],
  [["● ", G.ansi2], ["Read", G.foreground], ["(src/items/query.ts)", G.terminal]],
  [["● ", G.ansi2], ["Update", G.foreground], ["(src/items/list.ts)", G.terminal]],
  [["  ⎿  ", G.ansi8], ["+ const page = Math.max(1, Number(req.query.page ?? 1));", G.ansi2]],
  [["     ", G.ansi8], ["+ const size = Math.min(100, Number(req.query.size ?? 25));", G.ansi2]],
  [["     ", G.ansi8], ["- return db.items.all();", G.ansi1]],
  [["     ", G.ansi8], ["+ return db.items.page({ page, size });", G.ansi2]],
  "",
  [["● ", G.ansi2], ["Bash", G.foreground], ["(npm test)", G.terminal]],
  [["  ⎿  ", G.ansi8], ["1 failed, 14 passed", G.ansi1]],
  "",
  [["● ", G.terminal], ["page.test.ts expects 25 items per page; the query", G.terminal]],
  [["  ", G.terminal], ["helper still defaults to 100. Changing the default.", G.terminal]],
  "",
  [["● ", G.ansi2], ["Update", G.foreground], ["(src/items/query.ts)", G.terminal]],
  [["  ⎿  ", G.ansi8], ["- const DEFAULT_SIZE = 100;", G.ansi1]],
  [["     ", G.ansi8], ["+ const DEFAULT_SIZE = 25;", G.ansi2]],
  "",
  [["✻ ", G.working], ["Running the tests… ", G.working], ["(esc to interrupt)", G.ansi8]],
];
const claudePrompt = (x, y, w, h) => {
  const by = y + h - 64;
  return boxed(x + 12, by, w - 24, 40, "none", G.ansi8 + "80", 6) + text(x + 26, by + 25, "> ", { size: 14, font: MONO, fill: G.ansi8 }) +
    rect(x + 26 + monoWidth("> ", 14), by + 11, 8.4, 18, G.terminal);
};
const SHELL = [
  [["~/code/api ", G.ansi4], ["main ", G.ansi5], ["❯ ", G.ansi2], ["npm test", G.terminal]],
  "",
  [[" PASS ", G.ansi2], [" src/items/list.test.ts", G.terminal]],
  [[" PASS ", G.ansi2], [" src/items/query.test.ts", G.terminal]],
  [[" FAIL ", G.ansi1], [" src/items/page.test.ts", G.terminal]],
  [["   expected 25 items, received 100", G.ansi1]],
  "",
  [["Tests: ", G.terminal], ["1 failed", G.ansi1], [", 14 passed, 15 total", G.terminal]],
  "",
  [["~/code/api ", G.ansi4], ["main ", G.ansi5], ["❯ ", G.ansi2]],
];

// ---- the status line: Herdr's shipped workspace-status mod (not in this repository; approximated) ----------------------------
function status(x, y, w) {
  let o = rect(x, y, w, 28, G.chrome);
  const cy = y + 14;
  o += textMid(x + 12, cy, "This computer", { size: 11.5, fill: G.muted });
  let lx = x + 12 + width("This computer", 11.5) + 14;
  o += textMid(lx, cy, "5 agents", { size: 11.5, fill: G.muted });
  lx += width("5 agents", 11.5) + 14;
  o += textMid(lx, cy, "1 needs you", { size: 11.5, fill: G.blocked });
  return o;
}

// ---- the whole window ----------------------------------------------------------------------------------------------------------
const W = 1080, H = 1920, BAR = 246, TABS = 42, STATUS = 28;
const TABS_API = [{ name: "server", program: "claude", status: "working", active: true }, { name: "tests", program: "codex", status: "blocked" }];
function windowBody(variant) {
  const top = variant === "top";
  // The left column: bar, work and status with a 1 px divider between them (layout "divider").
  const workH = H - BAR - STATUS - 2;
  const barY = top ? 0 : workH + 1, workY = top ? BAR + 1 : 0, statusY = H - STATUS;
  let o = rect(0, 0, W, H, G.canvas);
  o += barStrip(0, barY, W);
  o += tree(0, barY + 26, W, BAR - 26, SPACES);
  o += hline(0, top ? BAR : workH, W) + hline(0, statusY - 1, W);
  o += tabBar(0, workY, W, TABS_API);
  // work-body: padding 8, gap 8; the active tab split down into two panes.
  const px = 8, py = workY + TABS + 8, pw = W - 16, total = workH - TABS - 16;
  const h1 = Math.round((total - 8) * 0.62), h2 = total - 8 - h1;
  o += pane(px, py, pw, h1, { id: `a-${variant}`, program: "claude", cwd: "~/code/api", status: "working", focus: true, lines: CLAUDE, after: claudePrompt });
  o += pane(px, py + h1 + 8, pw, h2, { id: `b-${variant}`, program: "zsh", cwd: "~/code/api", lines: SHELL });
  o += status(0, statusY, W);
  return o;
}

// ---- feature pictures -------------------------------------------------------------------------------------------------------------
const PIC = {};
// Two layouts: the whole window of each, small, side by side.
PIC["two-layouts"] = () => {
  const k = 0.2, ww = W * k, wh = H * k, pad = 24, gap = 40;
  const w = pad * 2 + ww * 2 + gap, h = pad + wh + 44;
  let o = rect(0, 0, w, h, G.canvas);
  [["top", "portrait"], ["bottom", "portrait-bottom"]].forEach(([v, label], i) => {
    const x = pad + i * (ww + gap);
    o += `<g transform="translate(${x} ${pad}) scale(${k})">${windowBody(v)}</g>` + boxed(x - 1, pad - 1, ww + 2, wh + 2, "none", G.border, 2);
    o += text(x + ww / 2, pad + wh + 28, label, { size: 14, weight: 500, fill: G.muted, anchor: "middle" });
  });
  return svgDoc(w, h, o);
};
// Space tree: one open space with tabs, panes and agents in several states, a folded space and the + for a new one.
PIC["space-tree"] = () => {
  const s = { name: "api", mark: "ansi6", active: true, tabs: [
    { name: "server", active: true, rows: [{ agent: "claude", title: "add pagination", status: "working", age: "4m", focused: true }, { program: "zsh", cwd: "~/code/api" }] },
    { name: "tests", rows: [{ agent: "codex", title: "flaky page test", status: "blocked", age: "6m" }, { program: "nvim", cwd: "~/code/api/src" }] },
    { name: "review", rows: [{ agent: "gemini", title: "check the API docs", status: "done", age: "12m" }, { agent: "claude", title: "release notes", status: "idle", age: "1d" }] },
  ] };
  const w = 400 + 34 + 34, h = 300;
  let o = rect(0, 0, w, h, G.chrome) + column(0, 0, 400, h, s) + strip(400, 0, h, SPACES[3]) + addColumn(434, 0, h);
  return svgDoc(w, h, o);
};
// Bar strip: every button, with the optional Vault one and the bell lit.
PIC["bar-strip"] = () => svgDoc(680, 26, barStrip(0, 0, 680, { vault: true }));
// Side panel: the Files panel (mods/portrait-files: rounded 10, header 42 with "Files", the folder and the editor ▾;
// rows h 28, pl 8 + 18 per level, chevron 12, icon 14, name 13, the git mark 11).
PIC["side-panel"] = () => {
  const w = 368, h = 430;
  let o = rect(0, 0, w, h, G.canvas) + vline(0, 0, h);
  const x = 8, y = 8, fw = w - 16, fh = h - 16;
  o += `<clipPath id="files"><rect x="${x}" y="${y}" width="${fw}" height="${fh}" rx="10"/></clipPath>`;
  let f = rect(x, y, fw, fh, G.background) + hline(x, y + 41, fw);
  const cy = y + 21;
  f += textMid(x + 14, cy, "Files", { size: 13, weight: 600 });
  const chip = "nvim", cw = 6 + width(chip, 11.5) + 3 + 11 + 6;
  const cx = x + fw - 14 - cw;
  f += textMid(cx + 6, cy, chip, { size: 11.5, fill: G.muted }) + icon("chevron-down", cx + 6 + width(chip, 11.5) + 3, cy - 5.5, 11, G.muted);
  f += text(cx - 8, cy + 12 * 0.36, "api", { size: 12, fill: G.dim, anchor: "end" });
  const rows = [
    { name: ".github", dir: true }, { name: "docs", dir: true },
    { name: "src", dir: true, open: true, mark: "•" },
    { name: "items", dir: true, open: true, depth: 1, mark: "•" },
    { name: "list.ts", depth: 2, mark: "M" }, { name: "page.test.ts", depth: 2, mark: "A" }, { name: "query.ts", depth: 2, mark: "M" },
    { name: "utils", dir: true, depth: 1 }, { name: "server.ts", depth: 1 },
    { name: ".gitignore" }, { name: "package.json", mark: "M" }, { name: "README.md" }, { name: "tsconfig.json" },
  ];
  rows.forEach((r, i) => {
    const ry = y + 42 + 6 + i * 28, rcy = ry + 14, rx = x + 6;
    let lx = rx + 8 + (r.depth ?? 0) * 18;
    if (r.dir) f += icon(r.open ? "chevron-down" : "chevron-right", lx, rcy - 6, 12, G.dim);
    lx += 12 + 7;
    f += icon(r.dir ? "folder" : "file", lx, rcy - 7, 14, G.muted);
    lx += 14 + 7;
    f += textMid(lx, rcy, r.name, { size: 13 });
    if (r.mark) f += text(rx + fw - 12 - 8, rcy + 11 * 0.36, r.mark, { size: 11, fill: r.mark === "A" ? G.ansi2 : r.mark === "D" ? G.ansi1 : G.blocked, anchor: "end" });
  });
  o += `<g clip-path="url(#files)">${f}</g>` + boxed(x, y, fw, fh, "none", G.border, 10);
  return svgDoc(w, h, o);
};
// Tab bar and pane header: the tabs of a space, and a pane's header as the pointer is over it (split, zoom, close).
PIC["tab-bar"] = () => {
  const w = 680, h = 42 + 8 + 150;
  let o = rect(0, 0, w, h, G.canvas) + tabBar(0, 0, w, [...TABS_API, { name: "Neovim", program: "nvim" }]);
  o += pane(8, 50, w - 16, 190, { id: "tb", program: "claude", cwd: "~/code/api", status: "working", focus: true, hovered: true, lines: CLAUDE.slice(0, 6) });
  return svgDoc(w, h, o);
};
// The Agents waiting list (mods/attention-picker): popover, p 18, gap 10, text 13; a waiting row h 46 with what the
// agent asks, other agents h 32 under their space's name (h 29), the separator h 17, the "earlier" row h 35.
PIC["waiting-list"] = () => {
  const w = 640;
  const rows = [
    { kind: "waiting", n: 1, status: "blocked", name: "flaky page test", word: "needs you", ago: "6m", sub: "api · tests", ask: "Allow edit to src/items/page.test.ts?" },
    { kind: "sep" },
    { kind: "head", name: "api", mark: "ansi6" },
    { kind: "agent", n: 2, status: "working", name: "add pagination", word: "working", ago: "4m", sub: "Claude Code · server" },
    { kind: "head", name: "infra", mark: "ansi5" },
    { kind: "agent", n: 3, status: "working", name: "plan the staging change", word: "working", ago: "2m", sub: "Codex · terraform" },
    { kind: "head", name: "web", mark: "ansi3" },
    { kind: "agent", n: 4, status: "idle", name: "dark mode toggle", word: "idle", ago: "38m", sub: "Gemini · ui" },
    { kind: "earlier", text: "earlier: 2 agents idle for over a day ▾" },
  ];
  const HH = { head: 29, agent: 32, waiting: 46, sep: 17, earlier: 35 };
  const listH = rows.reduce((n, r) => n + HH[r.kind], 0);
  const h = 18 + 22 + 10 + listH + 6 + 18;
  let o = rect(0, 0, w, h, G.popover, { r: 12 });
  const ty = 18 + 11;
  o += textMid(18, ty, "1 agent needs you", { size: 15, weight: 600 });
  const hint = "↑↓ choose · Enter go · 1–9 jump · Tab sort · Esc";
  const hx = w - 18 - width(hint, 11);
  o += textMid(hx, ty, hint, { size: 11, fill: G.dim });
  const sw = 8 + width("Sort", 11.5) + 4 + width("Recent", 11.5) + 8, sx = hx - 10 - sw;
  o += rect(sx, ty - 11, sw, 22, G.raised, { r: 6 }) + textMid(sx + 8, ty, "Sort", { size: 11.5, fill: G.dim }) + textMid(sx + 8 + width("Sort", 11.5) + 4, ty, "Recent", { size: 11.5, fill: G.muted });
  let y = 18 + 22 + 10;
  const x = 18, lw = w - 36;
  for (const r of rows) {
    const rh = HH[r.kind];
    if (r.kind === "sep") o += hline(x + 10, y + 8, lw - 20);
    else if (r.kind === "head") {
      const c = MARK[r.mark];
      const cy = y + 10 + 8;
      o += rect(x + 10, cy - 9, 18, 18, c, { r: 5 }) + textMid(x + 19, cy, r.name[0].toUpperCase(), { size: 10.5, weight: 700, fill: inkOn(c), anchor: "middle" });
      o += textMid(x + 36, cy, r.name, { size: 11, weight: 600, fill: G.dim });
    } else if (r.kind === "earlier") {
      o += hline(x + 4, y + 6, lw - 8) + textMid(x + 14, y + 6 + (rh - 6) / 2, r.text, { size: 12, fill: G.dim });
    } else {
      const sel = r.n === 1;
      if (sel) o += rect(x + 4, y, lw - 8, rh, G.hover, { r: 7 });
      const cy = r.kind === "waiting" ? y + 14 : y + rh / 2;
      let lx = x + 14;
      o += textMid(lx, cy, String(r.n), { size: 11, fill: G.dim });
      lx += 10 + 10;
      if (r.status === "working") o += icon("spinner", lx, cy - 6, 12, G.working);
      else o += textMid(lx, cy, r.status === "idle" ? "○" : "●", { size: 11, fill: G[r.status] ?? G.dim });
      lx += 12 + 10;
      let rx = x + lw - 4 - 10;
      o += text(rx, cy + 11 * 0.36, r.sub, { size: 11, fill: G.dim, anchor: "end" });
      rx -= width(r.sub, 11) + 10;
      o += text(rx, cy + 11 * 0.36, r.ago, { size: 11, fill: G.dim, anchor: "end" });
      rx -= width(r.ago, 11) + 5;
      o += text(rx, cy + 11 * 0.36, r.word, { size: 11, fill: r.status === "idle" ? G.dim : G[r.status], anchor: "end" });
      o += textMid(lx, cy, r.name, { size: 13 });
      if (r.ask) o += textMid(x + 14 + 42, y + 33, r.ask, { size: 11.5, fill: G.muted });
    }
    y += rh;
  }
  o += boxed(0, 0, w, h, "none", G.border, 12);
  return svgDoc(w, h, o);
};
// The floating editor: nvim in a window over the app, with mods/nvim-float's title bar (h 34, px 10, gap 8, text 12.5):
// the program's icon, the file, its folder, Keep ▾ (h 22, px 8) and the close button.
PIC["floating-editor"] = () => {
  const w = 680, h = 400;
  let o = `<clipPath id="float"><rect width="${w}" height="${h}" rx="10"/></clipPath>`;
  let f = rect(0, 0, w, h, G.background) + rect(0, 0, w, 34, G.chrome) + hline(0, 33, w);
  const cy = 16.5;
  f += icon("nvim", 10, cy - 7, 14, G.muted);
  f += textMid(32, cy, "query.ts", { size: 12.5, weight: 500 });
  f += textMid(32 + width("query.ts", 12.5, 500) + 8, cy, "~/code/api/src/items", { size: 11.5, fill: G.dim });
  const closeX = w - 10 - 29, kw = 8 + width("Keep", 12.5) + 4 + 11 + 8, kx = closeX - 8 - kw;
  f += textMid(kx + 8, cy, "Keep", { size: 12.5, fill: G.muted }) + icon("chevron-down", kx + 8 + width("Keep", 12.5) + 4, cy - 5.5, 11, G.muted);
  f += icon("close", closeX + 8, cy - 6.5, 13, G.muted);
  // nvim, made up: line numbers, a few lines of TypeScript, the status line.
  const code = [
    [["import ", G.ansi5], ["{ db } ", G.terminal], ["from ", G.ansi5], ['"../db"', G.ansi2], [";", G.terminal]],
    [],
    [["export const ", G.ansi5], ["DEFAULT_SIZE", G.ansi3], [" = ", G.terminal], ["25", G.ansi1], [";", G.terminal]],
    [["export const ", G.ansi5], ["MAX_SIZE", G.ansi3], [" = ", G.terminal], ["100", G.ansi1], [";", G.terminal]],
    [],
    [["export function ", G.ansi5], ["pageOf", G.ansi4], ["(query: ", G.terminal], ["Query", G.ansi3], [") {", G.terminal]],
    [["  const ", G.ansi5], ["page = Math.", G.terminal], ["max", G.ansi4], ["(", G.terminal], ["1", G.ansi1], [", Number(query.page ?? ", G.terminal], ["1", G.ansi1], ["));", G.terminal]],
    [["  const ", G.ansi5], ["size = Math.", G.terminal], ["min", G.ansi4], ["(MAX_SIZE, Number(query.size ?? DEFAULT_SIZE));", G.terminal]],
    [["  return ", G.ansi5], ["{ page, size };", G.terminal]],
    [["}", G.terminal]],
    [],
    [["// ", G.ansi8], ["The list endpoints call pageOf() before they query.", G.ansi8]],
  ];
  code.forEach((l, i) => {
    const ty = 34 + 6 + 14 + i * 18;
    f += text(10 + monoWidth("  ", 14), ty, String(i + 1).padStart(3), { size: 14, font: MONO, fill: i === 2 ? G.ansi3 : G.ansi8, anchor: "end" });
    let tx = 10 + monoWidth("   ", 14) + 8.4;
    for (const [t, c] of l) { f += text(tx, ty, t, { size: 14, font: MONO, fill: c }); tx += monoWidth(t, 14); }
  });
  for (let i = code.length; i < 17; i++) f += text(10 + monoWidth("   ", 14) + 8.4, 34 + 6 + 14 + i * 18, "~", { size: 14, font: MONO, fill: G.ansi8 });
  const sy = h - 6 - 18 - 18;
  f += rect(0, sy, w, 18, G.raised) + rect(0, sy, monoWidth(" NORMAL ", 14), 18, G.ansi4) + text(0, sy + 14, " NORMAL ", { size: 14, font: MONO, fill: G.background, weight: 700 });
  f += text(monoWidth(" NORMAL  ", 14), sy + 14, "query.ts", { size: 14, font: MONO, fill: G.terminal }) + text(w - 10, sy + 14, "3:28  Top ", { size: 14, font: MONO, fill: G.terminal, anchor: "end" });
  o += `<g clip-path="url(#float)">${f}</g>` + boxed(0, 0, w, h, "none", G.border, 10);
  return svgDoc(w, h, o);
};
// The viewer (mods/portrait-viewer): bar h 36, px 12, gap 8, text 12.5: the file, its pages, its folder, Open in Preview
// (h 24, px 8) and close; under it the pages on the theme background, with 24 px around them and 14 between.
PIC["viewer"] = () => {
  const w = 680, h = 420;
  let o = `<clipPath id="viewer"><rect width="${w}" height="${h}" rx="10"/></clipPath>`;
  let f = rect(0, 0, w, h, G.background) + rect(0, 0, w, 36, G.chrome) + hline(0, 35, w);
  const cy = 17.5;
  let lx = 12;
  f += textMid(lx, cy, "page-sizes.pdf", { size: 12.5, weight: 500 }); lx += width("page-sizes.pdf", 12.5, 500) + 8;
  f += textMid(lx, cy, "2 pages", { size: 11.5, fill: G.dim }); lx += width("2 pages", 11.5) + 8;
  f += textMid(lx, cy, "~/code/api/docs", { size: 11.5, fill: G.dim });
  const closeX = w - 12 - 29, ow = 8 + width("Open in Preview", 12.5) + 8, ox = closeX - 8 - ow;
  f += textMid(ox + 8, cy, "Open in Preview", { size: 12.5, fill: G.muted }) + icon("close", closeX + 8, cy - 6.5, 13, G.muted);
  // Page 1 of a made-up document: a title, a few lines of text, a small table.
  const px = 24, py = 36 + 24, pw = w - 48;
  f += rect(px, py, pw, 520, "#ffffff");
  f += text(px + 48, py + 64, "Page sizes in the /items API", { size: 22, weight: 600, fill: "#1d1f23" });
  [0.92, 0.86, 0.9, 0.6].forEach((k, i) => { f += rect(px + 48, py + 92 + i * 18, (pw - 96) * k, 8, "#c9ccd2", { r: 2 }); });
  f += text(px + 48, py + 196, "Defaults", { size: 15, weight: 600, fill: "#1d1f23" });
  [["page", "1"], ["size", "25"], ["max size", "100"]].forEach(([k, v], i) => {
    const ry = py + 212 + i * 26;
    f += rect(px + 48, ry, pw - 96, 26, i % 2 ? "#ffffff" : "#f1f2f4") + text(px + 60, ry + 17, k, { size: 12, font: MONO, fill: "#1d1f23" }) + text(px + pw - 60, ry + 17, v, { size: 12, font: MONO, fill: "#1d1f23", anchor: "end" });
  });
  [0.88, 0.94, 0.7].forEach((k, i) => { f += rect(px + 48, py + 316 + i * 18, (pw - 96) * k, 8, "#c9ccd2", { r: 2 }); });
  o += `<g clip-path="url(#viewer)">${f}</g>` + boxed(0, 0, w, h, "none", G.border, 10);
  return svgDoc(w, h, o);
};

// ---- Settings thumbnails: the same window at 1/9.6 scale, upright in the middle of a 320x200 card ----------------------------------
const CARD_W = 320, CARD_H = 200;
function thumb(variant) {
  const k = CARD_H / H, x = (CARD_W - W * k) / 2;
  const body = windowBody(variant);
  return svgDoc(CARD_W, CARD_H, `<g transform="translate(${r2(x)} 0) scale(${+k.toFixed(5)})">${body}</g>`);
}

writeFileSync(abs("layouts/portrait.svg"), thumb("top"));
writeFileSync(abs("layouts/portrait-bottom.svg"), thumb("bottom"));
writeFileSync(abs("scripts/preview-source.svg"), svgDoc(W, H, windowBody("top")));
mkdirSync(abs("docs/assets/pictures"), { recursive: true });
for (const [name, draw] of Object.entries(PIC)) writeFileSync(abs(`docs/assets/pictures/${name}.svg`), draw());
console.log(`wrote layouts/portrait.svg, layouts/portrait-bottom.svg, scripts/preview-source.svg and ${Object.keys(PIC).length} pictures in docs/assets/pictures/`);

if (!process.argv.includes("--svg-only")) {
  try {
    execFileSync("rsvg-convert", ["-w", String(W), "-h", String(H), "-o", abs("preview.png"), abs("scripts/preview-source.svg")]);
    copyFileSync(abs("preview.png"), abs("docs/assets/preview.png"));
    console.log("rendered preview.png (and copied it to docs/assets/preview.png)");
    // The hash of the source this picture was drawn from: check-assets.mjs fails when the source changes and the picture does not.
    writeFileSync(abs("scripts/preview.sha256"), `${sha256("scripts/preview-source.svg")}\n`);
  } catch {
    console.log("rsvg-convert not found: kept the committed preview.png (render scripts/preview-source.svg yourself to change it)");
  }
}
