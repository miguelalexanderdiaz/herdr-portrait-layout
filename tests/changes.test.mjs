// portrait-changes: pure logic (mods/portrait-changes/logic.mjs). `node --test`
import { test } from "node:test";
import assert from "node:assert/strict";
import { changesVisible, parseWorktrees, parseStatus, fileOf, addNumstat, addFolder, removeFolder, readFolders, MAX_FOLDERS, mergeRows, rowKey, rowTitle, rowMeta, watchable, baseName, sortRows, splitRows, applyOrder, newestOf, statArgs, nestedPaths, addArgs, withoutNested, commitBlock, createPacer } from "../mods/portrait-changes/logic.mjs";

test("changesVisible: only with the panel open on Changes", () => {
  const tree = (hidden, active) => ({ id: "root", children: [{ id: "panel", hidden, children: [{ id: "panel-body", active }] }] });
  assert.equal(changesVisible(tree(false, "changes")), true);
  assert.equal(changesVisible(tree(false, "files")), false);
  assert.equal(changesVisible(tree(true, "changes")), false);
  assert.equal(changesVisible({ id: "root" }), true, "a layout without the panel shows it where it is put");
});

test("parseWorktrees: main first, the rest by name; bare and prunable left out; detached has no branch", () => {
  const text = "worktree /r\nHEAD 1\nbranch refs/heads/main\n\nworktree /r/z\nbranch refs/heads/z\n\nworktree /r/det\nHEAD 2\ndetached\n\nworktree /r/gone\nbranch refs/heads/g\nprunable gitdir file points to non-existent location\n";
  assert.deepEqual(parseWorktrees(text), [{ path: "/r", branch: "main" }, { path: "/r/det", branch: null }, { path: "/r/z", branch: "z" }]);
  assert.deepEqual(parseWorktrees("worktree /bare\nbare\n\nworktree /w\nbranch refs/heads/a\n"), [{ path: "/w", branch: "a" }]);
  assert.deepEqual(parseWorktrees(""), []);
  assert.deepEqual(parseWorktrees("worktree /with space/x\nbranch refs/heads/feat/a\n"), [{ path: "/with space/x", branch: "feat/a" }]);
});

test("parseStatus: the branch line in its forms, and the entries after it", () => {
  assert.deepEqual(parseStatus("## main...origin/main [ahead 1]\0 M a\0?? b c\0"), { branch: "main", entries: [" M a", "?? b c"] });
  assert.equal(parseStatus("## HEAD (no branch)\0").branch, null);
  assert.equal(parseStatus("## No commits yet on dev\0").branch, "dev");
  assert.deepEqual(parseStatus(""), { branch: null, entries: [] });
});

test("fileOf and addNumstat: statuses, and a path with a tab", () => {
  assert.equal(fileOf(" M a").status, "M");
  assert.equal(fileOf("?? a").status, "A");
  assert.equal(fileOf("?? a").fresh, true);
  assert.equal(fileOf(" D a").status, "D");
  assert.equal(fileOf("UU a").status, "U");
  const stats = addNumstat(addNumstat({}, "1\t2\ta\0"), "3\t4\ta\0-\t-\tb\tc\0");
  assert.deepEqual(stats.a, { add: 4, del: 6, binary: false });
  assert.equal(stats["b\tc"].binary, true);
  assert.equal(fileOf(" M a", stats).add, 4);
});

test("the added folders: no doubles, junk ignored, capped", () => {
  assert.deepEqual(addFolder(["/a"], "/a"), ["/a"]);
  assert.deepEqual(removeFolder(["/a", "/b"], "/a"), ["/b"]);
  assert.deepEqual(readFolders("x"), []);
  assert.deepEqual(readFolders([1, null, "", "/a"]), ["/a"]);
  assert.equal(readFolders(Array.from({ length: MAX_FOLDERS + 5 }, (_, i) => `/f${i}`)).length, MAX_FOLDERS);
});

test("mergeRows: checkouts, then added, then the open row; each folder once", () => {
  const w = [{ path: "/r", branch: "main", on: null }];
  let rows = mergeRows(w, ["/n", "/r"], null);
  assert.deepEqual(rows.map((r) => r.path), ["/r", "/n"]);
  assert.equal(rows[0].added, true, "an added checkout can still be removed");
  assert.equal(rows[0].checkout, true);
  rows = mergeRows([], [], { path: "/old", on: "box", branch: "x" });
  assert.deepEqual(rows.map((r) => r.path), ["/old"], "the open row stays when the focus moves away");
  assert.equal(rows[0].added, false);
  assert.equal(mergeRows(w, [], { path: "/r", on: null }).length, 1);
  assert.equal(mergeRows([{ path: "/r", on: "box" }], ["/r"], null).length, 2, "the same path on another machine is another folder");
  assert.notEqual(rowKey({ path: "/r", on: "box" }), rowKey({ path: "/r" }));
});

test("mergeRows: the space's own repo is always there, once, and cannot be removed", () => {
  const start = { path: "/s", on: null };
  let rows = mergeRows([{ path: "/r", branch: "main", on: null }], ["/n"], null, start);
  assert.deepEqual(rows.map((r) => r.path), ["/r", "/s", "/n"]);
  assert.equal(rows[1].added, false);
  assert.equal(rows[1].checkout, false, "it goes by its folder name, with the branch beside it");
  rows = mergeRows([{ path: "/s", branch: "main", on: null }], [], null, start);
  assert.equal(rows.length, 1, "already listed as a checkout");
  assert.equal(rows[0].checkout, true);
  assert.deepEqual(mergeRows([], [], null, null), []);
});

