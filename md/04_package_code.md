# 04 - Package design, correctness and best-practice review: `cleaned` v0.7.0

Reviewed: `CIAT/cleaned` @ 800d53a (read-only). Everything was run on a copy under the session scratchpad.
Tooling: R 4.6.0 (aarch64 macOS), `R CMD build` + `R CMD check --as-cran --no-manual` (pandoc from the RStudio bundle), lintr 3.x, and the full model pipeline run end to end. `openxlsx` and `spelling` were installed into a scratch library only. devtools, rcmdcheck and covr are not installed, so coverage was judged by reading the tests.

## Verdict

**Not release-quality.** The package builds and installs. `R CMD check` finishes with **4 WARNINGs and 4 NOTEs**, and the repo's own CI (`error_on = "warning"`) would therefore fail. Check looks cleaner than the package really is because every example is `\dontrun` and every vignette is `eval = FALSE`. **No input file shipped with the package runs the pipeline.** Once a working input was built by hand, several reproducible model bugs showed up:

- Tree SOC is silently dropped.
- Off-farm fertiliser N is double counted as crop-residue N.
- Water use for off-farm concentrates is double counted.
- Anhydrous ammonia is given the urea quantity.
- NOx is costed at the N2O warming potential.
- A single typo in a category name produces **0 ha** of land with no warning.

Two exported functions find their main input by dynamic scoping (`get(..., parent.frame())`). Testing is effectively zero: one file with no expectations.

## R CMD check summary (reproduced)

`R CMD build`: OK (tarball 821 KB). The first attempt failed only because pandoc was missing, which is an environment issue.

`R CMD check --as-cran --no-manual cleaned_0.7.0.tar.gz`: **Status: 4 WARNINGs, 4 NOTEs**

| Level | Check | Detail |
|---|---|---|
| WARNING | portable file names | `R/misc/v37 loop.R` (has a space; it ships in the tarball) |
| WARNING | code/documentation mismatches | `combineOutputs` (`primary_excel` vs `readMe`/`benchMark`), `ghg_emission` (`feed_basket_quality`, `ym_prod` undocumented), `n_balance` (argument 3 is `energy_required` in the code but `soil_erosion` in the docs) |
| WARNING | Rd \usage | `readMe`, `benchMark` undocumented |
| WARNING | contents of `data` | `cleaned.sqlite`, `energy_parameters.json`, `explore_qt_json.html/.pdf/.rmd`, `mappings/`, `qt_example.json` are not allowed in `data/` |
| NOTE | top-level files | `-ILRIKE-21154.Rhistory`, `CITATION.cff`, `auxilary_info` |
| NOTE | package subdirectories | `CITATION.cff` in a non-standard place |
| NOTE | dependencies in R code | Imports declared but never imported: `ggplot2`, `plyr`, `rlang`, `tidyverse` |
| NOTE | R code problems | about 250 "no visible binding" globals across 10 functions; `where` has no visible definition; check suggests `importFrom("datasets","npk")` |

Examples, tests and vignettes all say "OK", but only because none of them execute model code (see F19 and F20).

lintr (defaults, line length 120): **4,879 lints**. The largest groups are `object_usage` 1550, `infix_spaces` 1113, `commas` 550, `line_length` 377, `T_and_F_symbol` 25 and `seq_linter` 17 (`1:length`/`1:nrow`).

Pipeline timing on the patched example: about 0.68 s per full scenario run (10 runs took 6.8 s).

## Findings table

Verdict key: C = CONFIRMED (reproduced by running code, or shown directly by the file contents or check output); P = PLAUSIBLE (strong static evidence, needs a domain or numeric check). Refuted and dropped: a suspected copy-paste title bug in `compare_scenario.R` (my own sed splice produced it); `land_requirement` returning only the last iteration's `feed_items_frac` (masked in practice because `feed_quality` always emits every feed); the "wet season crossing a year boundary goes negative" hypothesis (it computes correctly); and input mutation by reference (`para` is unchanged after a run, and no `:=` is used in `R/`).

