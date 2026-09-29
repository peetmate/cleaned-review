# 03 - Land use, water, soil, N and SOC review of `cleaned` v0.7.0

Reviewer role: sustainable land-use and agro-environmental modeller (adversarial review)
Source reviewed (read-only): `CIAT/cleaned` @ 800d53a (v0.7.0)
Scope: `land_requirement.R`, `land_productivity.R`, `biomass_calculation.R`, `water_requirement.R`, `soil_health.R`, `soc.R`, `nitrogen_balance.R`, `compare_scenario.R`, `differences.R`, `merge_outputs.R`, `inst/extdata/*.json`, vignettes, README.

## Verdict

The land, water, erosion, N-balance and SOC modules should not be used for quantitative ex-ante claims yet. The land footprint silently drops feeds (any Inf/NaN area becomes 0), so up to 74% of the ration's dry matter got no land in a test run. It is also inflated by up to about 70% because feed demand is set to the larger of the energy-based and protein-based DMI. The N balance adds per-hectare terms to farm totals, has a scalar `ifelse` bug that throws away grazing-manure N, silently ignores fertiliser types missing from the fertiliser table, and calls outputs/inputs including losses "NUE". Water is reported in mm·ha labelled as m³ (10x too low), with no green/blue split and no season length. SOC applies IPCC factors to a measured stock of arbitrary depth, so any baseline shows a permanent loss, and tree-SOC is always zero. There is no uncertainty treatment. The scenario % changes flip sign for negative baselines and report 0% for undefined ones.

## How numbers were checked

- The documented README run fails on the shipped `inst/extdata/example_input.json`. It also fails on `data/qt_example.json` and on `data(mufindi)`, because `crop_name` is missing (see D-01).
- I ran the pipeline from source with Rscript (dplyr/tidyr/jsonlite; nothing installed) after a minimal patch in a scratch copy:
  - added `crop_name`
  - derived `dry_yield`/`residue_dry_yield` from `fresh_yield`, `harvest_index` and `water_content` using the commented formula at `land_requirement.R:84-88`
  - aliased `fat_milkcontent`, `cp_lys_*` and `n_manure_content`
  - set `percentage_n` = 34 where it was missing
- Runs: "EX" = `example_input.json` (Muheza) and "QT" = `data/qt_example.json`. The numbers quoted below come from these runs.

## Findings table

