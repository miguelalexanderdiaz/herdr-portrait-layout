#!/usr/bin/env node
// Structure checks for the layout and its mods. Run from anywhere: node scripts/validate.mjs
//   - every JSON file parses and ends with a newline
//   - mod.json: only known fields, a main.js next to it, no editor files committed
//   - layouts: node rules, unique ids, every `content.mod` resolvable, load-bearing ids present,
//     no theme or font pinned, preview files exist, portrait-bottom = portrait with the left column reordered
//   - snippets: still fit into the layouts
//   - keys.json: known commands, valid sections, no duplicate chord, nothing Herdr already binds,
//     nothing a terminal program needs, no ctrl-alt (AltGr)
//   - mod sources: asset paths resolve inside the repo, `mod` names resolve, load-bearing names of RECIPE.md exist
//   - LICENSE and NOTICE (every icon accounted for under a heading that names its license)
//   - the bundled attention-picker equals scripts/bundled.json (SHA-256 per file), and the CI template is the one in use
import { readdirSync } from "node:fs";
import { abs, canonical, exists, json, layoutNames, modFolders, nodes, posix, read, reporter, repoFiles, sha256 } from "./lib.mjs";

const r = reporter("validate");
const files = repoFiles();

// ---- 1. JSON parses
for (const f of files.filter((f) => f.endsWith(".json"))) {
  try { JSON.parse(read(f)); } catch (e) { r.error(`${f}: invalid JSON (${e.message})`); }
  if (!f.startsWith("plans/")) r.check(read(f).endsWith("\n"), `${f}: must end with a newline (.editorconfig)`);
}

// ---- 2. mods
const MOD_KEYS = new Set(["place", "title", "overlay", "focusable", "size", "cloned_from"]);
const PLACES = new Set(["right", "left", "top", "bottom", "none"]);
const mods = modFolders();
const external = json("scripts/shipped-mods.json");
for (const m of mods) {
  r.check(exists(`mods/${m}/main.js`), `mods/${m}: main.js is missing`);
  if (!r.check(exists(`mods/${m}/mod.json`), `mods/${m}: mod.json is missing`)) continue;
  const mj = json(`mods/${m}/mod.json`);
  for (const k of Object.keys(mj)) r.check(MOD_KEYS.has(k), `mods/${m}/mod.json: unknown field "${k}" (known: ${[...MOD_KEYS].join(", ")})`);
  r.check(PLACES.has(mj.place), `mods/${m}/mod.json: "place" must be one of ${[...PLACES].join(", ")}`);
  r.check(typeof mj.title === "string" && mj.title.length > 0, `mods/${m}/mod.json: "title" is missing`);
  if (mj.cloned_from) r.check(typeof mj.cloned_from.name === "string" && /^\d+\.\d+\.\d+/.test(mj.cloned_from.version ?? ""), `mods/${m}/mod.json: cloned_from needs {name, version}`);
}
for (const f of files) {
  const base = f.split("/").pop();
  r.check(base !== "gpui-kit.d.ts" && base !== "jsconfig.json", `${f}: written by the Herdr app into mod folders, must not be committed`);
}

