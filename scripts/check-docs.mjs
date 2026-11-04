#!/usr/bin/env node
// Checks the human and agent documentation (README.md, CONTRIBUTING.md, AGENTS.md, CHANGELOG.md, llms.txt, docs/):
//   - every relative link and #anchor in the Markdown files and in docs/*.html resolves
//   - external hosts are github.com and herdr.dev only; pages load nothing from outside (no CDN, font host, script).
//     One exception: the repository's own GitHub Pages address, https://<owner>.github.io/<repo>/..., in the files that
//     tell people where the rendered pages are (README, AGENTS.md, llms.txt, docs/llms.txt, docs/404.html). The owner and
//     name are not written here: they must match a github.com/<owner>/<repo> link of the same files.
//   - the keys table of README.md and docs/configuration.html equals keys.json row for row (no missing, extra or doubled row)
//   - every `identifier` in a "Where to check" cell of the privacy page exists in mods/, and every mod folder is named in
//     README.md and docs/privacy.html
//   - each HTML page has <html lang>, a <title>, exactly one <h1>, an alt on every image, ids that are unique
//   - pages run no inline script; the only scripts are the site's own files in docs/assets/ (<script src="assets/x.js">),
//     and those may not reach the network, load code, or store anything (the site stays static and offline)
//   - docs/.nojekyll exists; llms.txt and docs/llms.txt are byte-identical; docs/assets/preview.png is a copy of preview.png
//   - no home path or e-mail address (the privacy scan covers this too, here it is per page)
import { readFileSync } from "node:fs";
import { dirname, posix as path } from "node:path";
import { abs, exists, json, modFolders, read, reporter, repoFiles } from "./lib.mjs";

