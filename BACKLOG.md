# Backlog

Tracked as issues in <https://github.com/peetmate/cleaned-review/issues>. This file is the index: what is open, in what order, and which items a session cannot do alone. Keep both in step — if you close an issue, strike it here.

**Last reconciled:** 2026-10-01, issues #1–#15.

## Needs a person, not a session

These are blocked on a decision, an access right or a conversation. A session should not guess at them.

| # | Item | Why it is blocked |
|---|---|---|
| [#11](https://github.com/peetmate/cleaned-review/issues/11) | Decide the workshop capture model | Changes the run sheet and what facilitators are told. Options and a recommendation are in the issue |
| [#9](https://github.com/peetmate/cleaned-review/issues/9) | Verify the artifact's shared feedback store | Needs someone signed in to open the artifact and press one button |
| [#1](https://github.com/peetmate/cleaned-review/issues/1) | Confirm two `cleaned` semantics | Needs the package maintainers. Both change numbers |
| [#12](https://github.com/peetmate/cleaned-review/issues/12) | Ask Emmanuel which batch code he meant | One question; decides where the batch work lives |
| [#8](https://github.com/peetmate/cleaned-review/issues/8) | Capacity sharing | Needs owner, pricing, language and accreditation decisions before it can be scoped |
| [#15](https://github.com/peetmate/cleaned-review/issues/15) | Clean up the stale `site/` clone | Discarding a working tree is not a session's call. State archived in `_archive/` |

Also outside a session: **sharing the artifact** with facilitators, which only its owner can do.

## Findings, recorded

| # | Severity | Finding |
|---|---|---|
| [#1](https://github.com/peetmate/cleaned-review/issues/1) | High | Intercrop direction and manure sales double-discount, both worked around, neither confirmed |
| [#5](https://github.com/peetmate/cleaned-review/issues/5) | High | The package cannot represent two herds of one animal category; duplicates crash or corrupt |
| [#4](https://github.com/peetmate/cleaned-review/issues/4) | High | The live app silently ignores adding a category that already exists (UX-89) |
| [#13](https://github.com/peetmate/cleaned-review/issues/13) | High | The batch driver is a script, not a component; sources code over HTTP from a moving branch |

The 88 app findings and the package review findings stay in their documents (`ui_ux/01_uiux_review.md`, `00_summary.md` and siblings) rather than being copied here. Only things still needing action are tracked as issues.

## Feature queue

The order shown in the mockup's own Feature requests screen, which is the version participants see and argue with. Ranks 1–15 live in `ui_ux/mockup/src/js/80_screens/74_features.js`; the ones with an issue are below.

| Rank | # | Feature |
|---|---|---|
| 1 | — | Ex-ante appraisal: plan and compare alternatives, including at scale |
| 2 | [#2](https://github.com/peetmate/cleaned-review/issues/2) | Run the model from the redesigned form |
| 3 | [#3](https://github.com/peetmate/cleaned-review/issues/3) | Track an enterprise over time, and attribute what changed |
| 4 | [#6](https://github.com/peetmate/cleaned-review/issues/6) | Benchmark context for every result |
| 5 | [#7](https://github.com/peetmate/cleaned-review/issues/7) | Test a range of values, not one value at a time |
| 6–13 | [#14](https://github.com/peetmate/cleaned-review/issues/14) | Draft sync, user-defined categories, batch run, depth modes, print form, languages, maps |
| 10 | [#8](https://github.com/peetmate/cleaned-review/issues/8) | Capacity sharing |

## Documentation

| # | Item |
|---|---|
| [#10](https://github.com/peetmate/cleaned-review/issues/10) | Rewrite the workshop run sheet to be mockup-first — blocked on #11 |

## Convention

- Anything a session can finish on its own: do it, do not file it.
- Anything needing a person: file it, label `needs-a-person`, and name what exactly is needed.
- Anything found while doing something else: file it rather than widening the current change.
- Mockup feedback from a workshop files itself, via the Feedback screen or `ui_ux/mockup/tools/file_feedback_issues.mjs`.
