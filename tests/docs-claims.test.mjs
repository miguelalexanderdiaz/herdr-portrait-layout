// The numbers the docs state must be the numbers the code uses. Each is matched with its own
// unit ("290 px", "7 days") in the page that makes the claim, so a number that merely occurs
// somewhere (34, 40) cannot satisfy it by chance. Change a constant and this fails until the docs follow.
// `node --test`
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { MIN_COL, FOLDED_COL, WHEEL_STEP as TREE_WHEEL, CHANGED_TTL } from "../mods/portrait-tree/logic.mjs";
import { WHEEL_STEP as TABS_WHEEL } from "../mods/portrait-tabs/logic.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
// A page as plain text: tags gone, entities for spaces turned into spaces, whitespace collapsed.
const page = (rel) => readFileSync(join(root, rel), "utf8")
  .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ")
  .replace(/<[^>]+>/g, " ").replace(/&(?:nbsp|thinsp|ensp|emsp|#160|#8201);/gi, " ").replace(/\s+/g, " ");
const says = (rel, pattern) => assert.match(page(rel), pattern, `${rel} no longer says ${pattern}: update it together with the constant`);

test("the two mods that wheel-scroll agree, and the number is the one the docs give", () => {
  assert.equal(TREE_WHEEL, TABS_WHEEL, "portrait-tree and portrait-tabs use different WHEEL_STEP values");
  says("docs/usage.html", new RegExp(`\\b${TABS_WHEEL}\\s*px\\b`));
});

test("column widths in the docs are MIN_COL and FOLDED_COL", () => {
  for (const rel of ["README.md", "docs/usage.html"]) {
    says(rel, new RegExp(`\\b${MIN_COL}\\s*px\\b`));
    says(rel, new RegExp(`\\b${FOLDED_COL}\\s*px\\b`));
  }
});

test("the retention of an agent's remembered state is the 7 days the privacy page states", () => {
  const days = CHANGED_TTL / 86400000;
  assert.equal(days, 7, "CHANGED_TTL is no longer a whole week: reword the privacy page and this test");
  says("docs/privacy.html", new RegExp(`\\b${days} days\\b`));
});
