# cleaned package: adversarial review summary

- **Date:** 2026-09-29
- **Package reviewed:** `cleaned` v0.7.0 (CIAT/cleaned `staging` @ `800d53a`)
- **App:** iCLEANED (CIAT/icleaned @ `fb8498c`)
- **Status:** published at https://peetmate.github.io/cleaned-review/ (repo `peetmate/cleaned-review`); `CIAT/cleaned` is unchanged

## Verdict

The package runs, and its Tier 2 structure follows IPCC. But several defects change headline results by tens of percent, and some by an order of magnitude:

- **Intake engine:** net energy is divided by metabolisable-energy density, and intake takes the larger of energy and protein demand with no cap.
- **N excretion:** retention is used with the wrong units.
- **Soil carbon:** it shows a permanent loss on unchanged land, and tree carbon is always 0.
- **Burning:** it is about 24× too high.
- **Land and N:** zero yields silently become 0 ha, and leaching is not scaled by area.
- **Water:** it is about 10× too low.

Nine of these were confirmed by unit tests against the IPCC source text (06). Most of them reach the live iCLEANED app (05). Until they are fixed, absolute footprints should not be reported. Enteric CH4 differences between scenarios are the most defensible output.

## Reports

| File | Scope | Critical | High | Medium | Low |
|---|---|---|---|---|---|
| 01_climate_ghg.md | IPCC GHG, SOC, N2O, GWP | 3 | 7 | 9 | 4 |
| 02_livestock.md | Energy, intake, herd, N, feed library | 2 | 5 | 9 | 8 |
| 03_landuse.md | Land, water, erosion, N balance, scenarios | 2 | 18 | 13 | 3 |
| 04_package_code.md | R CMD check, design, bugs, tests, docs | 4 | 8 | 15 | 5 |
| 05_app_relevance_and_workshop.md | Findings vs the deployed app, guide vs code, workshop plan | 39 Critical/High deduplicated: 28 affect the app, 7 are guarded by the app, 1 unclear, 3 have no runtime effect; 6 new issues | | | |
| 06_critical_tests.md | Unit tests vs IPCC, with citations | 9 findings tested: 8 fully confirmed, 1 partly confirmed (coefficient check skipped); controls pass | | | |
| 07_fix_log.md | Proposed fixes, tested on a temporary copy | Each fix turns only its own tests green, with no regressions; all fixes: 23 pass, 1 skipped | | | |
| 08_demo.md | Current vs fixed vs IPCC, plus iCLEANED study impact | Built by knitting `fixes/demo.Rmd` | | | |

R CMD check `--as-cran` gives 4 WARNINGs and 4 NOTEs, so CI (`error_on = "warning"`) fails by design. The only existing test file contains no expectations.

## Critical findings, deduplicated

| # | Finding | Review ids | Unit test (06) | Reaches app (05) |
|---|---|---|---|---|
| 1 | Net-energy requirements ÷ ME density, with no REM/REG conversion (IPCC Eq. 10.14–10.16) | CL F02, LV C-01 | FAIL: DMI 0.55–0.63× IPCC | Yes |
| 2 | N retention in kg N/day, used as a fraction and divided by 365 twice (Eq. 10.31A/10.33) | LV C-02, H-04; CL F04; PK F07 | FAIL: cow Nex +31% | Yes |
| 3 | SOC stock-change factors applied every year to the measured stock (Eq. 2.25) | CL F01, LU S-02 | FAIL: −7 t C/ha/yr on unchanged land | Yes, the largest effect: −4.5 t CO2/yr vs 5.1 t emissions in Study_1 |
| 4 | Burning counts biogenic CO2 and applies the N2O GWP to NOx | CL F03, PK F06 | FAIL: 24× | Yes: 40% of Study_2's total |
| 5 | Tree SOC is always 0 (list/data-frame mismatch) | PK F02, LU S-01 | FAIL | Yes |
| 6 | Divide-by-zero results silently set to 0 ha | LU-01, PK F04 | FAIL | Yes; the app's default removal = 0 triggers it |
| 7 | N leaching is a per-ha value added to farm totals | LU N-01 | FAIL: 2.6 vs 278 kg N | Yes |
| 8 | Main inputs fetched from the caller's environment (`get(..., parent.frame())`) | PK F03 | FAIL ×2 | Guarded: the app passes arguments explicitly |
| 9 | Shipped example inputs don't run | PK F01, LU D-01, LV H-03 | FAIL ×3 | Guarded: the app writes the correct column names |

