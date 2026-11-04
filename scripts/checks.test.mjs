// Negative tests for the repository checks: a check that never fails proves nothing. Each case copies the tree into a
// temporary folder, breaks one thing and asserts that the right script exits 1 and says what is wrong. The real tree is
// never touched. Plain `node --test` finds this file by its name; no dependencies.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync, mkdirSync, appendFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
let base; // a pristine copy, made once
let skip = null; // reason, when the temp folder is not usable

// Home paths and addresses are assembled from parts: the privacy scan reads this very file.
const homePath = ["", "Users", "jane", "notes"].join("/");
const emailAddr = ["jane", "example.org"].join("@");
const gmail = ["someone", "gmail.com"].join("@");

before(() => {
  try {
    base = mkdtempSync(join(tmpdir(), "portrait-checks-"));
    cpSync(ROOT, join(base, "t"), { recursive: true, filter: (src) => ![".git", "node_modules", ".wt", "gpui-kit.d.ts", "jsconfig.json"].includes(basename(src)) });
  } catch (e) { skip = `no usable temp folder (${e.code ?? e.message})`; }
});
after(() => { if (base) rmSync(base, { recursive: true, force: true }); });

let n = 0;
function scratch() {
  const dir = join(base, `case-${++n}`);
  cpSync(join(base, "t"), dir, { recursive: true });
  const file = (p) => join(dir, ...p.split("/"));
  return {
    dir,
    file,
    read: (p) => readFileSync(file(p), "utf8"),
    write: (p, text) => { mkdirSync(dirname(file(p)), { recursive: true }); writeFileSync(file(p), text); },
    edit(p, from, to) {
      const text = readFileSync(file(p), "utf8");
      assert.ok(text.includes(from), `the test's setup is out of date: ${p} has no ${JSON.stringify(from)}`);
      writeFileSync(file(p), text.replace(from, to));
    },
    json(p, fn) { const v = JSON.parse(readFileSync(file(p), "utf8")); fn(v); writeFileSync(file(p), `${JSON.stringify(v, null, 2)}\n`); },
    run(script, ...args) {
      const r = spawnSync(process.execPath, [join(dir, "scripts", `${script}.mjs`), ...args], { cwd: dir, encoding: "utf8" });
      return { code: r.status, out: `${r.stdout}${r.stderr}` };
    },
  };
}
// Broken on purpose: the script must fail and its message must contain `msg`.
function fails(name, script, setup, msg, ...args) {
  test(`${script} fails: ${name}`, (t) => {
    if (skip) return t.skip(skip);
    const s = scratch();
    setup(s);
    const r = s.run(script, ...args);
    assert.equal(r.code, 1, `expected exit 1, got ${r.code}:\n${r.out}`);
    assert.match(r.out, msg);
  });
}

test("the clean tree passes every check", (t) => {
  if (skip) return t.skip(skip);
  const s = scratch();
  for (const script of ["validate", "check-recipe", "check-assets", "check-docs", "privacy-scan", "check-all"]) {
    const r = s.run(script);
    assert.equal(r.code, 0, `${script}:\n${r.out}`);
  }
});

// ---- keys.json
fails("a duplicate chord", "validate", (s) => s.edit("keys.json", '"ctrl-shift-g": "layout.toggle:bar",', '"ctrl-shift-g": "layout.toggle:bar",\n    "ctrl-shift-g": "layout.toggle:bar",'), /duplicate chord/);
fails("a ctrl-b prefix chord", "validate", (s) => s.json("keys.json", (k) => { k["layout:portrait"]["ctrl-b a"] = "layout.toggle:bar"; }), /multi-key chords/);
fails("a plain ctrl letter", "validate", (s) => s.json("keys.json", (k) => { k["layout:portrait"]["ctrl-c"] = "layout.toggle:bar"; }), /plain ctrl\+key/);
fails("ctrl+alt", "validate", (s) => s.json("keys.json", (k) => { k["layout:portrait"]["ctrl-alt-x"] = "layout.toggle:bar"; }), /ctrl\+alt/);
fails("a chord Herdr already binds", "validate", (s) => s.json("keys.json", (k) => { k["layout:portrait"]["alt-shift-h"] = "layout.toggle:bar"; }), /Herdr already binds/);
fails("an unknown action", "validate", (s) => s.json("keys.json", (k) => { k["layout:portrait"]["ctrl-shift-u"] = "no.such.command"; }), /not a Herdr command/);
fails("a layout without its keys section", "validate", (s) => s.json("keys.json", (k) => { delete k["layout:portrait-bottom"]; }), /no "layout:portrait-bottom" section/);

