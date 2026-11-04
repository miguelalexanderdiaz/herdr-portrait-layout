// Invariants over the mods' files: what a shared layout must never regress. `node --test`
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, dirname, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const modsDir = join(root, "mods");
const modNames = readdirSync(modsDir).filter((n) => statSync(join(modsDir, n)).isDirectory());
// attention-picker is a bundled copy of another repo's mod: checked for shape, never edited here.
const own = modNames.filter((n) => n !== "attention-picker");

function files(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? files(join(dir, d.name)) : [join(dir, d.name)]));
}
const text = (f) => readFileSync(f, "utf8");
const rel = (f) => relative(root, f).split(sep).join("/");

test("there are mods, each with a parsable mod.json and a main.js", () => {
  assert.ok(modNames.length >= 7);
  for (const m of modNames) {
    assert.doesNotThrow(() => JSON.parse(text(join(modsDir, m, "mod.json"))), `${m}/mod.json`);
    assert.ok(existsSync(join(modsDir, m, "main.js")), `${m}/main.js`);
  }
});

test("each main.js default-exports a View and stays a sane size", () => {
  for (const m of modNames) {
    const main = join(modsDir, m, "main.js");
    assert.match(text(main), /export\s+default\s+class\s+\w+\s+extends\s+View\b/, `${m}/main.js`);
    assert.ok(statSync(main).size < 60 * 1024, `${m}/main.js is ${statSync(main).size} bytes`);
  }
});

test("logic.mjs files are free of host imports (node must be able to load them)", () => {
  for (const m of own) {
    const f = join(modsDir, m, "logic.mjs");
    if (!existsSync(f)) continue;
    assert.doesNotMatch(text(f), /from\s+["'](gpui-kit|gpui-base|herdr|fs\/promises)["']/, rel(f));
  }
  // The mods that have logic use it, and nothing but their own folder is imported.
  for (const m of own) {
    if (!existsSync(join(modsDir, m, "logic.mjs"))) continue;
    assert.match(text(join(modsDir, m, "main.js")), /from\s+"\.\/logic\.mjs"/, `${m} imports ./logic.mjs`);
  }
});

// Asset paths written in code: "mods/<mod>/<file>" in a string or a template literal.
function assetRefs(file) {
  const code = text(file).split("\n").filter((l) => !/^\s*\/\//.test(l)).join("\n");
  const refs = [];
  for (const m of code.matchAll(/["'`](mods\/[\w-]+\/[^"'`\s]*?\.(?:svg|png|jpe?g|webp|gif))["'`]/g)) refs.push(m[1]);
  return refs;
}
function exists(ref) {
  const [, mod, ...rest] = ref.split("/");
  const dir = join(modsDir, mod, ...rest.slice(0, -1));
  const name = rest[rest.length - 1];
  if (!existsSync(dir)) return false;
  if (!name.includes("${")) return existsSync(join(dir, name));
  // chevron-${open ? "down" : "right"}.svg -> every file the template could name must exist: list the folder.
  const re = new RegExp("^" + name.replace(/[.+?^()|[\]\\]/g, "\\$&").replace(/\$\{[^}]*\}/g, "[\\w-]+") + "$");
  return readdirSync(dir).some((f) => re.test(f));
}

test("every icon a mod draws is a file of this repo (no exception)", () => {
  let seen = 0;
  for (const m of own) {
    for (const f of files(join(modsDir, m)).filter((f) => f.endsWith(".js") || f.endsWith(".mjs"))) {
      for (const ref of assetRefs(f)) {
        seen++;
        const target = ref.split("/")[1];
        assert.ok(modNames.includes(target), `${rel(f)} draws ${ref}: not a mod of this repo`);
        assert.ok(exists(ref), `${rel(f)} draws ${ref}, which does not exist`);
      }
    }
  }
  assert.ok(seen > 20, `only ${seen} asset references found: did the scan break?`);
});

test("no mod reaches into Herdr's shipped mods", () => {
  for (const m of own) {
    for (const f of files(join(modsDir, m)).filter((f) => /\.(m?js|json)$/.test(f))) {
      assert.doesNotMatch(text(f), /mods\/(workspace-chrome|pane|files|changes|tabs|spaces|win98)\//, rel(f));
    }
  }
});

test("the icons that were copied from Herdr are in the mod that draws them", () => {
  const vendored = {
    "bar-strip": ["search.svg", "server.svg", "settings.svg", "changes.svg", "file.svg", "bell.svg"],
    "portrait-tree": ["plus.svg", "server.svg", "spinner.svg", "chevron-left.svg", "chevron-right.svg", "fold.svg", "unfold.svg"],
    "portrait-tabs": ["spinner.svg", "close.svg", "win-close.svg", "win-max.svg", "win-min.svg", "win-restore.svg"],
    "portrait-pane": ["spinner.svg", "close.svg", "split-right.svg", "split-down.svg", "zoom.svg", "unzoom.svg"],
    "portrait-files": ["chevron-down.svg", "chevron-right.svg", "file.svg", "folder.svg"],
    "nvim-float": ["chevron-down.svg", "close.svg"],
  };
  for (const [m, list] of Object.entries(vendored)) for (const f of list) assert.ok(existsSync(join(modsDir, m, f)), `mods/${m}/${f}`);
});

test("every SVG in the mods is a plain, script-free SVG", () => {
  for (const m of modNames) for (const f of files(join(modsDir, m)).filter((f) => f.endsWith(".svg"))) {
    const svg = text(f);
    assert.match(svg, /^\s*<svg[\s>]/, rel(f));
    assert.doesNotMatch(svg, /<script|onload=|javascript:|https?:\/\/(?!www\.w3\.org)/i, rel(f));
  }
});

test("no home folder path and no e-mail address in any mod file", () => {
  const leaks = [
    [/\/Users\/[A-Za-z0-9._-]+/, "macOS home folder"],
    [/\/home\/[a-z][a-z0-9._-]*/, "Linux home folder"],
    [/[A-Za-z]:\\+Users\\+[A-Za-z0-9._-]+/, "Windows home folder"],
    [/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+\.[A-Za-z]{2,}/, "e-mail address"],
  ];
  for (const f of files(modsDir)) {
    if (/\.(png|jpe?g|webp|gif)$/.test(f)) continue;
    for (const [re, what] of leaks) assert.doesNotMatch(text(f), re, `${rel(f)}: ${what}`);
  }
});

test("state kept in localStorage goes through readJson (a corrupt value must not break init)", () => {
  for (const m of own) {
    assert.doesNotMatch(text(join(modsDir, m, "main.js")), /JSON\.parse\(\s*localStorage/, `${m}/main.js`);
  }
});

test("the picker's name is not repeated as a literal outside its constant", () => {
  const code = text(join(modsDir, "bar-strip", "main.js"));
  assert.doesNotMatch(code, /["']attention-picker["']/);
});
