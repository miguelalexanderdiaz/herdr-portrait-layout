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
export const isPlainObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
export const isStringArray = (v) => Array.isArray(v) && v.every((x) => typeof x === "string");
// Keep only the ids that still exist, but never prune against an empty list: at startup the
// app may not have listed anything yet.
export function pruneIds(ids, live) {
  const keep = new Set(live);
  return keep.size ? [...ids].filter((id) => keep.has(id)) : [...ids];
}
// </shared:storage>

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

export const WHEEL_STEP = 40;

// The panel choices kept per space: { spaceId: "files" | "changes" | ... | null }.
export const isPanels = (v) => isPlainObject(v) && Object.values(v).every((x) => x === null || typeof x === "string");
// Spaces that are gone lose their entry (never against an empty list).
export function prunePanels(panels, live) {
  const ids = pruneIds(Object.keys(panels), live);
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

// <shared:vault>
// The Vault button and panel need the vault mod installed AND a `vault` child in the
// layout's panel stack (snippets/vault-panel.json); one without the other is a dead button.
export const vaultWanted = ({ installed, hasNode }) => installed === true && Boolean(hasNode);
// </shared:vault>

// The panels a space may remember: the shell's list (shared "workspace.panels") plus the vault.
export function enabledPanels(shared, { vault }) {
  const base = Array.isArray(shared) && shared.every((x) => typeof x === "string") ? shared : ["files", "changes"];
  return vault ? [...base.filter((x) => x !== "vault"), "vault"] : base.filter((x) => x !== "vault");
}
