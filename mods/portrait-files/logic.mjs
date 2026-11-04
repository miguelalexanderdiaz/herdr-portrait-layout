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
// ["sh", "-c", ...] running `script` with `pathValue` (the login shell's PATH) in front of the
// PATH it inherits, so the system folders stay even when a profile prints a short list; `args` are its $1, $2, ...
// (arguments, never code: a quote or a space in a file name is safe).
export function nvimArgv(pathValue, script, ...args) {
  return ["sh", "-c", 'if [ -n "$1" ]; then PATH="$1:$PATH"; export PATH; fi; shift; ' + script, "sh", pathValue ?? "", ...args];
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

// Refresh pacing. A busy folder (a build writing files, a dev server) fires watch events all
// the time, and every refresh lists the open folders and runs git: runs are at least `gap` ms
// apart, one at a time, and a request that arrives while one runs is not lost.
//   request(trailing)  "now": run now (call start()); "later": run after wait() ms and ask again
//                      with trailing = true; "skip": nothing to do (a run is on, or one is booked).
//   finish()           true when a request came in during the run, so ask once more.
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
    get busy() { return running; },
  };
}

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
// "nvim", then "nvim-2", ... (or "hx", "hx-2", ...): hc names are unique among live terminals.
export function freeName(taken, base = "nvim") {
  const used = new Set(taken);
  let name = base;
  for (let n = 2; used.has(name); n++) name = `${base}-${n}`;
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

// ---- what a click opens ------------------------------------------------------------------

// Pictures and PDFs open in the viewer (mods/portrait-viewer); documents, media and archives in
// the system's app; anything else is text for the chosen editor.
const IMAGE_EXT = /\.(png|jpe?g|gif|webp|bmp|svg|avif|tiff?)$/i;
// Binary programs and installers: never text, and never started (canOpen says no).
const BINARY_PROGRAM_EXT = /\.(exe|msi|msp|dmg|pkg|deb|rpm|apk|jar|appimage|bin|com|scr|pif|lnk|app)$/i;
const OTHER_EXT = /\.(docx?|xlsx?|pptx?|od[tspg]|rtf|pages|numbers|key|epub|mobi|zip|tar|gz|tgz|bz2|xz|zst|7z|rar|iso|img|mp3|wav|flac|aac|ogg|opus|m4a|mp4|m4v|mov|mkv|avi|webm|wmv|ttf|otf|woff2?|eot|sqlite3?|db|psd|ai|sketch|fig|xcf|heic|heif|ico|icns|raw|cr2|nef|class|o|a|so|dylib|dll|wasm|pyc|parquet|npy|pkl|onnx)$/i;
export function fileKind(name) {
  const s = String(name ?? "");
  if (/\.pdf$/i.test(s)) return "pdf";
  if (IMAGE_EXT.test(s)) return "image";
  if (OTHER_EXT.test(s) || BINARY_PROGRAM_EXT.test(s)) return "other";
  return "text";
}

// Files that start a program when the system opens them: never handed to the system's app
// (a cloned repository can hold anything). The same list as mods/portrait-viewer.
const PROGRAM_EXT = /\.(app|command|tool|workflow|action|terminal|scpt|scptd|sh|bash|zsh|fish|csh|bat|cmd|com|exe|msi|msp|scr|pif|ps1|psm1|vbs|vbe|js|jse|wsf|wsh|lnk|url|reg|hta|jar|desktop|appimage|run|bin|pkg|dmg|deb|rpm|apk|py|pl|rb|php)$/i;
export const canOpen = (file) => !PROGRAM_EXT.test(String(file ?? ""));

// The system's app for `file`. Windows uses rundll32's FileProtocolHandler, not `cmd /c start`
// (cmd would read an "&" in the name as another command).
export function systemOpen(platform, file) {
  if (platform === "macos") return ["open", [file]];
  if (platform === "windows") return ["rundll32", ["url.dll,FileProtocolHandler", file]];
  return ["xdg-open", [file]];
}

// The editors the Files panel can open text with. term: runs in a floating terminal (hc run);
// otherwise an app with its own window. mac: the app's name for `open -a` on macOS.
export const EDITORS = [
  { id: "nvim", label: "nvim", term: true },
  { id: "hx", label: "Helix", term: true },
  { id: "vim", label: "Vim", term: true },
  { id: "micro", label: "micro", term: true },
  { id: "nano", label: "nano", term: true },
  { id: "code", label: "VS Code", mac: "Visual Studio Code" },
  { id: "zed", label: "Zed", mac: "Zed" },
  { id: "subl", label: "Sublime Text", mac: "Sublime Text" },
  { id: "default", label: "Default app", hint: "the system's app for the file" },
  { id: "preview", label: "Preview only", hint: "read-only, in this panel" },
];
const BINS = EDITORS.filter((e) => e.term || e.mac).map((e) => e.id);
const APPS = EDITORS.filter((e) => e.mac).map((e) => e.mac);

// One sh run that prints what is installed: "bin:<id>" for each editor command on the (login)
// PATH, "app:<name>" for each macOS app in /Applications or ~/Applications.
export const DETECT = `for b in ${BINS.join(" ")}; do command -v "$b" >/dev/null 2>&1 && echo "bin:$b"; done; `
  + `for a in ${APPS.map((a) => `"${a}"`).join(" ")}; do for d in /Applications "$HOME/Applications"; do [ -d "$d/$a.app" ] && { echo "app:$a"; break; }; done; done; true`;
export function parseDetect(stdout) {
  const bins = new Set(), apps = new Set();
  for (const line of String(stdout ?? "").split(/\r?\n/)) {
    const m = line.trim().match(/^(bin|app):(.+)$/);
    if (m) (m[1] === "bin" ? bins : apps).add(m[2]);
  }
  return { bins: [...bins], apps: [...apps] };
}

// The editors to offer, in EDITORS order. found: parseDetect's result for that machine.
// Another machine (on): its terminal editors only (an app would open over there). Windows,
// this computer: the default app and the preview (terminal editors need a POSIX sh).
export function editorChoices({ platform, on, found }) {
  const bins = new Set(found?.bins ?? []), apps = new Set(found?.apps ?? []);
  return EDITORS.filter((e) => {
    if (e.id === "preview") return true;
    if (e.id === "default") return !on;
    if (on) return e.term && bins.has(e.id);
    if (platform === "windows") return false;
    if (e.term) return bins.has(e.id);
    return platform === "macos" ? apps.has(e.mac) || bins.has(e.id) : bins.has(e.id);
  });
}

// The editor a click uses: the saved choice when it is offered here, else nvim, else the
// default app (this computer) or the first terminal editor (another machine), else the preview.
export function pickEditor(saved, choices) {
  const has = (id) => choices.some((e) => e.id === id);
  if (saved && has(saved)) return saved;
  if (has("nvim")) return "nvim";
  if (has("default")) return "default";
  return choices.find((e) => e.term)?.id ?? "preview";
}

// How an app opens a file: macOS by the app's name (its command line tool is often not
// installed), elsewhere its command. Arguments, never code.
export function appCommand(platform, editor, file) {
  const e = EDITORS.find((x) => x.id === editor);
  if (!e || e.term || !e.mac) return null;
  return platform === "macos" ? ["open", ["-a", e.mac, file]] : [e.id, [file]];
}

// The sh script a terminal editor runs in (see nvimArgv): nvim listens on a socket ($1) so its
// window can hand the file to a kept nvim; the others just open the file ($2).
export function editorScript(editor) {
  return editor === "nvim" ? 'exec nvim --listen "$1" -c "set title titlestring=%t" -- "$2"' : `exec ${editor} "$2"`;
}
