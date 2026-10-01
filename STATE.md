# Project state — pick up here

**Updated:** 2026-10-01. Keep this file current: it is the first thing a new session or a new person reads, and the only one that claims to be true *now*. Everything else in this repository is either a record of what was found (the reviews) or a record of why (`ui_ux/DECISIONS.md`).

## What this project is

Two strands, one repository:

1. **A review of the `cleaned` R package and the live iCLEANED Shiny app** — 88 UI/UX findings, a package review with critical tests and a fix log, and the materials for a user-testing workshop.
2. **A redesign mockup** — a clickable, self-contained HTML page that compiles plain-language answers into the exact study-object JSON the package reads, and captures feedback in the page. It is the thing being tested in the workshop, not a prototype of a build.

## Where things are

| | Where | Notes |
|---|---|---|
| Source of truth | `/Users/pstewarda/Documents/rprojects/cleaned_review/` | Everything is edited here |
| Public site | <https://peetmate.github.io/cleaned-review/> | Pages, from `main` of `peetmate/cleaned-review` |
| Mockup, public | <https://peetmate.github.io/cleaned-review/ui_ux/mockup/> | **No shared feedback store** — a static page has no backend |
| Mockup, private | claude.ai artifact `XQQdVrsasQ9RWWSGMYq41q` | Has a shared store *if the runtime grants one*; **unverified** |
| Push clone | a clean clone of `peetmate/cleaned-review` | See `CLAUDE.md`. **Never push from `site/`** |
| Internal only | `funding/` | Record templates and archived searches. Never published |
| Archived | `_archive/` | A patch of the stale `site/` clone's uncommitted state, taken 2026-10-01 |

**Current mockup version: v0.9.3.** The header of the page shows the version and build time; `build.mjs` warns if `package.json` and the newest release-note heading disagree.

## How to resume in one minute

```bash
cd ui_ux/mockup && node build.mjs          # builds dist/offline/icleaned-mockup.html
python3 -m http.server 8792 --bind 127.0.0.1 --directory dist/offline
```

Then read, in order: `CLAUDE.md` (rules and how to ship), `ui_ux/DECISIONS.md` (why it is shaped this way), `BACKLOG.md` (what is open), and the newest `## vX.Y.Z` section of `ui_ux/05_mockup_review.md` (what changed last).

## Where the work stands

**Done and shipped.** The package review; the 88-finding app review; the workshop run sheet and feedback form; benchmarking of 22 comparable tools; the mockup through v0.9.3 — ten-step wizard, enterprises holding dated assessments, batch upload with QAQC, a results screen with explicitly sketched numbers, a parameter browser with editable copies, a feature queue, a "Why iCLEANED" section, and feedback capture with two no-token routes to GitHub issues.

**Decided and not revisitable without good reason.** See `ui_ux/DECISIONS.md` — in particular the vocabulary (assessment, enterprise, project), the deliberate crudeness of the results sketch, and the compulsory head-weighted herd merge.

**Known unknowns.** Listed in `BACKLOG.md`. The two that matter most: whether the artifact's shared feedback store works at all, and two `cleaned` package semantics that change numbers and have never been confirmed with the maintainers.

## Open threads that need a person, not a session

- **Share the artifact** with facilitators if they are to see it before the workshop. It is private; only its owner can open it.
- **Decide the workshop capture model** (see `BACKLOG.md` #W1). Options and a recommendation are there.
- **Confirm two package semantics** with the `cleaned` maintainers (`BACKLOG.md` #P1, #P2).
- **Ask Emmanuel** which batch code he meant (`BACKLOG.md` #P3).
- **Clean up the stale `site/` clone** — 13 commits behind with 33 modified files, all of them superseded by what is already pushed. Its state is archived at `_archive/stale-site-clone-20261001.patch`. To clear it:
  ```bash
  cd cleaned_review/site && git fetch origin && git reset --hard origin/main
  ```
  Nobody has done this because destroying someone else's working tree is not a call a session should make alone.

## Conventions a future session must not break

1. Read `CLAUDE.md` before changing anything. The four non-negotiable rules are there.
2. Bump `ui_ux/mockup/package.json` in the same change as a new release-note heading.
3. Verify in the browser, not by reasoning about the code. The dev server and the checks are in `CLAUDE.md`.
4. Update **this file** and `BACKLOG.md` at the end of a working session. A session that leaves them stale has cost the next one an hour.
