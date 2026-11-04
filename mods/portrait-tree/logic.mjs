// Pure helpers of portrait-tree: no gpui-kit, no herdr, so `node --test tests/` can load them.
// Blocks between "<shared:...>" markers are copied byte for byte into other mods
// (tests/shared.test.mjs keeps the copies identical).

// ---- colors -----------------------------------------------------------------------------

// Colors mixed in sRGB: the title's rule is the space's color, softened toward the
// column background while another space is the active one.
export const rgb = (hex) => { const n = parseInt(/^#?([0-9a-f]{6})/i.exec(hex ?? "")?.[1] ?? "808080", 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
export const hex = (c) => "#" + c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");
// Text on the space's letter badge: white or near-black, whichever contrasts more.
export const lumOf = (h) => { const l = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; const [r, g, b] = rgb(h); return 0.2126 * l(r) + 0.7152 * l(g) + 0.0722 * l(b); };
export const inkOn = (h) => (1.05 / (lumOf(h) + 0.05) >= (lumOf(h) + 0.05) / (0.007 + 0.05) ? "#ffffff" : "#141414");
export const mix = (a, b, k) => hex(rgb(a).map((v, i) => v + (rgb(b)[i] - v) * k));

// ---- text -------------------------------------------------------------------------------

export const clean = (s) => (s ?? "").replace(/^[^\p{L}\p{N}]+/u, "").trim();

export function duration(ms) {
  const m = Math.floor(ms / 60000);
  if (m < 1) return "<1m";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}h` : `${Math.floor(h / 24)}d`;
}

// An agent's own name: its title (a Claude session's name), else a named tab, else its program.
export function nameOf(a) {
  const title = clean(a.title);
  // A path or user@host title (a shell's) says nothing about the agent. Looked up before clean(),
  // which would strip the leading "~/" and make a path look like a name.
  const raw = (a.title ?? "").trim();
  const telling = title && !/^[~/]|^[A-Za-z]:\\/.test(raw) && !/^[~/]|^[A-Za-z]:\\/.test(title) && !title.includes("@") && title !== a.program?.name;
  if (telling) return title;
  if (a.tab_name && !/^\d+$/.test(a.tab_name)) return a.tab_name;
  return a.program?.name || a.app || "agent";
}

// Same name twice in one tab: number them, in list order. Returns address -> display name.
export function dedupeNames(list) {
  const key = (a) => `${a.tab}\u0000${a.name}`;
  const total = new Map(), nth = new Map(), out = new Map();
  for (const a of list) total.set(key(a), (total.get(key(a)) ?? 0) + 1);
  for (const a of list) {
    const n = (nth.get(key(a)) ?? 0) + 1;
    nth.set(key(a), n);
    out.set(a.address, total.get(key(a)) > 1 ? `${a.name} (${n})` : a.name);
  }
  return out;
}

// ---- paths ------------------------------------------------------------------------------

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

// <shared:note>
// A note kept by the vault reader (shared "vault.panes": pane id -> { vault, file, id }).
// A record from another version of that mod may lack fields: never throw on one.
export function noteParts(note) {
  const file = typeof note?.file === "string" ? note.file : "";
  const vault = typeof note?.vault === "string" ? basename(note.vault) : "";
  const dir = dirname(file);
  return {
    name: basename(file).replace(/\.(excalidraw\.md|md|canvas)$/i, "") || "Note",
    dir,
    vault,
    path: [vault, dir].filter(Boolean).join("/"),
  };
}
// </shared:note>

// ---- persisted state --------------------------------------------------------------------

// <shared:storage>
// localStorage "can come back empty or throw" (private windows, blocked site data).
export const safeStorage = (get) => ({
  getItem(key) { try { return get().getItem(key); } catch { return null; } },
  setItem(key, value) { try { get().setItem(key, value); return true; } catch { return false; } },
});
// The parsed value when it exists, parses and passes `validate`; else `fallback`.
export function readJson(storage, key, fallback, validate = () => true) {
  try {
    const raw = storage.getItem(key);
    if (raw == null) return fallback;
    const value = JSON.parse(raw);
    return validate(value) ? value : fallback;
  } catch { return fallback; }
}
export const writeJson = (storage, key, value) => storage.setItem(key, JSON.stringify(value));
export const isPlainObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
export const isStringArray = (v) => Array.isArray(v) && v.every((x) => typeof x === "string");
// Keep only the ids that still exist, but never prune against an empty list: at startup the
// app may not have listed anything yet.
export function pruneIds(ids, live) {
  const keep = new Set(live);
  return keep.size ? [...ids].filter((id) => keep.has(id)) : [...ids];
}
// </shared:storage>

export const isChangedMap = (v) => isPlainObject(v) && Object.values(v).every((e) => isPlainObject(e) && typeof e.s === "string" && Number.isFinite(e.at));
export const CHANGED_TTL = 7 * 24 * 3600 * 1000;
// Agents' last state changes: drop dead agents' entries once they are a week old.
export function pruneChanged(changed, liveAddresses, now, ttl = CHANGED_TTL) {
  const live = new Set(liveAddresses);
  if (!live.size) return changed;
  const out = {};
  for (const [address, e] of Object.entries(changed)) if (live.has(address) || now - e.at < ttl) out[address] = e;
  return Object.keys(out).length === Object.keys(changed).length ? changed : out;
}

// ---- spines -----------------------------------------------------------------------------

export const SPINE_H = 600;
export const SPINE_DIR = "data/portrait-tree-spines";
export function spineFile(name) {
  let h = 5381;
  for (const ch of name) h = ((h * 33) ^ ch.codePointAt(0)) >>> 0;
  return `${SPINE_DIR}/${h.toString(36)}.svg`;
}
// Text for an XML document: markup characters escaped, characters XML 1.0 forbids dropped.
export const xml = (str) => str.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, "")
  .replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;" })[c]);
export const spineSvg = (name) => `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="${SPINE_H}" viewBox="0 0 16 ${SPINE_H}">
  <text x="0" y="-4" transform="rotate(90)" font-family="Geist, Segoe UI, Helvetica Neue, Helvetica, Arial, sans-serif" font-size="13" font-weight="500" fill="currentColor">${xml(name)}</text>
</svg>
`;
// <shared:join>
// base + parts joined with the separator `base` already uses (a Windows app home has backslashes).
export function joinPath(base, ...parts) {
  const sep = base.includes("\\") && !base.includes("/") ? "\\" : "/";
  return [base.replace(/[\\/]+$/, ""), ...parts.map((p) => p.replace(/[\\/]+/g, sep))].join(sep);
}
// </shared:join>

// Writes each folded space's spine once. `fs` is "fs/promises" (or a fake); `root()` is the
// app home. A write that fails is not tried again for `cooldown` ms and the caller has nothing
// to redraw for it, so an unwritable folder cannot cause a render loop.
export function createSpineStore({ fs, root, now = Date.now, cooldown = 60000 }) {
  const ready = new Set(), pending = new Set(), failed = new Map();
  return {
    file: spineFile,
    ready: (name) => ready.has(spineFile(name)),
    // Starts the write when needed and returns a promise of "it is on disk now" (false when it
    // failed); null when nothing had to start (already written, in flight, or cooling down).
    request(name) {
      const file = spineFile(name);
      if (ready.has(file) || pending.has(file)) return null;
      const at = failed.get(file);
      if (at !== undefined && now() - at < cooldown) return null;
      pending.add(file);
      return (async () => {
        try {
          const path = joinPath(root(), file);
          const want = spineSvg(name);
          const have = await fs.readFile(path, "utf8").catch(() => null);
          if (have !== want) {
            await fs.mkdir(joinPath(root(), SPINE_DIR), { recursive: true });
            await fs.writeFile(path, want);
          }
          ready.add(file); failed.delete(file);
          return true;
        } catch {
          failed.set(file, now());
          return false;
        } finally {
          pending.delete(file);
        }
      })();
    },
    // Deletes the spine files of names that no longer exist. Only *.svg in the spine folder.
    async prune(names) {
      const keep = new Set([...names].map((n) => spineFile(n).slice(SPINE_DIR.length + 1)));
      if (!keep.size) return [];
      const removed = [];
      try {
        for (const f of await fs.readdir(joinPath(root(), SPINE_DIR))) {
          if (!f.endsWith(".svg") || keep.has(f)) continue;
          try { await fs.unlink(joinPath(root(), SPINE_DIR, f)); removed.push(f); } catch {}
          ready.delete(`${SPINE_DIR}/${f}`);
        }
      } catch {}
      return removed;
    },
  };
}

// ---- columns ----------------------------------------------------------------------------

export const MIN_COL = 290;
export const FOLDED_COL = 34;
export const MARKER = 28;

// Which run of whole columns is on screen. `widths`: each space's column width (unzoomed px);
// `width`: the row's reported width (zoomed); `start`: first column shown now; `follow`: the
// active space changed, so bring it on screen. Returns where the run starts and ends, how much
// room it has and the furthest start that still fills the row.
export function planColumns({ widths, width, zoom = 1, active = -1, follow = false, start = 0, strip = FOLDED_COL, marker = MARKER }) {
  const n = widths.length;
  const z = Number(zoom) > 0 ? Number(zoom) : 1;
  const avail = width / z - strip; // minus the "+" strip
  const total = widths.reduce((a, w) => a + w, 0);
  const windowed = n > 0 && width > 0 && total > avail;
  const room = Math.max(0, windowed ? avail - 2 * marker : avail);
  if (!windowed) return { windowed: false, avail, room, start: 0, end: n, lastStart: 0 };
  let last = n - 1;
  for (let used = widths[last]; last > 0 && used + widths[last - 1] <= room; last--) used += widths[last - 1];
  const fits = (from) => { let e = from, used = 0; while (e < n && used + widths[e] <= room) used += widths[e++]; return Math.max(e, from + 1); };
  let s = start;
  if (follow && active >= 0 && active < n) {
    if (active < s) s = active;
    else if (active >= fits(s)) {
      let from = active;
      for (let used = widths[active]; from > 0 && used + widths[from - 1] <= room; from--) used += widths[from - 1];
      s = from;
    }
  }
  s = Math.max(0, Math.min(s, last));
  return { windowed: true, avail, room, start: s, end: fits(s), lastStart: last };
}

export const WHEEL_STEP = 40;
export const WHEEL_IDLE = 400;
// <shared:wheel>
// A wheel or trackpad stream in `delta` px: how many whole `step`s it adds up to (signed, the
// sign of `delta`). The remainder is forgotten when the direction flips or the stream paused.
export function wheelSteps(state, delta, step, now, idle = 400) {
  let accum = state?.accum ?? 0;
  if (!delta) return { accum, at: state?.at ?? now, steps: 0 };
  if ((accum && Math.sign(accum) !== Math.sign(delta)) || now - (state?.at ?? now) > idle) accum = 0;
  accum += delta;
  const steps = Math.trunc(accum / step) || 0; // || 0: never -0
  return { accum: accum - steps * step, at: now, steps };
}
// </shared:wheel>