## Highest-impact High findings

- DMI = max(energy, CP) with no intake cap, so CP-poor diets inflate DMI, land, CH4 and N. A Study_2 cow eats 8.4% of body weight. (LV H-01, LU-02)
- Manure-system labels don't match the MCF table, so manure CH4 becomes NA and is summed as 0. The app's default label triggers this. (CL F07)
- Soils use 2006 N2O factors while manure uses 2019 values, and several N2O pathways are never aggregated. (CL F05, F06, F09)
- Water is in mm·ha but labelled m³, so it is 10× too low, and there's no green/blue split. (LU W-01, W-02)
- Fertiliser types missing from the table give 0 N, while manufacturing emissions still count them. (LU N-04, CL F10)
- Scenario % change flips sign when the baseline is negative. (LU C-01)
- The feed library has errors: Brachiaria CP equals ME, 995 ILRI rows have ME and IVDMD swapped. (LV M-07)

## Deployed version

This corrects what I said earlier in the session. The app most likely runs v0.7.0-equivalent code: fork head `4ae5505`, which has the same `R/` and `inst/` as `staging` (about 65% likely). The alternative is the `renv.lock` pin `4c44dc9` (about 30%).

- `global.R`'s fallback to `cleaned_v0.6.0` is ruled out: that version crashes on the studies the current app saves.
- Workshop test **T0** in 05 settles which version is live. If Study_1's GHG total reads 5.12 t, it's v0.7.0; if it reads 196, it's 4c44.
- On 4c44, the Compare-tab GHG totals are wrong by 1–3 orders of magnitude.

## For the workshop

05 §6 has a 15-scenario test plan with expected ranges, and §7 has 16 warnings for facilitators. Minimum messages to participants:

1. Test usability and the direction of change, not absolute numbers.
2. Ignore the soil carbon and burning figures.
3. Set a removal fraction for every feed; purchased feeds get no land.
4. Fill in mature body weight, and weaning and 1-year weights for sheep and goats.
5. Soil depth is in metres, and water figures are 10× too low.
6. Run T0 before the session.

## Suggested fix order

1. **Fixes that are one line or a few lines each:**
   - tree SOC lookup (`soc.R:234`)
   - burning aggregation (`merge_outputs.R:810-812`)
   - leaching `* area_total` (`nitrogen_balance.R:249`)
   - N retention units (`ghg_emission.R:226,233`)
   - manure-label normalisation
2. **Engine changes:**
   - REM/REG in `energy_requirement()`
   - an intake cap with a flag for CP-limited diets
   - SOC based on SOCref (IPCC Table 2.3) with a baseline land-use and management state
3. **Guards:**
   - error or warn instead of silently returning 0
   - remove `get(parent.frame())`
   - validate inputs against the input contract, with units documented
4. **Hygiene:**
   - get R CMD check to pass
   - a shipped example that runs
   - the critical tests plus a golden regression test on Study_1 and Study_2
   - move non-.rda files out of `data/`

The proposed fixes and their test results are in `07_fix_log.md`. The demo is `08_demo.md`.

## Local artefacts

- `../cleaned_review/`: these reports, and the user guide as extracted text
- `../cleaned_review_src/`: read-only checkout of v0.7.0 (a detached worktree)
- `fixes/`: tests, the proposed fixes, the runner, `demo.Rmd`, `build_site.R`, `build_notebook.py`, `results/`, and `cleaned_fixed_copy/` (a plain folder, not git)
- `reproduce/`: `reproduce_critical_issues.R` (self-contained script) and `critical_issues.ipynb` (Colab notebook, R runtime), both generated from the same code
- `site/`: the published site, a git checkout of https://github.com/peetmate/cleaned-review (Pages: https://peetmate.github.io/cleaned-review/)
- `../icleaned_review_src/`: read-only clone of the app
- Session scratchpad: the IPCC PDFs as text, the reviewers' run scripts, and the scratch R library (openxlsx)