// ---- 3. layouts
const NODE_TYPES = new Set(["block", "row", "column", "stack"]);
const FORBIDDEN_ROOT = ["theme", "colors", "font", "font_size", "ui_font"];
const REQUIRED_IDS = ["root", "left", "bar", "bar-strip", "tree", "work", "tabs", "main", "status", "panel", "panel-body", "files", "changes"];
const mine = new Set(mods);
const shipped = new Set(external.shipped);
const optional = new Set(external.optional);
const names = layoutNames();
const layouts = {};
for (const n of names) {
  const f = `layouts/${n}.json`;
  const root = (layouts[n] = json(f));
  const ids = new Set();
  for (const { node, parent } of nodes(root)) {
    r.check(typeof node.id === "string" && /^[a-z][a-z0-9-]*$/.test(node.id), `${f}: node without a clean id (${JSON.stringify(node.id)})`);
    r.check(!ids.has(node.id), `${f}: duplicate id "${node.id}"`);
    ids.add(node.id);
    r.check(NODE_TYPES.has(node.type), `${f}: ${node.id} has unknown type "${node.type}"`);
    if (node.size !== undefined) r.check(Number.isFinite(node.size.px) || Number.isFinite(node.size.weight), `${f}: ${node.id} size must be {px} or {weight}`);
    if (node.type === "block") {
      const c = node.content ?? {};
      const kinds = ["mod", "terminal", "tab", "agent"].filter((k) => c[k] !== undefined);
      r.check(kinds.length === 1, `${f}: block ${node.id} needs exactly one of content.mod/terminal/tab/agent`);
      for (const mod of [c.mod, c.pane?.header?.content?.mod].filter(Boolean)) {
        r.check(mine.has(mod) || shipped.has(mod), `${f}: ${node.id} uses mod "${mod}", which is neither in mods/ nor on the shipped list in scripts/shipped-mods.json`);
      }
    } else {
      r.check(Array.isArray(node.children) && node.children.length > 0, `${f}: ${node.type} ${node.id} needs children`);
    }
    if (node.type === "stack" && node.active) r.check((node.children ?? []).some((c) => c.id === node.active), `${f}: stack ${node.id} active "${node.active}" is not a child`);
  }
  for (const k of FORBIDDEN_ROOT) r.check(root[k] === undefined, `${f}: root "${k}" pins the look; the layout must follow the person's settings (decision D5)`);
  for (const id of REQUIRED_IDS) r.check(ids.has(id), `${f}: required id "${id}" is missing`);
  r.check(!ids.has("vault"), `${f}: the vault child belongs in snippets/vault-panel.json, not in the layout (decision D6)`);
  if (root.preview) {
    r.check(exists(root.preview), `${f}: preview "${root.preview}" does not exist`);
    // Herdr's convention: the thumbnail is layouts/<layout name>.svg. A rename that forgets it would leave the old one.
    r.check(root.preview === `layouts/${n}.svg`, `${f}: "preview" must be "layouts/${n}.svg" (rename it with the layout, copy the thumbnail too)`);
  } else r.error(`${f}: root "preview" is missing`);
  if (root.cloned_from) r.check(typeof root.cloned_from.name === "string" && root.cloned_from.version, `${f}: cloned_from needs {name, version}`);
}
// portrait-bottom must be portrait with the left column reordered, so the variants cannot drift.
if (layouts.portrait && layouts["portrait-bottom"]) {
  const norm = (l) => {
    const c = structuredClone(l);
    delete c.preview;
    const left = c.children.find((n) => n.id === "left");
    left.children.sort((a, b) => a.id.localeCompare(b.id));
    return JSON.stringify(canonical(c));
  };
  r.check(norm(layouts.portrait) === norm(layouts["portrait-bottom"]), "layouts: portrait-bottom differs from portrait by more than the order of the left column's children");
}

// ... and it lists every key in the same order, so `diff` between the two files shows only the moved bar.
if (layouts.portrait && layouts["portrait-bottom"]) {
  const orders = (l) => Object.fromEntries([...nodes(l)].map((x) => [x.node.id, Object.keys(x.node).join(",")]));
  const a = orders(layouts.portrait), b = orders(layouts["portrait-bottom"]);
  for (const id of Object.keys(a)) r.check(a[id] === b[id], `layouts: node "${id}" has its keys in another order in portrait-bottom.json (${b[id]} instead of ${a[id]})`);
  r.check(Object.keys(layouts.portrait).join(",") === Object.keys(layouts["portrait-bottom"]).join(","), "layouts: the root keys of portrait-bottom.json are in another order than portrait.json");
}

