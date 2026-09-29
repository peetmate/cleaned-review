# iCLEANED workshop: participant issue capture form

Observers fill in one block per issue during the session. The facilitator triages the blocks afterwards and files them on GitHub.

## Where issues go (routing)

The GitHub issue forms (`bug_report.yml`, `data_issue.yml`, `feature_request.yml`, `question.yml`, with `blank_issues_enabled: false`) currently exist in the **CIAT/cleaned** package repository. The web app lives in a separate repository, **CIAT/icleaned**, which has no issue templates. The package forms are written for R users. The bug form **requires** a component from the package-function list, an R reproducible example, and `packageVersion("cleaned")`, and workshop participants cannot supply any of those.

Route each issue as follows:

| Issue is about… | File in | Form | Who completes the required fields |
|---|---|---|---|
| App screens, buttons, saving, crashes, charts and labels, downloads, login, speed, accessibility | **CIAT/icleaned** | No form there. Use the "App bug / UX" block below as the issue body. Suggestion: add issue forms to icleaned too | Facilitator |
| Wrong or implausible *result* that persists when the same JSON is run through the package | CIAT/cleaned | **Bug report** (`[Bug]: `). Component = the model function; attach the scenario JSON exported from the user folder as the reprex | Facilitator/dev (needs R) |
| A parameter, emission factor, feed value or lookup entry that looks wrong or is missing (e.g. manure-system labels, a missing fertilizer such as CAN) | CIAT/cleaned (package data) or CIAT/icleaned (`data/primary_database/*.csv`) | **Data or parameter issue** (`[Data]: `) | Facilitator + participant (source/reference) |
| Missing capability (extrapolation, benchmarks, translation, CSV export) | icleaned for UI; cleaned for new calculations | **Feature request** (`[Feature]: `) | Facilitator |
| "How do I…" / "what does this mean" | cleaned (method) or icleaned (UI) | **Question** (`[Question]: `) | Facilitator |

Before filing, check `01_uiux_review.md`. If the issue matches a UX-nn finding, add the participant evidence to that finding rather than opening a duplicate.

## Issue capture block (copy one per issue)

```
Issue #: WS-___            Pair ID: P__        Observer: ____
Task (T1–T10): __          Time into task (min): __
Screen / tab:  [ ] Login/onboarding  [ ] Scenario select  [ ] Farm (page __/5)
               [ ] Livestock  [ ] Feed Production  [ ] Livestock Feeding
               [ ] Edit Parameters  [ ] Dashboard – run  [ ] Dashboard – compare
               [ ] Download  [ ] Help / Guide  [ ] Other: ____
Field / label / chart (exact text on screen): "________________"

TYPE (pick one → GitHub form):
  [ ] A. Bug – app (crash, grey screen, didn't save, wrong button behaviour) → icleaned
  [ ] B. Bug – result (number wrong/implausible)                          → cleaned Bug report
  [ ] C. Data / parameter (value, label, missing item in a list)          → Data or parameter issue
  [ ] D. Usability / wording / unit confusion                             → icleaned (UX)
  [ ] E. Feature request                                                  → Feature request
  [ ] F. Question / didn't understand                                     → Question

WHAT HAPPENED (participant's words, verbatim quote if possible):
______________________________________________________________

WHAT THEY EXPECTED:
______________________________________________________________

STEPS JUST BEFORE (clicks / values typed, incl. exact value e.g. "1,5", blank):
1. ____  2. ____  3. ____

EVIDENCE: [ ] screenshot/photo #___  [ ] error text copied: "________"
          [ ] scenario name: ________  (JSON retrievable from user folder: Y/N)

OUTCOME: [ ] recovered alone  [ ] recovered with help  [ ] blocked task  [ ] didn't notice (observer spotted)
IMPACT:  [ ] Blocker (couldn't finish / wrong result unknowingly)  [ ] High  [ ] Medium  [ ] Low
Matches known issue UX-__ ? [ ] yes  [ ] new

ENVIRONMENT: Browser ____  OS ____  Screen: laptop / tablet / phone
             Connection: good / slow / dropped   Browser language/locale: ____
```

