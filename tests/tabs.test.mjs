// portrait-tabs: pure logic (mods/portrait-tabs/logic.mjs). `node --test`
import { test } from "node:test";
import assert from "node:assert/strict";
import { isPanels, prunePanels, enabledPanels, readJson, wheelSteps, wheelStream, WHEEL_STEP } from "../mods/portrait-tabs/logic.mjs";

test("isPanels accepts the remembered choices and nothing else", () => {
  assert.equal(isPanels({ s1: "files", s2: null }), true);
  assert.equal(isPanels({}), true);
  for (const bad of [[], "x", 1, null, { s1: 1 }, { s1: {} }, { s1: undefined }]) assert.equal(isPanels(bad), false);
  const store = { getItem: () => "[1,2]" };
  assert.deepEqual(readJson(store, "panels", {}, isPanels), {}); // wrong shape
});

test("prunePanels forgets closed spaces, never against an empty list", () => {
  const panels = { s1: "files", s2: null, gone: "changes" };
  const ready = [{ name: null, layout: "ready" }];
  assert.deepEqual(prunePanels(panels, [{ id: "s1" }, { id: "s2" }], ready), { s1: "files", s2: null });
  assert.equal(prunePanels(panels, [{ id: "s1" }, { id: "s2" }, { id: "gone" }], ready), panels); // unchanged: same object, no write
  assert.equal(prunePanels(panels, [], ready), panels);
  assert.deepEqual(prunePanels({}, [{ id: "a" }], ready), {});
});

test("prunePanels keeps the choice of a space on a machine that is loading or offline", () => {
  const panels = { s1: "files", "vps/s9": "changes", "old/s3": "files" };
  const machines = (layout) => [{ name: null, layout: "ready" }, { name: "vps", layout }, { name: "old", layout: "ready" }];
  const spaces = [{ id: "s1" }];
  assert.deepEqual(prunePanels(panels, spaces, machines("loading")), { s1: "files", "vps/s9": "changes" });
  assert.deepEqual(prunePanels(panels, spaces, machines("unavailable")), { s1: "files", "vps/s9": "changes" });
  assert.deepEqual(prunePanels(panels, spaces, machines("ready")), { s1: "files" });
});

test("enabledPanels: the shell's list of panel names, else Files and Changes", () => {
  assert.deepEqual(enabledPanels(undefined), ["files", "changes"]);
  assert.deepEqual(enabledPanels(["files"]), ["files"]);
  assert.deepEqual(enabledPanels(["changes", "files"]), ["changes", "files"]);
  assert.deepEqual(enabledPanels("nonsense"), ["files", "changes"]);
  assert.deepEqual(enabledPanels([1]), ["files", "changes"]);
});

test("the tab wheel needs a whole step per tab and survives an inertia swipe", () => {
  assert.equal(WHEEL_STEP, 40);
  let s = null, tabs = 0;
  for (let i = 0; i < 40; i++) { s = wheelSteps(s, 3, WHEEL_STEP, i * 10); tabs += s.steps; } // 120 px of swipe
  assert.equal(tabs, 3);
  s = wheelSteps(null, -50, WHEEL_STEP, 0);
  assert.equal(s.steps, -1);
});

test("the tab wheel: one notch of a mouse wheel is one tab, a swipe is unchanged", () => {
  const notch = (y) => ({ delta: { x: 0, y: y * 18 }, delta_lines: { x: 0, y }, touch_phase: "moved" });
  let s = null;
  assert.deepEqual([1, 2, 3].map((i) => (s = wheelStream(s, notch(1), "y", i * 50)).steps), [1, 1, 1]);
  assert.equal(wheelStream(null, notch(-1), "y", 0).steps, -1);
  s = null; let tabs = 0;
  for (let i = 0; i < 40; i++) { s = wheelStream(s, { delta: { x: 0, y: 3 }, touch_phase: i ? "moved" : "started" }, "y", i * 10, WHEEL_STEP); tabs += s.steps; }
  assert.equal(tabs, 3);
});
