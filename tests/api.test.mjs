// API drift guard: every name the own mods import from "herdr", "gpui-kit" and "gpui-base",
// and every builder call (`.name(`) in their main.js, must exist in the type files Herdr writes
// into its app folder (herdr.d.ts, gpui-kit.d.ts). Herdr rewrites those files on every start, so after
// a Herdr update this is the test that says "this mod uses something that is gone".
//
// The files belong to the app and are not in this repo. They are looked up in $HERDR_APP_HOME,
// else in the default app folder under the home folder, read only. Without them the tests are
// skipped (not failed), with a message. `node --test`
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const mods = join(dirname(fileURLToPath(import.meta.url)), "..", "mods");
const OWN = ["portrait-tree", "portrait-tabs", "portrait-pane", "portrait-files", "portrait-changes", "bar-strip", "nvim-float"];
const appHome = process.env.HERDR_APP_HOME || join(homedir(), ".config", "herdr-app");
const files = { herdr: join(appHome, "herdr.d.ts"), kit: join(appHome, "gpui-kit.d.ts") };
const missing = Object.values(files).filter((f) => !existsSync(f));
const skip = missing.length ? `Herdr's type files are not here (${missing.map((f) => f.split(/[\\/]/).pop()).join(", ")} in the app folder; set HERDR_APP_HOME): API names not checked` : false;
if (skip) console.log(`# ${skip}`);

const read = (f) => readFileSync(f, "utf8");
const EXPORT = /^\s*export\s+(?:declare\s+)?(?:abstract\s+)?(?:function|const|let|var|class|interface|type|enum|namespace)\s+([A-Za-z_$][\w$]*)/gm;

// Names exported by a `declare module "name" { ... }` block (it ends at the first `}` in column 0).
function moduleExports(text, name) {
  const start = text.indexOf(`declare module "${name}" {`);
  if (start < 0) return null;
  const end = text.indexOf("\n}", start);
  const body = text.slice(start, end < 0 ? undefined : end);
  const names = new Set([...body.matchAll(EXPORT)].map((m) => m[1]));
  for (const m of body.matchAll(/^\s*export\s*\{([^}]*)\}/gm)) for (const n of m[1].split(",")) names.add(n.trim().split(/\s+as\s+/).pop());
  // `export * from "gpui-kit"` re-exports another module of the same file.
  for (const m of body.matchAll(/export\s*\*\s*from\s*"([^"]+)"/g)) for (const n of moduleExports(text, m[1]) ?? []) names.add(n);
  return names;
}
// Imports of the `herdr` module: top-level exports of herdr.d.ts (it is the module itself).
const hostNames = (text) => new Set([...text.matchAll(/^export\s+(?:declare\s+)?(?:function|const|let|var|class|interface|type|enum)\s+([A-Za-z_$][\w$]*)/gm)].map((m) => m[1]));