| ID | Sev | V | Location | Issue |
|---|---|---|---|---|
| F01 | Critical | C | `inst/extdata/example_input.json`, `data/qt_example.json`, `data/mufindi.rda`, `data/ghg_para.rda` | No shipped input or parameter set runs the pipeline. `feed_quality()` fails on `crop_name`, and `ghg_para` has the wrong table names |
| F02 | Critical | C | `R/soc.R:234` | `biomass[["trees_non_feed_biomass"]]` is always NULL, so tree SOC is always 0 |
| F03 | Critical | C | `R/nitrogen_balance.R:29-37`, `R/ghg_emission.R:46-48` | `get("energy_required"/"feed_basket_quality", envir = parent.frame(), inherits = TRUE)` is dynamic scoping |
| F04 | Critical | C | `R/energy_requirement.R:70-79,102-128`; `R/land_requirement.R:58-60,120-121`; `R/feed_quality.R:132` | Unknown category names or NA inputs silently become 0, e.g. 0 ha of land for a whole herd |
| F05 | High | C | `R/ghg_emission.R:373-375` | Off-farm crop-residue N is taken from fertiliser columns (conc_of and conc_ip double counted) or from a column that does not exist (rough_of is always 0) |
| F06 | High | C | `R/ghg_emission.R:494-504`, `R/merge_outputs.R:808-813` | Burning multiplies NOx by the N2O GWP, counts biogenic CO2, and reads a positional column 5 |
| F07 | High | P | `R/ghg_emission.R:213-233` | `n_retained` mixes daily and annual units and is used as a fraction in eq. 10.31 |
| F08 | High | C | `R/merge_outputs.R:74-84,92-98` and throughout | Defensive `tryCatch`/"column missing, use 0" helpers turn schema drift into silent zeros in the GHG balance |
| F09 | High | C | R CMD check, `.github/workflows/R-CMD-check.yaml:84` | 4 WARNINGs, and CI uses `error_on="warning"`, so CI is red by design |
| F10 | High | C | `data/` | Non-.rda artefacts ship in `data/`; copies diverge (`energy_parameters.json` typo, `stock_change_para` differs from the JSON) |
| F11 | High | C | `man/*.Rd`, `R/*.R` roxygen, `vignettes/*.Rmd` | Docs out of sync: codoc mismatches, all examples `\dontrun` and broken, all vignettes `eval=FALSE` |
| F12 | High | C | `tests/testthat/test-feed_quality.R:1` | The only test is `context("test-feed_quality")`: zero expectations and no regression tests |
| F13 | Medium | C | `R/water_requirement.R:56` | `kc_water_use_on_farm` does not subtract concentrates off-farm (OFC), so their water is counted twice |
| F14 | Medium | C | `R/ghg_emission.R:517-523` | "Anhydrous ammonia" falls through to the urea quantity, giving phantom emissions |
| F15 | Medium | C | `R/energy_requirement.R:190-191` | `sum(x, na.omit=TRUE)` adds 1 and does not drop NA |
| F16 | Medium | C | `R/ghg_emission.R:395-399,565-569` | `if (rice$source_type != "Purchased")` errors with two or more rice feeds; the two rice filters disagree |
| F17 | Medium | P | `R/nitrogen_balance.R:249-254` | Leaching `0.021*(P-3.9)` probably should be `(0.021*P-3.9)`; `in2` (total kg) is mixed with per-ha terms |
| F18 | Medium | C | `R/feed_quality.R:79-84,135-137` | Errors when a livestock category has no feed-basket rows; relies on loop leftovers |
| F19 | Medium | C | `DESCRIPTION:28-41`, `NAMESPACE:37` | `tidyverse` in Imports; `plyr`, `ggplot2`, `rlang` unused; `importFrom(utils, de)` (the data editor) |
| F20 | Medium | C | `R/global.R:1-251` | 250-name `globalVariables` list is stale, hides the dynamic-scoping objects, and still leaves ~250 NOTE entries |
| F21 | Medium | C | stray files | `-ILRIKE-21154.Rhistory` (personal `C:/Users/soloo...` paths) and `R/misc/v37 loop.R` ship in the tarball; also `R/.Rhistory`, `auxilary_info/`, `data/__MACOSX` |
| F22 | Medium | C | exported API | Inconsistent argument order and naming, a positional-swap heuristic, `ym_prod=F`, and the `fetilizer_ghg` typo exported twice |
| F23 | Medium | C | `R/ghg_emission.R:144,188-194,239-248,262,450,480`; `R/merge_outputs.R:810` | Fragile positional indexing and renames that depend on auto-generated column names |
| F24 | Medium | P | `R/land_requirement.R:108-119`, `R/water_requirement.R:53-55`, `R/nitrogen_balance.R:269-298`, `R/ghg_emission.R:367-369,538-540` | Feed origin is encoded as substrings (`"OFR"`, `"OFC"`, `"IP"`) inside free-text names |
| F25 | Medium | C | `R/merge_outputs.R:693-694` | GWPs (CH4 = 28, N2O = 265) are hardcoded rather than taken from parameters |
| F26 | Medium | C | `R/merge_outputs.R:1262-1267`, `R/merge_outputs.R:29` | Docs say "saved JSON file", but only an xlsx is written, named `<file>.json.xlsx` |
| F27 | Medium | C | `.github/workflows/R-CMD-check.yaml` | Obsolete runners and actions (ubuntu-20.04, setup-r@v1, cache@v2, checkout@v2); dev branch never checked |
| F28 | Low | C | `R/plotting.R:34-236`, `R/compare_scenario.R:36-478` | The "plotting" functions do not plot; unused `dir.create` side effect; stale `title` in the `else` branch; `1:nrow` fails with only a base run |
| F29 | Low | C | `R/season_length.R:22-36` | Hardcoded `%Y/%m/%d` format, so ISO dates fail with a cryptic error; leap year taken from the start date |
| F30 | Low | C | `R/nitrogen_balance.R:243,267` | `replace_na(as.list(rep(0, ncol(.)-2)))` with an unnamed list does nothing |
| F31 | Low | C | `R/feed_quality.R:31-50`, `R/land_requirement.R:71`, `R/nitrogen_balance.R:45`, `R/energy_requirement.R:183` | Loop-invariant `unnest()` recomputed in nested loops; `rbind` inside a loop; `1:length`/`1:nrow` |
| F32 | Low | C | `R/data.R:42,67`; missing NEWS.md and inst/CITATION; stale `docs/` | Roxygen typos (`#' #' @keywords`), `...` placeholders in `@format`; `docs/reference/economics_payback.html` documents a removed function |

