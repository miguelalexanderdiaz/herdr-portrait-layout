# Publish checklist

Steps to take this repository public and list it at herdr.dev. Everything marked **author** is a manual step that
only the repository owner does: agents and CI never change visibility, settings or topics.

Nothing here is part of the Pages site.

## Before publishing

1. [ ] **author** Create `.privacy-denylist` (git-ignored) with one term per line: your own name, employers, host
   names, anything that must never appear. Run `node scripts/privacy-scan.mjs --commits`; it must say `ok`. Also add the
   same terms, comma separated, as the repository secret `PRIVACY_DENYLIST` so CI checks them too.
2. [ ] Run the whole suite from the repository root; each must exit 0:
   ```sh
   node --test
   node scripts/validate.mjs
   node scripts/check-recipe.mjs
   node scripts/check-assets.mjs
   node scripts/check-docs.mjs
   node scripts/privacy-scan.mjs --commits
   ```
3. [ ] **author** With Herdr installed, check each mod once (Herdr writes nothing into the repository, but run it on a
   copy of the folders under your app home if you prefer):
   ```sh
   for m in mods/*; do herdr-app check "$PWD/$m"; done
   ```
4. [ ] **author** Install the layout on a spare app home (`HERDR_APP_HOME=<empty folder> herdr-app`), switch to
   `portrait` and `portrait-bottom`, and tick every item under "Done when" in `RECIPE.md`. Not covered by CI and
   not verified by the agents that wrote this: the live app, a fish login shell for the nvim click, a real Linux
   run, a real Windows run.
5. [ ] Look at `preview.png` on GitHub once pushed: it must show only invented content. Re-draw it with
   `node scripts/make-preview.mjs` if the layout changed (needs `rsvg-convert`).
6. [ ] CI is green on all three operating systems for the commit you tag:
   `gh run list --branch main` (use the owner's account).
7. [ ] `bar-strip` opens the mod `attention-picker` by name: confirm `mods/attention-picker` is the latest copy from the
   herdr-agents-waiting repository.

## Publishing

8. [ ] **author** Decide the published name. The layout files are `portrait` and `portrait-bottom` and the keys
   sections are `layout:portrait` and `layout:portrait-bottom`; renaming means changing both (and the load-bearing list in
   `RECIPE.md`) and re-running `node scripts/validate.mjs`.
9. [ ] **author** Set the repository to public (Settings, Danger zone).
10. [ ] **author** Add the topic `herdr-layout` to the repository (About, Topics). The repository holds a layout that
    brings its mods, so one topic is enough; it appears at https://herdr.dev/layouts within the hour. If the mods
    should also be listed at https://herdr.dev/mods, publish them from a separate repository with the topic `herdr-mod`.
11. [ ] **author** Enable GitHub Pages: Settings, Pages, deploy from branch `main`, folder `/docs`. (Pages on a private
    repository needs a paid plan, so do it after step 9.) Do not add a Pages workflow.
12. [ ] **author** Confirm the license: `gh api repos/<owner>/<repo>/license --jq .license.spdx_id` should print
    `Apache-2.0`.
13. [ ] **author** Tag the release: `git tag v0.1.0 && git push origin v0.1.0`, then create the GitHub release from the
    changelog's section.
14. [ ] Ask a fresh agent, with an empty app home, to add the layout from `https://herdr.dev/layouts/<owner>/<repo>` and
    run the steps of `AGENTS.md`; fix whatever it tripped on in `RECIPE.md`.

## After publishing

- Watch https://herdr.dev/layouts for the entry (up to an hour). If it does not appear, check the topic spelling and that
  the repository is public.
- Keep the copy in `mods/attention-picker` in sync after every release of herdr-agents-waiting.
