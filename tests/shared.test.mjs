// Helpers that are copied between mods (a mod folder must stand alone, so they can't import
// each other) stay byte-identical: the blocks between `// <shared:NAME>` and `// </shared:NAME>`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const mods = join(dirname(fileURLToPath(import.meta.url)), "..", "mods");

const EXPECTED = {
  paths: ["nvim-float", "portrait-files", "portrait-pane", "portrait-tree"],
  storage: ["portrait-tabs", "portrait-tree"],
  wheel: ["portrait-tabs", "portrait-tree"],
  find: ["bar-strip", "portrait-files", "portrait-tabs"],
  panels: ["bar-strip", "portrait-tabs"],
  nvim: ["nvim-float", "portrait-files"],
  alpha: ["bar-strip", "portrait-pane", "portrait-tree"],
  title: ["nvim-float", "portrait-tree"],
};

function blocks() {
  const found = {};
  for (const mod of readdirSync(mods)) {
    if (mod === "attention-picker") continue; // bundled copy, frozen
    const file = join(mods, mod, "logic.mjs");
    if (!existsSync(file)) continue;
    const text = readFileSync(file, "utf8").replace(/\r\n/g, "\n");
    for (const m of text.matchAll(/^\/\/ <shared:([\w-]+)>\n([\s\S]*?)^\/\/ <\/shared:\1>$/gm)) {
      (found[m[1]] ??= []).push({ mod, text: m[2] });
    }
  }
  return found;
}

test("every shared block is in exactly the mods that should have it", () => {
  const found = blocks();
  assert.deepEqual(Object.keys(found).sort(), Object.keys(EXPECTED).sort());
  for (const [name, mods] of Object.entries(EXPECTED)) {
    assert.deepEqual(found[name].map((b) => b.mod).sort(), mods, `shared:${name}`);
  }
});

test("the copies of each shared block are identical", () => {
  for (const [name, copies] of Object.entries(blocks())) {
    for (const c of copies.slice(1)) {
      assert.equal(c.text, copies[0].text, `shared:${name} differs between ${copies[0].mod} and ${c.mod}`);
    }
  }
});
