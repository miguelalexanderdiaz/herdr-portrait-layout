#!/usr/bin/env node
// RECIPE.md follows Herdr's sharing format (AGENTS.md, "Layouts and mods other people made"):
//   `# Name` + a paragraph + `![Name](preview.png)`, then the sections What you see, How it behaves, Built from,
//   Watch out, Done when, in that order. Beyond the format this checks that the recipe really describes this repo:
//   every layout file and mod folder is named, every key of keys.json and every size of the layouts is quoted,
//   the disclosure block (network, programs, reads, writes) is there, NOTICE exists, and no personal path appears.
import { exists, json, layoutNames, modFolders, nodes, read, reporter } from "./lib.mjs";

const r = reporter("check-recipe");
if (!r.check(exists("RECIPE.md"), "RECIPE.md is missing")) r.done();
const md = read("RECIPE.md");

// ---- headings, in order
const lines = md.split(/\r?\n/);
const h1 = lines.findIndex((l) => /^# \S/.test(l));
r.check(h1 === 0, "RECIPE.md must start with `# Name` on its first line");
const title = (lines[h1] ?? "").replace(/^# /, "").trim();
r.check(/!\[[^\]]*\]\(preview\.png\)/.test(md), "RECIPE.md must embed ![Name](preview.png)");
const imgAt = lines.findIndex((l) => /!\[[^\]]*\]\(preview\.png\)/.test(l));
const firstH2 = lines.findIndex((l) => /^## /.test(l));
r.check(imgAt > h1 && imgAt < firstH2, "the preview image must come after the title and before the first section");
const para = lines.slice(h1 + 1, imgAt).join(" ").trim();
r.check(para.length > 80, "a paragraph of what the person sees must sit between the title and the preview");
void title;

const SECTIONS = ["What you see", "How it behaves", "Built from", "Watch out", "Done when"];
const found = lines.filter((l) => /^## /.test(l)).map((l) => l.slice(3).trim());
r.check(JSON.stringify(found) === JSON.stringify(SECTIONS), `sections must be exactly ${JSON.stringify(SECTIONS)} in order, found ${JSON.stringify(found)}`);
const section = (name) => {
  const at = lines.findIndex((l) => l.trim() === `## ${name}`);
  if (at < 0) return "";
  const end = lines.findIndex((l, i) => i > at && /^## /.test(l));
  return lines.slice(at + 1, end < 0 ? undefined : end).join("\n");
};

// ---- everything in the repo is named
const built = section("Built from");
for (const n of layoutNames()) r.check(md.includes(`layouts/${n}.json`), `RECIPE.md never names layouts/${n}.json`);
for (const m of modFolders()) r.check(built.includes(`\`${m}\``), `Built from does not name the mod \`${m}\``);
r.check(built.includes("snippets/vault-panel.json"), "Built from must explain snippets/vault-panel.json");
r.check(md.includes("NOTICE"), "RECIPE.md should point to NOTICE for the art's provenance");

// ---- keys: every chord and action
const keys = json("keys.json");
for (const [section_, map] of Object.entries(keys)) {
  r.check(md.includes(`\`${section_}\``), `RECIPE.md does not mention the keys section \`${section_}\``);
  for (const [chord, action] of Object.entries(map)) {
    r.check(md.includes(`\`${chord}\``), `RECIPE.md does not list the key \`${chord}\``);
    r.check(md.includes(`\`${action}\``) || md.includes(action), `RECIPE.md does not mention the action ${action}`);
  }
}

// ---- layout facts quoted from the real files (the numbers a fresh build would get wrong)
const layout = json("layouts/portrait.json");
const byId = Object.fromEntries([...nodes(layout)].map((x) => [x.node.id, x.node]));
const quote = (id, key, value, label) => { if (byId[id]) r.check(md.includes(String(value)), `RECIPE.md does not state ${label} (${value})`); };
quote("bar", null, byId.bar?.size?.px, "the bar's height");
quote("bar-strip", null, byId["bar-strip"]?.size?.px, "the strip's height");
quote("tabs", null, byId.tabs?.size?.px, "the tab strip's height");
quote("status", null, byId.status?.size?.px, "the status line's height");
quote("panel", null, byId.panel?.size?.px, "the panel's width");
quote("panel", null, byId.panel?.min, "the panel's minimum");
quote("panel", null, byId.panel?.max, "the panel's maximum");
quote("bar", null, byId.bar?.min, "the bar's minimum");
quote("bar", null, byId.bar?.max, "the bar's maximum");
const pane = byId.main?.content?.pane;
if (pane) {
  r.check(new RegExp(`radius:? ?${pane.radius}`).test(md) || md.includes(`radius ${pane.radius}`), `RECIPE.md does not state the pane radius ${pane.radius}`);
  r.check(md.includes(`height: ${pane.header.height}`) || md.includes(`${pane.header.height}px`), "RECIPE.md does not state the pane header height");
}

// ---- disclosure (Herdr installers warn about these)
for (const term of ["Network:", "Runs programs:", "Reads outside its folder:", "Writes outside its folder:"]) {
  r.check(built.includes(term), `Built from must carry the disclosure line "${term}"`);
}
const watch = section("Watch out");
r.check(/Load-bearing names/.test(watch), 'Watch out must contain "### Load-bearing names"');
r.check(/macOS/.test(watch) && /Linux/.test(watch) && /Windows/.test(watch), "Watch out must say what differs on macOS, Linux and Windows");

// ---- done-when: concrete checks
const done = section("Done when");
const items = done.split("\n").filter((l) => /^- \[[ x]\] /.test(l));
r.check(items.length >= 5, "Done when needs at least five checkable items");

// ---- privacy
r.check(!/\/Users\/|\/home\/[a-z]|[A-Za-z]:\\Users\\/.test(md), "RECIPE.md must not contain a home path");
r.check(!/@[a-z0-9-]+\.[a-z]{2,}/i.test(md), "RECIPE.md must not contain an e-mail address");

// ---- plain-text rules: no tables left half written
const tableRows = lines.filter((l) => /^\|/.test(l));
r.check(tableRows.every((l) => /\|\s*$/.test(l)), "a table row in RECIPE.md is not closed with |");

r.done();
