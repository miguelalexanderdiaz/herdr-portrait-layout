# Round 2 log: documentation

Role: documentation. Branch `feat/round-2-hardening--documentation`. Files touched: `README.md`, `AGENTS.md`, `llms.txt`,
`docs/**` (pages, `docs/assets/site.css`, `docs/llms.txt`, `docs/404.html`), `CHANGELOG.md`, `CONTRIBUTING.md` and this log.
Nothing else was edited. Every sentence below was checked against the code of the merged tree (the three role branches
merged in a scratch clone outside the repository), not against the audit.

## Done, by task id

| Id | Result |
|----|--------|
| DOC-2-1 | "Mods use only theme colours" removed from README, `docs/configuration.html`, `docs/how-it-works.html`. New text: the 14 theme colours the mods read (`foreground`, `background`, `muted`, `dim`, `chrome`, `raised`, `hover`, `selected`, `border`, `accent`, `working`, `blocked`, `done`, `idle`; Files also `ansi1..6`), what is not themed (six fixed space marks in `portrait-tree`; badge ink picked per colour, 5.5 to 6.6 to 1; mark colour as rule and as the active folded space's name), the 2.3 to 3.4 to 1 figure recomputed by me, and (CR-2-11, landed) the darkening on light themes, with "not seen on `paper`". The audit's "11 tokens every theme defines" was itself wrong (the mods read 14); fixed. |
| DOC-2-2 | README privacy list, `docs/privacy.html`, `docs/how-it-works.html`, AGENTS.md, `docs/for-agents.html`: picker polls every 3 s, `hc read --lines 60`, only while open, `attention.seen` in local storage (address, state group, time; no screen text), `agents.since` read when present, own key only in its own repo, props. `rg "2 seconds\|every 2 s"` over README, docs, AGENTS.md is empty. |
| DOC-2-3 | README, AGENTS.md, `llms.txt` (= `docs/llms.txt`, byte-equal) link the rendered pages through `https://miguelalexanderdiaz.github.io/herdr-portrait-layout/`, with one line that it is live after publication. `llms.txt` and AGENTS.md otherwise link Markdown (README sections, RECIPE, CONTRIBUTING). |
| DOC-2-4 | CONTRIBUTING: conditional CI sentence replaced by the template path, `npm test`, `npm run check`, `npm run check:history`, PUBLISH.md step 6 (copy to `.github/workflows/ci.yml` with a workflow-scoped login). `docs/platforms.html` says no CI run has been reported. CHANGELOG `Unreleased` filled (Added, Changed, Fixed) with the rule "every merged round adds lines". |
| DOC-2-5 | Numbers kept as plain text next to their units: `290 px` (README, usage, configuration, troubleshooting), `34 px` (README, usage), `40 px` (usage), `7 days` (privacy, README). Keys tables: one `<td>` per key, 8 rows, equal to `keys.json`. "Where to check" identifiers all occur in `mods/` (listed on the board). CONTRIBUTING explains both guards. |
| DOC-2-6 | Ids: looked up by mods = `panel`, `panel-body`, `files`, `changes`, `vault`; `bar` named only by the key `layout.toggle:bar`; `enabledPanels` note; RECIPE has the full list. In AGENTS.md, `docs/for-agents.html`, `docs/configuration.html`, `docs/install.html`, `docs/how-it-works.html`. |
| DOC-2-7 | PowerShell block sets `$H` from `HERDR_APP_HOME` or `~\.config\herdr-app` with no placeholder; README and `docs/install.html` blocks are identical (install.html copied from README by a script); honest line: sh block run in a scratch home on macOS (7 of 7 checks), PowerShell not run, Windows default home unconfirmed, Linux expected. |
| DOC-2-8 | Site: `<details>` menu below 40rem (plain CSS, the full list from 40rem; links are in both lists, one hidden), a `<caption>` and `aria-labelledby` for all six tables, a "(scrolls sideways)" cue and soft scroll edges, preview image `width="1080" height="1920"`, `404.html` self-contained (own style, full Pages addresses, skip link). Checked with headless Chrome at 360 and 1280 px (iframe wrapper): no horizontal overflow on any of the 10 pages, correct list shown at each width. |
| DOC-2-9 | CONTRIBUTING "Maintenance": when Herdr updates (version, d.ts, `node --test` with the type files, clones vs shipped mods, manual refresh of the three snapshots with the sources HC gave) and when the picker is re-synced (git archive, `herdr-app check`, `node scripts/bundled.mjs <commit>`, tests). AGENTS.md has a short pointer. |
| DOC-2-10 | Windows more-than-500-entries caveat in `docs/usage.html` and `docs/platforms.html`. |
| DOC-2-11 | "Lucide (ISC; a few also MIT)", Herdr art Apache-2.0, `fold.svg`/`unfold.svg` original (CR-2-15 landed, NOTICE lists them), bundled picker Apache-2.0 per NOTICE. |
| DOC-2-12 | README from 200 to 148 lines: one privacy list (no table), no provenance or needs tables (on the site), chords moved to AGENTS.md and the Configuration page. Target was ~140; I kept the two install blocks and the 8-row keys table because `check-docs` needs the rows and an install that cannot be followed is worse than 8 spare lines. `290 px` and `34 px` stay (D8). |
| DOC-2-13a | `ctrl-shift-j` = `mod.open:attention-picker` everywhere (README, configuration, usage, troubleshooting, AGENTS.md chord block); `agent.next` appends folded spaces, does not skip them (usage); window buttons not shown with the system title bar (platforms, AGENTS.md, README); sub-agent rows (usage, README); Files refresh at most every 1.5 s and three watched folders (usage, platforms); wheel notch = one step, trackpad 40 px, at most three tabs per event (usage); folder dot colour wording (usage); AGENTS.md read list (plain click on Windows or without nvim reads the file; `mods/vault/main.js` existence). |

Also: the troubleshooting "Still stuck" fields follow `.github/ISSUE_TEMPLATE/bug.md` (herdr-completeness); `cmd-b` on Linux and Windows is worded "expected to do nothing (not tried)", as RECIPE says; `machines` read documented in the tree and tabs privacy rows; the picker facts in `docs/for-agents.html`.

## Deferred, and why

- DOC-2-13 (herdr.dev install line, publication-day README line): D16, only meaningful on publication day. The issue template is herdr-completeness'.
- Docs generator: not committed (plan table); the menu and footer are repeated by hand. CONTRIBUTING says to change all pages.
- Light-theme look of the darkened spine text: needs the author's eyes on `paper`; the docs say so.

## Checks run (scratch merge of the three role branches; macOS, Node 26)

- `node --test`: 160 pass, 0 fail (final merge of herdr-completeness e1392fa, code-review 4945b2d and this branch).
- `herdr-app check` on the merged tree: not run by me (no mod file of mine changed; the other roles ran it).
- `node scripts/validate.mjs`, `check-recipe.mjs`, `check-assets.mjs`, `privacy-scan.mjs`: ok. `rg` for home paths outside plans, tests and scripts: empty.
- `node scripts/check-docs.mjs`: ok with herdr-completeness' extended version (Pages host rule, keys table equals `keys.json` in README and `docs/configuration.html`, "Where to check" names exist, every mod named in README and privacy page). Before it landed it reported only the Pages host as a problem.
- 360 px and 1280 px probe of all pages (headless Chrome, iframe wrapper): no overflow, `.menu` shown at 360 and `.wide` at 1280.
- `rg -n "only (use )?theme|2 seconds|every 2 s" README.md docs AGENTS.md CONTRIBUTING.md llms.txt`: empty.
- Numbers with units present as listed under DOC-2-5.

## Handoffs for the next round

- Author, in the app: that `ctrl-shift-j` really toggles the picker through `mod.open`, and how the darkened spine text looks on `paper`. Both are stated as unconfirmed in `docs/configuration.html`.
- Author: after publication, open every Pages URL in README, AGENTS.md and `llms.txt` (PUBLISH.md step 11).
- If someone runs Linux or Windows: replace "not run, expected to work" in README and `docs/platforms.html` with what happened; the PowerShell block and the Windows default home folder are unverified.
- A docs generator would remove the repeated menu and footer; decide once the site is stable.
- Add the herdr.dev install line to README, AGENTS.md and the site once the listing exists.
