#!/usr/bin/env node
// Writes the manifest scripts/bundled.json for the bundled copy mods/attention-picker. It fetches nothing: after taking
// a new version of the folder, review its diff and run
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
  console.error("usage: node scripts/bundled.mjs <40-character commit the folder was taken from>");
  process.exit(2);
}
const files = {};
// gpui-kit.d.ts and jsconfig.json are written into mod folders by the Herdr app (herdr-app check); they are not part of the copy.
for (const name of readdirSync(abs(DIR)).sort().filter((n) => n !== "gpui-kit.d.ts" && n !== "jsconfig.json")) files[posix(`${DIR}/${name}`)] = sha256(`${DIR}/${name}`);
const manifest = {
  _about: "Hashes (SHA-256 of the text with LF line endings) of the bundled copy mods/attention-picker, taken at commit `ref` of its source. The copy is read-only here: take a new version of the whole folder, then run `node scripts/bundled.mjs <ref>`. validate.mjs fails when a file differs, is missing or is new.",
  ref,
  files,
};
const text = `${JSON.stringify(manifest, null, 2)}\n`;
if (print) process.stdout.write(text);
else { writeFileSync(abs("scripts/bundled.json"), text); console.log(`scripts/bundled.json written: ${Object.keys(files).length} files at ${ref}`); }
