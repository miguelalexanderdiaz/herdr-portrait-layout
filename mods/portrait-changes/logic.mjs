// Pure logic of the Changes panel (mods/portrait-changes): no host calls, so `node --test` covers it.

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

// The panel works only while it is on screen: the side panel is open with Changes selected.
export function changesVisible(root) {
  const panel = find(root, "panel"), body = find(root, "panel-body");
  if (!panel && !body) return true;
  if (panel?.hidden) return false;
  return body ? body.active === "changes" : true;
}

// Watching a whole home folder or a drive root is far too much: those rely on the timer.
export const watchable = (root, home) => Boolean(root) && tilde(root, home) !== "~" && !/^([A-Za-z]:)?[\\/]*$/.test(root);

export const baseName = (path) => String(path ?? "").replace(/[\\/]+$/, "").split(/[\\/]/).pop() ?? "";

// `git worktree list --porcelain`: the main checkout comes first, the rest by name. A bare entry
// has nothing to show and a prunable one is gone from the disk.
export function parseWorktrees(text) {
  const out = [];
  for (const block of String(text ?? "").split(/\n\n+/)) {
    const lines = block.split("\n");
    const path = lines.find((l) => l.startsWith("worktree "))?.slice(9);
    if (!path) continue;
    if (lines.includes("bare") || lines.some((l) => l === "prunable" || l.startsWith("prunable "))) continue;
    const branch = lines.find((l) => l.startsWith("branch "))?.slice(7).replace(/^refs\/heads\//, "") ?? null;
    out.push({ path, branch });
  }
  const [main, ...rest] = out;
  const name = (w) => w.branch ?? baseName(w.path);
  return main ? [main, ...rest.sort((a, b) => name(a).localeCompare(name(b)))] : [];
}

// `git status --porcelain=v1 -z --branch`: the branch line, then one entry per changed file.
export function parseStatus(text) {
  const entries = String(text ?? "").split("\0").filter(Boolean);
  let branch = null;
  if (entries[0]?.startsWith("## ")) {
    const line = entries.shift().slice(3);
    if (!line.startsWith("HEAD (no branch)")) branch = line.replace(/^(No commits yet on|Initial commit on) /, "").split("...")[0].trim() || null;
  }
  return { branch, entries };
}

// One entry of that status as a row of the file list.
export function fileOf(entry, stats) {
  const xy = entry.slice(0, 2), path = entry.slice(3), fresh = xy === "??";
  const conflict = xy.includes("U") || xy === "AA" || xy === "DD";
  const status = conflict ? "U" : xy.includes("D") ? "D" : fresh || xy.includes("A") ? "A" : "M";
  return { path, status, fresh, ...(stats?.[path] ?? { add: 0, del: 0 }) };
}

// `git diff --numstat -z --no-renames`, added to what `stats` holds.
export function addNumstat(stats, text) {
  for (const entry of String(text ?? "").split("\0")) {
    const [a, d, ...parts] = entry.split("\t");
    if (!parts.length) continue;
    const path = parts.join("\t"), old = stats[path] ?? { add: 0, del: 0 };
    stats[path] = { add: old.add + (Number(a) || 0), del: old.del + (Number(d) || 0), binary: a === "-" };
  }
  return stats;
}

export const countLines = (text) => (text ? text.split("\n").length - Number(text.endsWith("\n")) : 0);

// Numbers each diff line once, so a frame only draws the rows on screen.
export function diffRows(lines) {
  let old = 0, next = 0;
  return lines.map((line) => {
    const match = /^@@ -(\d+)(?:,\d+)? \+(\d+)/.exec(line);
    if (match) { old = +match[1]; next = +match[2]; return { kind: "@", text: line }; }
    const kind = line[0];
    if (kind === "-") return { kind, number: old++, text: line.slice(1) || " " };
    if (kind === "+") return { kind, number: next++, text: line.slice(1) || " " };
    if (kind === " ") { old++; return { kind, number: next++, text: line.slice(1) || " " }; }
    return { kind: "", text: line };
  });
}

// The folders you added (shared "changes.folders"): on this computer, at most MAX_FOLDERS.
export const MAX_FOLDERS = 50;
export const readFolders = (value) => (Array.isArray(value) ? [...new Set(value.filter((p) => typeof p === "string" && p))].slice(0, MAX_FOLDERS) : []);
export const addFolder = (list, path) => readFolders([...readFolders(list), path]);
export const removeFolder = (list, path) => readFolders(list).filter((p) => p !== path);

export const rowKey = (row) => JSON.stringify([row.on ?? null, row.path]);

// The rows, in a steady order: the checkouts of the focused pane's repo, the repo the space was
// started in, the folders you added, then the open row when none of them lists it any more, so
// moving the focus never closes what you are reading. A folder is shown once.
export function mergeRows(worktrees, folders, open, start) {
  const rows = [], seen = new Map();
  const put = (row) => { const k = rowKey(row), had = seen.get(k); if (had) { Object.assign(had, row.added ? { added: true } : {}); return; } seen.set(k, row); rows.push(row); };
  for (const w of worktrees ?? []) put({ path: w.path, on: w.on ?? null, branch: w.branch ?? null, added: false, checkout: true });
  if (start) put({ path: start.path, on: start.on ?? null, branch: null, added: false, checkout: false });
  for (const path of readFolders(folders)) put({ path, on: null, branch: null, added: true, checkout: false });
  if (open) put({ ...open, added: false, checkout: false });
  return rows;
}

// What a row says. A checkout of the focused repo goes by its branch; any other folder by its
// own name, with the branch beside it, since two repos can both be on main.
export function rowTitle(row, fact) {
  const branch = fact?.branch ?? row.branch ?? null;
  return row.checkout ? { name: branch ?? baseName(row.path), sub: "" } : { name: baseName(row.path), sub: branch ?? "" };
}
export function rowMeta(fact) {
  if (!fact) return "";
  if (fact.error) return fact.error;
  return fact.files === 0 ? "" : `${fact.files} ${fact.files === 1 ? "file" : "files"}`;
}

// Latest change first: the uncommitted files' dates, else the last commit. A row with no date yet
// keeps its place after the dated ones.
export function sortRows(rows, factOf) {
  const at = (f) => (typeof f?.at === "number" ? f.at : -1);
  return rows.map((row, i) => ({ i, row, f: factOf(row) }))
    .sort((a, b) => at(b.f) - at(a.f) || a.i - b.i).map((x) => x.row);
}

// The two parts of the panel, keeping the order: folders with changes to review, and the rest.
// A folder that can't be read goes on top too: it must not pass for one without changes.
export const CANT_READ = "can't read";
export function splitRows(rows, factOf) {
  const changed = [], quiet = [];
  for (const row of rows) { const f = factOf(row); (f?.files > 0 || f?.error === CANT_READ ? changed : quiet).push(row); }
  return { changed, quiet };
}

// Applies an order saved earlier, by key; rows it doesn't know go last, in their own order.
export function applyOrder(rows, order) {
  const place = new Map((order ?? []).map((k, i) => [k, i]));
  return rows.map((row, i) => ({ row, i, at: place.get(rowKey(row)) ?? Infinity }))
    .sort((a, b) => (a.at === b.at ? a.i - b.i : a.at - b.at)).map((x) => x.row);
}

// The dates of up to MAX_STATTED changed files: the newest, in seconds, or null. `stat` prints one
// number per line. BSD and GNU spell it differently; a remote machine can be either.
export const MAX_STATTED = 50;
export const statArgs = (flavor, paths) => ["stat", flavor === "bsd" ? ["-f", "%m", "--", ...paths] : ["-c", "%Y", "--", ...paths]];
export function newestOf(text) {
  const times = String(text ?? "").split("\n").map((l) => l.trim()).filter((l) => /^\d+$/.test(l)).map(Number);
  return times.length ? Math.max(...times) : null;
}

// The worktrees that live inside `root`, relative to it.
export const nestedPaths = (root, worktrees) => (worktrees ?? []).map((w) => w.path).filter((p) => p.startsWith(`${root}/`)).map((p) => p.slice(root.length + 1));

// `git add` for a commit: everything, but never a worktree inside this one, which git would stage
// as an embedded repository. Pass only the paths that aren't ignored: git refuses a pathspec that
// names an ignored path, even to exclude it.
export const addArgs = (paths) => (paths?.length ? ["add", "-A", "--", ".", ...paths.map((p) => `:(exclude,literal)${p}`)] : ["add", "-A"]);

// A nested worktree that isn't ignored shows in status as an untracked folder: it is not a change.
export function withoutNested(entries, paths) {
  const folders = new Set((paths ?? []).map((p) => `?? ${p}/`));
  return entries.filter((e) => !folders.has(e));
}

// Why a commit must not run now, or null. `cdup` is `git rev-parse --show-cdup`: not empty means
// the folder has lost its own .git and git walked up to a parent repository.
export function commitBlock(files, cdup) {
  if (String(cdup ?? "").trim()) return "This folder is no longer a checkout of its own: a commit would land in the repository above it.";
  if ((files ?? []).some((f) => f.status === "U")) return "Resolve the conflicts first: a commit now would keep their markers.";
  return null;
}

// Refresh pacing: copied from portrait-files. A busy folder fires watch events all the time, so
// runs are at least `gap` ms apart, one at a time, and a request that arrives during a run is kept.
export const REFRESH_GAP = 1500;
export function createPacer({ gap = REFRESH_GAP, now = Date.now } = {}) {
  let running = false, again = false, booked = false, last = -Infinity;
  return {
    request(trailing = false) {
      if (trailing) booked = false;
      if (running) { again = true; return "skip"; }
      if (now() - last < gap) { if (booked) return "skip"; booked = true; return "later"; }
      return "now";
    },
    start() { running = true; again = false; last = now(); },
    finish() { running = false; const more = again; again = false; return more; },
    wait: () => Math.max(0, last + gap - now()),
  };
}