// ---- 4. snippets
if (exists("snippets/vault-panel.json")) {
  const s = json("snippets/vault-panel.json");
  r.check(s.id === "vault" && s.type === "block" && s.content?.mod === "vault", "snippets/vault-panel.json: must be the block {id: vault, content: {mod: vault}}");
  r.check(optional.has(s.content?.mod), "snippets/vault-panel.json: its mod must be listed under 'optional' in scripts/shipped-mods.json");
  for (const [n, l] of Object.entries(layouts)) {
    const ids = new Set([...nodes(l)].map((x) => x.node.id));
    r.check(!ids.has(s.id), `snippets/vault-panel.json: id "${s.id}" already exists in layouts/${n}.json`);
    r.check(ids.has("panel-body"), `snippets/vault-panel.json: layouts/${n}.json has no stack "panel-body" to receive it`);
  }
} else r.error("snippets/vault-panel.json is missing");

// ---- 5. keys.json
const commands = json("scripts/commands.json").commands;
const defaults = json("scripts/default-keys.json");
const keysRaw = read("keys.json");
const keys = JSON.parse(keysRaw);
const RESERVED_NOTE = "programs rely on plain ctrl+letters (c d l r w a e u k z [ and the rest)";
const MODS = ["ctrl", "shift", "alt", "cmd"];
function parseToken(tok) {
  const m = new Set();
  let rest = tok;
  for (;;) {
    const hit = MODS.find((x) => rest.startsWith(x + "-") && rest.length > x.length + 1);
    if (!hit) break;
    m.add(hit);
    rest = rest.slice(hit.length + 1);
  }
  return { mods: m, key: rest };
}
const normChord = (c) => c.split(" ").map((t) => { const p = parseToken(t); return [...MODS.filter((x) => p.mods.has(x)), p.key].join("-"); }).join(" ");
// Chords the repo overrides on purpose inside layout sections; each needs its reason here.
const OVERRIDES = { "cmd-b": "macOS default for layout.toggle:sidebar; the portrait layouts have no sidebar, so the layout section re-points it at the bar" };
const defaultChords = new Set(Object.values({ ...defaults.linux_windows, ...defaults.macos }).flat().concat(Object.values(defaults.linux_windows).flat(), Object.values(defaults.macos).flat()).map(normChord));
// Duplicate keys inside one section (JSON.parse keeps the last silently).
function duplicates(raw) {
  const out = [];
  let depth = 0, section = null, i = 0, last = null;
  const seen = {};
  while (i < raw.length) {
    const ch = raw[i];
    if (ch === '"') {
      let j = i + 1, s = "";
      while (raw[j] !== '"') { s += raw[j] === "\\" ? raw[++j] : raw[j]; j++; }
      i = j + 1;
      let k = i; while (/\s/.test(raw[k])) k++;
      if (raw[k] === ":") { if (depth === 1) section = s; else if (depth === 2) { const key = `${section}\0${s}`; if (seen[key]) out.push(`${section}: ${s}`); seen[key] = true; } }
      last = s; continue;
    }
    if (ch === "{") depth++;
    if (ch === "}") depth--;
    i++;
  }
  return out;
}
for (const d of duplicates(keysRaw)) r.error(`keys.json: duplicate chord (${d})`);
for (const [section, map] of Object.entries(keys)) {
  const layoutSection = /^layout:(.+)$/.exec(section);
  if (layoutSection) r.check(names.includes(layoutSection[1]), `keys.json: section "${section}" has no layouts/${layoutSection[1]}.json`);
  else if (/^mod:(.+)$/.test(section)) r.check(mine.has(section.slice(4)), `keys.json: section "${section}" names a mod that is not in mods/`);
  else r.check(section === "global" || section === "terminal", `keys.json: unknown section "${section}"`);
  for (const [chord, action] of Object.entries(map)) {
    const where = `keys.json ${section} "${chord}"`;
    const tokens = chord.split(" ");
    const parsed = tokens.map(parseToken);
    r.check(parsed.every((p) => p.key.length > 0), `${where}: not a chord`);
    for (const p of parsed) {
      r.check(!(p.mods.has("ctrl") && p.mods.has("alt")), `${where}: ctrl+alt is AltGr on Windows and types characters`);
      r.check(!(p.mods.has("alt") && !p.mods.has("ctrl") && !p.mods.has("cmd") && /^[a-z0-9]$/.test(p.key) && !p.mods.has("shift")), `${where}: option/alt plus a letter or digit types characters on many keyboards`);
    }
    const p0 = parsed[0];
    r.check(!(p0.mods.size === 1 && p0.mods.has("ctrl") && p0.key.length === 1), `${where}: a plain ctrl+key is the terminal program's (${RESERVED_NOTE})`);
    r.check(tokens.length === 1, `${where}: multi-key chords make their first key a prefix that is stolen from every terminal program`);
    const n = normChord(chord);
    if (defaultChords.has(n)) r.check(Boolean(OVERRIDES[n]) && Boolean(layoutSection), `${where}: Herdr already binds this chord (scripts/default-keys.json)`);
    // action
    const name = String(action).split(":")[0];
    if (action === "terminal" || String(action).startsWith("send:")) continue;
    if (commands[name]) continue;
    const dot = name.indexOf(".");
    if (dot > 0 && mine.has(name.slice(0, dot))) continue;
    r.error(`${where}: action "${action}" is not a Herdr command (scripts/commands.json) nor <mod>.<command> of a mod in mods/`);
  }
}
// bar-strip.attention only reaches a shown bar-strip: bind it in the layout sections, never global, and not on the
// chord the standalone attention-picker repo uses for mod.open:attention-picker.
for (const [section, map] of Object.entries(keys)) {
  for (const [chord, action] of Object.entries(map)) {
    if (String(action).startsWith("bar-strip.")) r.check(section.startsWith("layout:"), `keys.json ${section} "${chord}": ${action} is only delivered to a shown copy; bind it in a layout: section`);
    if (normChord(chord) === "ctrl-shift-a") r.error(`keys.json ${section}: ctrl-shift-a is taken by the standalone attention-picker repo`);
  }
}
for (const n of names) r.check(Boolean(keys[`layout:${n}`]), `keys.json: no "layout:${n}" section (the toggle and switch chords)`);