const r = reporter("check-docs");
const files = repoFiles();
const MD = ["README.md", "CONTRIBUTING.md", "AGENTS.md", "CHANGELOG.md", "RECIPE.md", "scripts/PUBLISH.md"].filter(exists);
const HTML = files.filter((f) => /^docs\/.+\.html$/.test(f));
const TXT = ["llms.txt", "docs/llms.txt"].filter(exists);
const ALLOWED_HOSTS = new Set(["github.com", "www.github.com", "herdr.dev", "www.herdr.dev"]);
// Files that may point at the repository's own Pages address (they say where the rendered site lives).
const PAGES_FILES = new Set(["README.md", "AGENTS.md", "llms.txt", "docs/llms.txt", "docs/404.html"]);
const repoLinks = new Set(); // "owner/repo" of every github.com link in the Pages files, lower case
for (const f of PAGES_FILES) if (exists(f)) for (const m of read(f).matchAll(/github\.com\/([\w.-]+)\/([\w.-]+)/gi)) repoLinks.add(`${m[1]}/${m[2]}`.toLowerCase().replace(/\.git$/, ""));
// Is https://<host><path> an allowed address in `from`? github.com and herdr.dev always; <owner>.github.io/<repo> in the Pages files only.
function hostAllowed(from, host, path = "") {
  if (ALLOWED_HOSTS.has(host.toLowerCase())) return true;
  // The one-line install fetches this repository's own install/ scripts from raw.githubusercontent.com.
  if (host.toLowerCase() === "raw.githubusercontent.com") {
    const owner = /^\/([\w.-]+)/.exec(path)?.[1]?.toLowerCase();
    return Boolean(owner) && [...repoLinks].some((r) => r.split("/")[0] === owner);
  }
  const m = /^([a-z0-9-]+)\.github\.io$/i.exec(host);
  if (!m || !PAGES_FILES.has(from)) return false;
  const repo = /^\/([\w.-]+)/.exec(path)?.[1];
  return Boolean(repo) && repoLinks.has(`${m[1]}/${repo}`.toLowerCase());
}

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
    r.check(hostAllowed(from, u.hostname, u.pathname), `${from}: ${label} points to ${u.hostname}${u.pathname.split("/").slice(0, 2).join("/")}; only github.com, herdr.dev and this repository's own Pages address (in ${[...PAGES_FILES].join(", ")}) are allowed`);
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
  for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const src = /\ssrc\s*=\s*["']([^"']+)["']/i.exec(m[1])?.[1];
    r.check(Boolean(src) && !m[2].trim(), `${f}: an inline <script>; a page may only load the site's own scripts with <script src="assets/...">`);
    if (src) r.check(/^assets\/[\w.-]+\.js$/.test(src) && exists(`docs/${src}`), `${f}: <script src="${src}"> must be an existing file in docs/assets/`);
  }
  r.check((html.match(/<script\b/gi) ?? []).length === (html.match(/<script\b[^>]*>[\s\S]*?<\/script>/gi) ?? []).length, `${f}: a <script> is not closed`);
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
// ---- the site's scripts: no network, no loading code, no storage, no addresses
for (const f of files.filter((f) => /^docs\/.+\.m?js$/.test(f))) {
  const js = read(f);
  const bad = /\b(fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon|importScripts|eval|Function|localStorage|sessionStorage|indexedDB|document\.cookie|Worker)\b\s*[.(]|\bimport\s*[(\s{*"']|\bnew\s+(Function|Worker|WebSocket|EventSource|XMLHttpRequest|Image)\b|\.src\s*=|https?:\/\//.exec(js);
  r.check(!bad, `${f}: uses ${bad?.[0]}; the site's scripts may not reach the network, load code or store anything`);
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
  for (const m of text.matchAll(/\bhttps?:\/\/([A-Za-z0-9.-]+)(\/[\w.-]*)?/g)) {
    r.check(hostAllowed(f, m[1], m[2] ?? ""), `${f}: mentions ${m[1]}${m[2] ?? ""}; only github.com, herdr.dev and this repository's own Pages address (in ${[...PAGES_FILES].join(", ")}) are allowed`);
  }
  if (f !== "scripts/PUBLISH.md") {
    r.check(!/\/Users\/(?!<)[^/\s]+|\/home\/(?!<)[^/\s]+|[A-Za-z]:\\Users\\(?!<)[^\\\s]+/.test(text), `${f}: contains a home path`);
    r.check(!/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+\.[A-Za-z]{2,}/.test(text.replace(/noreply@anthropic\.com/g, "")), `${f}: contains an e-mail address`);
  }
}

// ---- the keys table equals keys.json
{
  const want = [];
  for (const [section, map] of Object.entries(json("keys.json"))) for (const [key, action] of Object.entries(map)) want.push(`${section} | ${key} | ${action}`);
  const rowsOf = {
    "README.md": () => [...read("README.md").matchAll(/^\|\s*`([^`|]+)`\s*\|\s*`([^`|]+)`\s*\|\s*`([^`|]+)`\s*\|/gm)].map((m) => `${m[1]} | ${m[2]} | ${m[3]}`).filter((x) => /^(layout:|global|terminal|mod:)/.test(x)),
    "docs/configuration.html": () => [...read("docs/configuration.html").matchAll(/<tr><td><code>([^<]+)<\/code><\/td><td><kbd>([^<]+)<\/kbd><\/td><td><code>([^<]+)<\/code><\/td>/g)].map((m) => `${m[1]} | ${m[2]} | ${m[3]}`),
  };
  for (const [file, rows] of Object.entries(rowsOf)) {
    if (!exists(file)) continue;
    const have = rows();
    for (const row of want) r.check(have.filter((x) => x === row).length === 1, `${file}: the keys table needs exactly one row "${row}" (as in keys.json)`);
    for (const row of have) r.check(want.includes(row), `${file}: the keys table has a row "${row}" that keys.json does not have`);
  }
}

// ---- the privacy page names what exists
if (exists("docs/privacy.html")) {
  const privacy = read("docs/privacy.html");
  const sources = repoFiles().filter((f) => /^mods\/[^/]+\/[^/]+\.(js|mjs)$/.test(f)).map((f) => read(f)).join("\n");
  const idents = new Set();
  for (const dd of privacy.matchAll(/<dt>Where to check<\/dt>\s*<dd>([\s\S]*?)<\/dd>/g)) for (const m of dd[1].matchAll(/<code>([^<]+)<\/code>/g)) idents.add(m[1].trim());
  r.check(idents.size >= 10, 'docs/privacy.html: found fewer than 10 identifiers in "Where to check" cells (markup changed?)');
  for (const id of idents) r.check(new RegExp(`(^|[^\\w$])${id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^\\w$]|$)`).test(sources), `docs/privacy.html: "Where to check" names \`${id}\`, which is not in any mod source`);
  const readme = read("README.md");
  for (const m of modFolders()) {
    r.check(readme.includes(`\`${m}\``), `README.md does not name the mod \`${m}\``);
    r.check(privacy.includes(m), `docs/privacy.html does not describe the mod ${m}`);
  }
}

r.note(`${MD.length} Markdown, ${HTML.length} HTML, ${TXT.length} text file(s) inspected`);
r.done();