Counts by severity: **Critical 4, High 8, Medium 15, Low 5** (32 findings).

## Detailed findings

### F01 (Critical, CONFIRMED): nothing shipped can run the model

Evidence:

- `feed_quality(fromJSON(system.file("extdata","example_input.json", package="cleaned")))` fails with `Column 'crop_name' doesn't exist` (`R/feed_quality.R:44`). `data/qt_example.json` fails the same way.
- `inst/extdata/example_input.json` also lacks `dry_yield` and `residue_dry_yield` in `feed_items`, which `land_requirement` needs (`R/land_requirement.R:94-96`). It lacks `fat_milkcontent`, `cp_lys_pregnancy`, `cp_lys_growth`, `lw_gain_piglets`, `proportion_growth_piglets_milk` and `n_manure_content` in `livestock`, which `R/energy_requirement.R:106-144,206-213` needs.
- `data(mufindi)` is an older schema: `txt_*` fields, a `ferlitizer` typo, and `manureman_*` at top level. Yet every roxygen example uses it.
- `data(ghg_para)` has the names `Table_10.12`, `table_10.17` and so on, but `ghg_emission` reads `"Table 10.12"`, `"Table 10.13"`, `"Table_m"` and `"Table 10.16"`. Running `ghg_emission(..., ghg_para, ...)` fails with `replacement has length zero`.
- To exercise the pipeline I had to build a working input by adding `crop_name = feed_item_name`, deriving `dry_yield` and `residue_dry_yield` from `fresh_yield`, `dm_content`, `harvest_index` and `water_content`, and aliasing six livestock fields.

Impact: users cannot run the README or vignette example. No golden or regression test is possible, and the input contract is not machine-checked anywhere.

Fix:

- Ship one canonical, validated `inst/extdata/example_scenario.json` that runs end to end.
- Delete or regenerate `mufindi`, `ghg_para` and `stock_change_para` from `data-raw/` scripts that read the `inst/extdata` JSON, so there is a single source of truth.
- Add a smoke test that runs the full pipeline on the shipped example.

### F02 (Critical, CONFIRMED): SOC ignores tree biomass

`R/soc.R:234`:
```r
biomass = sum(biomass[["trees_non_feed_biomass"]]$c_increase_soc),
```
`biomass_calculation()` returns a tibble, not a list (`R/biomass_calculation.R:141-144`), so `biomass[["trees_non_feed_biomass"]]` is `NULL` and the sum is `0`. Reproduced: `sum(biomass$c_increase_soc)` is 30.38, but the value used is 0. Setting `c_increase_soc = 1000` still gives SOC = 0. Wrapping the input as `list(trees_non_feed_biomass = biomass)` gives 4000 / 14666.67.

Fix:
```r
tree_df <- if (is.data.frame(biomass)) biomass else biomass[["trees_non_feed_biomass"]]
stopifnot("c_increase_soc" %in% names(tree_df))
biomass_c <- sum(tree_df$c_increase_soc, na.rm = TRUE)
```

### F03 (Critical, CONFIRMED): dynamic scoping in exported functions

In `R/nitrogen_balance.R:27-37`, `n_balance(para, land_required, energy_required = NULL, soil_erosion = NULL)` guesses whether argument 3 is really `soil_erosion`, then runs `get("energy_required", envir = parent.frame(), inherits = TRUE)`. `R/ghg_emission.R:46-48` does the same for `feed_basket_quality`. `R/global.R:61,67` then declares both names as globals, which hides the check NOTE.

Reproduced:

- The documented call `n_balance(para, land_required, soil_erosion)` made inside a function fails with `object 'energy_required' not found`.
- Inside a function with an unrelated local `energy_required`, it silently used that object and returned `organic_n_kg_total` = 3e6 instead of 0.

Fix: make the arguments explicit and required, and error on the wrong type:
```r
n_balance <- function(para, land_required, energy_required, soil_erosion) {
  stopifnot(is.list(energy_required), "annual_results" %in% names(energy_required),
            is.data.frame(soil_erosion))
  ...
}
```
Deprecate the old positional form with `lifecycle::deprecate_warn()` if the app depends on it.

