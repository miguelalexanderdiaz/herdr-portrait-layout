#!/usr/bin/env node
// Privacy scan: nothing personal may ship. Scans every repo text file and, with --commits (CI does), the commit
// messages and author addresses of the history that is being published.
//
//   node scripts/privacy-scan.mjs [--commits [base-ref]]
//
// Flags: home-folder paths (/Users/<name>, /home/<name>, C:\Users\<name>), e-mail addresses, access tokens, private
// network addresses, `.local` host names, and any term from the optional denylist: `.privacy-denylist` (git-ignored,
// one term per line: your own name, employer, host names) and the PRIVACY_DENYLIST environment variable (CI secret,
// comma or newline separated). Placeholders such as <home> or ~ are fine. plans/ explains the patterns it looks for, so
// there a path or address is let through only on a line that shows a pattern (a regex, `<home>`, an ellipsis): a real
// path on a plain line of a plan fails like anywhere else. Tokens and denylist terms are never exempt.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { abs, isText, read, reporter, repoFiles } from "./lib.mjs";

const r = reporter("privacy-scan");

const PLACEHOLDER = /^(<[^>]*>|\$\{?\w+\}?|%\w+%|~|you|user|username|name|me|example|alice|bob|ann|<name>)$/i;
const rules = [
  { id: "mac home path", re: /\/Users\/([^/\s'"`)\],;:]+)/g, ok: (m) => PLACEHOLDER.test(m[1]) },
  { id: "linux home path", re: /\/home\/([^/\s'"`)\],;:]+)/g, ok: (m) => PLACEHOLDER.test(m[1]) },
  { id: "windows home path", re: /[A-Za-z]:\\+Users\\+([^\\\s'"`)\]]+)/g, ok: (m) => PLACEHOLDER.test(m[1]) },
  { id: "e-mail address", re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/g, ok: (m) => /^noreply@anthropic\.com$/.test(m[0]) || /^git@github\.com$/.test(m[0]), pathRule: true },
  { id: "token", re: /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{10,})\b/g, ok: () => false },
  { id: "private IPv4 address", re: /\b(?:10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})\b/g, ok: () => false },
  { id: ".local host name", re: /\b[A-Za-z0-9-]+\.local\b/g, ok: () => false },
];

const denylist = [
  ...(existsSync(abs(".privacy-denylist")) ? read(".privacy-denylist").split(/\r?\n/) : []),
  ...(process.env.PRIVACY_DENYLIST ?? "").split(/[\n,]/),
].map((s) => s.trim()).filter((s) => s && !s.startsWith("#"));
if (!denylist.length) r.note("no denylist: add terms to .privacy-denylist (git-ignored) or PRIVACY_DENYLIST to check names, employers and hosts");

// The LICENSE copyright line is the one place the author's name belongs (github.com/<owner>/<repo> addresses are
// allowed too: see scan()).
const EXEMPT_FILES = new Set(["LICENSE"]);
const PLAN_EXEMPT_RULES = (f) => f.startsWith("plans/");
// A line of a plan that talks about the pattern itself: <home>, a regex alternative or class, an ellipsis, a `(?` group.
const SHOWS_PATTERN = /<home>|\\\||\[\^?[a-z0-9]|\/\.\.|\.\.\.@|\(\?/;

function scan(label, text, { path, skipDenylist = false } = {}) {
  for (const rule of rules) {
    const planRule = path && PLAN_EXEMPT_RULES(path) && (rule.id.includes("path") || rule.id === "e-mail address");
    for (const m of text.matchAll(rule.re)) {
      if (rule.ok(m)) continue;
      const line = text.slice(0, m.index).split("\n").length;
      if (planRule && SHOWS_PATTERN.test(text.split("\n")[line - 1])) continue;
      r.error(`${label}:${line}: ${rule.id} "${m[0]}"`);
    }
  }
  if (!skipDenylist) {
    // The repository's own address (owner/name in a github.com URL) is allowed: installing needs it (decision D12).
    const low = text.replace(/github\.com[/:][\w.-]+\/[\w.-]+/gi, (m) => " ".repeat(m.length)).toLowerCase();
    for (const term of denylist) {
      const at = low.indexOf(term.toLowerCase());
      if (at >= 0) r.error(`${label}:${text.slice(0, at).split("\n").length}: denylist term "${term[0]}${"*".repeat(Math.max(0, term.length - 1))}" (${term.length} chars)`);
    }
  }
}

const files = repoFiles();
let scanned = 0;
for (const f of files) {
  if (!isText(f)) continue;
  scanned++;
  scan(f, read(f), { path: f, skipDenylist: EXEMPT_FILES.has(f) });
}
r.note(`${scanned} text file(s) scanned`);

// Binary assets: file names only (content is checked by check-assets.mjs).
for (const f of files) if (!isText(f)) scan(`(file name) ${f}`, f, { skipDenylist: false });

// ---- commit history
const ci = process.argv.includes("--commits");
if (ci) {
  const at = process.argv.indexOf("--commits");
  const base = process.argv[at + 1] && !process.argv[at + 1].startsWith("-") ? process.argv[at + 1] : null;
  try {
    const range = base ? [`${base}..HEAD`] : [];
    const msgs = execFileSync("git", ["log", "--format=%H%x1f%B%x1e", ...range], { cwd: abs("."), encoding: "utf8", maxBuffer: 1 << 26 });
    let n = 0;
    for (const rec of msgs.split("\x1e").map((s) => s.trim()).filter(Boolean)) {
      const [sha, body] = rec.split("\x1f");
      n++;
      scan(`commit ${sha.slice(0, 8)}`, body ?? "");
    }
    // Author and committer addresses: name the commit and the role so the owner can find it (git log --format='%h %ae %ce').
    const NOREPLY = /@users\.noreply\.github\.com$|^noreply@(github|anthropic)\.com$|^theoverfittingclub@gmail\.com$/; // last: the author's public commit address
    const log = execFileSync("git", ["log", "--format=%h%x1f%ae%x1f%ce", ...range], { cwd: abs("."), encoding: "utf8", maxBuffer: 1 << 26 });
    for (const row of log.split(/\r?\n/).filter(Boolean)) {
      const [sha, author, committer] = row.split("\x1f");
      for (const [role, addr] of [["author", author], ["committer", committer]]) {
        if (addr && !NOREPLY.test(addr)) r.error(`commit ${sha}: the ${role} address is not a GitHub noreply address ("${addr.replace(/^[^@]*/, "***")}"); see scripts/PUBLISH.md step 0`);
      }
    }
    r.note(`${n} commit message(s) scanned`);
  } catch (e) {
    r.note(`commit history not scanned (${String(e.message).split("\n")[0]})`);
  }
}

r.done();
