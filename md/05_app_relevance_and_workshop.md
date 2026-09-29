# 05 - App relevance calibration and workshop test plan (iCLEANED web app)

**Scope.** This report checks the four expert reviews against what the iCLEANED Shiny app actually does:

- 01_climate_ghg.md, 02_livestock.md, 03_landuse.md and 04_package_code.md, all reviewing `cleaned` v0.7.0 at `staging` @ 800d53a.
- The app source is read-only at `CIAT/icleaned` @ fb8498c (`main` @ fb8498c, 2026-08-24).
- The user guide is `iCLEANED_user_process_guide.txt`.

**Method.** I did not touch the live site. I emulated the app's simulation code path line for line (`R/10_mod_board_simulation_server.R:176-300`, including its `environment()` hack and its attached libraries) in the scratchpad, and ran it against three package builds:

- `4c44dc9`, the renv.lock pin.
- `origin/cleaned_v0.6.0`, the fallback in `global.R`.
- `4ae5505`, the current head of the fork branch. Its `R/` and `inst/` are identical to `staging` 800d53a, i.e. v0.7.0 code.

Inputs were the app's own shipped study objects (`data/shared_folder/study_objects/Study_1.json` and `Study_2.json`). These are the "Shared Examples" that participants will clone. I then ran input variants that reproduce what a user can do in the UI. The comparison view was emulated with `calculate_differences()` on the app-written JSON.

Scripts are in the session scratchpad (`/private/tmp/claude-501/.../scratchpad/`):

- `app_run.R`: exact emulator of the app pipeline.
- `variant.R`: runs one input edit and prints the headline outputs.
- `diffs.R`: comparison indicators.

The scratchpad worktrees are `pkg_4c44`, `pkg_v06` and `pkg_4ae5`, with matching libraries `lib4c44`, `libv06` and `lib4ae5`.

---

## 1. Deployed-version finding

| Evidence | What it shows |
|---|---|
| `renv.lock:717-727`: `cleaned` "Version 0.6.0", RemoteRepo `M-Emmanuel/cleaned-staging-v2`, RemoteRef `feature/correct-functions`, RemoteSha `4c44dc9` | This is a snapshot record. It was last committed on 2026-02-27 ("update renv state", CIAT/icleaned 2b31647) and not touched since. There is no `renv/activate.R` or `.Rprofile` in the repo, so the lock file is **not enforced** at runtime. |
| `global.R:15-18` falls back to `remotes::install_github("CIAT/cleaned@cleaned_v0.6.0")` only if `cleaned` is not installed | This fallback is **not viable**. v0.6.0 crashes on every study object the current app writes: `Column 'feed_type_name' doesn't exist` (reproduced on Study_1 and Study_2). If the live app runs simulations at all, it is not on v0.6.0. |
| App `main` includes e9762e1 (2026-08-17, "replace t unit to kg for ghg emissions"). `data/iCLEANED - Graphs Information.xlsx` now lists `ghg_emission_kg_co2_eq_per_kg_fpcm/_meat/_protein` | These indicator names exist only in package ≥ 56f09d3 (2026-08-17, "Rename GHG product intensity outputs to kg CO2e units"). That commit is in fork head 4ae5505 (2026-08-18), which equals v0.7.0 code. Under 4c44, `calculate_differences()` emits `ghg_emission_t_co2_eq_per_kg_*` instead, so those three comparison plots would be empty (verified with `setdiff()` on the 4c44 output). |
| No Dockerfile, CI deploy or manifest. `.gitignore` lists `/rsconnect` and `cmds server.txt` | Deployment is manual: rsconnect or an install on the server. Whatever `cleaned` was in the deployer's library is what runs. |
| 4c44 is an ancestor of staging (57 commits behind). 4ae5505 has an identical R/ and inst/ to 800d53a | The review findings for v0.7.0 apply one-to-one if the server runs the fork head. |

**Conclusion.**

- **Most likely running:** v0.7.0-equivalent code, i.e. fork head 4ae5505. Confidence is moderate, about 65%. The app code of 24 Aug 2026 was built against it, and the developer renamed the outputs in both repos on the same day.
- **Plausible alternative:** 4c44dc9, about 30%, if the server was last rebuilt around the Feb 2026 renv snapshot and only the app code was pushed afterwards.
- **v0.6.0:** effectively ruled out (under 5%).

The two candidates give very different comparison-screen numbers (NEW-02 and NEW-03 below). **Workshop test T0 settles this in two minutes on the live site.** Verdicts below are given for v0.7.0/4ae5505, with a separate column wherever 4c44 differs.

---

## 2. App → package call map

**Study object construction.** This is entirely app-side. The package's `example_input.json` is never used.

- `R/30_mod_scenario_server.R` autosaves the study object as JSON on every edit (L2515-2650, `write(toJSON(...))` at L2648).
- The object is built from these tabs:
  - **Farm tab.** Numeric inputs, with the region and climate pickers `climate_zone_2` (L2911), the soil parameters, the SOC dropdowns (IPCC factors copied as `*_ipcc`), the seasons table, the fertilizer table and the waste inputs.
  - **Livestock tab.** A row is added from the `lkp_livetype` picker (L983-1036).
  - **Feed production tab.** A row is added from the `lkp_feeditem` and `lkp_crops` pickers (L1432-1500). `dry_yield`/`residue_dry_yield` are taken **directly from `lkp_crops`**, so the missing harvest-index derivation (reviewer D-01) is not an app problem.
  - **Crop inputs table.** Fertiliser kg/ha and `fraction_as_fertilizer`.
  - **Livestock feeding tab.** % allocation per season, which is saved as `feed_basket`.