### F04 (Critical, CONFIRMED): bad inputs silently become zeros

In `R/energy_requirement.R:70-77`, categories are matched by exact strings (`"Cattle - Cows (improved)"`), and anything unmatched gets `maintenance_cat = NA`. Later, `ifelse(!is.finite(x), 0, x)` (lines 102, 112, 118, 123, 128), `replace(is.na(.), 0)` (`R/land_requirement.R:60,121`) and `feed_allocation_all[is.na(...)] <- 0` (`R/feed_quality.R:132`) erase the problem.

Reproduced:

- Renaming `"Cattle - Cows (improved)"` to `"Cattle - Cows (Improved)"` gives `er_maintenance = NA` and **0 ha of land** for the dairy herd, with no warning.
- Setting `body_weight = NA` for one class gives 0 ha for that class.

Fix: validate before computing, and fail loudly.
```r
validate_para <- function(para, energy_parameters) {
  lv <- para$livestock
  bad <- setdiff(lv$livetype_desc, known_livetypes)
  if (length(bad)) stop("Unknown livetype_desc: ", paste(bad, collapse = ", "), call. = FALSE)
  req <- c("body_weight", "herd_composition", "time_in_stable", ...)
  miss <- req[!req %in% names(lv)]
  if (length(miss)) stop("livestock missing: ", toString(miss), call. = FALSE)
  if (anyNA(lv[req])) stop("NA in required livestock fields", call. = FALSE)
  tt <- rowSums(lv[grep("^time_in_", names(lv))])
  if (any(abs(tt - 1) > 1e-6)) warning("time_in_* fractions do not sum to 1")
  invisible(TRUE)
}
```
Call it at the top of each exported function, or once in a `run_cleaned()` wrapper. Replace NaN/Inf with 0 only for the documented structural 0/0 cases.

### F05 (High, CONFIRMED): off-farm crop-residue N is wrong

`R/ghg_emission.R:373-375`:
```r
rough_of_n_from_crop_residue_managed_soil <- sum(nitrogen_balance$rough_of_n_from_crop_residue, na.rm = TRUE) # column does not exist -> 0
conc_of_n_from_crop_residue_managed_soil  <- sum(nitrogen_balance$conc_of_min_fert_n, na.rm = TRUE)          # fertiliser N!
conc_ip_n_from_crop_residue_managed_soil  <- sum(nitrogen_balance$conc_ip_min_fert_n, na.rm = TRUE)          # fertiliser N!
```
Reproduced with urea on an `OFC` feed: `conc_of_n_synthetic_fertilizer_managed_soil` = 41.305 and `conc_of_n_from_crop_residue_managed_soil` = 41.305. The same N is counted twice in `ghg_balance` (`R/merge_outputs.R:857-860`).

Fix: use the values already computed at lines 361-370.
```r
rough_of_n_from_crop_residue_managed_soil <- sum(n_from_crop_residues$rough_of_n_from_crop_residue, na.rm = TRUE)
conc_of_n_from_crop_residue_managed_soil  <- sum(n_from_crop_residues$conc_of_n_from_crop_residue,  na.rm = TRUE)
conc_ip_n_from_crop_residue_managed_soil  <- sum(n_from_crop_residues$conc_ip_n_from_crop_residue,  na.rm = TRUE)
```

### F06 (High, CONFIRMED statically): residue burning GHG

`table_2.5` rows are CO2 1515, CO 92, CH4 2.7, N2O 0.07 and **Nox 2.5**. `R/merge_outputs.R:810-812`:
```r
burning <- sum_num(ghg_burn[ghg_burn$ghg_gas == "CO2", 5]) +
  sum_num(ghg_burn[ghg_burn$ghg_gas == "CH4", 5]) * methane +
  sum_num(ghg_burn[ghg_burn$ghg_gas == "Nox", 5]) * N2O
```
This does three wrong things:

- NOx is costed at the N2O GWP, which overstates the N2O term by about 36 times (2.5 / 0.07).
- Biogenic CO2 from residue burning is counted, although IPCC excludes it from national totals.
- Column 5 is picked by position.

Fix:
```r
b <- ghg_burn$amount_of_ghg_emission_from_fire; g <- ghg_burn$ghg_gas
burning <- sum(b[g == "CH4"]) * gwp[["CH4"]] + sum(b[g == "N2O"]) * gwp[["N2O"]]
```
Also check the units: the factors are g/kg DM while the masses are kg.

### F07 (High, PLAUSIBLE): N retention units in eq. 10.31

`R/ghg_emission.R:226`: the non-pig `n_retained` is divided by `no_days` when `annual_growth == 0` and **not** divided in the growth branch, so the two branches have different units. It is then used as a fraction: `n_excretion_rate = n_intake*(1-n_retained)*no_days` (line 233). IPCC 2019 eq. 10.31 uses `N_intake × (1 − N_retention_frac)`. When retention is in kg N/day (eq. 10.33), the correct form is `N_intake − N_retention`.