// ---- layouts
fails("a theme pinned in a layout", "validate", (s) => s.json("layouts/portrait.json", (l) => { l.theme = { dark: "graphite" }; }), /pins the look/);
fails("a renamed layout file (preview and keys no longer match)", "validate", (s) => renameSync(s.file("layouts/portrait.json"), s.file("layouts/portrait-top.json")), /"preview" must be "layouts\/portrait-top\.svg"/);
fails("portrait-bottom drifting from portrait", "validate", (s) => s.json("layouts/portrait-bottom.json", (l) => { l.background = "chrome"; }), /portrait-bottom differs/);
fails("portrait-bottom with its keys in another order", "validate", (s) => s.json("layouts/portrait-bottom.json", (l) => { const bg = l.background; delete l.background; l.background = bg; }), /another order/);
fails("a layout that uses a mod nobody ships", "validate", (s) => s.edit("layouts/portrait.json", '"mod": "workspace-status"', '"mod": "no-such-mod"'), /neither in mods\/ nor on the shipped list/);
fails("a JSON file without a final newline", "validate", (s) => { const t = s.read("mods/bar-strip/mod.json"); s.write("mods/bar-strip/mod.json", t.trimEnd()); }, /must end with a newline/);
fails("an unknown mod.json field", "validate", (s) => s.json("mods/bar-strip/mod.json", (m) => { m.colour = "red"; }), /unknown field "colour"/);

// ---- icons, NOTICE, bundled copy, CI
test("validate ignores the two files Herdr writes into a mod folder when it checks the bundled copy", (t) => {
  if (skip) return t.skip(skip);
  const s = scratch();
  // not tracked in a checkout (.gitignore), so only the bundled-copy listing could trip over them
  s.write("mods/attention-picker/jsconfig.json", "{}\n");
  const r = s.run("validate");
  assert.doesNotMatch(r.out, /not in scripts\/bundled\.json/);
});
fails("an icon NOTICE does not account for", "validate", (s) => s.write("mods/bar-strip/zzz-new.svg", '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M1 1"/></svg>\n'), /does not account for the icon zzz-new\.svg/);
fails("a NOTICE line about an icon that is gone", "validate", (s) => appendFileSync(s.file("NOTICE"), "\n  ghost-icon.svg                   mods/nowhere\n"), /lists ghost-icon\.svg/);
fails("an edited bundled file", "validate", (s) => appendFileSync(s.file("mods/attention-picker/main.js"), "\n// local edit\n"), /mods\/attention-picker\/main\.js: differs from scripts\/bundled\.json/);
fails("a new file in the bundled folder", "validate", (s) => s.write("mods/attention-picker/extra.js", "export {};\n"), /not in scripts\/bundled\.json/);
fails("a bundled file that went missing", "validate", (s) => rmSync(s.file("mods/attention-picker/ask.js")), /missing from the folder/);
fails("an installed CI file that differs from the template", "validate", (s) => s.write(".github/workflows/ci.yml", "name: other\n"), /ci\.yml differs from scripts\/ci\.workflow\.yml/);
fails("a file the Herdr app writes into a mod folder", "validate", (s) => s.write("mods/bar-strip/gpui-kit.d.ts", "// written by the app\n"), /must not be committed/);
fails("a mod that loads another mod's icon", "validate", (s) => appendFileSync(s.file("mods/nvim-float/main.js"), '\nconst leak = "mods/workspace-chrome/spinner.svg";\n'), /not in this repo/);
fails("a mod that loads an icon of a mod that is not shipped here", "validate", (s) => appendFileSync(s.file("mods/bar-strip/main.js"), '\nconst leak = "mods/some-addon/icons/book.svg";\n'), /not in this repo/);