| id | severity | verdict | file:line | issue |
|---|---|---|---|---|
| LU-01 | Critical | CONFIRMED | land_requirement.R:99-102, 120-121 | Division by zero (removal=0, yield=0, source_type not Main/Residue) gives Inf/NaN, which is then set to 0 ha. Feeds silently get no land (74% of DM in QT). |
| LU-02 | High | CONFIRMED | energy_requirement.R:174; land_requirement.R:93 | Land is driven by `dmi_s = max(DMI_energy, DMI_CP)`. CP-limited diets inflate DM demand and land by 27-69% in the examples. |
| LU-03 | Medium | PLAUSIBLE | land_requirement.R:103-107 | Residue land uses undocumented mass allocation. Main items take 100% of crop land even when their residue is also fed, so there is a double-count risk. No economic allocation. |
| LU-04 | Medium | CONFIRMED | land_requirement.R:108-110; water_requirement.R:53-55; nitrogen_balance.R:269-298; merge_outputs.R:602-604 | Off-farm/imported status is inferred from the substrings "OFR"/"OFC"/"IP" in feed names. Off-farm land is then scored with on-farm soil and climate. |
| LU-05 | Low | PLAUSIBLE | land_requirement.R:100-102 | Area is cut by `intercrop*intercrop_fraction` with no documented meaning. |
| LU-06 | Medium | CONFIRMED | differences.R:211-214; compare_scenario.R:328-342; differences.R:195 vs merge_outputs.R:530 | "ha/kg" indicators are really ha/t (x1000). Milk, meat and protein each get 100% of the land (no co-product allocation). AME uses 2100 vs 2500 kcal in different places. |
| N-01 | Critical | CONFIRMED | nitrogen_balance.R:249-256 | Leaching `out3` is a per-ha rate that is never multiplied by area. It also adds total organic N (`in2`) into a per-ha pool, and is then summed with farm-total terms in `nout`. |
| N-02 | High | PLAUSIBLE | nitrogen_balance.R:249 | Leaching coefficient written as `0.021*(P-3.9)`. The De Willigen/NUTMON form is `0.021*P - 3.9`, so leaching is about 3.8 percentage points too high (+22% at 1000 mm, +84% at 400 mm). |
| N-03 | High | CONFIRMED | nitrogen_balance.R:234-238 | `ifelse(denom > 0, vector, 0)` returns only the first element. Grazing-manure N is replaced by feed 1's value for every feed (126.6 kg N lost in QT). |
| N-04 | High | CONFIRMED | nitrogen_balance.R:80-121; example_input.json `fertilizer` | A fertiliser missing from `para$fertilizer`, or with no `percentage_n`, silently gives 0 N. QT's 400 kg urea/ha becomes 0 N, while GHG manufacturing emissions still count it. |
| N-05 | High | CONFIRMED | nitrogen_balance.R:148-155 | All collected-manure N and purchased organic N is given to every feed x `fraction_as_fertilizer`, with no normalisation. N is multiplied by the number of feeds (200% in QT). |
| N-06 | High | CONFIRMED | nitrogen_balance.R:257, 285-294 | "NUE" = nout/nin, where nout includes leaching, gaseous and erosion losses. The mining (>0.9) and leaching (<0.5) classes are meaningless (EX NUE = 24 and 54). |
| N-07 | Medium | CONFIRMED | nitrogen_balance.R:164 vs 184 | `soil_n` is used on two bases 10x apart. The soil N stock (and so mineralisation) is 10x low if `soil_n` is in g/kg, which is the basis erosion N (`out5`) assumes. |
| N-08 | Medium | CONFIRMED | nitrogen_balance.R:174, 253-254 | Non-symbiotic fixation `2+(P-1350)*0.005` is negative when P < 950 mm. Gaseous loss can go negative at low clay and low rain. Neither is clamped. |
| N-09 | Medium | PLAUSIBLE | nitrogen_balance.R:143-148; ghg_emission.R:373-375 | The N balance uses excreted N with no storage losses (not consistent with the GHG manure-N chain). The GHG module uses fertiliser N as off-farm residue N. |
| SE-01 | High | CONFIRMED | soil_health.R:35-58, 73; nitrogen_balance.R:179-182 | LS is NA when `slope_desc` is empty/unknown or `slope_length` is NA. The NA is later dropped with `na.rm`, so erosion and erosion-N become 0. EX: all `slope_desc` = "" gives zero erosion. |
| SE-02 | High | PLAUSIBLE | soil_health.R:26-27 | R = 0.55*(P/rain_length) - 4.7 has no source. It gives about 98-160, roughly 5-10x below common SSA erosivity relations. The units of K are unstated. |
| SE-03 | Medium | PLAUSIBLE | soil_health.R:34-58; example inputs `slope_p_factor` | The LS lookup has no source, units or length basis, and uses very wide slope classes. P = 0.11 (terracing level) is the de facto default. |
| SE-04 | High | CONFIRMED | merge_outputs.R:620, 649-665 | `erosion_t_soil_year` is built in the order total, OFR, OFC, IP, farm but labelled total, on-farm, OFR, OFC, IP. Rows are shifted, and per-ha values use the wrong area. |
| SE-05 | Medium | CONFIRMED | merge_outputs.R:628-634; differences.R:231 | `balance_N_kg_N_ha` sums per-ha values across feeds. The headline N balance uses the whole-crop balance in one output and the feed-only balance in another. |
| W-01 | High | CONFIRMED | water_requirement.R:48-49, 57, 74-81; differences.R:352-376 | ET in mm x area in ha is reported as "m3" and "m3/ha" (1 mm·ha = 10 m³), so values are 10x too low. |
| W-02 | High | CONFIRMED | water_requirement.R:33-49 | Annual ET0 x mean Kc is applied over 365 days for every crop. No growing season, effective rainfall, irrigation, green/blue split or drinking water. The `wfp_green/blue/grey` and livestock `water_requirement` inputs are unused. |
| W-03 | Medium | CONFIRMED | water_requirement.R:49-51, 74 | Residue water is allocated twice (already-allocated `area_feed` x feed share again). `total_water_use` does not equal the sum of `feed_water_use` (QT test: 307 vs 1460 mm/ha). |
| W-04 | Medium | CONFIRMED | water_requirement.R:56 | `kc_water_use_on_farm` subtracts roughages and IP but not OFC concentrates. |
| W-05 | Low | CONFIRMED | water_requirement.R:46 | Kc is the plain mean of the three stages, not a stage-duration-weighted mean (FAO-56). |
| S-01 | High | CONFIRMED | soc.R:234; biomass_calculation.R:141-144 | `biomass[["trees_non_feed_biomass"]]` is NULL (biomass is a plain data frame), so tree-SOC is always 0. |
| S-02 | High | CONFIRMED | soc.R:103-133 | IPCC F factors are applied to the measured field SOC as if it were SOCref. Long-term, steady-state cropland therefore shows a permanent loss (QT: -17 t C/ha/yr). |
| S-03 | High | CONFIRMED | soc.R:73-74; input-contract.Rmd:53 | `soil_depth` is implicitly in metres, with no 0-30 cm basis and no validation. EX (depth 2) gives 832 t C/ha; QT (BD = 6) gives 1440 t C/ha. |
| S-04 | High | CONFIRMED | stock_change_parameters.json `grassland.management."Medium": 1.5` | This management factor is not in IPCC. It gives +50% SOC over 20 years (about +1 t C/ha/yr on the fixed 40 t C). |
| S-05 | Medium | CONFIRMED | soc.R:106-107, 141-142, 175-176 | "Cropland" area includes off-farm and imported concentrate land at farm SOC. Grassland SOC is fixed at 40 t C and ignores `field_soc`. Tree-legume land gets no SOC. |
| S-06 | Low | CONFIRMED | output-contract.Rmd:258-262 vs soc.R:245-248 | The docs promise `field_soc` and per-land-use changes; the function returns only 2 totals. |
| C-01 | High | CONFIRMED | compare_scenario.R:49-150 (all % blocks) | % change = (S-B)/B. It flips sign for negative baselines (N balance, SOC) and gives 0% when B = 0. |
| C-02 | Medium | CONFIRMED | differences.R:39-40; water_requirement.R:76-81; merge_outputs.R:703-704 | Zero denominators give 0 intensities (for example 0 m³ or 0 kg CO2e per kg meat when there is no meat) instead of NA. |
| C-03 | High | CONFIRMED | all modules (absence) | Everything is deterministic. There is no uncertainty, sensitivity or range output, although results hinge on unobserved inputs (yield, HI, removal, Kc, R, LS, P, soil N). |
| D-01 | High | CONFIRMED | README.md "Standard Model Run"; inst/extdata/example_input.json | The shipped example and README workflow fail (missing `crop_name`, `dry_yield`, `residue_dry_yield`, `percentage_n`, `fat_milkcontent`, `cp_lys_*`, `n_manure_content`). The derived yields are computed outside the package. |
| D-02 | Medium | CONFIRMED | input-contract.Rmd:42-53, 146; example_input.json | Units are given only as the "package basis". `dm_content` is a fraction (0.3) in EX but a percent (89) in QT and in the README. No range checks (BD = 6, depth = 2). |