Fix: compute `n_retained_kg_day` consistently, then `n_excretion_rate = (n_intake - n_retained_kg_day) * 365`. Pin the result with a hand-calculated golden value for one cow and one steer.

### F08 (High, CONFIRMED statically): `combineOutputs` hides upstream failures

`to_df()` (`R/merge_outputs.R:74-84`) wraps `as.data.frame` in `tryCatch(..., error = function(e) data.frame())`. `sum_col`, `soil_direct_pick` and the `if ("col" %in% names(x)) ... else 0` branches (lines 736-828) all fall back to 0 or NA. If an upstream column is renamed, for example `direct_N2O_emission`, the GHG balance quietly reports 0 for that source.

Fix: define the required output schema once (a named list of required columns per section) and `stop()` when something is missing. Keep the tolerant fallbacks only for known legacy JSON, and `warning()` when they fire.

### F09 (High, CONFIRMED): check status versus CI

The 4 WARNINGs are listed above. `.github/workflows/R-CMD-check.yaml:84` runs `rcmdcheck(..., error_on = "warning")`, so every CI run on master fails. Fix everything in F10, F11, F19, F20 and F21, then enforce `error_on = "note"`.

### F10 (High, CONFIRMED): `data/` misuse and diverging copies

`data/` holds `cleaned.sqlite` (lookup tables), a rendered `explore_qt_json.html` (1.1 MB), `.pdf`, `.rmd`, `energy_parameters.json`, `qt_example.json` and `mappings/*.csv`, all of which ship. The copies disagree:

- `data/energy_parameters.json:19` has `"Sheep_lamb_to _1_year"` (stray space) where `inst/extdata` has `"Sheep_lamb_to_1_year"`.
- `stock_change_para.rda` is not identical to `inst/extdata/stock_change_parameters.json`.
- `ghg_para.rda` uses another schema (F01).

Fix:

- Move the raw artefacts to `data-raw/`, which is already in `.Rbuildignore`, together with build scripts.
- Keep in `data/` only the `.rda` objects produced by `usethis::use_data()` from `inst/extdata`.
- Move `explore_qt_json.*` to a vignette or out of the package.
- Add `^data/__MACOSX$` and `.DS_Store` to `.Rbuildignore` and `.gitignore`.

### F11 (High, CONFIRMED): documentation out of sync

- The `man/` pages are stale compared with both code and roxygen: `man/combineOutputs.Rd` documents `readMe` and `benchMark`, which appear nowhere in `R/`. `document()` has not been re-run.
- Every `@examples` block is inside `\dontrun{}` and calls objects that do not exist. Examples: `feed_quality(para)` after `data(mufindi)`; `economics_payback()`, which was removed; `energy_requirement(mufindi, fbq, energy_parameters)` with `energy_parameters` never defined; `soil_organic_carbon(para, land_required, biomass)` with 3 of its 4 arguments; `land_productivity(para)` missing `energy_required`; `data(para)`.
- `@param para "A JSON file"` is wrong everywhere: the argument is a parsed list.
- All four vignettes set `eval = FALSE`.

Fix:

- Run `devtools::document()`.
- Replace `\dontrun` with runnable `@examples` built on the canonical example from F01. Use `@examplesIf interactive()` only for file writers, with `tempdir()`.
- Set `eval = TRUE` in `cleaned-overview.Rmd` so the vignette build becomes an integration test.

### F12 (High, CONFIRMED): no tests

`tests/testthat/test-feed_quality.R` is one line, `context("test-feed_quality")`. That is a deprecated call with zero expectations. There is no `Config/testthat/edition: 3`, no fixtures and no snapshot tests.

Fix, in priority order:

1. `test-pipeline.R`: run the canonical example end to end and `expect_snapshot_value(round(key_indicators, 6), style = "json2")`.
2. One unit test per module on a 1-animal, 1-feed, 1-season fixture with values computed by hand.
3. Regression tests for F02, F05, F13, F14, F15 and F16.
4. Error tests: unknown category, NA input, missing column.

Add covr and a coverage badge.

### F13 (Medium, CONFIRMED): water double counting for OFC feeds

`R/water_requirement.R:56`:
```r
kc_water_use_on_farm = feed_water_use-kc_water_use_of_roughages-kc_water_use_ip_concentrates,
```
Reproduced: the `"... OFC"` feed shows 2237.2 under `kc_water_use_of_concentrates` and also 2237.2 under `kc_water_use_on_farm`. Land (`R/land_requirement.R:111`) subtracts all three categories.

Fix: `- kc_water_use_of_concentrates` as well.

### F14 (Medium, CONFIRMED): anhydrous ammonia gets the urea quantity

In `R/ghg_emission.R:517-523`, the nested `ifelse` has no `"Anhydrous ammonia"` branch, so it takes the final `else`, which is the urea sum. Reproduced: Urea 10994 kg gives 8631 kg CO2e, and "Anhydrous ammonia" also gets 10994 kg, giving a phantom 28586 kg CO2e in `fertilizer_applied`. This affects the reported sheet and JSON, not the headline balance, which uses the by-crop table.