// ---- RECIPE
fails("swapped RECIPE sections", "check-recipe", (s) => {
  const t = s.read("RECIPE.md");
  s.write("RECIPE.md", t.replace("## Watch out", "## @@").replace("## Done when", "## Watch out").replace("## @@", "## Done when"));
}, /sections must be exactly/);
fails("a key that RECIPE does not list", "check-recipe", (s) => s.json("keys.json", (k) => { k["layout:portrait"]["ctrl-shift-u"] = "layout.toggle:bar"; }), /does not list the key `ctrl-shift-u`/);
fails("a network call in a mod", "check-recipe", (s) => appendFileSync(s.file("mods/portrait-tree/main.js"), '\nfetch("https://example.org");\n'), /uses fetch/);
fails("a new import from herdr", "check-recipe", (s) => appendFileSync(s.file("mods/portrait-tree/main.js"), '\nimport { brandNewApi } from "herdr";\n'), /imports "brandNewApi" from "herdr"/);
fails("a new command a mod runs", "check-recipe", (s) => appendFileSync(s.file("mods/portrait-tree/main.js"), '\nrun("thing.undocumented");\n'), /runs the command thing\.undocumented/);
fails("a new program a mod starts", "check-recipe", (s) => appendFileSync(s.file("mods/portrait-tree/main.js"), '\nexec("curl", ["x"]);\n'), /starts the program "curl"/);
fails("a RECIPE without a disclosure line", "check-recipe", (s) => s.edit("RECIPE.md", "- **Network:**", "- **Net:**"), /disclosure line "Network:"/);
test("check-recipe still passes when RECIPE.md has CRLF line endings", (t) => {
  if (skip) return t.skip(skip);
  const s = scratch();
  s.write("RECIPE.md", s.read("RECIPE.md").replace(/\n/g, "\r\n"));
  const r = s.run("check-recipe");
  assert.equal(r.code, 0, r.out);
});

// ---- privacy
fails("a home path in a file", "privacy-scan", (s) => appendFileSync(s.file("CONTRIBUTING.md"), `\nsee ${homePath}\n`), /home path/);
fails("a home path on a plain line of a plan", "privacy-scan", (s) => s.write("plans/round-2/PLAN.md", `# Plan\n\nthe author keeps notes in ${homePath} on disk\n`), /plans\/round-2\/PLAN\.md:\d+: mac home path/);
test("privacy-scan lets a plan line that shows a pattern through", (t) => {
  if (skip) return t.skip(skip);
  const s = scratch();
  // plans/ is git-ignored and absent from a fresh checkout: the case writes its own plan file.
  s.write("plans/round-2/PLAN.md", `# Plan\n\nthe scan looks for ${["", "Users", "[a-z]+"].join("/")} and ends with <home>\n`);
  const r = s.run("privacy-scan");
  assert.equal(r.code, 0, r.out);
});
fails("an e-mail address in a file", "privacy-scan", (s) => appendFileSync(s.file("README.md"), `\nwrite to ${emailAddr}\n`), /e-mail address/);
fails("a token in a file", "privacy-scan", (s) => appendFileSync(s.file("README.md"), `\n${["ghp", "a".repeat(30)].join("_")}\n`), /token/);
fails("a denylisted term", "privacy-scan", (s) => { s.write(".privacy-denylist", "zebra-corp\n"); appendFileSync(s.file("README.md"), "\nbuilt at Zebra-Corp\n"); }, /denylist term/);

test("privacy-scan --commits names the commit whose author address is not a noreply address", (t) => {
  if (skip) return t.skip(skip);
  const probe = spawnSync("git", ["--version"], { encoding: "utf8" });
  if (probe.status !== 0) return t.skip("git is not installed");
  const s = scratch();
  const git = (...a) => spawnSync("git", ["-c", "commit.gpgsign=false", ...a], { cwd: s.dir, encoding: "utf8" });
  assert.equal(git("init", "-q").status, 0);
  assert.equal(git("add", "-A").status, 0);
  const noreply = ["1+someone", "users.noreply.github.com"].join("@");
  assert.equal(git("-c", "user.name=T", "-c", `user.email=${noreply}`, "commit", "-q", "-m", "first").status, 0);
  assert.equal(s.run("privacy-scan", "--commits").code, 0, "a history with noreply addresses passes");
  writeFileSync(s.file("note.txt"), "x\n");
  git("add", "-A");
  assert.equal(git("-c", "user.name=T", "-c", `user.email=${gmail}`, "commit", "-q", "-m", "second").status, 0);
  const sha = git("rev-parse", "--short", "HEAD").stdout.trim();
  const r = s.run("privacy-scan", "--commits");
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, new RegExp(`commit ${sha.slice(0, 7)}\\w*: the author address is not a GitHub noreply address`));
});

