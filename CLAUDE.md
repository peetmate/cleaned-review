# Working in this repository

Review of the `cleaned` R package and the iCLEANED app, plus a clickable redesign mockup, published as a GitHub Pages site at <https://peetmate.github.io/cleaned-review/>. Read this before changing anything.

## What is here

| Path | What it is |
|---|---|
| `00_summary.md` … `09_*.md` | The package review: findings, critical tests, fix log, demo, scoping notes |
| `ui_ux/01_uiux_review.md` | 88-finding UI/UX review of the live Shiny app (UX-nn ids) |
| `ui_ux/02_workshop_script.md` | Facilitator run sheet for the user-testing workshop |
| `ui_ux/03_feedback_form.md` | Capture template, mapped to the GitHub issue forms |
| `ui_ux/04_design_benchmarks.md` | 22 comparable tools, read from their own manuals, and the patterns taken from them |
| `ui_ux/05_mockup_review.md` | The mockup's adversarial review **and its release notes** — every version is a `## vX.Y.Z` section |
| `ui_ux/DECISIONS.md` | Why the mockup is shaped the way it is. Read before changing its structure or vocabulary |
| `ui_ux/mockup/` | The mockup source. `README.md` there describes the build |
| `funding/` | **Local only, never published.** Record templates and archived searches |
| `site/` | A stale, dirty clone. **Do not use it** (see below) |

## Rules that are not negotiable

1. **Never publish funding or fundraising content in the tool or the site.** No instruments, no budget lines, no target-organisation lists, no demand-evidence arguments. That material lives in `funding/` locally and stays there. The tool describes what it does for the people using it.
2. **Do not file issues on `CIAT/cleaned` or `CIAT/icleaned`.** Findings stay in this repository until the team decides otherwise.
3. **Do not commit or push from `cleaned_review/site/`.** It is many commits behind with uncommitted work in it and pushing from it would clobber that. Work from a fresh clone of `peetmate/cleaned-review`.
4. **Read a file before overwriting it.** Several documents here are long, hand-written and not reconstructible from the mockup.

## Shipping a change to the mockup

```bash
cd ui_ux/mockup
node build.mjs            # writes dist/offline/icleaned-mockup.html and warns on version drift
```

Then, from a clean clone of `peetmate/cleaned-review`:

1. `ui_ux/mockup/dist/offline/icleaned-mockup.html` → `ui_ux/mockup/index.html` (this is what Pages serves)
2. `rsync -a --delete --exclude dist --exclude node_modules ui_ux/mockup/ <clone>/ui_ux/mockup/src-tree/`
3. Re-render the reading copy and copy the markdown into `<clone>/md/ui_ux/`
4. Commit, push, then republish the private artifact **to the same URL** so the link people hold keeps working

**Version discipline.** Bump `ui_ux/mockup/package.json` in the same change as the new `## vX.Y.Z` heading in `ui_ux/05_mockup_review.md`. The build compares the two and warns, because the header once read `v0.7.0` through four documented releases and nobody noticed.

## Verifying a change

A dev server on `127.0.0.1:8792` serves `dist/offline/`. Drive the page rather than asking anyone to check by hand:

- `localStorage.clear()` first — the mockup keeps a draft, and a stale one hides bugs
- All example assessments must validate: six with 0 errors, the Rungwe commercial one with its 2 known warnings
- Sweep every screen with an `onerror` hook and expect nothing
- Check the header build stamp matches what you just built

## House style

- Plain, concrete, adversarially honest. A placeholder says it is a placeholder; a comparison table states where the other tool is better; a screen that cannot do something says so on the screen.
- Never a number without its unit, and never a result without what it is relative to.
- Labels are questions a field officer would ask. Model vocabulary (`manureman_stable`, IPCC table names) appears only behind the "Technical names" toggle.
- British spelling. Sentence case for headings.
- Comments explain **why**, especially where the code is deliberately odd (the rAF/timeout race in the store, `manure_sales_fraction = 0`, the inverted intercrop fraction).

## Traps this repository has already fallen into

- **A rename that only touched prose.** `scenario → assessment` left an element class behind in `styles.css`, two inputs sharing one accessible name, and seven `"a assessment"`s. After any rename, grep the stylesheet and the ids, not just the strings.
- **A structural change that only fixed the screens it targeted.** Splitting assessments under enterprises broke the batch route, which creates rows of its own. Find everything that *creates* the moved object.
- **Cross-references by number.** Queue positions were written into other screens as `#7` and broke twice. Reference features by name.
- **Docs drifting from the build.** See version discipline above.