// ---- 6. mod sources
const OPTIONAL_ICON = new Set(external.tolerated_assets.optional_assets);
const jsFiles = files.filter((f) => /^mods\/[^/]+\/.+\.(js|mjs)$/.test(f));
const idRefs = new Map(); // layout ids that code looks up
// Ids the code probes for but a layout may lack: the opt-in vault panel, and the sidebar of the cloned tabs mod.
const OPTIONAL_IDS = new Set(["vault", "sidebar"]);
for (const f of jsFiles) {
  const mod = f.split("/")[1];
  const src = read(f);
  for (const m of src.matchAll(/[`"'](mods\/[^`"']+\.(?:svg|png|jpe?g|webp|gif)|mods\/[^`"']*\$\{[^`"']*)[`"']/g)) {
    const p = m[1];
    if (p.includes("${")) {
      // template path: check the static prefix folder only
      const folder = p.slice(0, p.indexOf("${"));
      if (folder.startsWith("mods/")) r.check(exists(posix(folder).replace(/\/[^/]*$/, "")), `${f}: asset folder of "${p}" does not exist`);
      continue;
    }
    if (!p.startsWith("mods/")) continue;
    if (exists(p)) continue;
    const tolerated = (external.tolerated_assets[mod] ?? []).includes(p) || OPTIONAL_ICON.has(p);
    r.check(tolerated, `${f}: loads "${p}", which is not in this repo (vendor it into mods/${mod}/, see NOTICE)`);
  }
  for (const m of src.matchAll(/\bmod:\s*"([a-z0-9-]+)"/g)) {
    const name = m[1];
    r.check(mine.has(name) || shipped.has(name) || optional.has(name), `${f}: refers to mod "${name}", which is not in mods/ or scripts/shipped-mods.json`);
  }
  for (const m of src.matchAll(/"mod\.open",\s*\{\s*name:\s*"([a-z0-9-]+)"/g)) {
    const name = m[1];
    r.check(mine.has(name) || shipped.has(name) || optional.has(name), `${f}: opens mod "${name}", which is not in mods/ or scripts/shipped-mods.json`);
  }
  if (mod !== "attention-picker") {
    for (const m of src.matchAll(/run\(\s*"layout\.(?:hide|show|toggle|resize)",\s*\{\s*id:\s*"([^"]+)"/g)) idRefs.set(m[1], f);
    for (const m of src.matchAll(/stack:\s*"([^"]+)"/g)) idRefs.set(m[1], f);
    for (const m of src.matchAll(/\bfind\(\s*\w+\s*,\s*"([^"]+)"\s*\)/g)) if (!OPTIONAL_IDS.has(m[1])) idRefs.set(m[1], f);
  }
}
for (const [id, f] of idRefs) for (const [n, l] of Object.entries(layouts)) {
  r.check([...nodes(l)].some((x) => x.node.id === id), `${f}: looks up layout id "${id}", which layouts/${n}.json does not have`);
}

// ---- 7. load-bearing names listed in RECIPE.md
if (exists("RECIPE.md")) {
  const recipe = read("RECIPE.md");
  const sec = /###\s+Load-bearing names\s*\n([\s\S]*?)(?=\n#{1,3}\s|$)/.exec(recipe);
  if (!sec) r.error('RECIPE.md: the "### Load-bearing names" list is missing (decision HC-1-9)');
  else {
    const allIds = new Set(Object.values(layouts).flatMap((l) => [...nodes(l)].map((x) => x.node.id)));
    const allJs = jsFiles.map((f) => read(f)).join("\n");
    const allKeys = JSON.stringify(keys);
    let counted = 0;
    for (const line of sec[1].split("\n")) {
      const lm = /^\s*[-*]\s+\*\*([^*]+?):?\*\*\s*(.*)$/.exec(line);
      if (!lm) continue;
      const kind = lm[1].toLowerCase().trim();
      const tokens = [...lm[2].matchAll(/`([^`]+)`/g)].map((x) => x[1]);
      for (const t of tokens) {
        counted++;
        if (kind.startsWith("layout id")) r.check(allIds.has(t), `RECIPE.md load-bearing layout id "${t}" is not in any layout`);
        else if (kind.startsWith("mod")) r.check(mine.has(t) || shipped.has(t) || optional.has(t), `RECIPE.md load-bearing mod "${t}" is not in mods/ or the external list`);
        else if (kind.startsWith("key section")) r.check(Object.hasOwn(keys, t), `RECIPE.md load-bearing key section "${t}" is not in keys.json`);
        else if (kind.startsWith("shared")) r.check(allJs.includes(`"${t}"`), `RECIPE.md load-bearing shared key "${t}" is not used by any mod`);
        else if (kind.startsWith("command")) r.check(allKeys.includes(t) || allJs.includes(`"${t}"`), `RECIPE.md load-bearing command "${t}" is used by no key or mod`);
        else r.error(`RECIPE.md load-bearing list: unknown kind "${kind}"`);
      }
    }
    r.check(counted >= 10, "RECIPE.md: the load-bearing names list is nearly empty");
  }
}

