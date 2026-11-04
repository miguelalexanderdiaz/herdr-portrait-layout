// Pure helpers of portrait-tabs (no gpui-kit, no herdr): `node --test` loads this file.
// Blocks between "<shared:...>" markers are copies of the same blocks in other mods
// (tests/shared.test.mjs keeps them identical).

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
const isPlainObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
export const isStringArray = (v) => Array.isArray(v) && v.every((x) => typeof x === "string");
// Keep only the space ids that still exist, never pruning against an empty list (at startup the
// app may not have listed anything yet). The spaces of a machine that is not "ready" (loading,
// offline, unreachable) are just not listed yet, so their ids stay. `spaces`: spaces() (or plain
// ids); `machines`: machines(). A remote id is "<machine>/<id>", a local one has no "/"; a
// machine that machines() does not list is unknown, and unknown keeps.
export function pruneSpaceIds(ids, spaces, machines) {
  const listed = new Set((spaces ?? []).map((s) => (typeof s === "string" ? s : s?.id)));
  listed.delete(undefined);
  if (!listed.size) return [...ids];
  const state = new Map((Array.isArray(machines) ? machines : []).map((m) => [m?.name ?? null, m?.layout]));
  return [...ids].filter((id) => {
    if (listed.has(id)) return true;
    const slash = String(id).indexOf("/");
    const name = slash > 0 ? String(id).slice(0, slash) : null;
    return state.get(name) !== "ready";
  });
}
// </shared:storage>

// <shared:wheel>
export const WHEEL_IDLE = 400;
// A wheel or trackpad stream in `delta` px: how many whole `step`s it adds up to (signed, the
// sign of `delta`). The remainder is forgotten when the direction flips or the stream paused.
export function wheelSteps(state, delta, step, now, idle = WHEEL_IDLE) {
  let accum = state?.accum ?? 0;
  if (!delta) return { accum, at: state?.at ?? now, steps: 0 };
  if ((accum && Math.sign(accum) !== Math.sign(delta)) || now - (state?.at ?? now) > idle) accum = 0;
  accum += delta;
  const steps = Math.trunc(accum / step) || 0; // || 0: never -0
  return { accum: accum - steps * step, at: now, steps };
}
// One scroll event of `axis` ("x" or "y") into steps. A notched mouse wheel reports whole lines
// (`delta_lines`): one line is one step. A trackpad reports pixels: `pixelStep` px is one step.
// The remainder is dropped when a new gesture starts (`touch_phase` "started") or the unit changes.
export function wheelStream(state, event, axis, now, pixelStep = 40) {
  const lines = event?.delta_lines?.[axis];
  const byLine = Number.isFinite(lines) && lines !== 0;
  const amount = byLine ? lines : (Number(event?.delta?.[axis]) || 0);
  const prev = event?.touch_phase === "started" || state?.byLine !== byLine ? null : state;
  return { ...wheelSteps(prev, amount, byLine ? 1 : pixelStep, now), byLine };
}
// </shared:wheel>

export const WHEEL_STEP = 40; // trackpad px per tab (a mouse wheel notch is one tab)

// The panel choices kept per space: { spaceId: "files" | "changes" | ... | null }.
export const isPanels = (v) => isPlainObject(v) && Object.values(v).every((x) => x === null || typeof x === "string");
// Spaces that are gone lose their entry (never against an empty list, and never while their
// machine is not "ready": see pruneSpaceIds).
export function prunePanels(panels, spaces, machines) {
  const ids = pruneSpaceIds(Object.keys(panels), spaces, machines);
  return ids.length === Object.keys(panels).length ? panels : Object.fromEntries(ids.map((id) => [id, panels[id]]));
}

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

// <shared:panels>
// The panels a space may remember or show a button for: the shell's list (shared
// "workspace.panels"); anything that is not a list of names falls back to Files and Changes.
export function enabledPanels(shared) {
  return Array.isArray(shared) && shared.every((x) => typeof x === "string") ? shared : ["files", "changes"];
}
// </shared:panels>
