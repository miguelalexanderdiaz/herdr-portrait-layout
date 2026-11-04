#!/usr/bin/env node
// Writes the manifest scripts/bundled.json for the bundled copy mods/attention-picker. It fetches nothing: after syncing
// the folder from the herdr-agents-waiting repository, review the diff of the folder and run
//
//   node scripts/bundled.mjs <commit of the synced branch>
//
// Without an argument the commit already recorded in bundled.json is kept; --print writes to the screen instead. validate.mjs recomputes the same hashes, so a
// hand edit of the copy (or a forgotten file at the next sync) fails the suite on every operating system.
import { readdirSync } from "node:fs";
import { writeFileSync } from "node:fs";
import { abs, exists, json, posix, sha256 } from "./lib.mjs";

const DIR = "mods/attention-picker";
const previous = exists("scripts/bundled.json") ? json("scripts/bundled.json") : {};
const args = process.argv.slice(2);
const print = args.includes("--print");
const ref = args.find((a) => !a.startsWith("--")) ?? previous.ref;
if (!/^[0-9a-f]{40}$/.test(ref ?? "")) {
  console.error("usage: node scripts/bundled.mjs <40-character commit of herdr-agents-waiting that was synced>");
  process.exit(2);
}
const files = {};
for (const name of readdirSync(abs(DIR)).sort()) files[posix(`${DIR}/${name}`)] = sha256(`${DIR}/${name}`);
const manifest = {
  _about: "Hashes (SHA-256 of the text with LF line endings) of the bundled copy mods/attention-picker, synced from the repository named in `source` at `ref`. The copy is read-only here: change it there, sync it, then run `node scripts/bundled.mjs <ref>`. validate.mjs fails when a file differs, is missing or is new.",
  source: previous.source ?? "herdr-agents-waiting",
  ref,
  files,
};
const text = `${JSON.stringify(manifest, null, 2)}\n`;
if (print) process.stdout.write(text);
else { writeFileSync(abs("scripts/bundled.json"), text); console.log(`scripts/bundled.json written: ${Object.keys(files).length} files at ${ref}`); }