test("sortRows: latest first, undated last in their own order; applyOrder keeps it", () => {
  const paths = (facts) => sortRows(Object.keys(facts).map((path) => ({ path })), (r) => facts[r.path]).map((r) => r.path);
  assert.deepEqual(paths({ "/a": { at: 10 }, "/b": undefined, "/c": { at: 30 }, "/d": {} }), ["/c", "/a", "/b", "/d"]);
  const rows = [{ path: "/a" }, { path: "/b" }];
  assert.deepEqual(applyOrder([...rows, { path: "/new" }], [rowKey(rows[1]), rowKey(rows[0])]).map((r) => r.path), ["/b", "/a", "/new"]);
  assert.deepEqual(applyOrder(rows, undefined).map((r) => r.path), ["/a", "/b"]);
});

test("splitRows: files to review on top, everything else below, order kept", () => {
  const facts = { "/a": { files: 0 }, "/b": { files: 2 }, "/c": { error: "not a repo" }, "/d": undefined, "/e": { files: 1 } };
  const { changed, quiet } = splitRows(Object.keys(facts).map((path) => ({ path })), (r) => facts[r.path]);
  assert.deepEqual(changed.map((r) => r.path), ["/b", "/e"]);
  assert.deepEqual(quiet.map((r) => r.path), ["/a", "/c", "/d"]);
});

test("splitRows: a folder that can't be read does not pass for one without changes", () => {
  const facts = { "/a": { error: "can't read" }, "/b": { error: "not a repo" } };
  const { changed, quiet } = splitRows(Object.keys(facts).map((path) => ({ path })), (r) => facts[r.path]);
  assert.deepEqual(changed.map((r) => r.path), ["/a"]);
  assert.deepEqual(quiet.map((r) => r.path), ["/b"]);
});

test("nestedPaths, addArgs, withoutNested: a worktree inside this one, not a sibling with the same prefix", () => {
  const nested = nestedPaths("/r", [{ path: "/r" }, { path: "/r/.wt/x" }, { path: "/r2/y" }]);
  assert.deepEqual(nested, [".wt/x"]);
  assert.deepEqual(addArgs([]), ["add", "-A"]);
  assert.deepEqual(addArgs(nested), ["add", "-A", "--", ".", ":(exclude,literal).wt/x"]);
  assert.deepEqual(withoutNested(["?? .wt/x/", " M a", "?? other/"], nested), [" M a", "?? other/"]);
});

test("commitBlock: a lost .git and conflicts stop the commit", () => {
  assert.equal(commitBlock([{ status: "M" }], "\n"), null);
  assert.match(commitBlock([{ status: "M" }], "../\n"), /no longer a checkout/);
  assert.match(commitBlock([{ status: "U" }], ""), /conflicts/);
});

test("createPacer: one run at a time, a gap between runs, a request during a run is kept", () => {
  let t = 0;
  const p = createPacer({ gap: 100, now: () => t });
  assert.equal(p.request(), "now");
  p.start();
  assert.equal(p.request(), "skip");
  assert.equal(p.finish(), true, "the request during the run asks for another");
  assert.equal(p.request(), "later");
  assert.equal(p.request(), "skip", "only one is booked");
  assert.equal(p.wait(), 100);
  t = 100;
  assert.equal(p.request(true), "now");
});

test("newestOf and statArgs: the date lines only; a path can't pass for a flag", () => {
  assert.equal(newestOf("100\n300\n200\n"), 300);
  assert.equal(newestOf("stat: cannot stat\n"), null);
  assert.equal(newestOf(""), null);
  assert.deepEqual(statArgs("bsd", ["-x"]), ["stat", ["-f", "%m", "--", "-x"]]);
  assert.deepEqual(statArgs("gnu", ["a"]), ["stat", ["-c", "%Y", "--", "a"]]);
});

test("rowTitle and rowMeta", () => {
  assert.deepEqual(rowTitle({ path: "/r/x", checkout: true, branch: "feat" }), { name: "feat", sub: "" });
  assert.deepEqual(rowTitle({ path: "/r/x", checkout: true }), { name: "x", sub: "" }, "detached goes by its folder");
  assert.deepEqual(rowTitle({ path: "/n/notes", checkout: false }, { branch: "main" }), { name: "notes", sub: "main" });
  assert.equal(rowMeta(undefined), "");
  assert.equal(rowMeta({ files: 0 }), "", "the darker part says it once");
  assert.equal(rowMeta({ files: 1 }), "1 file");
  assert.equal(rowMeta({ files: 2 }), "2 files");
  assert.equal(rowMeta({ error: "not a repo" }), "not a repo");
});

test("watchable and baseName", () => {
  assert.equal(watchable("/h", "/h"), false);
  assert.equal(watchable("/", "/h"), false);
  assert.equal(watchable("/h/r", "/h"), true);
  assert.equal(baseName("/a/b/"), "b");
  assert.equal(baseName("C:\\a\\b"), "b");
});