Counts: Critical 2, High 18, Medium 13, Low 3 (36 in total).

---

## Detailed findings

### Land requirement

**LU-01 - Silent zero land for feeds (Critical, CONFIRMED)**

- **Evidence:**
  - `area_total = feed_item_dm/(crop_yield*crop_removal) ...` for source_type "Main", and `feed_item_dm/(cr_yield*crop_residue_removal)` for "Residue". Any other source_type gets `0` (L99-102).
  - Then `mutate_if(is.numeric, list(~na_if(.,Inf))) %>% replace(is.na(.), 0)` (L120-121).
  - QT run: cowpea (Main, `main_product_removal=0`, 7,480 kg DM) and rice straw (Residue, `residue_dry_yield=0`, 7,203 kg DM) both get 0 ha. That is 74% of the 19,765 kg DM ration. Only oats get land (0.169 ha).
  - EX run: maize stover (`residue_removal=0`, 2,043 kg DM, 12% of DM) gets 0 ha. `"Concentrate (commercial)"` has source_type "Purchased", so it always gets 0 ha.
  - The zero area then flows into erosion, N, water, SOC and GHG, and into every per-ha and per-kg indicator.
- **Expected:** fed DM must map to land or to an explicit "no land attributed / purchased with external footprint" category. A zero removal fraction for a fed item is logically inconsistent and should be an error.
- **Impact:** land and all area-scaled impacts are biased downward by an unknown, input-dependent amount (up to about 75% in the test). Scenarios that change a feed's removal fraction from 0 look like large land "savings".
- **Fix:**
  - Validate: stop if `feed_item_dm > 0` and the denominator is ≤ 0.
  - Handle "Purchased" explicitly, with a default yield or an external land footprint factor.
  - Report the unallocated DM.

**LU-02 - Land driven by the larger of energy- and CP-based DMI (High, CONFIRMED mechanism)**

- **Evidence:**
  - `dmi_s = ifelse(dmi_required_cp>dmi_required_e, dmi_required_cp, dmi_required_e)` (energy_requirement.R:174), then `feed_item_dm = fraction_dry_matter*dmi_s` (land_requirement.R:93).
  - Every season and category in EX and QT is CP-limiting.
  - EX improved cow, S1: 2,794 vs 1,654 kg DM (+69%). Annual DMI is 9,714 kg, or 26.6 kg/d (4.4% of 600 kg BW). The energy-based 15.6 kg/d is realistic for 3,660 kg milk.
  - QT: +2% to +35%.
- **Expected:** land should follow actual or feasible intake (energy-based DMI capped by intake capacity). A CP deficit should be reported as a deficit, not converted into extra feed.
- **Impact:** land, water, N and erosion are overstated by up to about 70% on low-CP diets. Diet improvements that raise CP look like large land savings.
- **Fix:** use energy DMI for land, cap by an intake-capacity check (for example about 2.5-3.5% BW for cattle), and output the CP gap separately.

