# Publish checklist

Steps to take this repository public and list it at herdr.dev. Everything marked **author** is a manual step that
only the repository owner does: agents and CI never change visibility, settings or topics, and the agents' token cannot
push `.github/workflows/`.

Nothing here is part of the Pages site.

## Step 0, before any further pull request is merged

0. [x] **author** Done on 2026-11-04. The first pull request's web merge had put a personal address in the history.
   `main` was rewritten, and the repository was recreated so GitHub no longer serves the old commit. The author now
   commits with a public address, which is also the GitHub primary email, so web merges use it too. To keep it that way:
   1. GitHub, Settings, Emails: the primary email is the address you want public. If you want no address at all, tick
      **Keep my email addresses private** instead (web merges then use the noreply address).
   2. `npm run check:history` must print `ok`; `git log --format='%ae%n%ce' | sort -u` must list only noreply addresses
      and the address allowed in `scripts/privacy-scan.mjs`.

## Before publishing

1. [ ] **author** Create `.privacy-denylist` (git-ignored) with one term per line: your own name, employers, host
   names, anything that must never appear. Run `npm run check:history`; apart from step 0 it must say `ok`. Also add the
   same terms, comma separated, as the repository secret `PRIVACY_DENYLIST` so CI checks them too.
2. [ ] Run the suite from the repository root; both must exit 0 (Node 22 or newer, no install):
   ```sh
   npm test            # node --test: unit tests, repository invariants, the checks' own negative tests
   npm run check       # validate, check-recipe, check-assets, check-docs, privacy-scan in one summary
   ```
   After a Herdr update run `npm test` with Herdr's `herdr.d.ts` and `gpui-kit.d.ts` in the app home (or
   `HERDR_APP_HOME`): the API test skips itself without them.
3. [ ] **author** With Herdr installed, check each mod once on a copy (Herdr writes nothing into the repository, but keep
   it out of your live app home):
   ```sh
   for m in mods/*; do herdr-app check "$PWD/$m"; done
   ```
4. [ ] **author** Run the layout on every operating system you can reach, on a scratch app home (never your own), and fill
   in the table. Until a row exists, RECIPE.md treats Linux, Windows and fish behaviour as unverified.

   macOS and Linux (sh, bash, zsh, fish needs `set -x HERDR_APP_HOME (mktemp -d)`):
   ```sh
   export HERDR_APP_HOME="$(mktemp -d)"
   mkdir -p "$HERDR_APP_HOME/layouts" "$HERDR_APP_HOME/mods"
   cp layouts/* "$HERDR_APP_HOME/layouts/" && cp -R mods/* "$HERDR_APP_HOME/mods/"
   for m in mods/*; do herdr-app check "$HERDR_APP_HOME/mods/$(basename "$m")"; done
   herdr-app            # starts Herdr on the scratch home; merge keys.json into $HERDR_APP_HOME/keys.json first
   ```
   Windows (PowerShell):
   ```powershell
   $env:HERDR_APP_HOME = (New-Item -ItemType Directory -Path (Join-Path $env:TEMP ("herdr-" + [guid]::NewGuid()))).FullName
   New-Item -ItemType Directory -Path "$env:HERDR_APP_HOME\layouts", "$env:HERDR_APP_HOME\mods" | Out-Null
   Copy-Item layouts\* "$env:HERDR_APP_HOME\layouts\"; Copy-Item mods\* "$env:HERDR_APP_HOME\mods\" -Recurse
   Get-ChildItem mods -Directory | ForEach-Object { herdr-app check "$env:HERDR_APP_HOME\mods\$($_.Name)" }
   herdr-app
   ```
   In that app: switch to `portrait` (Settings, or `herdr-app do layout.switch --name portrait` from a second terminal
   with the same `HERDR_APP_HOME`), then `portrait-bottom`, and tick every item under "Done when" in `RECIPE.md`. Paste
   the filled table into the release notes:

   | OS | Herdr | Date | 1 mods check | 2 bar and rows | 3 columns, fold | 4 agent states | 5 keys | 6 Files and nvim | 7 no writes | 8 Vault opt-in | Notes |
   | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
   | macOS | | | | | | | | | | | |
   | Linux | | | | | | | | | | | |
   | Windows | | | | | | | | | | | |

   Also try, once: a fish login shell for the nvim click, a folder with more than 500 entries on Windows, and
   `ctrl-shift-j` with the bar hidden (`ctrl-shift-g`) and pressed twice.
5. [ ] Look at `preview.png` on GitHub once pushed: it must show only invented content. Re-draw it with
   `node scripts/make-preview.mjs` if the layout changed (needs `rsvg-convert`; without it only the SVGs are written),
   copy it to `docs/assets/preview.png`, then run `node scripts/check-assets.mjs`.
