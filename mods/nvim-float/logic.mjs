// Pure helpers of nvim-float (no gpui-kit, no herdr): `node --test` loads this file.
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