**LU-03 - Allocation of crop land between food and residue feed (Medium, PLAUSIBLE)**

- **Evidence:**
  - For residues, `area_feed = area_total * cr_yield*res_removal/(crop_yield*crop_removal + cr_yield*res_removal)` (L103-107). This is DM-mass allocation.
  - Main items: `crop_residue_removal` is forced to 0 (L97-98), so a grain or fodder item takes 100% of its crop's area.
  - If both "maize grain" (Main) and "maize stover" (Residue) are fed, the two areas are computed independently from different DM demands and never reconciled.
  - QT test with rice straw `residue_dry_yield=5`: straw gets 21% of 1.8 ha.
- **Expected:** a documented allocation choice. FAO LEAP feed guidelines use economic allocation by default, which typically gives stover a much smaller share than mass allocation. Also a single crop-level area when several co-products of one crop are fed.
- **Impact:** residue land share is likely overstated several-fold relative to economic allocation (my inference; depends on prices). There is a double-count risk for crops whose grain and residue are both fed.
- **Fix:** make the allocation method a parameter (mass/economic/none), and compute crop area once per crop with co-product shares.
- **Refutation attempt:** mass allocation is a defensible choice, but it is undocumented and non-configurable, so the finding stands.

**LU-04 - Feed-source classification by name substring (Medium, CONFIRMED)**

- **Evidence:** `str_detect(feed, "OFR")`, `"OFC"`, `"IP"` in land_requirement.R:108-116 and repeated in the water, N, merge and GHG code. A name like "…PIPER…" or "SHIP…" would be classed as imported.
- Off-farm and imported land is assessed with the farm's own `annual_prec`, `soil_*`, R, K, `et`, `cropland_system` and so on (soil_health.R:26-27; water_requirement.R:33; soc.R:106).
- **Fix:** add an explicit `feed_origin` field. Use separate (or default regional) soil and climate parameters for off-farm land, or report off-farm land as area only.

**LU-05 - Intercropping reduction (Low, PLAUSIBLE)**

- `area*(1 - intercrop*intercrop_fraction)` (L100-102). Whether yields are sole-crop or intercrop yields, and whether the "saved" land belongs to the companion crop, is undocumented.
- A land-equivalent-ratio approach would be more transparent.

**LU-06 - Land intensity metrics (Medium, CONFIRMED)**

- `total_land_requirement_ha_per_kg_fpcm <- safe_div(ha, kg)*1000` (differences.R:211) is ha per tonne, but it is plotted as "ha/kg" (compare_scenario.R:328-342).
- The same total land is divided separately by milk, by meat and by protein, so there is no co-product allocation. Per-kg-meat and per-kg-milk footprints both carry 100% of the land. The same applies to water, N, erosion and GHG.
- `land_productivity()` computes no land productivity at all. It returns livestock outputs.
- AME days use 2100 kcal (differences.R:195-196) but 2500 kcal in merge_outputs.R:530.
- **Fix:**
  - Relabel the unit, or report m²/kg.
  - Add biophysical or economic milk/meat allocation (IDF 2015 for dairy).
  - Use one AME constant.

### Nitrogen balance

**N-01 - Leaching term mixes per-ha and total units (Critical, CONFIRMED)**

- **Evidence:**
  - `out3a/b/c = (n_mineralized_kg_ha_year + fertilizer_rate + in2) * (...)/100` (L249-252).
  - `n_mineralized` and `fertilizer_rate` are kg/ha, but `in2 = organic_n_kg_total` is kg per farm (L245).
  - `out3` is never multiplied by `area_total`, yet `nout = out1+out2+out3+out4+out5` adds it to farm totals (L256).
  - By contrast, `out4` uses `organic_n_kg_per_ha` and `* area_total` (L253-254).
  - EX: `out3 = 2.55` kg for every feed, including zero-area feeds.
  - QT oats (0.169 ha): `out3 = 46.4` kg total, where the correct value is about 0.169 x the per-ha rate using the per-ha manure.
- **Expected:** `out3 = (Nmin + Nfert + Norg_per_ha) x frac x area_total`, as `out4` already does.
- **Impact:** leaching is underestimated by a factor equal to the area when area > 1 ha, and overestimated when area < 1 ha. The bias flows into `nbalance`, "NUE", the leaching area and the per-ha summaries.
- **Fix:** use `organic_n_kg_per_ha` and multiply by `area_total`.

**N-02 - Leaching regression mis-parenthesised (High, PLAUSIBLE)**

- **Evidence:** `0.021 * (annual_precipitation - 3.9)` (L249), while the other clay classes use the form `a*P + b` (`0.014*P + 0.71`, `0.0071*P + 5.4`).
- **Expected:** De Willigen (2000), as used in the NUTMON toolbox, gives `0.021*P - 3.9` (%) for clay < 35%.
- **Impact:** leaching fraction is +3.8 percentage points too high: 20.9% vs 17.1% at 1000 mm, and 8.3% vs 4.5% at 400 mm.
- **Caveat:** verdict is PLAUSIBLE because I checked against the published form from memory. The pattern of the other two clay classes strongly supports it.

