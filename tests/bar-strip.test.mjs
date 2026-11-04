// bar-strip: pure logic (mods/bar-strip/logic.mjs). `node --test`
import { h, LIN } from "./fake-home.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { PICKER, ATTENTION, PICKER_KEY, KEY_ACTIONS, enabledPanels, alpha, find, vaultWanted, joinPath, keyHint, waitingAgents, nextWaiting } from "../mods/bar-strip/logic.mjs";

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

test("keyHint finds the picker bound as a mod, in the layout section and in global", () => {
  assert.equal(PICKER_KEY, "mod.open:attention-picker");
  assert.deepEqual(KEY_ACTIONS, [PICKER_KEY, ATTENTION]);
  const open = { section: "layout:portrait", keys: "ctrl-shift-j", action: "mod.open:attention-picker" };
  assert.equal(keyHint([open], "portrait"), "ctrl-shift-j");
  assert.equal(keyHint([{ ...open, section: "global" }], "portrait-bottom"), "ctrl-shift-j");
  assert.equal(keyHint([open], "portrait-bottom"), ""); // another layout's key
  // Either action, the layout's own wins over global.
  const both = [{ section: "global", keys: "f1", action: "bar-strip.attention" }, open];
  assert.equal(keyHint(both, "portrait"), "ctrl-shift-j");
  // An explicit action or list narrows the lookup.
  assert.equal(keyHint(both, "portrait", "bar-strip.attention"), "f1");
  assert.equal(keyHint(both, "portrait", ["nope"]), "");
  assert.equal(keyHint([open], "portrait", PICKER_KEY), "ctrl-shift-j");
  // Another mod's open must not match.
  assert.equal(keyHint([{ section: "global", keys: "f2", action: "mod.open:other" }], "portrait"), "");
});

test("alpha is the shared six-digit helper the strip uses for its tints", () => {
  assert.equal(alpha("#d9649a", 0.12), "#d9649a1f");
  assert.equal(alpha("#d9649aff", 0.2), "#d9649a33");
  assert.equal(alpha("blocked", 0.2), "blocked");
});

test("enabledPanels (shared with the tab bar): the shell's list, the vault only when wanted", () => {
  assert.deepEqual(enabledPanels(undefined, { vault: false }), ["files", "changes"]);
  assert.deepEqual(enabledPanels(["files"], { vault: true }), ["files", "vault"]);
  assert.deepEqual(enabledPanels({ includes: () => true }, { vault: false }), ["files", "changes"]); // not an array: would have thrown on .includes
  assert.deepEqual(enabledPanels(["files", "vault"], { vault: false }), ["files"]);
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

test("waitingAgents orders by agents.since when it has the agents, else by seq", () => {
  const list = [
    { address: "a", status: "blocked", seq: 1 }, { address: "b", status: "blocked", seq: 9 },
    { address: "c", status: "blocked", seq: 5 }, { address: "d", status: "done", seq: 8 }, { address: "e", status: "done", seq: 2 },
  ];
  const order = (since) => waitingAgents(list, since).map((a) => a.address).join("");
  assert.equal(order(undefined), "acbed");
  assert.equal(order({}), "acbed");
  // since says b has waited longest although its seq is the highest (a title change moved seq).
  assert.equal(order({ a: 300, b: 100, c: 200, d: 50, e: 60 }), "bcade");
  // Partly missing: agents with an entry first (oldest first), the rest after them by seq.
  assert.equal(order({ c: 10, e: 5 }), "cabed");
  // Junk is ignored.
  assert.equal(order("x"), "acbed");
  assert.equal(order({ a: "soon", b: NaN, c: null }), "acbed");
  // Equal times fall back to seq.
  assert.equal(order({ a: 5, b: 5, c: 5 }), "acbed");
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