// ---- 8. license and notice
if (r.check(exists("LICENSE"), "LICENSE is missing")) {
  const lic = read("LICENSE");
  r.check(/^\s*Apache License\s*\n\s*Version 2\.0, January 2004/.test(lic), "LICENSE must be the Apache License 2.0 text");
  r.check(/^\s*Copyright 20\d\d \S.*$/m.test(lic) && !/\[yyyy\]|\[name of copyright owner\]/.test(lic), "LICENSE needs its copyright line filled in");
}
if (r.check(exists("NOTICE"), "NOTICE is missing")) {
  const notice = read("NOTICE");
  const cloned = new Set();
  for (const m of mods) { const c = json(`mods/${m}/mod.json`).cloned_from; if (c) { cloned.add(c.name); r.check(notice.includes(`mods/${m}/`), `NOTICE does not name the clone mods/${m}/`); } }
  for (const n of names) { const c = layouts[n].cloned_from; if (c) { cloned.add(c.name); r.check(notice.includes(`layouts/${n}.json`), `NOTICE does not name layouts/${n}.json`); } }
  for (const c of cloned) r.check(notice.includes(`\`${c}\``), `NOTICE does not name the Herdr original \`${c}\``);
  r.check(/Apache License, Version 2\.0/.test(notice) && /ISC License/.test(notice), "NOTICE must carry the Apache and the Lucide (ISC) statements");
  // every vendored picture is accounted for, and nothing is listed that is not there (the bundled copy is covered as a whole)
  const assets = files.filter((f) => /^mods\/[^/]+\/[^/]+\.(svg|png|jpe?g|webp)$/.test(f) && !f.startsWith("mods/attention-picker/"));
  const bases = new Set(assets.map((f) => f.split("/").pop()));
  for (const b of bases) r.check(notice.includes(b), `NOTICE does not account for the icon ${b} (origin and license)`);
  // ... and each one sits under a heading that names the license it is used under (a heading is a line followed by a line of dashes).
  const parts = [];
  notice.split("\n").forEach((line, i, all) => { if (i > 0 && /^-{5,}\s*$/.test(line) && all[i - 1].trim()) parts.push({ title: all[i - 1].trim(), from: i + 1 }); });
  const lines = notice.split("\n");
  parts.forEach((p, i) => { p.text = lines.slice(p.from, i + 1 < parts.length ? parts[i + 1].from - 2 : undefined).join("\n"); });
  for (const b of bases) {
    const home = parts.find((p) => p.text.includes(b));
    if (home) r.check(/Apache|ISC|\bMIT\b/.test(home.title), `NOTICE lists ${b} under "${home.title}", a heading that names no license (Apache, ISC or MIT)`);
  }
  const listed = [...notice.matchAll(/\b([a-z0-9-]+\.svg)\b/g)].map((m) => m[1]);
  for (const b of new Set(listed)) r.check(bases.has(b), `NOTICE lists ${b}, which is not in any mod folder (stale)`);
  r.check(!files.some((f) => /obsidian\.(png|svg)$/i.test(f)), "the Obsidian logo may not be redistributed");
}