Fix:
```r
qty <- vapply(fert_cols, function(cl) sum(crop_parameters[[cl]] * crop_parameters$area_total, na.rm = TRUE), numeric(1))
fertilizer_applied <- data.frame(fertilizer_list = names(fert_cols), fertilizer_quantity = unname(qty))
```
Here `fert_cols` is a named vector mapping each label to its column, with no fallthrough.

### F15 (Medium, CONFIRMED): `sum(..., na.omit = TRUE)`

`R/energy_requirement.R:190-191`. `na.omit` is not an argument of `sum`, so `TRUE` is summed as 1: `sum(1, 2, na.omit = TRUE)` returns 4. Reproduced: `dmi_energy_total` is 5683 against a true 5682, and every class is +1. NA values are not removed either. `surplus_total` and `limiting_total` inherit the error.

Fix: `na.rm = TRUE`.

### F16 (Medium, CONFIRMED): rice branch

`R/ghg_emission.R:399` and `:569` use `if (rice$source_type != "Purchased")`. With two rice feeds, R 4.2+ fails with `the condition has length > 1` (reproduced). Line 395 filters on `feed_item_name`, line 565 on `crop_name`, so the two blocks can select different rows.

Fix: filter once, use `rice <- rice[rice$source_type != "Purchased", ]` and vectorise.

### F17 (Medium, PLAUSIBLE): leaching and gaseous-loss equations

`R/nitrogen_balance.R:249`:
```r
out3a = (...) * (0.021 * (annual_precipitation - 3.9) / 100)
```
The sibling equations are written `a*P + b` (lines 250-251). The NUTMON leaching equation for clay < 35 % is `0.021*P - 3.9`. At P = 1500 the two give 31.4 and 27.6, a 14 % difference.

`in2` is `organic_n_kg_total`, a farm total in kg, yet it is added to per-ha terms in `out3*`. `out4` correctly uses `organic_n_kg_per_ha * area_total`. Confirm against the Excel reference model.

### F18 (Medium, CONFIRMED): `feed_quality` fragility

- Adding a livestock class that has no feed-basket rows fails with `fraction_as_fed must be size 1, not 0` (reproduced).
- Lines 135-137 build `season_name` and `livestock_category_code` from `feed_item_selected` and `livestock_selected`, which are leftovers of the last inner-loop iteration. The season can become NA if the last feed has no rows for that season.
- Lines 33 and 44 re-read and re-`unnest` inputs on every iteration of the livestock and season loops.

Fix: rewrite as one join, sketched below.
```r
fi  <- tidyr::unnest(para$feed_items, cols = crop_name)
fb  <- tidyr::unnest(para$feed_basket, cols = feeds) |> tidyr::unnest(cols = livestock)
alloc <- tidyr::expand_grid(livetype_code = para$livestock$livetype_code,
                            season_name = para$seasons$season_name,
                            feed_item_code = fi$feed_item_code) |>
  dplyr::left_join(fb, by = c("season_name", "feed_item_code", "livetype_code")) |>
  dplyr::mutate(fraction_as_fed = dplyr::coalesce(as.numeric(allocation), 0) / 100)
```

### F19 (Medium, CONFIRMED): Imports hygiene

`DESCRIPTION:28-41` lists `tidyverse`. Putting a meta-package in Imports is an anti-pattern: it pulls in about 80 packages and CRAN advises against it. `plyr`, `ggplot2` and `rlang` are never used (check NOTE). Loading `plyr` after `dplyr` also masks `summarise`/`mutate` in user sessions. `NAMESPACE:37` has `importFrom(utils, de)`, the interactive data editor, from `R/biomass_calculation.R:13`. `lubridate` is used only for `leap_year`.

Fix:
```
Imports: data.table, dplyr, jsonlite, openxlsx, stringr, tibble, tidyr, tidyselect, utils
```
Use `tidyselect::where` (it currently raises a NOTE), drop `@importFrom utils de`, and replace `lubridate::leap_year` with base R:
```r
y <- as.integer(format(d, "%Y")); leap <- (y %% 4 == 0 & y %% 100 != 0) | y %% 400 == 0
```

### F20 (Medium, CONFIRMED): `globalVariables` misuse

`R/global.R` is a stale list of 250 names that still misses about 250 others (check NOTE). It includes object names that should be arguments (`energy_required`, `feed_basket_quality`, `livestock_productivity`), functions (`all_of`, `starts_with`), `.`, typos (`anaimal_category`), and auto-generated rbind names.

Fix: use `.data$col` / `.env$x` in dplyr verbs, or maintain one generated list. Remove `.`, the functions and the object names. As a side effect, `npk` currently resolves to `datasets::npk` if the column is missing, giving a confusing error instead of "column not found".

