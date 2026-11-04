#!/usr/bin/env node
// Asset checks: preview.png is a real, clean, portrait PNG at least 800px wide; every SVG in the repo is
// well formed, has no script or external reference; layouts' preview files exist; mod icon files are small.
import { readFileSync, statSync } from "node:fs";
import { abs, exists, json, layoutNames, read, reporter, repoFiles } from "./lib.mjs";

const r = reporter("check-assets");
const files = repoFiles();

// ---- preview.png
if (r.check(exists("preview.png"), "preview.png is missing (herdr.dev needs it, see RECIPE.md)")) {
  const buf = readFileSync(abs("preview.png"));
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (r.check(buf.subarray(0, 8).equals(sig), "preview.png: not a PNG (bad signature)")) {
    const chunks = [];
    for (let i = 8; i + 8 <= buf.length;) {
      const len = buf.readUInt32BE(i);
      chunks.push(buf.toString("latin1", i + 4, i + 8));
      i += 12 + len;
    }
    const width = buf.readUInt32BE(16), height = buf.readUInt32BE(20);
    r.check(width >= 800, `preview.png: width ${width}px, at least 800 needed`);
    r.check(height > width, `preview.png: ${width}x${height} is not portrait (this layout is for vertical monitors)`);
    r.check(buf.length < 2 * 1024 * 1024, `preview.png: ${buf.length} bytes, keep it under 2 MB`);
    // Text, EXIF and time chunks can carry paths, usernames or dates; the generator writes none.
    const meta = chunks.filter((c) => ["tEXt", "zTXt", "iTXt", "eXIf", "tIME"].includes(c));
    r.check(meta.length === 0, `preview.png: carries metadata chunks (${meta.join(", ")}); re-render it with scripts/make-preview.mjs`);
    r.check(chunks[0] === "IHDR" && chunks.at(-1) === "IEND" && chunks.includes("IDAT"), "preview.png: chunk structure is broken");
  }
}

// ---- SVG well-formedness (balanced tags, one root, no scripts or external loads)
function svgProblems(src) {
  const out = [];
  const body = src.replace(/<!--[\s\S]*?-->/g, "").replace(/<\?[\s\S]*?\?>/g, "");
  const stack = [];
  let roots = 0;
  const re = /<(\/?)([A-Za-z][\w:.-]*)((?:"[^"]*"|'[^']*'|[^'">])*?)(\/?)>/g;
  let m;
  while ((m = re.exec(body))) {
    const [, close, name, , self] = m;
    if (close) { if (stack.pop() !== name) { out.push(`unbalanced </${name}>`); break; } }
    else if (!self) { if (!stack.length) roots++; stack.push(name); }
    else if (!stack.length) roots++;
  }
  if (stack.length) out.push(`unclosed <${stack.at(-1)}>`);
  if (roots !== 1) out.push(`${roots} root elements`);
  if (!/^\s*(<\?xml[\s\S]*?\?>\s*)?(<!--[\s\S]*?-->\s*)*<svg[\s>]/.test(src)) out.push("does not start with <svg");
  if (/<script/i.test(src)) out.push("contains <script");
  if (/\bon[a-z]+\s*=/i.test(src)) out.push("contains an event handler attribute");
  if (/(?:href|src)\s*=\s*["']\s*(?:https?:|\/\/|file:)/i.test(src) || /url\(\s*["']?(?:https?:|\/\/)/i.test(src)) out.push("loads an external resource");
  if (/<image\b/i.test(src)) out.push("embeds an <image>");
  return out;
}
const svgs = files.filter((f) => f.endsWith(".svg"));
for (const f of svgs) {
  for (const p of svgProblems(read(f))) r.error(`${f}: ${p}`);
  r.check(statSync(abs(f)).size < 64 * 1024, `${f}: larger than 64 KB`);
}
r.note(`${svgs.length} SVG file(s) inspected`);

// ---- layout thumbnails exist and are SVG or PNG
for (const n of layoutNames()) {
  const p = json(`layouts/${n}.json`).preview;
  if (p) r.check(/\.(svg|png)$/.test(p) && exists(p), `layouts/${n}.json: preview "${p}" must be an existing .svg or .png`);
}

r.done();
