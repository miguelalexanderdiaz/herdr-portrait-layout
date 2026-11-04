// bar-strip: pure logic (mods/bar-strip/logic.mjs). `node --test`
import { h, LIN } from "./fake-home.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { PICKER, ATTENTION, find, vaultWanted, joinPath, keyHint, waitingAgents, nextWaiting } from "../mods/bar-strip/logic.mjs";

test("the picker's mod name lives in one constant", () => {
  assert.equal(PICKER, "attention-picker");
  assert.equal(ATTENTION, "bar-strip.attention");
});

test("vaultWanted needs the mod installed AND a vault node in the layout", () => {
  assert.equal(vaultWanted({ installed: true, hasNode: { id: "vault" } }), true);
  assert.equal(vaultWanted({ installed: true, hasNode: null }), false);
  assert.equal(vaultWanted({ installed: false, hasNode: { id: "vault" } }), false);
  assert.equal(vaultWanted({ installed: undefined, hasNode: { id: "vault" } }), false); // not probed yet
  assert.equal(vaultWanted({ installed: "yes", hasNode: { id: "vault" } }), false); // only a real true
  assert.equal(vaultWanted({}), false);
});

test("find tolerates a missing layout", () => {
  assert.equal(find(undefined, "panel"), null);
  assert.equal(find({ id: "a", children: [{ id: "b", children: [{ id: "c" }] }] }, "c").id, "c");
});

test("joinPath builds the vault probe path on any OS", () => {
  assert.equal(joinPath(h("@LIN/.config/herdr-app"), "mods", "vault", "main.js"), h("@LIN/.config/herdr-app/mods/vault/main.js"));
  assert.equal(joinPath(h("@WIN\\AppData\\herdr-app"), "mods", "vault", "main.js"), h("@WIN\\AppData\\herdr-app\\mods\\vault\\main.js"));
});

test("keyHint: the shown layout's binding wins over global; unbound is empty", () => {
  const bindings = [
    { section: "global", keys: "ctrl-shift-x", action: "bar-strip.attention" },
    { section: "layout:portrait", keys: "ctrl-alt-a", action: "bar-strip.attention" },
    { section: "layout:portrait", keys: "cmd-b", action: "layout.toggle:bar" },
    { section: "layout:other", keys: "f9", action: "bar-strip.attention" },
  ];
  assert.equal(keyHint(bindings, "portrait"), "ctrl-alt-a");
  assert.equal(keyHint(bindings, "portrait-bottom"), "ctrl-shift-x"); // global
  assert.equal(keyHint(bindings, undefined), "ctrl-shift-x");
  assert.equal(keyHint([bindings[1]], "portrait-bottom"), ""); // unbound here
  assert.equal(keyHint([], "portrait"), "");
  assert.equal(keyHint(undefined, "portrait"), "");
  assert.equal(keyHint([null, { section: "global" }], "portrait"), "");
  assert.equal(keyHint([{ section: "global", keys: "f1", action: "bar-strip:attention" }], "x"), "f1"); // other spelling
  assert.equal(keyHint([{ section: "global", keys: "", action: "bar-strip.attention" }], "x"), "");
});

test("waitingAgents: asking first, then done, each longest-waiting first", () => {
  const list = [
    { address: "a", status: "done", seq: 5 }, { address: "b", status: "blocked", seq: 9 },
    { address: "c", status: "working", seq: 1 }, { address: "d", status: "blocked", seq: 2 },
    { address: "e", status: "done", seq: 3 }, { address: "f", status: "idle", seq: 0 },
  ];
  assert.deepEqual(waitingAgents(list).map((a) => a.address), ["d", "b", "e", "a"]);
  assert.deepEqual(waitingAgents([]), []);
});

test("nextWaiting: goes to the one after the focused one, wraps, remembers its jump", () => {
  const w = [{ address: "a" }, { address: "b" }, { address: "c" }];
  assert.equal(nextWaiting([], "a", null), null);
  assert.deepEqual(nextWaiting(w, "zz", null), { index: 0, address: "a" }); // not in the list: the longest waiting
  assert.deepEqual(nextWaiting(w, "a", null), { index: 1, address: "b" });
  assert.deepEqual(nextWaiting(w, "c", null), { index: 0, address: "a" }); // wraps
  // We jumped to index 1 ("b"), it finished being seen and left the list: its place now holds "c".
  assert.deepEqual(nextWaiting([{ address: "a" }, { address: "c" }], "b", { address: "b", index: 1 }), { index: 1, address: "c" });
  assert.deepEqual(nextWaiting([{ address: "a" }], "b", { address: "b", index: 1 }), { index: 0, address: "a" });
});