### F21 (Medium, CONFIRMED): personal and legacy files in the build

The tarball contains:

- `-ILRIKE-21154.Rhistory`, 26 KB, with lines such as `C:/Users/SOloo.CGIARAD/OneDrive - CGIAR/Documents/...`. That is a personal machine path and working history.
- `R/misc/v37 loop.R`, which calls `pacman::p_load` and sources `R/ghg_emission_v2.R`, a file that does not exist. R ignores subdirectories of `R/` for code, but the file still ships and triggers the portability WARNING.
- `auxilary_info/*.xlsx` (misspelled directory name).

The empty `R/.Rhistory` and the `.DS_Store` and `__MACOSX` files are untracked clutter.

Fix: `git rm` the history files, move `R/misc` to `data-raw/` or `inst/scripts/`, and add to `.Rbuildignore`:
```
^.*\.Rhistory$
^auxilary_info$
^CITATION\.cff$
^R/misc$
\.DS_Store$
^data/__MACOSX$
```

### F22 (Medium, CONFIRMED): inconsistent API

- `land_requirement(feed_basket_quality, energy_required, para)` is the only function that does not take `para` first.
- Naming mixes styles: `combineOutputs`/`filePath`/`oDir`/`baseRun` against `snake_case` elsewhere.
- Module names do not match their outputs: `n_balance` versus the output `nitrogen_balance`, and `land_productivity` returns livestock productivity.
- `ghg_emission(..., ym_prod = F)` uses `F` (25 T/F lints).
- The typo `fetilizer_ghg` is returned alongside the alias `ghg_fertilizer` (`R/ghg_emission.R:606-607`).
- `@return list/dataframe` is untyped.

Fix:

- Add a single `run_cleaned(para, energy_parameters, ghg_parameters, stock_change_parameters)` that returns a classed `cleaned_result` list. The Shiny app and batch scripts should call that.
- Standardise names, and deprecate the old ones with `lifecycle`.
- Document each return structure with `@returns` and a column table.

### F23 (Medium, CONFIRMED): positional indexing and generated names

- `table_10.16$Bo <- table_10.16[,4]` (line 144)
- `table_10.17[,c(1,4)]` (188-194)
- `table_10.21[,c(1,4)]` (239-248)
- `...$emission_factors=="EF4",4]` (262)
- `ghg_burn[..., 5]` (`merge_outputs.R:810`)
- `rename(amount_of_N_applied = V1)` (450) and `rename(n_off_farm_pasture = rbind.cattle_pig_poultry_n_pasture_off_farm..sheep_and_other_n_pasture_off_farm.)` (480)

Any reordering of the parameter JSON silently changes results.

Fix: select by name (`MCFs`, `direct_nitrous_oxide_factor`, `n2o_emissions_from_managed_soils`), and build small frames with `data.frame(anthropogenic_N_input = c(...), amount = c(...))`.

### F24 (Medium, PLAUSIBLE): feed origin encoded in names

`stringr::str_detect(feed, "OFR" | "OFC" | "IP")` appears in about 25 places. `"IP"` matches any feed name containing the uppercase letters `IP`, and a user-edited name loses its classification. `source_type` and `category` already exist in the input.

Fix: add an explicit `feed_origin` field (`on_farm`, `off_farm_roughage`, `off_farm_concentrate`, `imported`), validate it, and derive it once.

### F25 (Medium, CONFIRMED): hardcoded GWPs

`R/merge_outputs.R:693-694` sets `methane <- 28; N2O <- 265` (AR5). These should come from `ghg_parameters`, with AR6 values of 27 (non-fossil CH4) and 273 available, and be reported in the output metadata.

### F26 (Medium, CONFIRMED): `combineOutputs` output contract

The roxygen says "@return saved JSON file" and `@param filePath` says "where the JSON is to be saved". In fact the function writes only a workbook, and `paste0(filePath, ".xlsx")` turns `scenario_output.json` into `scenario_output.json.xlsx` (reproduced). `calculate_differences()` then expects JSON files on disk that nothing in the package writes. A model function writing files also violates the "no side effects by default" guidance.

Fix: return the object only, and add explicit `write_cleaned_json(x, path)` and `write_cleaned_xlsx(x, path)` functions.

### F27 (Medium, CONFIRMED statically): CI workflow

The workflow uses retired or deprecated components: `ubuntu-20.04` (runner image removed in 2025), `r-lib/actions/*@v1`, `actions/checkout@v2`, `actions/cache@v2` (retired) and a focal RSPM URL. It triggers only on `main`/`master`, so the active `cleaned_dev_ps` branch is never checked.

Fix: regenerate with `usethis::use_github_action("check-standard")` (v2 actions, `setup-r-dependencies`), and add `test-coverage` and `pkgdown` workflows.

### F28 (Low, CONFIRMED): plotting functions