- The JSON uses the code's own column names: `crop_name`, `fat_milkcontent`, `cp_lys_pregnancy`, `cp_lys_growth`, `lw_gain_piglets`, `proportion_growth_piglets_milk`, `n_manure_content`, `dry_yield`, `residue_dry_yield`, and `dm_content` in %. So the "shipped examples don't run" findings do not affect the app.

**Parameter JSONs.** `global.R:59-70` reads `ghg_parameters.json`, `stock_change_parameters.json` and `energy_parameters.json` from the **installed package's** `inst/extdata` via `system.file()`. The `data/*.rda` and `data/*.json` copies are never used.

**Run Scenario.** `R/10_mod_board_simulation_server.R`:

1. `para <- fromJSON(study_object, flatten=TRUE)` (L180).
2. `environment(n_balance|ghg_emission|combineOutputs) <- environment()` (L191-193). This is the app-side workaround for the package's dynamic scoping (PK F03).
3. `feed_quality(para)` → `energy_requirement(para, fbq, energy_parameters)` → `land_requirement(fbq, er, para)` → `soil_health(para, lr)` → `water_requirement(para, lr)` → `n_balance(para, lr, soil_erosion=)` → `land_productivity(para, er)` → `biomass_calculation(para, lr)` → `soil_organic_carbon(para, stock_change_para, lr, biomass)` → `ghg_emission(para, er, ghg_ipcc_data, lr, nb)` (L196-249).
4. **App-side check:** a warning appears if `dmi_tot/365 > 0.04*body_weight` (L252-273). See NEW-04: it compares **herd** DMI with **one animal's** BW.
5. `combineOutputs(..., filePath, primary_excel="www/ReadMe.xlsx")` (L281). Its `json_output`, `on_farm_table`, `nitrogen_balance`, `land_required` and `water_use_per_feed_item` are saved (L296-331).

**Dashboard (simulation).** There are four plots in `R/graphs.R`:

- GHG `t_CO2e_per_ha` by source.
- N balance per feed (`nbalance_kg_n_total`).
- Land per feed and season (`area_feed_total`).
- Water share per feed (%).

The downloadable Excel has all the sheets.

**Compare.** `R/20_mod_board_comparison_server.R:151-178` runs `calculate_differences(outfile, <scenario>.json...)`, then `clean_plotting()` (absolute values) and `compare_scenario()` (relative % against the chosen base). The 44 indicators are listed in `Graphs Information.xlsx` rows 5-48.

**App-side defaults and validation that matter.**

| Location | Behaviour | Effect on findings |
|---|---|---|
| `30_mod_scenario_server.R:1449-1450` | A new feed row gets `main_product_removal = 0` and `residue_removal = 0` | Triggers LU-01 by default: 0 ha for every newly added feed until the user edits it. |
| `:1441`, `:2007` | `source_type` defaults to "Main". The options are Main / Residue / **Purchased** | "Purchased" always gives 0 ha. The DB crop "Purchased" has `dry_yield = 0` (`lkp_crops`), so "Concentrate (commercial)" gets 0 ha even as "Main". |
| `:1446-1447` | `slope_desc` defaults to `lkp_slope[1]` ("Flat (0-5%)") and `slope_length` to 15 | Guards SE-01 for blank slopes. The option "Non-agricultural (all slope categories)" is still selectable and gives LS = NA, i.e. 0 erosion. |
| `helpers_shiny.R:191-210` | A blank numeric cell becomes 0, not NA | NA propagation is avoided, but zeros feed silent-zero paths (LU-01, NEW-01). |
| `:1010-1012` | New livestock: `body_weight_weaning = 0`, `body_weight_year_one = 0`, `adult_weight = 0` (hard-coded, although `lkp_livetype` has 10/30 and 350/600) | Triggers H-02 and **NEW-01**. |
| `:987` | Manure systems default to `lkp_manureman[1]` = "Pasture / range / paddock". Both that label **and** "Pasture/Range/Paddock" are offered | Triggers CL F07 (MCF lookup miss). |
| `:783-784`, `30_mod_scenario_init.R:334-341` | Fertiliser %N is auto-filled for Urea 46, DAP 18, AN 34.5, AS 21, N-solutions 32 and Ammonia 82. **NPK defaults to 0 %N**. There is no CAN | Mostly guards N-04 and CL F10, but not NPK. |
| `:1880-1930` | Fertiliser kg/ha columns are editable only for fertilisers added in the Farm tab | Guards N-04 ("fertiliser not in table"). |
| `:2365` | Alert if Σ `fraction_as_fertilizer` > 1 | Guards N-05 (advisory only). |
| `30_mod_scenario_validation.R` and `:1176-1290` | Range and sum alerts for area, waste, manure, time fractions, residue fractions and intercrop | **All alerts are advisory. Only duplicate feed or crop names block saving (`:2527-2532`). Nothing blocks Run.** |
| `40_mod_params_db_server.R:622-640` | `lkp_livetype` names and IPCC categories are locked, with no add or delete | Guards the "unknown livestock label → 0" part of PK F04. Slope, manure and feed tables in cloned DBs remain editable. |
| `validation.R:66` | "Soil depth (m)"; the guide says m; the shared examples use 0.2 | The unit is consistent with the code (metres). Only `non_negative` is checked. |

---

## 3. New app-relevant issues (not in the four reports)

