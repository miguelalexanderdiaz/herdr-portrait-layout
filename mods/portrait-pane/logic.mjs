// Pure helpers of portrait-pane (no gpui-kit, no herdr): `node --test` loads this file.
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

// <shared:alpha>
// `color` ("#rrggbb" or "#rrggbbaa") at opacity `a` (0 to 1); anything else comes back as it was.
export function alpha(color, a) {
  const m = /^#([0-9a-f]{6})(?:[0-9a-f]{2})?$/i.exec(typeof color === "string" ? color : "");
  if (!m) return color;
  return "#" + m[1] + Math.round(Math.max(0, Math.min(1, Number(a) || 0)) * 255).toString(16).padStart(2, "0");
}
// </shared:alpha>