**N-03 - Scalar `ifelse` discards grazing-manure N (High, CONFIRMED)**

- **Evidence:** `animal_manure_grazing = ifelse(denom > 0, sum_n_content_manure_grazing*(...)/denom, 0)` (L234-238). `denom` is a scalar, so `ifelse` returns only element 1 of the vector, recycled to every row. Checked: `ifelse(5082>0, c(0,126.6,0), 0)` returns `0`.
- QT: 126.6 kg of grazing-manure N becomes 0 for all feeds. If feed 1 had had a non-zero value, that value would have been copied to every feed (over-count instead).
- The allocation key itself (harvested DM, including off-farm and imported feeds) is also questionable: grazing manure falls on grazed land, not on purchased-concentrate land.
- **Fix:** use `if (denom > 0) ... else 0` (vector form), and allocate grazing manure only to on-farm grazed areas.

**N-04 - Missing fertiliser types or N content silently give 0 N (High, CONFIRMED)**

- **Evidence:** `ifelse(feed_selected$urea == 0, 0, as.numeric(para$fertilizer[which(desc=="Urea"),]$percentage_n)/100)`, then `!is.finite(...)` becomes 0 (L116-120). If "Urea" is not in `para$fertilizer`, or `percentage_n` is absent (as in `example_input.json`, whose fertiliser row has no `percentage_n`), the N input is 0.
- QT: 400 kg urea/ha on oats gives `in1 = 0.85` kg total (only N-solutions counted). Adding a Urea row gives `in1 = 32.0` kg, so about 184 kg N/ha was ignored.
- ghg_emission.R:517-535 still counts the urea mass in fertiliser manufacturing emissions, while soil N2O (which uses `fertilizer_rate` from n_balance) does not.
- **Fix:** use a fixed internal N-content table (urea 46%, AN 33-34%, AS 21%, DAP 18%, etc.) with user override, and stop on unknown types.

**N-05 - Manure and purchased organic N multiplied across feeds (High, CONFIRMED)**

- **Evidence:** `animal_manure_collected <- n_content_manure_collected * manure_fraction` and `organic_n_imported <- manure_fraction*(purchased_...)` inside the per-feed loop (L148-155). There is no division by the sum of fractions and no area weighting.
- QT: 82.66 kg N is given to both oats and rice (`fraction_as_fertilizer = 1` each), so 200% of the available manure N is applied. `organic_n_kg_per_ha = 488` kg N/ha on oats.
- **Fix:** normalise `fraction_as_fertilizer` to sum to ≤ 1 across feeds (with a warning), and optionally distribute by area.

**N-06 - "NUE" is not NUE (High, CONFIRMED)**

- **Evidence:** `nue = nout/nin` (L257), where `nout` includes leaching, gaseous loss and erosion. Mining is `nue > 0.9` and leaching is `nue < 0.5` (L285-294).
- EX: NUE 24.2 and 54.4, so the pasture is classed as "mining". Higher leaching raises this "NUE", which pushes a plot toward "mining", the opposite of the intended signal.
- **Expected:** NUE = N in harvested products / N inputs (EU Nitrogen Expert Panel, 2015). The 0.5/0.9 thresholds come from that framework and only make sense with that numerator.
- **Fix:** `nue = (out1+out2)/nin`, and keep the balance separate.

**N-07 - Two bases for `soil_n` (Medium, CONFIRMED)**

- `ntot_kg_ha_20cm = soil_n*20*soil_bulk*10` (L164). If `soil_n` is in g/kg, the correct stock is `soil_n*0.2 m*1e4 m²*BD` = `2000*BD*soil_n` kg/ha, so the code is 10x low. If it is in %, the code is 100x low.
- `out5 = soil_loss_plot(t)*soil_n*1.5` (L184) is kg N only if `soil_n` is in g/kg.
- EX: mineralisation 15.6 kg N/ha/yr vs 156 on the g/kg basis. Mineralised N feeds both the leaching and gaseous pools, so both are likely underestimated.
- Units are undocumented (input-contract.Rmd:49: "package basis").

**N-08 - Negative inputs and losses (Medium, CONFIRMED)**

- `in4a = 2 + (P-1350)*0.005` (Smaling-type relation) is < 0 for P < 950 mm, which covers much of semi-arid SSA.
- `out4` fraction `-9.4 + 0.13*clay + 0.01*P` is < 0 for, for example, clay 20% and P 600 mm.
- **Fix:** `pmax(0, …)`.

**N-09 - Cross-module N consistency (Medium, PLAUSIBLE)**

