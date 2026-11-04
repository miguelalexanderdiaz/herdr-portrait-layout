#!/usr/bin/env node
// Checks the human and agent documentation (README.md, CONTRIBUTING.md, AGENTS.md, CHANGELOG.md, llms.txt, docs/):
//   - every relative link and #anchor in the Markdown files and in docs/*.html resolves
//   - external hosts are github.com and herdr.dev only; pages load nothing from outside (no CDN, font host, script)
//   - each HTML page has <html lang>, a <title>, exactly one <h1>, an alt on every image, ids that are unique
//   - docs/.nojekyll exists; llms.txt and docs/llms.txt are byte-identical; docs/assets/preview.png is a copy of preview.png
//   - no home path or e-mail address (the privacy scan covers this too, here it is per page)
import { readFileSync } from "node:fs";
import { dirname, posix as path } from "node:path";
import { abs, exists, read, reporter, repoFiles } from "./lib.mjs";

const r = reporter("check-docs");
const files = repoFiles();
const MD = ["README.md", "CONTRIBUTING.md", "AGENTS.md", "CHANGELOG.md", "RECIPE.md", "scripts/PUBLISH.md"].filter(exists);
const HTML = files.filter((f) => /^docs\/.+\.html$/.test(f));
const TXT = ["llms.txt", "docs/llms.txt"].filter(exists);
const ALLOWED_HOSTS = new Set(["github.com", "www.github.com", "herdr.dev", "www.herdr.dev"]);

if (!r.check(exists("README.md"), "README.md is missing")) r.done();
r.check(HTML.length > 0, "docs/ has no pages");
r.check(exists("docs/index.html"), "docs/index.html is missing");
r.check(exists("docs/.nojekyll"), "docs/.nojekyll is missing (Pages would run Jekyll over the site)");
r.check(exists("llms.txt") && exists("docs/llms.txt"), "llms.txt and docs/llms.txt must both exist");
if (exists("llms.txt") && exists("docs/llms.txt")) {
  r.check(readFileSync(abs("llms.txt")).equals(readFileSync(abs("docs/llms.txt"))), "llms.txt and docs/llms.txt differ (they must be byte-identical)");
}

if (exists("docs/assets/preview.png") && exists("preview.png")) {
  r.check(readFileSync(abs("docs/assets/preview.png")).equals(readFileSync(abs("preview.png"))), "docs/assets/preview.png is not a copy of preview.png (copy it again after node scripts/make-preview.mjs)");
}

// ---- anchors
const slug = (h) => h.trim().toLowerCase().replace(/<[^>]+>/g, "").replace(/`/g, "").replace(/[^\p{L}\p{N}\s_-]/gu, "").replace(/\s/g, "-");
const anchorCache = new Map();
function anchorsOf(file) {
  if (anchorCache.has(file)) return anchorCache.get(file);
  const set = new Set();
  const text = read(file);
  if (file.endsWith(".html")) {
    for (const m of text.matchAll(/\sid\s*=\s*["']([^"']+)["']/g)) set.add(m[1]);
    for (const m of text.matchAll(/<a\s[^>]*\bname\s*=\s*["']([^"']+)["']/g)) set.add(m[1]);
  } else if (file.endsWith(".md")) {
    const seen = {};
    let fence = false;
    for (const line of text.split(/\r?\n/)) {
      if (/^\s*```/.test(line)) { fence = !fence; continue; }
      const m = !fence && /^#{1,6}\s+(.*?)\s*#*\s*$/.exec(line);
      if (!m) continue;
      let s = slug(m[1]);
      if (seen[s] !== undefined) s += `-${++seen[s]}`; else seen[s] = 0;
      set.add(s);
    }
  }
  anchorCache.set(file, set);
  return set;
}

function resolveLink(from, target) {
  // external or non-file schemes are handled elsewhere
  const [rawPath, frag] = target.split("#");
  const decoded = decodeURIComponent(rawPath || "");
  let file = decoded ? path.normalize(path.join(dirname(from), decoded)) : from;
  if (!decoded) return { file, frag };
  if (decoded.endsWith("/") || (!path.extname(file) && files.some((f) => f.startsWith(file + "/")))) file = path.join(file, "index.html");
  return { file, frag };
}

