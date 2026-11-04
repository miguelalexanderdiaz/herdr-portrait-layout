#!/usr/bin/env node
// Runs every repository check in turn and prints one summary: `npm run check` (CI runs the same on three systems).
//   validate, check-recipe, check-assets, check-docs, privacy-scan
// The node tests are separate (`npm test`, i.e. `node --test`), and so is the history scan (`npm run check:history`:
// it needs the git history and fails on purpose until the author has dealt with the address in an old commit).
// Each script is started with the running node binary, no shell, so this behaves the same on Linux, macOS and Windows.
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const SCRIPTS = ["validate", "check-recipe", "check-assets", "check-docs", "privacy-scan"];
const extra = process.argv.slice(2);

const results = [];
for (const name of SCRIPTS) {
  const started = Date.now();
  const run = spawnSync(process.execPath, [join(here, `${name}.mjs`), ...(name === "privacy-scan" ? extra : [])], { encoding: "utf8", maxBuffer: 1 << 26 });
  const out = `${run.stdout ?? ""}${run.stderr ?? ""}`.trimEnd();
  results.push({ name, ok: run.status === 0, ms: Date.now() - started, out });
  if (run.status !== 0 || process.env.CHECK_VERBOSE) console.log(`--- ${name}\n${out}\n`);
}
console.log("check-all:");
for (const x of results) console.log(`  ${x.ok ? "ok  " : "FAIL"} ${x.name} (${x.ms} ms)`);
const failed = results.filter((x) => !x.ok);
if (failed.length) {
  console.error(`check-all: ${failed.length} of ${results.length} failed: ${failed.map((x) => x.name).join(", ")}`);
  process.exit(1);
}
console.log(`check-all: all ${results.length} ok`);