- The N balance applies excreted N in collected manure (`n_content_manure_collected`) with no housing or storage losses. The GHG module models NH3 and N2O losses from the same manure, so the same N is both lost and fully applied.
- ghg_emission.R:374-375 sets `conc_of_n_from_crop_residue_managed_soil <- sum(nitrogen_balance$conc_of_min_fert_n)`: fertiliser N is used as residue N.
- L373 reads `nitrogen_balance$rough_of_n_from_crop_residue`, which does not exist, so it returns 0.
- Main-product N removal uses `main_n` as a fraction of DM, while `n_fixing` uses `0.5 x shoot N` (no roots, with a fixed %Ndfa). Both are undocumented.

### Soil erosion

**SE-01 - Erosion silently zero when slope inputs are missing (High, CONFIRMED)**

- The nested `ifelse` returns `NA_real_` for any unmatched class (L58), so `soil_loss_ha_year` is NA.
- `n_balance` then uses `sum(..., na.rm=TRUE)`, which gives 0 (nitrogen_balance.R:179-182), and summaries do the same.
- EX: every feed has `slope_desc: ""`, so LS = NA and erosion = 0 with no warning. QT has `slope_length 0`, which is accepted as the class "≤1".
- **Fix:** validate `slope_desc` against the allowed set, and stop or warn on NA.

**SE-02 - Rainfall erosivity formula (High, PLAUSIBLE)**

- `R = 0.55*(annual_prec/rain_length) - 4.7` (L26) has no reference, and `rain_length` has no unit (6 and 5 in the examples, apparently months). This gives R = 98 (EX) and 160 (QT).
- Widely used SSA relations give far larger values:
  - Roose (1977): R ≈ 0.5·P in US units, often converted as about 0.5·P·1.73 in SI, i.e. about 970 at 1119 mm.
  - Hurni (1985, Ethiopia): R = 0.562·P - 8.12, i.e. about 620.
- Unless K is on a matching non-SI basis, soil loss is likely underestimated 5-10x.
- K = 0.19-0.25 in the examples looks like US-customary K (SI K is typically 0.01-0.07 t·h·MJ⁻¹·mm⁻¹).
- **Verdict PLAUSIBLE:** the bias could partly cancel through unit mixing, but that cannot be verified because units are undocumented.
- **Fix:** cite the formula, state the SI units for R and K, and consider regional R options.

**SE-03 - LS table and P default (Medium, PLAUSIBLE)**

- The LS lookup (L34-58) has no source and no unit for slope length (metres? 1-30 looks too short for field slopes), and uses four very wide steepness classes ("Hilly 5-20%" covers a 4x range in S).
- `slope_p_factor = 0.11` appears for every feed in both examples, including pasture and purchased concentrate. That value corresponds to well-maintained terraces; P = 1 for no practice. Erosion is about 9x lower than without conservation practices.
- **Fix:** use a continuous LS (for example Wischmeier-Smith or Moore-Burch), document units, and default P to 1.

**SE-04 - Erosion summary rows shifted (High, CONFIRMED)**

- `sources = c("total","on-farm","rough of","conc of","conc ip")` (merge_outputs.R:620).
- `erosion_t_soil_year = c(soil_loss_plot, rough_of_soil_loss, conc_of_soil_loss, conc_ip_soil_loss, farm_soil_loss)` (L649-655).
- So the "on-farm" row shows off-farm roughage erosion, and so on. `erosion_t_soil_ha` then divides those shifted values by the mislabelled areas (L659-665).
- **Fix:** reorder so farm comes second.

**SE-05 - Per-ha N summary summed across feeds (Medium, CONFIRMED)**

- `balance_N_kg_N_ha = sum_col(nitrogen_balance, "nbalance_feed_only_kg_n_ha")` (merge_outputs.R:628-634) adds kg/ha values across feeds. It should be the total divided by the area.
- differences.R:231 uses `nbalance_kg_n_total` (whole crop, including the food share), while merge_outputs uses the feed-only balance. The two headline N balances differ in scope.

### Water

**W-01 - mm·ha reported as m³ (High, CONFIRMED)**

- `ET = kc_frac*et` (mm) and `water_use = ET*sum(area_feed)` (L48-49). `kc_water_use_m3_per_ha = feed_water_use/area_feed` (L57) is therefore just Kc·ET0 in mm. EX pasture shows 815 "m³/ha" = 0.6 x 1359 mm.
- 1 mm over 1 ha = 10 m³, so every reported water volume and intensity (`total_water_use`, `water_use_fpcm`, `_meat`, `_protein`, and `total_water_use_m3*` in differences.R) is 10x too low.
- EX `water_use_fpcm` = 0.235 "m³/kg" should be 2.35 m³/kg under the model's own assumptions.
- **Fix:** multiply by 10.

**W-02 - ET method incomplete (High, CONFIRMED)**