| ID | Versions | Issue | Evidence | What a participant sees |
|---|---|---|---|---|
| NEW-01 | 4c44 and v0.7.0 | Cattle growth energy is silently 0 when **mature weight = 0**. That is the app default for every newly added animal. | App `30_mod_scenario_server.R:1012` (`adult_weight = 0`). Pkg `energy_requirement.R:93-95` uses `body_weight/(C*adult_weight)`, which gives Inf, and `:102` sets it to 0. Study_1 and Study_2 heifers ship with `adult_weight = 0`: `er_growth = 0` for 125 and 200 kg/yr gain. Setting 600 gives 4.31 MJ/d (about 17% of the heifer's NE). | No error. Growth energy is missing from the Excel energy sheets. Energy-limited DMI, GE and CH4 for growing cattle are underestimated. The effect is masked when CP binds. |
| NEW-02 | **4c44 only** (regression e517787 of 2026-01-07, fixed c5734c8 of 2026-03-17) | **Manure CH4 is always 0.** `climate_zone <- para[["climate"]]` (the app writes `climate_zone_2`), and `Table 10.17$climate` is an ambiguous partial match, so NULL. The MCF table ends up with 0 rows, MCF = NA, and `sum(na.rm=TRUE)` gives 0. | `pkg_4c44/R/ghg_emission.R:146-148`. The Study_1 and Study_2 runs give Manure-Methane = 0. It is still 0 after setting `para$climate` and fixing the labels. | The "Liv. Manure" bar is N2O only. Manure-management scenarios such as covered storage or biogas show no CH4 change. |
| NEW-03 | **4c44 only** (fixed in v0.7.0) | The comparison "GHG Emissions per Year (t CO2e)" is `sum(ghg_balance$value)`, which adds kg CH4 + kg N2O + kg CO2e. `carbon_stock_change_t_co2eq_per_meat` divides by *land per kg meat*. | `pkg_4c44/R/differences.R:89, :107`. Study_1 shows **196.1** where the true value is 5.12 t CO2e. Study_2 shows **15,745** where the true value is 34.9. Under v0.7.0 the same studies give 5.12 and 34.92. | Totals, per-ha and per-kg GHG values in the Compare tab are wrong by 1–3 orders of magnitude. The three GHG-intensity plots are blank, because of the indicator-name mismatch in §1. |
| NEW-04 | app | The ">4% of body weight" DMI warning compares **herd** DMI with a **single animal's** BW. | `10_mod_board_simulation_server.R:253-258` (`dmi_tot` is herd total, from `energy_requirement.R:140` × `herd_composition`). Study_1 with 3 cows at 1.86% BW each triggers the warning. | False warnings for any class with more than about 2 head. The true over-intake cases (H-01) are indistinguishable from herd-size artefacts. |
| NEW-05 | app | Unit labels are misleading. The simulation GHG plot's unit is the literal string "ghg_emission" (Graphs Info row 1). Land is "ha /year". "ha/kg FPCM" is really ha/t (`differences.R` ×1000). "t CO2eq/kg FPCM" for carbon stock is really kg/kg. Water "m³" is mm·ha (W-01). | `data/iCLEANED - Graphs Information.xlsx` sheet 2. | Participants will copy these units into slides. |
| NEW-06 | app ↔ pkg | Validation is advisory, and Run never re-validates. Time fractions not summing to 1, removal fractions of 0, Σ manure fraction > 1 and so on all run silently. | §2 table | Results are produced from inputs the UI itself flagged as invalid. |

---

## 4. Per-finding verdicts (all Critical and High, deduplicated)

**Verdict key.**

- **AFFECTS-APP:** the code is in the deployed version and the app's input path triggers it.
- **APP-GUARDED:** the app's own JSON, defaults or UI prevent it.
- **NOT-IN-DEPLOYED-VERSION**
- **UNCLEAR**
- **NO-RUNTIME-EFFECT:** development or process findings that are not user-visible. I added this fifth label so that they are not misclassified.

The primary verdict assumes v0.7.0/4ae5505. The "4c44" column states where that version differs. v0.6.0 contains essentially all of the model code (grep-verified), but it cannot run app inputs, so it is omitted as a column.

**Source of the per-finding evidence.** The "Evidence" column cites the package code at 4c44 (`pkg_4c44/R/...`; v0.7.0 line numbers are in the original reports). Unless stated otherwise, numbers come from the app emulator run on Study_1 (S1) and Study_2 (S2).

| # | IDs (report) | Sev | Verdict | 4c44 | Evidence (package @4c44 · app) | Participant sees |
|---|---|---|---|---|---|---|
| 1 | LV C-01 = CL F02 (NE divided by ME) | Crit | AFFECTS-APP | same | `energy_requirement.R:79-140, 170`; every run | Energy-limited DMI, GE, CH4, land and N are ~35–45% low. It is masked where CP binds: S1 cows dmiE 3,380 vs dmiCP 3,823 kg/yr. |
| 2 | LV C-02 = PK F07 = CL F04 (N retention used as a fraction and /365²) | Crit | AFFECTS-APP | same | `ghg_emission.R:193, 196`. S1 cow Nex 65.5 kg N/yr, where (N_in − N_ret)·365 = 53.1 (+23%). Heifers 54.1 vs 44.2 (+22%). | Manure N2O and PRP N2O about 20–30% high. |
| 3 | LV H-01 = LU LU-02 = CL F19 (DMI = max(E, CP), uncapped) | High | AFFECTS-APP (partly warned) | same | `energy_requirement.R:174`. S2 (barley straw at the DB's CP 0.3%): cow 50.5 kg DM/d (8.4% BW), heifer 5.9% BW. Raising straw CP to 4% cuts DMI, land and GHG by 34%. | The ">4% BW" warning (unreliable, NEW-04). Every downstream indicator is inflated. |
| 4 | LV H-02 (small-ruminant weaning / 1-yr weights default 0) | High | AFFECTS-APP | same | `energy_requirement.R:96-101, 109`. The app hard-codes 0 (`scenario_server:1010-1011`) although `lkp_livetype` has 10/30. Goat kids NEg 0.27 → 0.64 MJ/d when set to 10/30. Doe NEl is 0. | No visible change while CP binds, which is typical: goat kids hit 27.8% BW DMI (CP-limited via `cp_lys_growth` 0.45). It matters on energy-limited diets. |
| 5 | LV H-03 = LU D-01 = PK F01 (+CL F22 Low) (column contract / examples don't run) | High/Crit | **APP-GUARDED** | same | The app writes the code's names (Study_1 keys). The emulator runs cleanly on 4c44 and v0.7.0. `dry_yield` comes from `lkp_crops`. | Nothing. This is a package and batch-user problem only. |
| 6 | LV H-04 (growth N retention mixes MJ/d and kg/yr) | High | AFFECTS-APP (minor) | same | `ghg_emission.R:193` growth branch | Masked by #2. Also, with NEW-01 `er_growth = 0`, so the term defaults to 268 g/kg. |
| 7 | LV H-05 (two manure-N pathways) | High | AFFECTS-APP | same | `energy_requirement.R:203-211` (DMI × 0.365 × 0.029) vs GHG Nex. S1 N-balance collected manure N is about 67 kg vs GHG Nex 119.6 kg. | The N balance and N2O are inconsistent. Only visible in the Excel. |
| 8 | LU LU-01 (+PK F04) (Inf/NaN → 0 ha) | Crit | **AFFECTS-APP (strong)** | same | `land_requirement.R:99-102, 120-121`. App defaults removal = 0 (`:1449-1450`). "Purchased" gives 0 ha. The DB "Purchased" crop has yield 0. S1: 679 kg DM of concentrate → 0 ha. S2: barley straw residue_removal 0 → farm land 17.3 → 8.1 ha while it is still fed. | Land, erosion, water, N, SOC and per-kg footprints silently drop feeds. Purchased concentrates are footprint-free. |
| 9 | LU N-01 (+PK F17) (leaching per-ha added to totals) | Crit | AFFECTS-APP | same | `nitrogen_balance.R:256-259`. S1 concentrate (0 ha) still gets 6.48 kg N leached. | N balance per feed (dashboard plot) and N totals are wrong. |
| 10 | LU N-02 (+PK F17) (`0.021*(P-3.9)`) | High | AFFECTS-APP | same | `nitrogen_balance.R:256`. Clay < 35% in both shared examples (23%). | Leaching about 3.8 percentage points high. |
| 11 | LU N-03 (scalar `ifelse` drops grazing manure N) | High | AFFECTS-APP | **NOT-IN-DEPLOYED-VERSION** (4c44 vectorised, `nitrogen_balance.R:245`) | Regression in v0.7.0 (`:234`). S1 with 50% on-farm grazing: grazing-manure N 1.65/17.6/6.0/11.9 kg per feed (4c44) vs **0 for all** (v0.7.0). | Grazing systems lose manure N inputs, so the N balance is more negative. |
| 12 | LU N-04 = CL F10 (fertiliser N 0 if type or %N missing; no urea CO2/CAN) | High | AFFECTS-APP (narrowed) | same | `nitrogen_balance.R:111`. The app auto-fills %N except NPK = 0 (`:783-784`). S1 NPK set to 0%: soil N2O → 0 while manufacture stays at 36.8 kg CO2e. CAN is not offered. Urea CO2 is absent. | NPK users who skip the %N cell get no soil N2O. |
| 13 | LU N-05 (manure N multiplied across feeds) | High | **APP-GUARDED** (advisory) | same | Alert at Σ > 1 (`:2365`). With Σ ≤ 1 the allocation is correct (S1: 0.15/0.2/0.2 of 67 kg). | Only if a user ignores the red alert. |
| 14 | LU N-06 ("NUE" = nout/nin; mining > 0.9) | High | AFFECTS-APP | same | `nitrogen_balance.R:263, 286-295`. S1 and S2: **100% area "mining"**, including groundnut residue with a *positive* balance (+0.74 kg). | The "Area Mining/Leaching %" comparison plots are meaningless and contradict the guide (§5). |
| 15 | LU SE-01 (LS NA → erosion 0) | High | AFFECTS-APP (narrow) | same | `soil_health.R:54-78`. Defaults guard blanks, but the "Non-agricultural (all slope categories)" option (lkp_slope row 5) gives erosion 0.000 (S1 variant, vs 0.418 t). | Erosion silently 0. |
| 16 | LU SE-02 (unsourced R formula) | High | AFFECTS-APP | same | `soil_health.R:28`. S1 R = 81.7. | Erosion probably 5–10× low (S1: 0.59 t/ha/yr on "Hilly 5-20%"). |
| 17 | LU SE-04 (erosion summary rows shifted) | High | AFFECTS-APP (Excel only) | same | `merge_outputs.R:327, 336`. The Compare tab reads the "total" row (`differences.R:82`; v0.7.0 sums `soil_loss_plot`), so dashboard values are right. | Mislabelled on-farm/off-farm rows in the downloaded Excel. |
| 18 | LU W-01 (mm·ha labelled m³) | High | AFFECTS-APP | same | `water_requirement.R:49, 57`. S1 total 733 "m³" on 0.705 ha = 1,039 "m³/ha", which equals Kc·ET0 in mm. The true volume is ×10. | Water per kg FPCM is 0.32 "m³/kg" vs the guide benchmark of 1.2–3.1. |
| 19 | LU W-02 (annual ET0 × mean Kc, no season/green-blue/drinking) | High | AFFECTS-APP | same | `water_requirement.R:45-49`. S1 "precipitation used for feed" 94%. | Water indicators are not interpretable as water footprints. |
| 20 | LU S-01 = PK F02 (tree SOC always 0) | High/Crit | AFFECTS-APP (when trees entered) | same | `soc.R:130` (4c44) / `:234` (v0.7.0). The app exposes tree columns. `lkp_crops` defaults are mostly 0. | Agroforestry scenarios show no soil-C benefit. |
| 21 | LU S-02 + S-03 = CL F01 (measured SOC as SOCref, perpetual loss; depth) | Crit | **AFFECTS-APP (strong)** | same | `soc.R:39, 49, 63`. S1 (depth 0.2 m, 44 g C/kg): **−4.5 t CO2/yr = −6.4 t CO2/ha/yr**, about 88% of the herd's 5.1 t CO2e. S2: −32.4 t CO2/yr. Depth 0.2 → 0.3 m adds 50% more "loss" with no management change. | The "Carbon stock change" and "Carbon balance" plots are dominated by a spurious loss. |
| 22 | LU S-03 (depth unit) | High | **APP-GUARDED** (residual risk) | same | The UI label "Soil depth (m)" and the guide both say m, consistent with the code. There is only a ≥ 0 check: typing 20 (cm) gives **−445 t CO2/yr**. | Only if a user enters cm. |
| 23 | LU S-04 (+CL F17) (grassland "Medium" = 1.5) | High | **APP-GUARDED** | same | UI management options come from `lkp_grasslandman` (no "Medium"). Implevel "Medium" = 1.0. | Nothing, unless a cloned DB adds "Medium". |
| 24 | LU C-01 (% change sign/zero) | High | AFFECTS-APP | same | `compare_scenario.R:49-150` | The relative view flips sign for negative N balance and SOC, and shows 0% for zero baselines (0-ha feeds, 0 manure CH4). |
| 25 | LU C-03 (no uncertainty) | High | AFFECTS-APP (design) | same | absence | Point values with no range. |
| 26 | PK F03 (dynamic scoping) | Crit | **APP-GUARDED** (workaround) | worse: 4c44 `n_balance` uses a free `energy_required` (L122) | `10_mod_board_simulation_server.R:191-193` | Nothing now; fragile. |
| 27 | PK F04 (bad inputs → silent 0) | Crit | AFFECTS-APP (partly guarded) | same | Livestock labels are locked (guarded). Zeros are not: NEW-01, LU-01 and blank cells → 0. | Silent zeros, as in #8 and NEW-01. |
| 28 | PK F05 (+CL F11) (off-farm residue N = fertiliser N) | High | AFFECTS-APP (when OFC/IP feeds are used) | same | `ghg_emission.R:336-338`. 6 of 14 shipped DBs have "…OFC/…IP" feeds. Test: 12.81 kg N appears as both synthetic and residue N for an OFC feed. | Off-farm concentrate soil N2O doubled. |
| 29 | PK F06 = CL F03 (burning: CO2 + NOx×GWP_N2O) | Crit | **AFFECTS-APP (strong)** | same | `merge_outputs.R:406` (4c44) / `:810-812`. S2 (rice straw burnt 0.4): **13.8 t CO2e = 40% of 34.9 t**. Burnt 0 gives 22.1 t. The IPCC-consistent value for the same mass is ≈ 0.58 t. | Burning dominates totals wherever residues are burnt. |
| 30 | PK F08 (tryCatch / fallback zeros in combineOutputs) | High | UNCLEAR (latent) | NOT-IN-DEPLOYED-VERSION (0 `tryCatch` at 4c44) | No schema drift was observed with app JSON. | Nothing observed. It would hide future app/package mismatches. |
| 31 | PK F09 (CI red) | High | NO-RUNTIME-EFFECT | – | – | – |
| 32 | PK F10 (data/ copies diverge) | High | **APP-GUARDED** | same | The app reads `inst/extdata` via `system.file` (`global.R:59-70`). | – |
| 33 | PK F11 (docs stale) | High | NO-RUNTIME-EFFECT | – | – | – |
| 34 | PK F12 (no tests) | High | NO-RUNTIME-EFFECT | – | It explains how the NEW-02 and N-03 regressions shipped. | – |
| 35 | CL F05 (manure applied to soils: no N2O) | High | AFFECTS-APP | same | `ghg_emission.R:310, 322` (`manure_produced` is not in the app JSON). `merge_outputs.R:390` omits the row. S1: about 67 kg manure N applied, 0 N2O (≈ 0.28 t CO2e ≈ 5% missing). | Manure-to-crop recycling scenarios show no N2O. |
| 36 | CL F06 (off-farm grazing N2O dropped) | High | AFFECTS-APP | same | `ghg_emission.R:441-452`; not aggregated. S1 with 50% off-farm grazing: total **falls** 5.12 → 4.79 t. | "Send animals to communal grazing" looks like mitigation. |
| 37 | CL F07 (manure-label mismatch → MCF NA → CH4 0) | High | **AFFECTS-APP (strong)** | masked by NEW-02 (CH4 is 0 anyway) | The app's default label "Pasture / range / paddock" is not an MCF key. v0.7.0 S1: manure CH4 **0**. Relabelled to "Pasture/Range/Paddock": 12.5 kg CH4 (+0.35 t CO2e). | Manure CH4 is 0 for any animal with the default label in *any* location, including time = 0 locations. |
| 38 | CL F08 (duplicate 10.21 keys) | High | **APP-GUARDED** | same | The app's manure options do not include "Liquid/Slurry" or "Burned for fuel or as waste". The slurry test gave 2 rows for 2 animals (no duplication). | – |
| 39 | CL F09 (2006 EF3PRP 0.02 vs 2019) | High | AFFECTS-APP | same | JSON `table_11.1_&_table_11.3` (4c44 and v0.7.0). S1 with 50% on-farm grazing: soil N2O 0.06 → 1.94 kg. | PRP N2O about 5× high relative to the 2019 factors. |

**Counts (39 deduplicated rows from 49 Critical/High findings; v0.7.0 assumption).**

| Verdict | Count |
|---|---|
| AFFECTS-APP | 28 |
| APP-GUARDED | 7 (#5, 13, 22, 23, 26, 32, 38) |
| UNCLEAR | 1 (#30) |
| NO-RUNTIME-EFFECT | 3 (#31, 33, 34) |
| NOT-IN-DEPLOYED-VERSION | 0 (this becomes 2, #11 and #30, if 4c44 is deployed) |

On 4c44, NEW-02 and NEW-03 are added.

**Calibration summary: where the reviewers overstated relative to the app.**

- Everything about the shipped examples or column names not running (LV H-03, LU D-01, PK F01, CL F22).
- `data/` divergence (PK F10).
- Dynamic scoping (PK F03, worked around by the app).
- Grassland "Medium" (S-04).
- Duplicate 10.21 keys (CL F08).
- Depth units (S-03, which the app labels in metres).
- Fertiliser-type omissions (N-04), which are mostly guarded; the exceptions are NPK and CAN.

Conversely, the app **amplifies** LU-01, H-02 and CL F07 through its defaults, and adds NEW-01 to NEW-06.

---

## 5. User guide vs code: contradictions

| # | Guide claim (section) | Code reality (deployed) | Severity |
|---|---|---|---|
| G1 | §1 Fig 3/Fig 4: dimensions include **Economics** / "VOP/GP" | There are no economics outputs in the package or the app (`economics_payback` was removed; PK F32). | Misleading scope |
| G2 | §2.2.3: energy requirements are "mainly based on NRC 1998 (pigs), 2001 (cattle & buffalo), 2007 (sheep/goats); McDonald 1985" | Ruminants use **IPCC 2006 Tier 2 NE equations 10.3–10.13** (`energy_requirement.R:79-128`), divided by ME (#1). Only the pig lactation term is NRC. NRC-style ME values in `lkp_livetype` (`me_*`) are unused (LV M-02). | High |
| G3 | §5.1: GHG are "Tier 2 results" and include "CO2 from ... burning of crop residues" | Enteric is Tier 2. Manure CH4 is 0 by default (#37 / NEW-02). Soils use Tier 1 2006 EFs mixed with 2019 manure tables (#39). Off-farm grazing N2O and manure-applied N2O are omitted (#35, #36). **IPCC excludes biogenic burning CO2**; the guide advertises the error (#29). | High |
| G4 | §5.1: GWP 28/265 | Matches code (`merge_outputs.R:365-366`, AR5). **Consistent** (no AR6 option). | – |
| G5 | §3.3 3.1: "% mining = share of fields with **negative N balance**; % leaching = positive balance (> 150 kg N/ha undesirable)" | Code: mining = `nout/nin > 0.9`, leaching = `< 0.5` (`nitrogen_balance.R:286-295`), with losses in `nout` (#14). S1 has 100% mining although one feed's balance is positive. | High |
| G6 | §4.1: water "percentage of water used to produce a kg of milk, meat, protein" | The code reports a volume per kg (labelled m³, actually mm·ha, so 10× low, #18). No green/blue split, no season length (#19). | High |
| G7 | §1.3: "Area per milk unit (**ha/kg FPCM**)" | The code multiplies by 1000, so the value is **ha/t**. The Graphs Info label also says ha/kg. The §3.4 benchmark is in ha/t, so the numbers match the benchmark but not the label (NEW-05). | Medium |
| G8 | §2.2.2: "Soil N ... in g/kg" | Mineralisation uses `soil_n*20*bulk*10`, which is 10× low for g/kg (LU N-07). | Medium |
| G9 | §2.2.3: "all time not spent in stable, enclosure or on-farm grazing is spent grazing off-farm" | Nothing infers this. The code uses the entered fractions as they are. The app only warns if they don't sum to 1 (non-blocking). | Medium |
| G10 | §2.2.2 / §2.2.4: stock-change and grassland factors are "IPCC default values" | The factors are IPCC, but the **method** is not: measured SOC is used as SOCref and F is applied every year (#21). Grassland SOC is fixed at 40 t C. There is no LUC even though `grassland_toarable`/`arable_tograssland` are inputs (CL F17). | High |
| G11 | §2.2.3: "Adult body weight" and weaning weights are inputs for energy | They are inputs, but the app pre-fills them with **0** (NEW-01, #4), silently removing growth or lactation energy. The guide does not warn. | High |
| G12 | §2.2.4 i: Source type "purchased (i.e., concentrate)" | Purchased feeds get **0 ha** and no soil, water or fertiliser footprint (#8). The guide's §3.3 1.2 describes off-farm/imported land categories, which are only populated by name suffixes "OFR/OFC/IP" (LU-04). | High |
| G13 | §3.3 2.1: AME = 2500 kcal/day | 4c44: 2500 (consistent). v0.7.0 Compare tab: **2100** (`differences.R:196`) while the Excel uses 2500 (LV L-07). S1 AME days are 876 vs 1,043 depending on version. | Low |
| G14 | §3.2.4: % change = (S − B)/B × 100 | Same as the code, but wrong for negative baselines (#24). The guide should say "use absolute differences for N balance and C stock". | Medium |
| G15 | §3.3 1.4/1.5: DM requirement and feed per kg FPCM "Lower values indicate better conversion" | DMI = max(energy, CP) (#3). Low-CP feeds *raise* DM demand and land, which inverts the interpretation. | High |
| G16 | §3.3: "users should focus on relative changes" | Reasonable, but several errors are **not** constant across scenarios: burning share, zero-land feeds, CP-limited DMI, and off-farm grazing. So relative changes are biased as well. | – |
| G17 | §3.4 benchmarks | These have no sources or years. There are internal inconsistencies: East Africa semi-intensive dairy mean 2,147.8 < min 2,244.8; West Africa goat intensive mean 0.09 > max 0.08; there are typos ("`1258", "sss", "0. 43", "Regionlal"). The benchmarks are LCA values (usually allocated, cradle-to-farm-gate, with LUC or energy in some). iCLEANED's intensities are **unallocated** (100% of emissions go to milk and again to meat; LU-06, CL F18) and exclude energy, transport and LUC. So they are **not like-for-like**. Water benchmarks (m³/kg) cannot be compared with the 10×-low mm·ha values. Under 4c44 the GHG per kg values are off by orders of magnitude (NEW-03). | High for the workshop |
| G18 | §2.2.2 fertiliser: "% N added automatically except NPK" | This matches the app, but the app lets NPK stay at 0% with no warning (#12). CAN, the dominant East African top-dressing, is not offered. | Medium |
| G19 | §3.3 3.1: erosion in "t soil/ha/year" | The R formula is unsourced and gives low values (#16). A "Non-agricultural" slope gives 0 (#15). | Medium |

---

## 6. Workshop test plan

Use the two **Shared Examples** so that everyone starts from the same state:

- **Study_1 "Rungwe":** 1 improved cow + 2 improved heifers, zero-grazed, 0.7 ha.
- **Study_2 "Lao PDR":** 1 cow + 1 heifer on barley and rice straw.

Participants clone each study, change **one** thing, save as a new scenario, run, then compare against the original (base = original) and against None.

The expected values below are what the deployed code produces in my emulator (v0.7.0 unless noted; 4c44 values in brackets where they differ). The plausible ranges are independent references.

| T | Scenario (UI steps) | Expected app output | Plausible / reference | Exposes |
|---|---|---|---|---|
| **T0** (facilitators, before the workshop) | Clone Study_1 and Study_2, run both, Compare, base = None, and look at "GHG Emissions per Year" | **5.12 and 34.9 t CO2e** means v0.7.0. **196 and 15,745** with blank GHG-per-FPCM plots means 4c44. | Real totals are 5.1 and 34.9 t. | Version fingerprint (§1, NEW-03) |
| T1 | Study_1 → Livestock tab: change the three non-stable manure systems from "Pasture / range / paddock" to "Pasture/Range/Paddock" | Manure CH4 0 → about 12.5 kg CH4 (+0.35 t CO2e; "Liv. Manure" bar rises). Under 4c44 it stays 0. | Manure CH4 from solid-stored dairy manure should be > 0 (IPCC 2019 Tier 2 with Africa Bo and MCF). | CL F07, NEW-02 |
| T2 | Study_1 → Feed production: add "Pennisetum purpureum" (or any feed) with allocation, leaving *Main product removal* at the default 0. Then set it to 0.9. | Land for that feed is **0 ha**, then becomes > 0. The "Concentrate (commercial)" row stays at 0 ha whatever you do. | Every fed kg DM should need land, or be flagged as imported. | LU-01, app defaults |
| T3 | Study_2 → set Source type of Barley (straw) to "Purchased", or set its residue removal to 0 | Total land 17.3 → about 8.1 ha, although the same straw is still fed. | Land should not fall when the diet is unchanged. | LU-01 |
| T4 | Study_2 → Feed parameters: Barley straw CP 0.3 → 4 %DM (a realistic value) | Warning ">4% BW" for both animals at baseline. Cow DMI 50.5 → 33.3 kg DM/d. GHG, land and N all fall by about 34%. | A 600 kg cow producing 3,500 kg/yr eats about 2.5–3.5% BW (15–21 kg DM/d; NASEM 2021 intake equations). | H-01, M-06 (feed library) |
| T5 | Study_1 → set cow number 1 → 3 | A DMI warning for cows appears, although per-cow intake is unchanged (1.86% BW). | There should be no warning. | NEW-04 |
| T6 | Study_2 → Crop residue burnt 0.4 → 0 for rice straw | Total 34.9 → 22.1 t CO2e. Burning is 13.8 t (40%). | IPCC 2006 Table 2.5 (CH4 2.7, N2O 0.07 g/kg DM; no CO2) gives about 0.094 kg CO2e/kg DM burnt, i.e. about 0.6 t here (~24× lower). | PK F06 / CL F03 |
| T7 | Study_1 → Livestock: time in stable 1.0 → 0.5 and off-farm grazing 0 → 0.5 | Total GHG **falls** 5.12 → 4.79 t. | Emissions should stay similar or rise (PRP N2O plus activity energy). | CL F06 |
| T8 | Study_1 → Farm → Fertilizer: set NPK %N 12 → 0 (or add NPK and never fill %N) | Soil N2O → 0. Fertilizer manufacture unchanged (36.8 kg CO2e). No warning. Also note that CAN is not in the list. | 200 kg NPK/ha × 15% N ≈ 30 kg N/ha → about 0.3 kg N2O-N/ha (EF1 0.01). | N-04 / CL F10 |
| T9 | Study_1 → Farm: soil depth 0.2 → 0.3, then enter 20 (a user thinking in cm) | Carbon stock change −4.5 → −6.7 → **−445 t CO2/yr**. | Long-term cultivated land under unchanged management: ΔSOC ≈ 0 (IPCC eq 2.25, D = 20 yr). | S-02, S-03 |
| T10 | Compare Study_1 with an exact copy of itself | Both show −4.5 t CO2/yr "carbon stock change" (−6.4 t/ha/yr). The carbon balance per kg FPCM (4.26) is almost double the GHG per kg (2.27). | ≈ 0 change. East Africa intensive dairy benchmark (guide §3.4): 1.1–5.9 kg CO2e/kg FPCM, mean 2.39. | S-02 / CL F01 |
| T11 | Study_1 → look at the N balance plot and Compare "Area Mining %" | 100% of area "mining", although Groundnut residue has a positive balance. The concentrate shows leaching N with 0 ha. | By the guide's own definition, mining should be < 100%. | N-06, N-01, G5 |
| T12 | Study_1 → Compare "Total water use" and "Water per FPCM" | 733 "m³/yr", 1,039 "m³/ha", 0.32 "m³/kg FPCM". | ×10 gives the true volume: ≈ 7,300 m³, ≈ 10,400 m³/ha (= Kc·ET0 1,040 mm). Guide benchmark for East Africa: 1.2–3.1 m³/kg FPCM. | W-01, W-02 |
| T13 | Study_1 → Livestock: set heifers' "mature body weight" 0 → 600. Download Excel → energy sheet | `er_growth` 0 → 4.3 MJ/d per heifer. Dashboard unchanged (CP-limited). | IPCC eq 10.6 for a 327 kg heifer gaining 0.34 kg/d: NEg ≈ 4–5 MJ/d. | NEW-01 |
| T14 | New scenario from Study_1: add "Goats - Kids" (10 head, 20 kg/yr gain), leaving the weaning and 1-yr weights at the app default 0 | DMI warning. Kids' DMI is about 28% BW (CP-limited). NEg only uses `a`. | Kids eat about 3–4% BW. | H-02, H-01 |
| T15 | Study_1 → set slope to "Non-agricultural (all slope categories)" for all feeds | Erosion 0.42 → **0.00 t/yr**. | P-factor 1 should *increase* erosion. | SE-01 |

Optional (DBs with OFC feeds: Tunisia, Uzbekistan, Mongolia, Uganda, Haiti, Honduras): an OFC concentrate with urea shows the same N counted twice in "Concentrates off-farm" soil N2O (PK F05).

**Sanity anchors for facilitators** (independent of the tool):

- Improved East African dairy cow (2,000–3,500 kg milk): enteric CH4 about 60–100 kg/yr (Tier 2 range).
- IPCC 2006 Tier 1 Africa dairy: 40 kg/head/yr for low-yield cows.
- FAO GLEAM (Gerber et al. 2013), sub-Saharan Africa dairy: about 7.5 kg CO2e/kg FPCM (allocated, includes feed and LUC).
- DMI of lactating cows: 2.5–3.5% BW.
- Growing cattle and small ruminants: about 2.5–4% BW.

---

## 7. Known issues facilitators should flag up front

1. **Do not use absolute numbers for reporting.** Use the workshop to test usability and relative directions only, and even those are biased (G16).
2. **Soil carbon:** the "Carbon stock change" and "Carbon balance" indicators show a large permanent loss for any cropland. Ignore them (T9/T10).
3. **Burning** is overstated about 24×. Don't interpret burning-reduction scenarios quantitatively (T6).
4. **Manure CH4 shows 0** with the default manure labels. If you need it, choose "Pasture/Range/Paddock" (not "Pasture / range / paddock") for grazing and enclosure locations (T1). On the 4c44 build it is always 0.
5. **Always set removal fractions** (main product / residue) for each feed, otherwise the feed gets 0 ha. **Purchased concentrates never get land, water or soil footprints** (T2/T3).
6. **Always fill "mature body weight"** for cattle, and weaning / 1-year weights for sheep and goats. The app pre-fills 0 (T13/T14).
7. **Check feed CP values.** Very low CP (e.g. barley straw 0.3% in the DB) makes the model "feed" impossible amounts. The >4% BW warning is also triggered by herd size alone, so check per-head intake in the Excel (T4/T5).
8. **Water volumes are 10× too low** (the unit is mm·ha, not m³), and the water indicator is not a water footprint (T12).
9. **"% area mining/leaching" is not the N-balance share** that the guide describes. Use the per-feed N balance values instead (T11).
10. **Off-farm grazing appears to reduce emissions**, because its N2O is dropped (T7).
11. **Fertiliser:** enter %N for NPK. CAN is not available. Urea CO2 is not counted (T8).
12. **Units:** soil depth is in **metres** (0.2–0.3). "ha/kg FPCM" is really ha per tonne. "t CO2eq/kg" for the carbon stock is really kg/kg.
13. **Red alerts don't stop a run.** Fix every alert before pressing Run.
14. **% changes** flip sign for negative baselines (N balance, SOC). Read absolute differences instead.
15. **Benchmarks in guide §3.4** are not like-for-like with iCLEANED (no allocation, different boundaries, water unit error), and some rows are internally inconsistent.
16. If T0 shows the 4c44 build: **Compare-tab GHG totals and intensities are wrong by 1–3 orders of magnitude.** Use only the Simulation tab (per-ha by source) and the Excel `ghg_balance` `kg_co2_e_tot` column.

---

## 8. Top app-affecting issues (priority for fixes before or after the workshop)

1. **SOC perpetual loss** (#21, CL F01 / LU S-02). It dominates the carbon balance (S1: −4.5 t CO2/yr against 5.1 t CO2e of emissions).
2. **Silent zero land** from the app's default removal = 0 and from "Purchased" feeds (#8, LU-01). This propagates to every per-ha and per-kg indicator.
3. **Intake engine**: DMI = max(E, CP) with no cap, combined with NE÷ME (#3, #1). S2 cow: 8.4% BW. The app's warning is itself mis-scaled (NEW-04).
4. **Burning CO2 plus NOx×GWP_N2O** (#29). S2: 40% of total GHG.
5. **Manure CH4 missing** (#37 CL F07 via the app's default label; NEW-02 on 4c44). If 4c44 is live, **NEW-03** (Compare-tab GHG totals in mixed units) jumps to #1.
