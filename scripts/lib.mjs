// Shared helpers for the repo checks. Dependency-free, Node 22+, identical on Linux, macOS and Windows:
// no shell, no POSIX-only paths, every path is built with node:path and shown with forward slashes.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export const posix = (p) => p.split(sep).join("/");
export const abs = (...p) => join(ROOT, ...p);
export const read = (p) => readFileSync(abs(p), "utf8").replace(/\r\n/g, "\n");
export const exists = (p) => existsSync(abs(p));
// SHA-256 of a text file with line endings normalised to LF, so a Windows checkout with autocrlf hashes the same.
export const sha256 = (p) => createHash("sha256").update(read(p)).digest("hex");
export const json = (p) => JSON.parse(read(p));

// Files that belong to the repo: `git ls-files` plus untracked-but-not-ignored files, so the checks also see a
// file that is about to be committed. Falls back to walking the folder when git is missing (a zip download).
export function repoFiles() {
  try {
    const out = execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], { cwd: ROOT, encoding: "utf8", maxBuffer: 1 << 26, stdio: ["ignore", "pipe", "ignore"] });
    const list = out.split("\0").filter(Boolean).filter((f) => existsSync(abs(f)));
    if (list.length) return [...new Set(list)].sort();
  } catch { /* not a git checkout */ }
  const skip = new Set([".git", "node_modules", ".wt"]);
  const walk = (dir) => readdirSync(dir).flatMap((name) => {
    if (skip.has(name)) return [];
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [posix(relative(ROOT, full))];
  });
  return walk(ROOT).sort();
}

export const TEXT_EXT = /\.(md|txt|json|js|mjs|cjs|svg|html|css|yml|yaml|toml|gitignore|gitattributes)$|(^|\/)(LICENSE|NOTICE|\.gitignore|\.gitattributes|\.editorconfig)$/;
export const isText = (f) => TEXT_EXT.test(f);

// A tiny reporter: collect problems, print them, exit non-zero when there are any.
export function reporter(name) {
  const errors = [];
  const notes = [];
  return {
    error: (msg) => errors.push(msg),
    note: (msg) => notes.push(msg),
    check: (cond, msg) => { if (!cond) errors.push(msg); return Boolean(cond); },
    done() {
      for (const n of notes) console.log(`  note: ${n}`);
      if (errors.length) {
        console.error(`${name}: ${errors.length} problem(s)`);
        for (const e of errors) console.error(`  - ${e}`);
        process.exit(1);
      }
      console.log(`${name}: ok`);
    },
  };
}

// Stable JSON for comparing two trees whatever their key order.
export function canonical(v) {
  if (Array.isArray(v)) return v.map(canonical);
  if (v && typeof v === "object") return Object.fromEntries(Object.keys(v).sort().map((k) => [k, canonical(v[k])]));
  return v;
}

export function modFolders() {
  return readdirSync(abs("mods")).filter((n) => statSync(abs("mods", n)).isDirectory()).sort();
}

export function layoutNames() {
  return readdirSync(abs("layouts")).filter((n) => n.endsWith(".json")).map((n) => n.slice(0, -5)).sort();
}

// Every node of a layout tree, with its parent.
export function* nodes(node, parent = null) {
  yield { node, parent };
  for (const c of node.children ?? []) yield* nodes(c, node);
}