## Field mapping to GitHub forms (for the facilitator when filing)

### → `bug_report.yml` (CIAT/cleaned) — type B only

| Form field (id) | Required | Fill from capture block |
|---|---|---|
| Title | — | `[Bug]: <indicator> <wrong how> when <input condition>` |
| `component` (dropdown) | yes | Map the chart or indicator to its function: GHG → `ghg_emission`; N balance → `n_balance`; land required → `land_requirement`; water → `water_requirement`; soil/erosion → `soil_health`; comparison % → `compare_scenario / calculate_differences`; otherwise `Not sure / other` |
| `description` | yes | "What happened", plus the error text |
| `expected` | yes | "What they expected" |
| `reprex` | yes | R code: `para <- jsonlite::fromJSON("<scenario>.json")` followed by the call chain. **Attach the scenario JSON** from `Users/<user>/study_objects/` |
| `pkg-version` | yes | Deployed build, i.e. `packageVersion("cleaned")` + RemoteSha on the server (UX-14) |
| `session` | no | Server `sessionInfo()` |
| `context` | no | Pair ID (no names), task, screenshot, UX-ID link, "found via iCLEANED web app" |

### → `data_issue.yml` (CIAT/cleaned) — type C

| Form field (id) | Required | Fill from |
|---|---|---|
| Title | — | `[Data]: <table/entry> <problem>` |
| `source` | yes | `ghg_parameters.json` / `energy_parameters.json` / `stock_change_parameters.json` / Feed library / Input mappings / Other. For app DB CSVs (`lkp_*.csv`) choose "Other package data" and state that it is an app DB, or file in icleaned |
| `current` | yes | Exact entry and value as seen on screen, e.g. `lkp_manureman: "Pasture / range / paddock"` |
| `proposed` | no | Participant's value, if known |
| `reference` | yes | Participant's source (national statistics, paper). If none, write "participant field knowledge – needs source" |
| `impact` | no | Which charts looked wrong |
| `pkg-version` | no | Deployed build |

### → `feature_request.yml` — type E

| Form field (id) | Required | Fill from |
|---|---|---|
| `problem` | yes | "What happened" / "What they expected", written as a user need ("As an extension officer I need to…") |
| `solution` | yes | Participant's suggestion, or the fix from the UX-ID |
| `alternatives` | no | Current workaround (e.g. "extrapolated in Excel") |
| `methods` | no | Guide section, e.g. §3.2 extrapolation, §3.4 benchmarks |
| `contribute` | no | "I can help test or provide data" if the participant offered |

### → `question.yml` — type F

| Form field (id) | Required | Fill from |
|---|---|---|
| `question` | yes | Participant's question, verbatim |
| `tried` | no | What they clicked or read (guide section, "?" tooltip). This field renders as R code, so wrap plain text in comments `# ...` |

Note: a question that several participants ask about the same screen is a **usability issue** (type D), not just a question. File one UX issue in icleaned, and add the count.

### → CIAT/icleaned (no forms) — types A and D, suggested body

```
**Screen / step:** <tab › section › field>   **Workshop task:** T_   **Pairs affected:** n / N
**What happened:** …
**Expected:** …
**Steps:** 1. … 2. … 3. …
**Input used:** (exact values, e.g. "1,5", blank)
**Environment:** browser / OS / screen / connection / locale
**Severity:** Blocker | High | Medium | Low
**Related review finding:** UX-__ (cleaned_review/ui_ux/01_uiux_review.md)
**Evidence:** screenshots, error text (no participant names/emails)
```

Suggested labels: `ux`, `bug`, `validation`, `dashboard`, `accessibility`, `i18n`, `performance`, `workshop-2026`.

## Privacy reminder

- Do not put participant names, emails or IPs in issues. Use pair IDs only.
- Scenario JSONs attached to issues must not contain identifying farm names. Rename `farm_name` before attaching.
