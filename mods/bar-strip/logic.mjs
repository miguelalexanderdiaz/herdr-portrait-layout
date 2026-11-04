// Pure helpers of bar-strip (no gpui-kit, no herdr): `node --test` loads this file.
// Blocks between "<shared:...>" markers are copies of the same blocks in other mods
// (tests/shared.test.mjs keeps them identical).

// The key commands (`<mod>.<command>` in keys.json) and the mod that serves them.
export const PICKER = "attention-picker";
export const ATTENTION = "bar-strip.attention";
// What ctrl-shift-j is bound to in keys.json: the picker opened as a mod (works with the bar
// hidden, which is when this mod's own commands have no receiver). The tooltip names either.
export const PICKER_KEY = `mod.open:${PICKER}`;
export const KEY_ACTIONS = [PICKER_KEY, ATTENTION];

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

// <shared:alpha>
// `color` ("#rrggbb" or "#rrggbbaa") at opacity `a` (0 to 1); anything else comes back as it was.
export function alpha(color, a) {
  const m = /^#([0-9a-f]{6})(?:[0-9a-f]{2})?$/i.exec(typeof color === "string" ? color : "");
  if (!m) return color;
  return "#" + m[1] + Math.round(Math.max(0, Math.min(1, Number(a) || 0)) * 255).toString(16).padStart(2, "0");
}
// </shared:alpha>

// The key that runs one of `actions` (a name or a list) in the shown layout: its own section wins
// over `global` (as Herdr resolves them). "" when none is bound. A mod command (`bar-strip.attention`)
// is accepted in both spellings (`bar-strip:attention`).
export function keyHint(bindings, layoutName, actions = KEY_ACTIONS) {
  const names = [].concat(actions).flatMap((a) => (a.includes(":") ? [a] : [a, a.replace(".", ":")]));
  const hit = (section) => (Array.isArray(bindings) ? bindings : []).find((b) => b?.section === section && names.includes(b.action) && typeof b.keys === "string" && b.keys);
  return (layoutName && hit(`layout:${layoutName}`))?.keys ?? hit("global")?.keys ?? "";
}

// Agents waiting on you: first those asking for input, then those that finished while you
// weren't looking; each group longest-waiting first. "Longest" is by the time the agent got its
// state (shared "agents.since": address -> epoch ms, published by portrait-tree, the same order
// the waiting list shows); an agent without an entry comes after those with one, by `seq`
// (lower = changed longer ago, but any change moves it, a title too).
export function waitingAgents(list, since) {
  const at = (a) => { const v = since && typeof since === "object" ? since[a.address] : undefined; return Number.isFinite(v) ? v : null; };
  const older = (a, b) => {
    const x = at(a), y = at(b);
    if (x !== null && y !== null && x !== y) return x - y;
    if ((x === null) !== (y === null)) return x === null ? 1 : -1;
    return a.seq - b.seq;
  };
  const by = (st) => list.filter((a) => a.status === st).sort(older);
  return [...by("blocked"), ...by("done")];
}

// Which waiting agent the bell goes to: the one after the focused one (wrapping); a finished
// agent turns idle once seen and leaves the list, so when we are still on the one we jumped
// to, the next is whatever took its place (`last` = { address, index } of the previous jump).
export function nextWaiting(waiting, focusedAddress, last) {
  if (!waiting.length) return null;
  const at = waiting.findIndex((a) => a.address === focusedAddress);
  let next = at + 1;
  if (at === -1 && last && focusedAddress === last.address) next = last.index;
  next %= waiting.length;
  return { index: next, address: waiting[next].address };
}