`clean_plotting()` and `compare_scenario()` only build lists of titles; they plot nothing, despite the titles "Plot results" and "It plots the change". `clean_plotting` calls `dir.create(oDir)` and never uses the directory. The `else { NA }` branch (`R/plotting.R:225-227`) leaves `title`/`y_title` from the previous column. `compare_scenario` with only the base scenario fails with `arguments imply differing number of rows: 1, 0` (reproduced), because of `1:nrow(scenarios_df)`.

Fix: use a lookup table of labels, `seq_len()`, and remove the directory argument.

### F29 to F32 (Low)

- **F29 `season_length`:** `season_length("2020-03-01", "2020-12-31")` fails with `missing value where TRUE/FALSE needed` (reproduced). Use `as.Date(x)` with `tryFormats` and validate. The leap year should come from the season's span, and the function should state whether the end day is inclusive.
- **F30 `replace_na`:** `tidyr::replace_na(df, as.list(rep(0, ncol(df)-2)))` is a no-op because the list has no names (reproduced). Delete it; the preceding `across(where(is.numeric), ...)` already handles non-finite values.
- **F31 efficiency:** `unnest(para$feed_items)` is recomputed inside livestock × season × feed loops (`land_requirement.R:71`), `n_balance.R:45` and `feed_quality.R:44`. `energy_requirement.R:183-184` uses `rbind` in a loop. At about 0.7 s per run this only matters for batch Monte-Carlo, but it should be hoisted and vectorised (see the F18 sketch). `1:nrow(seasons)` and `1:length(feed_types)` should be `seq_len()`/`seq_along()`.
- **F32 docs hygiene:**
  - `R/data.R:42,67` has `#' #' @keywords datasets`, so the keyword is lost.
  - `@format` blocks end in `...`.
  - There is no `NEWS.md` for v0.7.0 and no `inst/CITATION`; `CITATION.cff` is not build-ignored.
  - `docs/` is gitignored but present and stale (`economics_payback.html`).
  - The DESCRIPTION Title is 155 characters; CRAN wants 65 or fewer.

## Prioritised refactor roadmap

**Quick wins (hours)**
1. Fix the one-line bugs, each with a regression test: F15 (`na.rm`), F02 (SOC biomass), F05 (residue N), F13 (water OFC), F14 (anhydrous ammonia), F16 (rice `if`), F30 (drop the no-op).
2. Hygiene: delete the `.Rhistory` files, move `R/misc` and the non-rda `data/` files to `data-raw/`, extend `.Rbuildignore`, and remove `tidyverse`, `plyr`, `ggplot2`, `rlang` and `utils::de` from Imports.
3. Run `devtools::document()`, fix the `data.R` typos, and add `NEWS.md` and `Config/testthat/edition: 3`.
4. Regenerate CI from `usethis::use_github_action("check-standard")` and include the dev branch.

**Short term (days)**
5. Build one canonical `inst/extdata/example_scenario.json` that runs the full pipeline. Regenerate the `.rda` datasets from it via `data-raw/`, and turn examples and the overview vignette into runnable code.
6. Add a golden snapshot test of about 40 headline indicators on that example, plus hand-calculated unit fixtures per module. Target at least 70 % line coverage with covr.
7. Remove the dynamic scoping from `n_balance` and `ghg_emission` (F03), with explicit required arguments and lifecycle deprecation.
8. Add `validate_para()` (F04) plus a JSON Schema in `inst/schema/` checked with `jsonvalidate`. Fail on unknown categories and NA in required fields.

**Medium term (weeks)**
9. Resolve the domain PLAUSIBLE items (F06 burning, F07 N retention, F17 leaching) against the Excel reference model, and record the decisions in NEWS.
10. Replace name-string semantics (`"OFR"`/`"OFC"`/`"IP"`, exact `livetype_desc` strings) with explicit coded fields and lookup tables in the parameter JSON. Select parameters by name, never by position (F23, F24). Parameterise the GWPs (F25).
11. Split `combineOutputs` (1.3k lines) into `summarise_*()` functions that return data and separate `write_*()` functions. Replace the silent `tryCatch`/0 fallbacks with a schema check (F08, F26).
12. Add a single `run_cleaned()` entry point that returns a classed result, standardise naming to snake_case, and vectorise the loop-based modules with joins (F18, F22, F31).

## Done well

- The README and four vignettes (input contract, output contract, developer guide) are a serious attempt at documenting the data contract, and `_pkgdown.yml` is organised by pipeline stage.
- `soil_organic_carbon()` has a good lookup helper (`lookup_soc_factor`) that fails loudly with the list of valid keys. That is the pattern the rest of the package should copy.
- Model functions do not modify their inputs: `para` was byte-identical after a full run, and there is no `:=` or `setwd()` in `R/`.
- The code is ASCII-clean, namespace imports are mostly explicit (`dplyr::`, `tidyr::`), and IPCC equation numbers are cited inline, which makes domain review possible.
- Issue templates, a code of conduct, `CITATION.cff` and a spelling test show good project-governance intent.