- ET0 (`para$et`, annual) x the mean of Kc_ini/mid/late is applied as if every crop transpires all year. There is no crop season length, even though `cultivation_period` exists in QT feed items.
- No effective rainfall, no irrigation or blue-water term, no green/blue/grey separation. The `wfp_green/blue/grey` fields in `feed_items` are ignored.
- Livestock drinking and servicing water (`livestock$water_requirement`) is ignored, even though the function is called `water_requirement`.
- For annual crops (about 120-150 d) ET is overestimated about 2-3x. This partly offsets W-01, which is not a correction.
- `fraction_of_precipitation_used_for_feed_production = ET/annual_prec` is an area-weighted crop ET/P ratio, not a share of farm rainfall.
- **Fix:** use CROPWAT-style stage-length-weighted Kc x ET0 over the season, split into green water (min of ETc and Peff) and blue water, and add drinking water.

**W-03 - Double allocation for residues (Medium, CONFIRMED)**

- `water_use` is already computed on `area_feed` (the allocated share). Then `feed_water_use = water_use*(1 - area_non_feed/area_total)` (L50-51) applies the share a second time.
- QT test (rice straw with 21% share): 307 vs the expected 1460 mm/ha.
- `total_water_use = ET*sum(area_feed)` (L74) does not include the second allocation, so the per-feed and total water outputs disagree.

**W-04 - OFC included in on-farm water (Medium, CONFIRMED)**

- `kc_water_use_on_farm = feed_water_use - roughages - ip_concentrates` (L56) omits `kc_water_use_of_concentrates`.

**W-05 - Plain-mean Kc (Low, CONFIRMED)**

- `(kc_initial + kc_midseason + kc_late)/3` (L46). FAO-56 weights each Kc by stage length.

### Soil organic carbon and biomass

**S-01 - Tree SOC always zero (High, CONFIRMED)**

- `biomass_calculation()` returns a plain tibble (L141-144). `soil_organic_carbon()` reads `biomass[["trees_non_feed_biomass"]]$c_increase_soc` (soc.R:234), which is NULL, so the sum is 0. Verified in both runs.
- `differences.R` adds `biomass$co2_increase` (above-ground only), so the 25% below-ground/soil increment is dropped everywhere.

**S-02 - Permanent SOC loss for steady-state land (High, CONFIRMED)**

- `((SOC*FLU*FMG*FI) - SOC)/20 * area` (soc.R:125-132), where SOC is the measured field stock.
- IPCC Tier 1 computes SOC0 and SOC(0-T) from SOCref x F for the current and previous management, and ΔC = (SOC0 - SOC(0-T))/D. Land under the same management for more than 20 years has ΔC = 0.
- The code instead reports an annual loss for every baseline as if native land had been converted within the last 20 years. It also applies the factors to a measured stock that already reflects current management, which double-counts the effect.
- QT: -2.93 t C/yr on 0.169 ha, i.e. -17 t C/ha/yr. That is physically implausible.
- Scenario differences are partly meaningful (ΔF x SOC/20) only when areas are equal.
- **Fix:** take baseline management as the prior state and scenario management as the current state (or explicit land-use-change inputs), and use SOCref from IPCC Table 2.3 or the measured 0-30 cm stock as SOC(0-T).

**S-03 - Depth and units (High, CONFIRMED)**

- `soil_amount = 1e6*(soil_depth/100)*soil_bulk` = 1e4·depth·BD. This is t/ha only if depth is in **metres**.
- EX `soil_depth = 2` gives 2 m and 832 t C/ha. QT `soil_bulk = 6` is impossible but accepted, giving 1440 t C/ha.
- IPCC factors are defined for 0-30 cm. At 2 m depth the flux is inflated about 3-7x.
- **Fix:** fix the depth at 0.3 m (or document cm and convert), and range-check BD (0.8-1.8 g/cm³) and `soil_c`.

**S-04 - Non-IPCC grassland factor (High, CONFIRMED)**

- `stock_change_parameters.json` has `grassland.management."Medium": 1.5`. IPCC 2006 Vol 4 Table 6.2 has nominally managed 1.0, moderately degraded 0.95-0.97, severely degraded 0.7 and improved 1.14-1.17. There is no 1.5.
- Selecting "Medium" gives +50%, i.e. (40 x 0.5)/20 = +1 t C/ha/yr.
- The cropland factors match IPCC 2006 Table 5.5. The 2019 Refinement revised several of them; which version to use is an author decision.

**S-05 - Land categories (Medium, CONFIRMED)**

- Cropland area = `sum(area_feed) - grasses - tree_legume` (L106-107). This includes off-farm and imported concentrate land at farm SOC and farm management.
- Grassland uses a fixed 40 t C/ha (L142, L176), not `field_soc` or IPCC SOCref.
- Tree-legume and tree-crop land is excluded from every SOC pool.
- Organic soils are hard-coded to 0 (L210-216).

