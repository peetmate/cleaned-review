# Proposed fixes: test log

- **Date:** 2026-09-29
- **Package:** `cleaned` v0.7.0 (`staging` @ `800d53a`)
- **Status:** proposals only. The repository was not edited, branched or merged.

## How the fixes were tested

`fixes/proposed_fixes.R` defines each fix as exact find-and-replace edits. Each edit must match exactly once, so a fix fails loudly if the source has moved on.

`fixes/run_all.sh` runs `fixes/run_one.R` for 11 configurations:
- baseline (no fixes)
- each fix alone (F01 to F09)
- all fixes together (ALL)

Each configuration does the following in a fresh R process:
1. Copies the package source (`../cleaned_review_src`, the v0.7.0 checkout) to a temporary folder.
2. Applies the fix or fixes to that copy.
3. Writes the change as a diff to `fixes/results/<id>.diff`.
4. Loads the copy with `pkgload::load_all()`.
5. Runs the 24 tests in `fixes/tests/`:
   - 8 controls
   - 13 finding tests
   - 2 guards for the fixes themselves
   - 1 skipped test, whose source I couldn't verify
6. For the baseline and ALL configurations, runs the two iCLEANED example studies the same way the app does.

## Result

Each fix turns only its own finding tests green, and every control passes in all 11 configurations. No fix breaks another test. With all fixes, 23 tests pass and 1 is skipped. The full matrix is in `fixes/results/test_matrix.csv`.

| Test | base | F01 | F02 | F03 | F04 | F05 | F06 | F07 | F08 | F09 | ALL |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 01 control NEm (Eq. 10.3) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 01 intake per Eq. 10.14–10.16 | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| 01 guard: intake finite on a low-DE diet | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 02 control N intake (Eq. 10.32) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 02 N retention (Eq. 10.33) | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| 02 N excretion (Eq. 10.31A) | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| 03 control Eq. 2.25 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 03 no change on steady-state land | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| 03 guard: land-use change per Eq. 2.25 | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| 04 control Table 2.5 factors | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 04 burning CO2e = CH4 + N2O | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| 05 control biomass output shape | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 05 tree carbon added to SOC | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| 06 control normal feed has land | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 06 zero yield flagged | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ |
| 07 control out4 = rate × area | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 07 leaching = rate × area | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ |
| 07 leaching coefficient | ⏭ | ⏭ | ⏭ | ⏭ | ⏭ | ⏭ | ⏭ | ⏭ | ⏭ | ⏭ | ⏭ |
| 08 control explicit argument | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 08 `n_balance()` signals the lookup | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ |
| 08 `ghg_emission()` signals the lookup | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ |
| 09 `feed_quality()` runs on the example | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| 09 `energy_requirement()` runs on the example | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| 09 example DM in % | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |

## The fixes

The Status column says whether a fix can go in as it is or needs the authors to agree the method first. Ready means the code change is correct and only affects what the finding describes.