6. [ ] **author** Install CI (the agents' token cannot push workflow files), then read its first run:
   ```sh
   mkdir -p .github/workflows && cp scripts/ci.workflow.yml .github/workflows/ci.yml
   gh auth refresh -s workflow          # once, so the push is allowed to add a workflow
   git add .github/workflows/ci.yml && git commit -m "Install CI" && git push
   gh run list --branch main            # use the owner's account; every job must be green
   ```
   `node scripts/validate.mjs` fails later if the installed file differs from `scripts/ci.workflow.yml`: edit the
   template, then copy it again. The first run on Linux and Windows has never happened; expect to fix something small.
   The `commit history` job stays red until step 0 is settled. Dependabot (`.github/dependabot.yml`) keeps the action
   pins current once the repository is on GitHub.
7. [ ] `bar-strip` and `ctrl-shift-j` open the mod `attention-picker` by name: confirm `mods/attention-picker` is the
   latest copy from the herdr-agents-waiting repository. To re-sync: remove the folder, then
   ```sh
   git -C <path to herdr-agents-waiting> archive <branch or commit> mods/attention-picker | tar -x -C .
   herdr-app check "$PWD/mods/attention-picker"
   node scripts/bundled.mjs <the 40-character commit that was archived>   # rewrites scripts/bundled.json
   npm test && npm run check
   ```
   Never copy `gpui-kit.d.ts` or `jsconfig.json`: Herdr writes those into mod folders and `validate` refuses them. Review
   the diff of the folder, RECIPE's picker row and disclosure (poll interval, `hc read` lines, `localStorage` keys) and
   NOTICE section 4 before committing.
7a. [ ] **author** Decide about `plans/`: it holds the review notes of each round and is public with the repository. The
   scan checks it like every other file (a path or address on a plain line fails). Keep it, or remove it before the
   release (`git rm -r plans`; the notes stay in the history).

## Publishing

8. [ ] **author** Decide the published name. The layout files are `portrait` and `portrait-bottom` and the keys
   sections are `layout:portrait` and `layout:portrait-bottom`; renaming means changing both, the `preview` field of each
   layout and its `.svg` (and the load-bearing list in `RECIPE.md`) and re-running `node scripts/validate.mjs`.
9. [ ] **author** Set the repository to public (Settings, Danger zone).
10. [ ] **author** Add the topic `herdr-layout` to the repository (About, Topics). The repository holds a layout that
    brings its mods, so one topic is enough; it appears at https://herdr.dev/layouts within the hour. If the mods
    should also be listed at https://herdr.dev/mods, publish them from a separate repository with the topic `herdr-mod`.
11. [ ] **author** Enable GitHub Pages: Settings, Pages, deploy from branch `main`, folder `/docs`. (Pages on a private
    repository needs a paid plan, so do it after step 9.) Do not add a Pages workflow. Then open every Pages URL named in
    `README.md`, `AGENTS.md` and `llms.txt` once: they are dead until Pages is on.
12. [ ] **author** Confirm the license: `gh api repos/<owner>/<repo>/license --jq .license.spdx_id` should print
    `Apache-2.0`.
13. [ ] **author** Tag the release: `git tag v0.1.0 && git push origin v0.1.0`, then create the GitHub release from the
    changelog's section.
14. [ ] Ask a fresh agent, with an empty app home, to add the layout from `https://herdr.dev/layouts/<owner>/<repo>` and
    run the steps of `AGENTS.md`; fix whatever it tripped on in `RECIPE.md`. Look at the card on herdr.dev: the preview
    is tall (1080 by 1920) and the gallery may crop it; if it does, make a 1600 by 900 variant.

## After publishing

- Watch https://herdr.dev/layouts for the entry (up to an hour). If it does not appear, check the topic spelling and that
  the repository is public.
- Keep the copy in `mods/attention-picker` in sync after every release of herdr-agents-waiting (step 7).

## When Herdr releases a new version

The snapshots in `scripts/` are copied by hand (no network code lives in this repository). After every Herdr release:

1. `scripts/default-keys.json`: replace its contents with the release's default key files
   (`defaults/keys*.json` in the herdr-app repository on GitHub, one section for macOS and one for Linux and Windows).
2. `scripts/commands.json`: the output of `herdr-app commands`.
3. `scripts/shipped-mods.json`: the shipped mod folder names under the app home's `mods/` that this layout opens by name
   (`workspace-status`, `changes`, `picker`, `machine-add`, `menu`, `new-menu`), and `min_herdr_version`.
4. `npm test` with the app's `herdr.d.ts` and `gpui-kit.d.ts` present, `npm run check`, and `herdr-app check` for each mod.
5. The clones (`portrait-tabs`, `portrait-pane`, `portrait-files` and the two layouts) keep their `cloned_from`; Herdr
   never updates a clone. Compare them with the new shipped files by hand if a change matters, and keep NOTICE's list of
   changes true.
