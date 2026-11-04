// portrait-tabs: pure logic (mods/portrait-tabs/logic.mjs). `node --test`
import { test } from "node:test";
import assert from "node:assert/strict";
import { isPanels, prunePanels, enabledPanels, vaultWanted, readJson, wheelSteps, WHEEL_STEP } from "../mods/portrait-tabs/logic.mjs";

test("isPanels accepts the remembered choices and nothing else", () => {
  assert.equal(isPanels({ s1: "files", s2: null }), true);
  assert.equal(isPanels({}), true);
  for (const bad of [[], "x", 1, null, { s1: 1 }, { s1: {} }, { s1: undefined }]) assert.equal(isPanels(bad), false);
  const store = { getItem: () => "[1,2]" };
  assert.deepEqual(readJson(store, "panels", {}, isPanels), {}); // wrong shape
});

test("prunePanels forgets closed spaces, never against an empty list", () => {
  const panels = { s1: "files", s2: null, gone: "changes" };
  assert.deepEqual(prunePanels(panels, ["s1", "s2"]), { s1: "files", s2: null });
  assert.equal(prunePanels(panels, ["s1", "s2", "gone"]), panels); // unchanged: same object, no write
  assert.equal(prunePanels(panels, []), panels);
  assert.deepEqual(prunePanels({}, ["a"]), {});
});

test("enabledPanels adds the vault only when it is wanted", () => {
  assert.deepEqual(enabledPanels(undefined, { vault: false }), ["files", "changes"]);
  assert.deepEqual(enabledPanels(undefined, { vault: true }), ["files", "changes", "vault"]);
  assert.deepEqual(enabledPanels(["files"], { vault: true }), ["files", "vault"]);
  assert.deepEqual(enabledPanels(["files", "vault"], { vault: false }), ["files"]); // vault gone: not selectable
  assert.deepEqual(enabledPanels(["files", "vault"], { vault: true }), ["files", "vault"]);
  assert.deepEqual(enabledPanels("nonsense", { vault: false }), ["files", "changes"]);
  assert.deepEqual(enabledPanels([1], { vault: false }), ["files", "changes"]);
  assert.equal(vaultWanted({ installed: true, hasNode: null }), false);
});

test("the tab wheel needs a whole step per tab and survives an inertia swipe", () => {
  assert.equal(WHEEL_STEP, 40);
  let s = null, tabs = 0;
  for (let i = 0; i < 40; i++) { s = wheelSteps(s, 3, WHEEL_STEP, i * 10); tabs += s.steps; } // 120 px of swipe
  assert.equal(tabs, 3);
  s = wheelSteps(null, -50, WHEEL_STEP, 0);
  assert.equal(s.steps, -1);
});