// Source without comments and string contents (so a word inside a string or a comment is not a call).
function code(src) {
  let out = "", i = 0;
  while (i < src.length) {
    const c = src[i], n = src[i + 1];
    if (c === "/" && n === "/") { while (i < src.length && src[i] !== "\n") i++; continue; }
    if (c === "/" && n === "*") { const e = src.indexOf("*/", i + 2); i = e < 0 ? src.length : e + 2; continue; }
    // A regular expression literal (a `/` where a value can start): its quotes are not strings.
    if (c === "/" && /[(,=:[!&|?{};]\s*$|^\s*$|return\s*$/.test(out.slice(-12))) {
      let j = i + 1, inClass = false;
      while (j < src.length && (src[j] !== "/" || inClass) && src[j] !== "\n") { if (src[j] === "\\") j++; else if (src[j] === "[") inClass = true; else if (src[j] === "]") inClass = false; j++; }
      if (src[j] === "/") { out += "/ /"; i = j + 1; while (/[a-z]/.test(src[i] ?? "")) i++; continue; }
    }
    if (c === '"' || c === "'" || c === "`") {
      out += c; i++;
      while (i < src.length && src[i] !== c) { if (src[i] === "\\") i++; i++; }
      out += c; i++; continue;
    }
    out += c; i++;
  }
  return out;
}

// What a `.name(` may be besides a builder method of gpui-kit or a function of herdr: JavaScript's
// own methods, and the methods of objects and classes the mod defines itself (see `defined`).
const BUILT_IN = new Set(("add all abs assign at catch ceil charCodeAt codePointAt concat delete endsWith entries every fill filter find findIndex flat flatMap " +
  "floor forEach from fromEntries get has includes indexOf isArray isFinite join keys lastIndexOf map max min normalize now padEnd padStart parse pop " +
  "push race reduce repeat replace replaceAll resolve reverse round set shift sign slice some sort split startsWith stringify test then toFixed " +
  "toLowerCase toString toUpperCase trim trimEnd trimStart trunc unshift values").split(" "));

const importsOf = (src) => [...src.matchAll(/^import\s*\{([^}]*)\}\s*from\s*(["'])([^"']+)\2/gm)].map((m) => ({
  from: m[3], names: m[1].split(",").map((n) => n.trim().split(/\s+as\s+/)[0]).filter(Boolean),
}));

test("the type files give a module list the checks below rely on", { skip }, () => {
  const kit = read(files.kit);
  for (const name of ["gpui-kit", "gpui-base"]) assert.ok(moduleExports(kit, name)?.size > 20, `declare module "${name}" not found or empty in gpui-kit.d.ts`);
  assert.ok(hostNames(read(files.herdr)).has("spaces"), "herdr.d.ts exports no spaces()");
  assert.ok(moduleExports(kit, "gpui-kit").has("View"), "gpui-kit exports no View");
});

for (const mod of OWN) {
  test(`${mod}: every import from herdr, gpui-kit and gpui-base exists`, { skip }, () => {
    const kit = read(files.kit), host = hostNames(read(files.herdr));
    const exportsOf = { herdr: host, "gpui-kit": moduleExports(kit, "gpui-kit"), "gpui-base": moduleExports(kit, "gpui-base") };
    for (const { from, names } of importsOf(read(join(mods, mod, "main.js")))) {
      if (!(from in exportsOf)) continue;
      for (const n of names) assert.ok(exportsOf[from].has(n), `${mod}/main.js imports { ${n} } from "${from}", which Herdr's type files do not export`);
    }
  });

  test(`${mod}: every builder call in main.js is declared in gpui-kit.d.ts or herdr.d.ts`, { skip }, () => {
    const types = read(files.kit) + "\n" + read(files.herdr);
    const declared = new Set([...types.matchAll(/\b([A-Za-z_$][\w$]*)\s*[<(]/g)].map((m) => m[1]));
    // Names the mod defines itself: methods and functions in its main.js and logic.mjs (a call is
    // not a definition), including object-literal methods and arrow properties.
    const own = code(read(join(mods, mod, "logic.mjs")) + "\n" + read(join(mods, mod, "main.js")));
    const defined = new Set([
      ...own.matchAll(/^\s*(?:export\s+)?(?:async\s+)?(?:function\s+|get\s+|static\s+)?([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{/gm),
      ...own.matchAll(/\b([A-Za-z_$][\w$]*)\s*:\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/g),
      ...own.matchAll(/\bfunction\s+([A-Za-z_$][\w$]*)/g),
    ].map((m) => m[1]));
    const src = code(read(join(mods, mod, "main.js")));
    const unknown = new Set();
    // `.name(` but not a spread (`...name(`).
    for (const m of src.matchAll(/(?<!\.)\.\s*([A-Za-z_$][\w$]*)\s*\(/g)) {
      const n = m[1];
      if (!declared.has(n) && !BUILT_IN.has(n) && !defined.has(n)) unknown.add(n);
    }
    assert.deepEqual([...unknown], [], `${mod}/main.js calls methods that gpui-kit.d.ts and herdr.d.ts do not declare: ${[...unknown].join(", ")}`);
  });
}

// The checker itself: a misspelled builder must be seen (so the test above can fail).
test("the builder check sees a misspelled method", { skip }, () => {
  const types = read(files.kit);
  const declared = new Set([...types.matchAll(/\b([A-Za-z_$][\w$]*)\s*[<(]/g)].map((m) => m[1]));
  assert.ok(declared.has("text_ellipsis_start"));
  assert.ok(!declared.has("text_ellipsis_strat"));
  assert.ok(declared.has("on_scroll_wheel") && declared.has("on_mouse_move") && declared.has("overflow_x_scrollbar"));
});