function checkLink(from, target, label) {
  const t = target.trim();
  if (!t || /^(mailto:|tel:|javascript:|data:)/i.test(t)) {
    if (/^(mailto:|javascript:)/i.test(t)) r.error(`${from}: ${label} uses ${t.split(":")[0]}:`);
    return;
  }
  if (/^(https?:)?\/\//i.test(t)) {
    const u = new URL(t.startsWith("//") ? `https:${t}` : t);
    r.check(ALLOWED_HOSTS.has(u.hostname), `${from}: ${label} points to ${u.hostname}; only github.com and herdr.dev are allowed`);
    return;
  }
  if (t.startsWith("/")) { r.error(`${from}: ${label} "${t}" is root-relative; Pages serves the site under /<repo>/, use a relative link`); return; }
  const { file, frag } = resolveLink(from, t);
  if (!r.check(files.includes(file) || exists(file), `${from}: ${label} "${t}" does not resolve (${file})`)) return;
  if (frag && /\.(html|md)$/.test(file)) r.check(anchorsOf(file).has(frag), `${from}: ${label} "${t}" has no anchor #${frag} in ${file}`);
}

// ---- Markdown
for (const f of MD) {
  const text = read(f);
  const noCode = text.replace(/```[\s\S]*?```/g, "").replace(/`[^`\n]*`/g, "");
  for (const m of noCode.matchAll(/!?\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g)) checkLink(f, m[1], "link");
  for (const m of noCode.matchAll(/^\[[^\]]+\]:\s*(\S+)/gm)) checkLink(f, m[1], "reference link");
}

// ---- HTML
for (const f of HTML) {
  const html = read(f);
  r.check(/<!doctype html>/i.test(html), `${f}: missing <!doctype html>`);
  r.check(/<html[^>]*\slang\s*=\s*["'][a-z-]+["']/i.test(html), `${f}: <html> needs a lang attribute`);
  r.check(/<title>[^<]{3,}<\/title>/i.test(html), `${f}: needs a <title>`);
  r.check(/<meta[^>]+name=["']viewport["']/i.test(html), `${f}: needs a viewport meta (phone width)`);
  const h1 = (html.match(/<h1[\s>]/gi) ?? []).length;
  r.check(h1 === 1, `${f}: has ${h1} <h1>, exactly one is needed`);
  for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
    r.check(/\salt\s*=\s*["'][^"']*["']/i.test(m[0]), `${f}: an <img> has no alt text`);
    const src = /\ssrc\s*=\s*["']([^"']+)["']/i.exec(m[0]);
    if (src) r.check(!/^(https?:)?\/\//i.test(src[1]), `${f}: an image is loaded from outside the site`);
  }
  r.check(!/<script\b/i.test(html), `${f}: pages must not load or run scripts`);
  const ids = [...html.matchAll(/\sid\s*=\s*["']([^"']+)["']/g)].map((m) => m[1]);
  const dup = ids.filter((id, i) => ids.indexOf(id) !== i);
  r.check(dup.length === 0, `${f}: duplicate ids ${[...new Set(dup)].join(", ")}`);
  for (const m of html.matchAll(/<(?:a|link|img|source|script|iframe)\b[^>]*\s(?:href|src)\s*=\s*["']([^"']*)["']/gi)) {
    const tag = /^<(\w+)/.exec(m[0])[1].toLowerCase();
    if (/^(https?:)?\/\//i.test(m[1]) && tag !== "a") { r.error(`${f}: <${tag}> loads ${m[1]} from outside the site (no CDNs, no font hosts)`); continue; }
    checkLink(f, m[1], `<${tag}>`);
  }
  r.check(/\.skip\b|class=["'][^"']*\bskip\b|skip to/i.test(html), `${f}: no "skip to content" link`);
}
// ---- the stylesheet must not import or load from outside
for (const f of files.filter((f) => /^docs\/.+\.css$/.test(f))) {
  const css = read(f);
  r.check(!/@import|url\(\s*["']?(?:https?:)?\/\//i.test(css), `${f}: loads something from outside the site`);
  for (const m of css.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) if (!/^data:/.test(m[1])) checkLink(f, m[1], "css url");
}

// ---- every file: external hosts and personal data
for (const f of [...MD, ...HTML, ...TXT]) {
  const text = read(f).replace(/xmlns(?::\w+)?\s*=\s*["'][^"']*["']/g, "");
  for (const m of text.matchAll(/\bhttps?:\/\/([A-Za-z0-9.-]+)/g)) {
    r.check(ALLOWED_HOSTS.has(m[1].toLowerCase()), `${f}: mentions ${m[1]}; only github.com and herdr.dev are allowed`);
  }
  if (f !== "scripts/PUBLISH.md") {
    r.check(!/\/Users\/(?!<)[^/\s]+|\/home\/(?!<)[^/\s]+|[A-Za-z]:\\Users\\(?!<)[^\\\s]+/.test(text), `${f}: contains a home path`);
    r.check(!/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+\.[A-Za-z]{2,}/.test(text.replace(/noreply@anthropic\.com/g, "")), `${f}: contains an e-mail address`);
  }
}

r.note(`${MD.length} Markdown, ${HTML.length} HTML, ${TXT.length} text file(s) inspected`);
r.done();