// ---- 9. the bundled copy of another repository's mod is read-only: it must equal the manifest
if (r.check(exists("scripts/bundled.json"), "scripts/bundled.json is missing (hashes of the bundled mods/attention-picker)")) {
  const b = json("scripts/bundled.json");
  r.check(/^[0-9a-f]{40}$/.test(b.ref ?? ""), "scripts/bundled.json: `ref` must be the 40-character commit of the repository it was synced from");
  const want = b.files ?? {};
  const have = readdirSync(abs("mods/attention-picker")).map((n) => `mods/attention-picker/${n}`);
  for (const f of have) {
    if (!want[f]) r.error(`${f}: not in scripts/bundled.json (a new file of the sync, or a stray file): sync from ${b.source}, then run node scripts/bundled.mjs <commit>`);
    else r.check(sha256(f) === want[f], `${f}: differs from scripts/bundled.json. The copy is read-only here: change it in ${b.source}, sync it, then run node scripts/bundled.mjs <commit>`);
  }
  for (const f of Object.keys(want)) r.check(have.includes(f), `${f}: listed in scripts/bundled.json but missing from the folder`);
}

// ---- 10. CI: the workflow definition lives in scripts/ (a token without the `workflow` scope cannot push .github/workflows/)
if (r.check(exists("scripts/ci.workflow.yml"), "scripts/ci.workflow.yml is missing (the CI definition; see scripts/PUBLISH.md)")) {
  if (exists(".github/workflows/ci.yml")) r.check(read(".github/workflows/ci.yml") === read("scripts/ci.workflow.yml"), ".github/workflows/ci.yml differs from scripts/ci.workflow.yml: edit the template and copy it over (scripts/PUBLISH.md)");
}

r.done();
