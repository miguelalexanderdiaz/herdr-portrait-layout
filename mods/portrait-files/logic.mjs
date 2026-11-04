// Pure helpers of portrait-files (no gpui-kit, no herdr): `node --test` loads this file.
// Blocks between "<shared:...>" markers are copies of the same blocks in other mods
// (tests/shared.test.mjs keeps them identical).

// <shared:paths>
// `~` for the home folder, for any OS: separators are compared as "/", a Windows
// drive letter ignores case, and only the folder itself or something inside it matches
// (never a sibling that merely starts with the same letters, never a home of "/").
export function tilde(path, home) {
  if (typeof path !== "string" || !path) return "";
  if (typeof home !== "string") return path;
  const slash = (s) => s.replace(/\\/g, "/");
  const h = slash(home).replace(/\/+$/, "");
  if (!h) return path;
  const p = slash(path);
  const same = /^[A-Za-z]:/.test(h) ? (a, b) => a.toLowerCase() === b.toLowerCase() : (a, b) => a === b;
  if (same(p.replace(/\/+$/, ""), h)) return "~";
  if (p.length > h.length && p[h.length] === "/" && same(p.slice(0, h.length), h)) return "~" + p.slice(h.length);
  return path;
}
export const basename = (p) => (typeof p === "string" ? p.split(/[\\/]/).pop() : "") ?? "";
export const dirname = (p) => (typeof p === "string" ? p.slice(0, Math.max(0, Math.max(p.lastIndexOf("/"), p.lastIndexOf("\\")))) : "");
// </shared:paths>

// <shared:find>
// Search `node` and its children for `id` (a layout tree from layout()).
export function find(node, id) {
  if (node?.id === id) return node;
  for (const child of node?.children ?? []) {
    const found = find(child, id);
    if (found) return found;
  }
  return null;
}
// </shared:find>

// <shared:nvim>
// nvim without depending on the user's login shell dialect (fish and csh have no $0/$1):
// the PATH of the login shell is read once (`printenv PATH` is an external command, so it
// prints the same in bash, zsh, fish and csh), then everything runs in plain POSIX sh.
const loginPaths = new Map(), nvimOn = new Set();
export function loginPath(exec, on) {
  const key = on ?? "";
  if (!loginPaths.has(key)) {
    loginPaths.set(key, (async () => {
      try {
        const r = await exec("sh", ["-c", 'exec "${SHELL:-sh}" -lc "printenv PATH"'], { on: on || undefined });
        // A login shell may print a banner first: the PATH is the last line.
        return (r.code === 0 && r.stdout.trim().split("\n").pop().trim()) || null;
      } catch { return null; }
    })().then((p) => { if (!p) loginPaths.delete(key); return p; }));
  }
  return loginPaths.get(key);
}
// ["sh", "-c", ...] running `script` with PATH set to `pathValue`; `args` are its $1, $2, ...
// (arguments, never code: a quote or a space in a file name is safe).
export function nvimArgv(pathValue, script, ...args) {
  return ["sh", "-c", 'if [ -n "$1" ]; then PATH="$1"; export PATH; fi; shift; ' + script, "sh", pathValue ?? "", ...args];
}
// Click-to-edit needs nvim and a POSIX sh: on Windows the local machine gets the read-only preview.
export const platformMode = (platform, on) => (on || platform !== "windows" ? "nvim" : "preview");
// Is nvim on the (login) PATH of that machine? Only a yes is remembered.
export async function nvimFound(exec, on) {
  const key = on ?? "";
  if (nvimOn.has(key)) return true;
  const argv = nvimArgv(await loginPath(exec, on), "command -v nvim >/dev/null 2>&1");
  const r = await exec(argv[0], argv.slice(1), { on: on || undefined }).catch(() => null);
  if (r?.code === 0) nvimOn.add(key);
  return r?.code === 0;
}
// </shared:nvim>

// ---- when to work -----------------------------------------------------------------------

// Is the Files panel on screen? The layout's `panel` is shown and its stack `panel-body` has
// `files` active. A layout without those nodes (the mod used somewhere else) counts as visible.
export function filesVisible(root) {
  const panel = find(root, "panel"), body = find(root, "panel-body");
  if (!panel && !body) return true;
  if (panel?.hidden) return false;
  return body ? body.active === "files" : true;
}
// Watching a whole home folder or a drive root is far too much: those rely on the timer.
export const watchable = (root, home) => Boolean(root) && tilde(root, home) !== "~" && !/^([A-Za-z]:)?[\\/]*$/.test(root);

// One click opens one editor: the gate stays shut from the click until its window is up (or gave up).
// It opens again by itself after `ttl` ms so a lost event can never lock the panel.
export function createGate(ttl = 30000, now = Date.now) {
  let since = null;
  const busy = () => since !== null && now() - since < ttl;
  return {
    enter() { if (busy()) return false; since = now(); return true; },
    leave() { since = null; },
    get busy() { return busy(); },
  };
}
// "nvim", then "nvim-2", ... : hc names are unique among live terminals.
export function freeName(taken) {
  const used = new Set(taken);
  let name = "nvim";
  for (let n = 2; used.has(name); n++) name = `nvim-${n}`;
  return name;
}

// ---- git marks --------------------------------------------------------------------------

// One letter for a two-letter `git status` code: U conflict, A new, D deleted, else M.
export function markOf(xy) {
  if (["DD", "AU", "UD", "UA", "DU", "AA", "UU"].includes(xy)) return "U";
  if (xy === "??" || xy.includes("A")) return "A";
  if (xy.includes("D")) return "D";
  return "M";
}
// `git status --porcelain=v1 -z --no-renames` -> { "path relative to the shown folder": mark }.
// Paths in that output are relative to the repository root; `prefix` is the shown folder
// relative to it (`git rev-parse --show-prefix`, "" at the top, "src/" below), so no absolute
// path, separator or symlink can make a mark miss its row. Entries outside the folder are ignored.
export function parseStatus(stdout, prefix = "", limit = 5000) {
  const marks = {};
  let n = 0;
  for (const entry of stdout.split("\0")) {
    if (entry.length < 4 || entry[2] !== " ") continue;
    let path = entry.slice(3);
    if (prefix) { if (!path.startsWith(prefix)) continue; path = path.slice(prefix.length); }
    if (!path) continue;
    marks[path] = markOf(entry.slice(0, 2));
    if (++n >= limit) break;
  }
  return marks;
}
// The same marks plus one for every folder that holds a marked file ("U" if any is a conflict,
// else "M"), so a collapsed folder shows that something inside changed.
export function bubble(marks) {
  const out = { ...marks }, folders = {};
  for (const [path, mark] of Object.entries(marks)) {
    for (let i = path.indexOf("/"); i > 0; i = path.indexOf("/", i + 1)) {
      const dir = path.slice(0, i);
      if (folders[dir] !== "U") folders[dir] = mark === "U" ? "U" : "M";
    }
  }
  return Object.assign(out, folders);
}

// ---- listing ----------------------------------------------------------------------------

// Herdr's script engine has no Intl: fall back to localeCompare there.
const collator = typeof Intl !== "undefined" ? new Intl.Collator() : { compare: (a, b) => a.localeCompare(b) };
// Folders first, then by name; THEN cut to `per` entries and what is left of `budget` (the
// total all open folders may show). `limited`: something was cut.
export function arrange(entries, per, budget) {
  const sorted = [...entries].sort((a, b) => Number(b.dir) - Number(a.dir) || collator.compare(a.name, b.name));
  return { list: sorted.slice(0, Math.max(0, Math.min(per, budget))), limited: entries.length > per || entries.length > budget };
}