**S-06 - Doc mismatch (Low, CONFIRMED)**

- output-contract.Rmd:258-262 lists `field_soc` and per-land-use rows. The function returns only `total_annual_change_carbon_soils` and `total_change_co2_soils`.

### Scenario comparison and uncertainty

**C-01 - % change arithmetic (High, CONFIRMED)**

- Every indicator uses `ifelse(!is.finite((S-B)/B*100), 0, (S-B)/B*100)` (compare_scenario.R:49-150).
- A baseline N balance of -100 improving to -50 is reported as -50%, which reads as "worse".
- A baseline of 0 (common for SOC, erosion or meat after LU-01/SE-01) gives 0%.
- **Fix:** report absolute differences, use `(S-B)/|B|`, and return NA when B = 0.

**C-02 - Zero-denominator intensities (Medium, CONFIRMED)**

- `safe_div(..., default = 0)` (differences.R:39) and `ifelse(!is.finite(...), 0, ...)` (water_requirement.R:76-81) turn undefined intensities into 0. A dairy-only farm then shows "0 m³/kg meat" and "0 t CO2e/kg meat".

**C-03 - No uncertainty or sensitivity (High, CONFIRMED by absence)**

- No module carries ranges, Monte Carlo, or one-at-a-time sensitivity.
- Results depend strongly on unobserved or default inputs: yield and HI (land varies inversely), removal fractions (division, LU-01), Kc, R/LS/P (multiplicative), `soil_n` and BD (N-07, S-03).
- The comparison view presents single-point % changes with no indication of the noise floor.
- **Fix:** at minimum, ship a sensitivity wrapper over key parameters (±20-50%) and show ranges in `compare_scenario`.

### Documentation

**D-01 - Shipped examples do not run (High, CONFIRMED)**

- The README "Standard Model Run" fails on `inst/extdata/example_input.json`, `data/qt_example.json` and `data(mufindi)` at `unnest(cols = c(crop_name))`.
- After adding `crop_name`, it also needs `dry_yield`, `residue_dry_yield` (EX), `percentage_n` (EX), `fat_milkcontent`, `cp_lys_pregnancy`, `cp_lys_growth`, `n_manure_content`, `lw_gain_piglets` and `proportion_growth_piglets_milk`.
- The key agronomic derivations (dry yield, residue yield, residue DM) live outside the package; the code at `land_requirement.R:84-88` that did this is commented out. Those derivations therefore cannot be reviewed or tested.
- The commented formula uses the *feed's* `dm_content` for the main product's DM, which is wrong for residue items.

**D-02 - Units unstated or inconsistent (Medium, CONFIRMED)**

- input-contract.Rmd:42-53 gives `soil_n`, `soil_c`, `soil_depth`, `et`, `rain_length` and `slope_length` only on the "package basis".
- `dm_content` is 0.3 (a fraction) in EX but 89 (a percent) in QT, and the README says percent.
- There are no range checks.

---

## Done well

- The IPCC 2006 cropland stock-change factors (FLU/FMG/FI) in `stock_change_parameters.json` are transcribed correctly and are looked up by explicit key, with a clear error on a missing key (soc.R:39-71).
- The NUTMON/De Willigen structure is recognisable: deposition `0.14·√P`, clay-dependent leaching classes, and the gaseous-loss regression. The N balance also separates off-farm and on-farm sources.
- Land is disaggregated by source (on-farm, off-farm roughage, off-farm concentrate, imported), which is the right structure for footprint shifting, even though the classification is fragile.
- FPCM correction (0.337 + 0.116F + 0.06P) is applied consistently in the productivity and water modules.
- The DBH-based tree biomass allometry and the C-to-CO2 conversions are dimensionally consistent (kg to t via /1000, 0.48 C fraction, 44/12).

## Open questions for authors

1. What are the intended units of `soil_n`, `soil_c`, `soil_depth`, `soil_k_value`, `rain_length`, `slope_length` and `et`, and what is the source of the R formula and the LS table?
2. Where (app or batch) are `dry_yield`, `residue_dry_yield` and `crop_name` derived, and can that code be moved into the package and tested?
3. Is mass allocation of crop land to residues a deliberate choice? Would you accept economic allocation (FAO LEAP) as an option?
4. Should land and feed demand follow energy-limited intake rather than max(energy, CP)?
5. Is SOC change meant to be baseline-to-scenario (management change) or native-to-current? Is the grassland "Medium" = 1.5 factor intentional?
6. What should a zero removal fraction on a fed item mean? And how should "Purchased" feeds get a land and water footprint?
7. Is any validation dataset (for example NUTMON farm studies or measured erosion plots in East Africa) available to benchmark the N balance and erosion magnitudes?
8. Should milk and meat footprints be allocated (IDF 2015 or economic) rather than each carrying 100% of the impacts?
