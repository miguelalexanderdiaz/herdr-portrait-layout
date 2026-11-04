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