| Id | Fix | Files | Status | Notes |
|---|---|---|---|---|
| **F01** | Convert net energy to intake with IPCC REM/REG (2019 Eq. 10.14–10.16). Energy-based DMI = GE/18.45 for cattle, buffalo, sheep and goats. Pigs are unchanged. | `R/energy_requirement.R` (annual NE split into REM and REG groups; seasonal DMI) | **Author decision** | (1) DE is derived from the package's ME with its own ME/DE = 0.81. (2) DE is floored at **45%** for REM/REG: IPCC 2019 p. 10.21 gives the common ruminant DE ranges as starting at 45%. The package warns below that. Without the floor, the example diet (35–40% DE) gave negative intakes and one of 57,831 kg DM. The guard test catches this. (3) It changes every livestock output. |
| **F02** | N retention in kg N/head/day (Eq. 10.33), and N excretion = (N intake − retention × herd) × 365 (Eq. 10.31A) | `R/ghg_emission.R:226, 233` | Ready for cattle | Sheep and goats reuse the cattle equation, 10.33; IPCC gives it for cattle, so confirm for small ruminants. The pig pathway is unchanged. |
| **F03** | Soil carbon changes only when land use or management changes (2006 Eq. 2.25). Adds optional inputs `cropland_system_previous`, `cropland_tillage_previous`, `cropland_orgmatter_previous`, `grassland_management_previous` and `grassland_implevel_previous`; if they're absent, the change is 0. | `R/soc.R` (3 stock-change blocks) | **Author decision** | The measured stock is treated as SOC₀, and SOCref = SOC₀/F₀. The alternative is IPCC Table 2.3 SOCref by climate and soil. The app would need fields for the previous state to show real land-use change. The stock size/units question (about 10×) is not addressed. |
| **F04** | Burning CO2e = CH4 × GWP + N2O × GWP, read by column name | `R/merge_outputs.R:810-812` | Ready | |
| **F05** | Read tree carbon from `biomass$c_increase_soc` | `R/soc.R:234` | Ready | |
| **F06** | Warn when a feed with DM demand has no finite land area | `R/land_requirement.R` | Ready | Warns only; the result is unchanged. Whether purchased feeds should count off-farm land is a separate method decision. |
| **F07** | Leaching = per-ha rate × `area_total`, using per-ha organic N | `R/nitrogen_balance.R:249-251` | Ready (area only) | The coefficient `0.021*(P-3.9)` is left unchanged. The NUTMON form is reported as `0.021*P-3.9`, but I haven't verified it against Smaling et al. (1993). |
| **F08** | Warn when `energy_required` or `feed_basket_quality` is taken from the caller | `R/nitrogen_balance.R:36`, `R/ghg_emission.R:47` | Ready as a warning | **iCLEANED relies on this lookup:** it sets `environment(n_balance) <- environment()` and omits the argument. Replace the lookup with `stop()` only after the app passes both inputs explicitly. |
| **F09** | Make the shipped `example_input.json` match the input contract: add `crop_name` and the renamed livestock columns; DM in %, with concentrate DM set to an assumed 87% | `inst/extdata/example_input.json` | Ready | The diff is large because `write_json` reformats the whole file. |

## Effect in iCLEANED (the app's two example studies, all fixes)

The per-source table is in `08_demo.md`. On-farm totals, including the soil carbon change:

| Study | Current, kg CO2e/yr | Fixed, kg CO2e/yr | Main drivers |
|---|---|---|---|
| Study_1 | 9,628 | 8,045 | False soil carbon loss removed (−4,505). Enteric CH4 +60% (4,388 → 6,998) because intake is now per IPCC. Cow intake goes from 1.9% to 3.1% of body weight. |
| Study_2 | 67,322 | 21,660 | False soil carbon loss removed (−32,397). Burning 13,834 → 578. Intake unchanged because it's limited by crude protein, not energy. |

Messages the app would now receive:
- Study_1: concentrate with DM demand but 0 ha.
- Study_2: diet DE of 39–40% is below the IPCC range.
- Both: deprecation warnings for the hidden input lookup.

## Not fixed here (High findings still open)

- **Intake has no upper limit.** Intake = max(energy, CP), so the Study_2 cow still eats **8.4% of body weight**. The authors need to decide how to cap intake, for example by rumen fill or an NDF limit, or flag CP-limited diets (LV H-01, LU-02).
- **Manure CH4 is 0:** manure-system labels don't match the MCF table (CL F07).
- **Water** is about 10× too low: mm·ha is labelled as m³ (LU W-01).
- **N2O pathways** that are never aggregated, and the mix of 2006 and 2019 N2O factors (CL F05, F06, F09).
- The remaining High findings: see `00_summary.md`.

## To reproduce

```bash
cd fixes
./run_all.sh ../../cleaned_review_src ../../icleaned_review_src
Rscript -e 'knitr::knit("demo.Rmd", "../08_demo.md")'
```

This needs `openxlsx`, `callr`, `knitr`, `testthat` and `pkgload`. `run_all.sh` rebuilds `fixes/results/` and `fixes/cleaned_fixed_copy/`, which is a plain folder, not a git checkout.