// ---- assets and docs
fails("a missing preview.png", "check-assets", (s) => rmSync(s.file("preview.png")), /preview\.png is missing/);
fails("an SVG with a script", "check-assets", (s) => s.write("mods/bar-strip/evil.svg", '<svg xmlns="http://www.w3.org/2000/svg"><script>1</script></svg>\n'), /contains <script/);
fails("a docs link that does not resolve", "check-docs", (s) => appendFileSync(s.file("README.md"), "\n[gone](docs/nope.html)\n"), /does not resolve/);
fails("a docs page that loads from another host", "check-docs", (s) => s.edit("docs/index.html", "</head>", '<link rel="stylesheet" href="https://fonts.example.net/x.css"></head>'), /outside the site|only github\.com/);
fails("a docs page with an inline script", "check-docs", (s) => s.edit("docs/index.html", "</head>", "<script>alert(1)</script></head>"), /inline <script>/);
fails("a docs page loading a script from another host", "check-docs", (s) => s.edit("docs/index.html", "</head>", '<script src="https://cdn.example.net/x.js"></script></head>'), /outside the site|must be an existing file in docs\/assets/);
fails("a site script that reaches the network", "check-docs", (s) => appendFileSync(s.file("docs/assets/motion.js"), "\nfetch('x.json');\n"), /may not reach the network/);
fails("llms.txt differing from its copy", "check-docs", (s) => appendFileSync(s.file("docs/llms.txt"), "\nextra\n"), /byte-identical/);

// ---- docs: keys table, privacy page, Pages address
fails("a keys row in README that keys.json does not have", "check-docs", (s) => s.write("README.md", s.read("README.md").replace("| `layout.toggle:bar` | Show", "| `layout.toggle:nothing` | Show")), /README\.md: the keys table has a row "[^"]*layout\.toggle:nothing"/);
fails("a keys row missing from docs/configuration.html", "check-docs", (s) => s.write("docs/configuration.html", s.read("docs/configuration.html").replace(/<tr><td><code>layout:portrait-bottom<\/code><\/td><td><kbd>cmd-b<\/kbd>.*?<\/tr>/, "")), /docs\/configuration\.html: the keys table needs exactly one row "layout:portrait-bottom \| cmd-b \| layout\.toggle:bar"/);
fails("a 'Where to check' name that is not in any mod", "check-docs", (s) => s.edit("docs/privacy.html", "<code>keyHint</code>", "<code>noSuchFunction</code>"), /names `noSuchFunction`/);
fails("a mod missing from the privacy page", "check-docs", (s) => s.write("docs/privacy.html", s.read("docs/privacy.html").replaceAll("nvim-float", "nvim-flat")), /docs\/privacy\.html does not describe the mod nvim-float/);
fails("a Pages address of some other owner", "check-docs", (s) => appendFileSync(s.file("README.md"), "\nSee https://zebra.github.io/elsewhere/ for more.\n"), /zebra\.github\.io\/elsewhere/);
fails("a Pages address in a file that may not carry one", "check-docs", (s) => {
  s.write("CONTRIBUTING.md", `${s.read("CONTRIBUTING.md")}\nsee ${["https:/", "acme.github.io", "thing/"].join("/")} and ${["https:/", "github.com", "acme", "thing"].join("/")}\n`);
}, /CONTRIBUTING\.md: mentions acme\.github\.io\/thing/);
test("check-docs accepts the repository's own Pages address in README", (t) => {
  if (skip) return t.skip(skip);
  const s = scratch();
  appendFileSync(s.file("README.md"), `\nSource ${["https:/", "github.com", "acme", "thing"].join("/")}, site ${["https:/", "acme.github.io", "thing/"].join("/")}\n`);
  assert.doesNotMatch(s.run("check-docs").out, /acme\.github\.io/);
});

// ---- preview
fails("a preview source that changed while preview.png did not", "check-assets", (s) => s.write("scripts/preview-source.svg", `${s.read("scripts/preview-source.svg").trimEnd()}\n<!-- edited -->\n`), /preview-source\.svg changed since preview\.png was rendered/);
