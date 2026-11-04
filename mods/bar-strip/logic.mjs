// Pure helpers of bar-strip (no gpui-kit, no herdr): `node --test` loads this file.
// Blocks between "<shared:...>" markers are copies of the same blocks in other mods
// (tests/shared.test.mjs keeps them identical).

// The key commands (`<mod>.<command>` in keys.json) and the mod that serves them.
export const PICKER = "attention-picker";
export const ATTENTION = "bar-strip.attention";

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

// <shared:join>
// base + parts joined with the separator `base` already uses (a Windows app home has backslashes).
export function joinPath(base, ...parts) {
  const sep = base.includes("\\") && !base.includes("/") ? "\\" : "/";
  return [base.replace(/[\\/]+$/, ""), ...parts.map((p) => p.replace(/[\\/]+/g, sep))].join(sep);
}
// </shared:join>

// The key that runs `action` in the shown layout: its own section wins over `global`
// (as Herdr resolves them). "" when it is not bound. Accepts both spellings of a mod command.
export function keyHint(bindings, layoutName, action = ATTENTION) {
  const names = [action, action.replace(".", ":")];
  const hit = (section) => (Array.isArray(bindings) ? bindings : []).find((b) => b?.section === section && names.includes(b.action) && typeof b.keys === "string" && b.keys);
  return (layoutName && hit(`layout:${layoutName}`))?.keys ?? hit("global")?.keys ?? "";
}

// Agents waiting on you: first those asking for input, then those that finished while you
// weren't looking; each group longest-waiting first (lower seq = changed longer ago).
export function waitingAgents(list) {
  const by = (st) => list.filter((a) => a.status === st).sort((a, b) => a.seq - b.seq);
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
