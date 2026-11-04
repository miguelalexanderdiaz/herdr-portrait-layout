# Round 2 summary: review round 1, then harden it

Branch: feat/round-2-hardening, stacked on main (which holds round 1, PR 1 merged). Three role branches merged with --no-ff in the order herdr-completeness, code-review, documentation; no merge conflicts. The first commits of the branch are the picker sync (2fb912a, herdr-agents-waiting b7fcb3fa) and the audits and plan.

## What changed

### Code review (plans/round-2/code-review-log.md)
- Pruning keeps folded, peeked and panel state of a machine that is loading, unavailable or unknown (tree and tabs).
- Reorder drop line follows the pointer; the pressed row dims; a move happens only on release over a row.
- Wheel: a mouse-wheel notch is one tab or column; a trackpad still needs 40 px; a new gesture forgets the remainder.
- Sub-agent rows (agents without a pane) under their parent tab; click focuses the agent.
- Files refresh pacer: at least 1.5 s apart, a request during a load runs once more, at most 3 watch roots.
- keyHint finds mod.open:attention-picker and bar-strip.attention; bell and jump order by agents.since with seq fallback.
- Leading dot kept in terminal titles; spine text darkened on light themes; shared alpha(); editor.space label removed; fold.svg and unfold.svg redrawn as originals; unused imports, xml escapes and PATH handling cleaned up.
- New tests: tests/api.test.mjs (checks builders and imports against Herdr's d.ts files, skipped when absent) and tests/docs-claims.test.mjs (numbers next to their units).

### Herdr completeness (plans/round-2/herdr-completeness-log.md)
- Bundled attention-picker is frozen and hash-checked (scripts/bundled.json, scripts/bundled.mjs); RECIPE, NOTICE and disclosure follow the synced picker (3 s poll, hc read --lines 60, attention.seen).
- keys.json: ctrl-shift-j is mod.open:attention-picker in both layout sections. cmd-b stated as dead on Linux and Windows.
- CI as scripts/ci.workflow.yml plus package.json (npm test, npm run check, npm run check:history), scripts/check-all.mjs, .github/dependabot.yml, bug issue template, .editorconfig. Nothing under .github/workflows/.
- NOTICE rewritten per icon with its source; check-recipe cross-checks imports, run() commands and exec programs against RECIPE and fails on network APIs; check-docs derives the Pages host and checks keys tables, "Where to check" names and mod names; scripts/checks.test.mjs (55 mutation cases); preview hash guard; plans/ is privacy-scanned; PUBLISH.md steps 0, 4, 6, 7, 7a.

### Documentation (plans/round-2/documentation-log.md)
- The false "mods use only theme colours" claim is replaced by the real list of 14 theme tokens, fixed mark colours and the light-theme darkening (stated as unseen on the shipped paper theme).
- Picker facts, wheel, refresh floor, sub-agent rows, window buttons, folder-dot colour, Windows >500 entries caveat, provenance wording all follow the code.
- Rendered-page links through the Pages address, CONTRIBUTING maintenance section and CI rules, CHANGELOG [Unreleased], README cut to 148 lines, site menu folds at phone width, 404 page, table captions, checked at 360 and 1280 px in headless Chrome.

### Integration (round lead)
- Merge commits carry the attribution lines. plans/round-2/board.md holds the board; this summary added. No code change was needed after the merge.

## Checks (on the merged result)
- herdr-app check: 7 of 7 mod folders pass.
- node --test: 160 pass, 0 fail, 0 skipped (the Herdr d.ts files are present on this machine).
- npm run check: validate, check-recipe, check-assets, check-docs, privacy-scan all ok.
- All tracked .json files parse. rg for home paths and non-noreply emails outside plans, tests and scripts: empty. RECIPE.md has the six Herdr sections. Relative links in README, docs and root Markdown resolve (three broken relative image links remain only inside the historical plans/round-1 documents).
- privacy-scan --commits fails on exactly one commit, ef8b513 (web merge, personal author address). Expected; needs PUBLISH.md step 0 by the author.
- Not checked anywhere: Linux, Windows, PowerShell, fish, any CI run, the running app (rule 2).

## Deferred
- Live checks in the app: ctrl-shift-j toggling the picker through mod.open (docs say unconfirmed, with revert), drop line, mouse-wheel notch, Files CPU under a build, sub-agent rows, darkened spine text on paper, ctrl-shift-j with the bar hidden.
- PowerShell listing order, virtualised Files list, remote ~ (needs Windows or a remote machine).
- Watch cap of 3: a fourth folder stays on the 10 s timer until an old loop fires (no cancellable watch API).
- refresh-snapshots network tool (HC-2-10), wide 1600x900 previews (HC-2-9 B and C), docs generator (menu and footer repeated by hand), publication-day README line, titlebar none plus traffic_lights for Linux and Windows window buttons (design call).
- Optional agents.since.at heartbeat key requested by the picker owner.

## Author must do by hand
1. PUBLISH.md step 0: decide on the history of ef8b513 (personal address) before merging more PRs through the web UI or going public.
2. PUBLISH.md step 6: install .github/workflows/ci.yml from scripts/ci.workflow.yml with a workflow-scoped token; read the first Linux and Windows runs.
3. Confirm in the app the items under "Live checks" above; PUBLISH.md step 4 table for each OS.
4. Decide whether plans/ stays (step 7a). After publication open every Pages URL (step 11).

## Round 3 priorities
1. Read the first CI runs (ubuntu, windows, macos) and fix failures; fill the PUBLISH step 4 per-OS table.
2. Fold the author's live-app findings back in (ctrl-shift-j via mod.open, wheel feel, drop line, sub-agent rows, paper theme spine text); revert to bar-strip.attention if the toggle does not work.
3. Fix the PowerShell listing order (folders first) once a Windows machine is available; then virtualise the Files list.
4. Remote machines: make ~ and watch roots work for remote spaces; cancellable watchers if Herdr adds an API.
5. Re-sync mods/attention-picker after herdr-agents-waiting round 2 (git archive, herdr-app check, node scripts/bundled.mjs <commit>); decide on the agents.since.at heartbeat key.
6. Window buttons on Linux and Windows (titlebar none plus traffic_lights) as a design call with options and schematics first.
7. refresh-snapshots tool and wide preview variants; docs generator or a check that the repeated menu and footer match on every page.
8. Publication day: herdr.dev install line in README, topic and Pages steps by the author.
