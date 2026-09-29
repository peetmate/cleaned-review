# CLEANED v0.7.0: adversarial review of GHG and climate science

Reviewer role: IPCC AFOLU inventory methodologist (2006 Guidelines Vol 4 and 2019 Refinement).
Source reviewed (read-only): `CIAT/cleaned` @ 800d53a.
Scope: `R/ghg_emission.R`, `R/soc.R`, `R/energy_requirement.R`, `R/nitrogen_balance.R`, `R/land_requirement.R`, `R/biomass_calculation.R`, the GHG aggregation in `R/merge_outputs.R` and `R/differences.R`, and `inst/extdata/*.json`.

**How the findings were checked.** Every finding comes from reading the code. I also ran the full pipeline outside the package: I sourced `R/*.R` and used `data/qt_example.json`, with the missing fields patched in a scratch copy only (`crop_name`, `fat_milkcontent`, `cp_lys_*`, `n_manure_content`). **Neither shipped example input runs against the current code** (`inst/extdata/example_input.json` and `data/qt_example.json` both fail on the missing `crop_name` column). Findings marked "verified" were reproduced numerically in that run.

---

## Verdict

CLEANED has the right Tier 2 structure: IPCC eqs 10.21, 10.23, 10.24, 10.25–10.27, 10.32–10.34 and 11.1/11.9, with 2019 Refinement Bo, MCF and EF3 tables. But several defects are large enough to change headline results by tens of percent to orders of magnitude.

- **Soil carbon (SOC) is structurally wrong.** It treats the measured current soil carbon as the IPCC reference stock and applies the land-use factor every year forever. It also uses a depth convention that gives about 800–1,400 t C/ha in the shipped examples. The result is a very large, perpetual, spurious CO2 source.
- **Feed intake is underestimated.** Net-energy requirements are divided by metabolisable-energy density, so DMI and gross energy (GE) come out about 35–45% low when energy limits intake. This flows through to enteric CH4, volatile solids (VS) and N excretion.
- **Burning emissions are overstated about 24×.** The burning total counts biogenic CO2 and multiplies NOx by the N2O GWP.
- **N2O accounting has several problems.** Several N2O sources are silently dropped: manure applied to soils, off-farm grazing, and animals whose manure-system label doesn't match a table key. Nex ignores N retention. Soils use 2006 EF3PRP values, which are about 5× the 2019 values the rest of the model is built on.

In its current state the tool should not be used for absolute footprints or for carbon-balance claims. Scenario deltas for enteric CH4 are the most defensible output.

## Findings summary

| ID | Severity | Verdict | Location | Issue |
|---|---|---|---|---|
| F01 | Critical | CONFIRMED (verified) | `R/soc.R:73-74, 103-133` | Measured current SOC is used as SOC_ref and FLU/FMG/FI are applied every year, so long-cultivated land shows a perpetual loss. The depth convention gives about 800–1,400 t C/ha. |
| F02 | Critical | CONFIRMED | `R/energy_requirement.R:79-140, 170, 201-202` | IPCC net-energy (NE) requirements are divided by feed ME density. There is no REM/REG (eq 10.16), so DMI, GE and CH4 are about 35–45% low when energy is limiting. |
| F03 | Critical | CONFIRMED | `R/merge_outputs.R:810-812` | Burning total includes biogenic CO2 (1515 g/kg) and applies the N2O GWP to NOx. N2O is omitted. Overstated about 24×. |
| F04 | High | CONFIRMED (verified) | `R/ghg_emission.R:226, 233` | N retention is in kg N/day, divided by 365 twice, then used as a fraction in eq 10.31. Nex ≈ N intake, so dairy Nex is about 25–30% high. Pig growers can get negative Nex. |
| F05 | High | CONFIRMED (verified) | `R/ghg_emission.R:347, 359`; `R/merge_outputs.R:787-795` | Managed manure N applied to soils gets zero direct and zero indirect N2O: `manure_produced` is not an input, and the row is not aggregated. |
| F06 | High | CONFIRMED | `R/ghg_emission.R:475-485`; `R/merge_outputs.R` | Off-farm grazing N2O is computed but never aggregated. The formula is also wrong: no 44/28, and indirect is computed from the emission instead of the N. |
| F07 | High | CONFIRMED (verified) | `R/ghg_emission.R:185-200`; JSON `Table 10.17` | Manure-system labels don't match the MCF table keys ("Pasture / range / paddock", "Liquid/Slurry", ...). MCF becomes NA, so the animal's whole manure CH4 is NA and is summed as 0. |
| F08 | High | CONFIRMED (verified) | JSON `Table 10.21`; `R/ghg_emission.R:239-250` | Duplicate keys ("Liquid/Slurry", "Burned for fuel or as waste") create a many-to-many join that duplicates animal rows, doubling PRP N and indirect N. |
| F09 | High | CONFIRMED (verified) | JSON `table_11.1_&_table_11.3` | Soils use 2006 EF3PRP (0.02/0.01), FracGASF 0.10, FracGASM 0.20 and EF1R 0.003, while manure uses 2019 tables. PRP N2O is about 5× high against 2019. |
| F10 | High | CONFIRMED (verified) | `R/nitrogen_balance.R:78-130`; `R/ghg_emission.R:509-560` | Fertiliser N for N2O comes only from fertilisers listed in `para$fertilizer` with `percentage_n`, so urea N was zero in the test. CAN is ignored. Ammonia production EF is 0. No urea or lime CO2. |
| F11 | Medium | CONFIRMED (verified) | `R/ghg_emission.R:365, 373-375` | Residue N uses main-product yield, not residue yield, and no below-ground residue. Off-farm concentrate residue N is copied from fertiliser N. Roughage residue N reads a column that doesn't exist, so it is 0. |
| F12 | Medium | CONFIRMED | `R/ghg_emission.R:288-291, 441-472` | Indirect N2O from leaching/runoff (eqs 10.28–10.29, 11.10) is omitted for manure and soils, although Frac_leach_MS, FracLEACH and EF5 are loaded. |
| F13 | Medium | CONFIRMED | `R/ghg_emission.R:333-339, 366, 495, 517-541, 583` vs `R/nitrogen_balance.R:66` | Areas are inconsistent: fertiliser manufacture, residue N, burning and rice CH4 use `area_total` (whole crop area, including the food share), while N2O-fertiliser and SOC use `area_feed`. |
| F14 | Medium | CONFIRMED | `R/ghg_emission.R:251, 290, 318, 472` | When a non-pasture manure system is assigned to grazing time (e.g. "Dry lot" in `example_input.json`), the same N gets EF3(MMS)+FracGasMS and also EF3PRP+FracGASM. |
| F15 | Medium | CONFIRMED | `R/ghg_emission.R:564-589`; JSON `table_5.13` | Rice CH4: SFo is computed from the synthetic N rate. "Flooded pre-season <30 d" has SFp = 0. Rice N is counted under both EF1 and EF1R. `if()` is applied to a vector. |
| F16 | Medium | PLAUSIBLE | `R/ghg_emission.R:90-127`; JSON `Table 10.12/10.13` | Ym is chosen by DE alone: feedlot Ym 4.0/3.0 applies to any non-dairy animal with DE ≥ 72%. Unmatched category gives Ym = 0. Pigs have Ym = 0. Lambs get 6.7. High-producing dairy Ym is 5.85 (2019 is probably 5.7). |
| F17 | Medium | CONFIRMED | `inst/extdata/stock_change_parameters.json`; `R/soc.R:138-201` | Grassland FMG includes "Medium" = 1.5, which is not an IPCC value. FI is applied to non-improved grassland. SOC_ref is hardcoded at 40. Off-farm land gets on-farm factors. No land-use change (LUC), although inputs for it exist. |
| F18 | Medium | CONFIRMED | `R/differences.R:300-318`; `R/land_productivity.R:60-62` | Emission intensities put 100% of the herd's emissions on milk, and again on meat and on protein (no allocation). Boundary excludes LUC, energy and transport. |
| F19 | Medium | PLAUSIBLE | `R/energy_requirement.R:174` | Intake = max(energy-limited, CP-limited DMI), which inflates GE, CH4 and Nex on protein-poor diets. |
| F20 | Low | CONFIRMED | `R/merge_outputs.R:693-694` | GWPs are AR5 without feedback (28/265). Consistent, but undocumented. No AR6 option and no biogenic/fossil CH4 distinction. |
| F21 | Low | CONFIRMED (verified) | JSON `fertilizer_table`; `R/ghg_emission.R:517-523` | Fertiliser production EFs are unsourced, with per-kg-N and per-kg-product bases mixed. "Anhydrous ammonia" is given the urea quantity in the summary table. |
| F22 | Low | CONFIRMED | `inst/extdata/example_input.json`, `data/qt_example.json` | Examples don't run. A humid lowland Tanzanian farm is set to "Warm Temperate Dry" with temperate cropland factors, soil_depth = 2, AN at 12% N, and residue_n = 0.2. |
| F23 | Low | CONFIRMED | `R/energy_requirement.R:73-79`; `R/ghg_emission.R:148-180`; JSON `Table_m` | Lactating Cfi (0.386) applies to all cows year-round. Buffalo get no productivity class, so Bo = NA. Duplicate buffalo row in Table_m. Small-ruminant productivity split at DE 0.72 is arbitrary. |

Counts: Critical 3, High 7, Medium 9, Low 4 (23 total).

---

## Detailed findings

### F01 — SOC stock change is structurally wrong (Critical, CONFIRMED, verified)

**Evidence.** `R/soc.R:73-74`:
```r
soil_amount <- 1000000 * (para[["soil_depth"]] / 100) * para[["soil_bulk"]]
field_soc   <- soil_amount * para[["soil_c"]] * 0.001
```
`R/soc.R:108, 125-132`:
```r
carbon_stock_last_year_inventory_period = ifelse(field_soc > 0, field_soc, 30)
annual_change = ((C * FLU * FMG * FI) - C) / 20 * area
```
- **Depth convention.** `1e6*(depth/100)` equals `depth*1e4`, which is only correct if depth is in metres. The contract gives no unit (`vignettes/input-contract.Rmd:53`), and both examples use `soil_depth = 2`. With soil_c = 33 g/kg and bulk density 1.26, `example_input.json` gives SOC = 832 t C/ha. `qt_example.json` gives 1,440 t C/ha. Tropical mineral-soil SOC_ref to 30 cm (2006 Vol 4 Table 2.3) is roughly 30–90 t C/ha.
- **Perpetual loss.** The farm's current measured stock is treated as SOC_ref, and FLU for "long-term cultivated" (0.48–0.80) is applied every simulated year. Any cropland therefore loses (1 − FLU·FMG·FI)/20 of its stock annually, forever.
- **What IPCC does.** Eq 2.25 computes ΔC = (SOC_0 − SOC_(0−T))/D, with SOC = SOC_ref·FLU·FMG·FI for the current and the previous state. SOC_ref is the native, uncultivated value from Table 2.3, not a measured cultivated stock. ΔC is zero when management has not changed for more than D = 20 years.

**Verified.** The `qt_example` run gives −2.93 t C/yr (−10.7 t CO2/yr) from 0.17 ha of cropland, i.e. about −63 t CO2/ha/yr. That is larger than all the herd's enteric CH4 (about 11.8 t CO2e).

**Refutation attempt.** Could this be meant as a "scenario minus baseline" quantity where the constant term cancels? No. `differences.R:381-396` subtracts the absolute value from emissions to form `total_carbon_balance_*`, and grassland uses a different SOC_ref (40) with FLU = 1, so the terms don't cancel between land types. Finding stands.

**Impact.** This dominates the total carbon balance in any cropland-feed scenario. The sign is always a loss for cultivated land. Magnitude: 1–100 t CO2/ha/yr, depending on depth units.

**Fix.**
- Use SOC_ref from Table 2.3 (2019 Refinement update) by climate and soil class, to 30 cm.
- Compute ΔC only from a stated change in land use or management between baseline and scenario, i.e. (F_scen − F_base)·SOC_ref/20, for 20 years.
- Document the units of `soil_depth` and `soil_c`, and validate them.

### F02 — NE requirements divided by ME density (Critical, CONFIRMED)

**Evidence.**
- `energy_requirement.R:79` and the lines after it use IPCC net-energy equations: NEm = Cfi·W^0.75 (eq 10.3), NEa (10.4), NEg (10.6), NEl (10.8) and NEp (10.13). The Cfi values in `energy_parameters.json` (0.322/0.386/0.370) are the IPCC NEm coefficients.
- Line 140 sums these into `energy_required_annually`.
- Line 170 computes `fresh_intake_required_e = energy_required_by_season/average_me`, where `average_me` is ME per kg fresh (feed `me_content`, e.g. 12.27 MJ/kg for oat grain).
- Lines 201-202 derive GE = DMI·18.45 and DE = ME/0.81/GE.

**Expected.** IPCC 2006 eq 10.16: GE = [(NEm+NEa+NEl+NEw+NEp)/REM + (NEg+NEwool)/REG]/(DE/100), with REM/REG from eqs 10.14–10.15. Alternatively, divide NE by NE density, not by ME density. At DE = 55%, REM ≈ 0.47, so NE/ME ≈ 0.58.

**Refutation attempt.** Could `me_content` actually be NE? No: the values match ME tables (maize stover 6.9, oats 12.3 MJ/kg DM). Is it masked by the CP-limited branch (line 174)? Only when CP is limiting. In the test run the cows were CP-limited, so the error there was about −13%.

**Impact.**
- When energy is limiting, DMI and GE are about 35–45% low. Enteric CH4, VS and manure CH4, and N intake/Nex are all underestimated by the same proportion.
- Worked check: a 600 kg cow producing 3,000 kg milk should have GE ≈ 227 MJ/d (Tier 2, DE 65%) and enteric CH4 ≈ 94 kg/yr. The code gives 81.6 kg/yr, and would give about 60 kg/yr if energy were limiting.
- This also affects land and water requirements (out of scope here).

**Fix.** Implement eq 10.16 with REM/REG, or convert the requirements to ME with published km/kl/kg efficiencies (e.g. AFRC/CSIRO) consistently.

### F03 — Burning total counts biogenic CO2 and uses the N2O GWP for NOx (Critical, CONFIRMED)

**Evidence.** `merge_outputs.R:810-812`:
```r
burning <- sum(CO2 row) + sum(CH4 row)*methane + sum(Nox row)*N2O
```
The `table_2.5` factors (1515/92/2.7/0.07/2.5 g/kg DM) are the correct 2006 Vol 4 Table 2.5 values for agricultural residues.

**Expected.**
- CO2 from crop-residue burning is not reported, because it is biogenic and resequestered (2006 Vol 4 §2.4 and §5.2.4).
- Only CH4 and N2O count: eq 2.27 → 2.7·28 + 0.07·265 = 94.2 g CO2e per kg DM burnt.
- The code gives 1515 + 75.6 + 2.5·265 (662.5) = 2,253 g CO2e per kg DM.

**Refutation attempt.** Is burning ever non-zero? Yes, whenever `residue_burnt > 0`, which is common in SSA cereal systems.

**Impact.** Burning is overstated about 24× whenever residues are burnt.

**Fix.** Drop the CO2 term, use the N2O row, and optionally report NOx and CO as indirect precursors.

### F04 — N retention unit error, so Nex ≈ N intake (High, CONFIRMED, verified)

**Evidence.** `ghg_emission.R:226`:
```r
ifelse(annual_growth == 0, (milk*pr/100)/6.38/no_days, (...)) / no_days
```
The milk-only branch is divided by 365 twice.

Line 233:
```r
n_excretion_rate = n_intake*(1-n_retained)*no_days
```
Here `n_retained` is an absolute kg N/day (eq 10.33) used as if it were the fraction in eq 10.31. There is a further scale mismatch: `n_intake` is for the whole herd (GE × herd size), while `n_retained` is per head.

**Verified.** The improved cows have `n_retained` = 1.3e-4, against an expected 0.048 kg N/head/day, and the effective retention fraction is 0.03%. The expected fraction is about 22%.

For pigs, lines 225-228 give growers `annual_growth*n_gain` (for example 100 kg × 0.024 = 2.4), so `1 − 2.4` makes Nex negative.

**Expected.** 2019 Refinement: Nex = (N_intake − N_retention)·365 per head, with N_retention from eq 10.33 in kg N/head/day. Equivalently, use eq 10.31 with N_retention_frac = N_retention/N_intake.

**Impact.**
- Dairy Nex is about 25–30% high (1/(1−0.22)). That bias carries into manure N2O (direct and indirect) and PRP N2O.
- Pig N2O can come out negative.

**Fix.** Compute retention per head per day, subtract it per head, then multiply by herd size.

### F05 — N2O from manure applied to soils is silently zero (High, CONFIRMED, verified)

**Evidence.**
- `ghg_emission.R:347`: `manure_produced <- as.numeric(para[["manure_produced"]])`. This field is not in the input contract or in either example, so it evaluates to `numeric(0)`.
- Line 359 then makes `n_organic_manure_managed_soil` equal to `numeric(0)`, and the row disappears from `rbind`. In the run, the direct-soil table has no organic-manure row and indirect `organic_n` = 0.
- Independently, `merge_outputs.R:787-795` (`soil_direct_pick`) doesn't list `n_organic_manure_managed_soil` at all.

**Expected.** F_AM (eq 10.34, then eq 11.1 with EF1, and eq 11.9 with FracGASM) must be included.

**Refutation attempt.** Could `nitrogen_balance` supply it? No: `ghg_emission` never reads `organic_n_kg_total`.

**Impact.** Zero-grazing systems with a lot of stall manure lose about 0.8 kg N2O per cow per year (about 200 kg CO2e/cow, roughly 5–10% of the farm total). Mixed crop-livestock intensification scenarios are biased low.

**Fix.** Use `sum_total_n_from_manure_mgmt` (excluding PRP; see F14) minus exported manure, plus purchased organic N converted to N units. Add the row to the aggregation.

### F06 — Off-farm grazing N2O is dropped, and the formula is wrong (High, CONFIRMED)

**Evidence.**
- `ghg_emission.R:482`: `annual_N20N_off_farm_direct_emission = n*EF3PRP`, with no ×44/28.
- Line 485: indirect = `direct_emission*FracGASM*EF4*44/28`. That applies FracGASM to the N2O-N emission instead of to the deposited N, which understates it 50–100×.
- `grep N20N_off_farm R/merge_outputs.R` finds nothing, so neither term reaches `ghg_balance` or the totals in `differences.R`.

**Expected.** Eq 11.1 applied to F_PRP gives the direct term. Eq 11.9 gives the indirect term as F_PRP·FracGASM·EF4·44/28.

**Impact.** In communal or off-farm grazing systems (common across SSA), all PRP N2O for that time is missing. That is typically 5–15% of the herd total at 2006 factors.

**Fix.** Correct the formulas and add the rows to `ghg_balance` (off-farm roughage block or a separate line).

### F07 — Manure-system label mismatches null out manure CH4 (High, CONFIRMED, verified)

**Evidence.** The MCF join (`ghg_emission.R:188-195`) is on `Manure_management_systems`. That key has "Pasture/Range/Paddock", but the examples and the 10.21 `systems` column use "Pasture / range / paddock".
- "Liquid/Slurry" (in 10.21) and "Pit storage  below animal confinements" (double space) have no 10.17 key.
- 10.17 has "Burned for fuel" where 10.21 has "Burned for fuel or as waste".
- An NA MCF, multiplied by a time fraction of 0, is still NA in R. So the emission for the whole animal (line 200) is NA, and `merge_outputs` `sum_num(..., na.rm = TRUE)` turns it into 0.

**Verified.** The local cows' manure CH4 is NA with the shipped label and 2.14 kg with "Pasture/Range/Paddock".

**Impact.** All manure CH4 is silently removed for any category with an unmatched label, including housed-time emissions.

**Fix.** Use one canonical key vocabulary across 10.17/10.21/10.22 and the app. Stop on unmatched keys (as `soc.R` already does). Replace NA with 0 only where time = 0.

### F08 — Duplicate keys in Table 10.21 duplicate animal rows (High, CONFIRMED, verified)

**Evidence.** In `Table 10.21`, "Liquid/Slurry" appears twice (0.005 and 0), and so does "Burned for fuel or as waste". The `left_join` at `ghg_emission.R:239` is many-to-many (dplyr warns about it).

**Verified.** Assigning "Liquid/Slurry" to the stable produced 4 rows for 3 animals, and on-farm PRP N stayed at 215.3 kg instead of 107.7 kg (doubled).

**Impact.** PRP N2O, indirect N2O and N available for soils are doubled for any animal using these systems.

**Fix.** Disambiguate the keys: "Liquid/Slurry – with crust" 0.005 and "– without crust" 0. Assert that every join key is unique.

### F09 — Soils use 2006 factors, manure uses 2019 (High, CONFIRMED, verified)

**Evidence.** JSON `table_11.1_&_table_11.3` holds:

| Factor | Code (2006 value) | 2019 aggregated default |
|---|---|---|
| EF1 | 0.01 | 0.010 (unchanged) |
| EF3PRP-CPP | 0.02 | 0.004 |
| EF3PRP-SO | 0.01 | 0.003 |
| EF1R | 0.003 | 0.004 |
| FracGASF | 0.10 | 0.11 |
| FracGASM | 0.20 | 0.21 |
| FracLEACH | 0.30 | 0.24 |
| EF5 | 0.0075 | 0.011 |

The 2019 values are from 2019 Refinement Vol 4 Ch 11 Table 11.1/11.3; I am confident of EF3PRP and EF5 and reasonably confident of the rest. Wet/dry disaggregated values also exist (e.g. EF1 wet 0.016 synthetic, dry 0.005; EF4 wet 0.014, dry 0.005).

Meanwhile, the manure-management tables are 2019 values:
- Bo, Table 10.16: Africa high/low productivity.
- MCF, Table 10.17: including pasture at 0.47%.
- EF3, Table 10.21: including anaerobic digesters.
- Eq 10.34A/B.

**Verified.** On-farm PRP gives 215 kg N × 0.02 = 6.77 kg N2O (1,794 kg CO2e). At 2019 factors it would be 1.35 kg N2O (359 kg CO2e), a difference of about 11% of the farm total.

**Refutation attempt.** Using 2006 is defensible if it is declared, but mixing the vintages is not. For the most important SSA source (PRP), the 2019 meta-analysis specifically lowered the factor for tropical, dung-dominated systems.

**Fix.** Adopt the 2019 Table 11.1 values, preferably disaggregated by wet/dry climate (the input already has `annual_prec` and `et`). Record the vintage in the JSON.

### F10 — Fertiliser N and CO2 sources are inconsistent or incomplete (High, CONFIRMED, verified)

**Evidence.**
- **N2O uses one fertiliser source, manufacture another.** `nitrogen_balance.R:78-130` takes the N content of each product only from `para$fertilizer[...]$percentage_n`. Products absent from that list, or a missing `percentage_n` field (as in `example_input.json`), give NA and then 0. Fertiliser manufacture (`ghg_emission.R:517-541`) instead uses the `feed_items` product amounts directly.
  - Verified: the oats item had urea = 400 kg/ha plus N solutions = 50, but `fertilizer_rate` = 5 kg N/ha, because urea wasn't in `para$fertilizer`. Urea manufacture emissions were still computed.
- **CAN is ignored.** CAN, the dominant top-dressing in Kenya and Tanzania, appears in `fertilizer_table` but not in `fertilizer_list` or the `nitrogen_balance` product columns.
- **Ammonia has no production emissions.** "Ammonia" production EF = 0, while "Anhydrous ammonia" = 2.6 is never used for N2O.
- **Urea CO2 is missing.** 2006 Vol 4 §11.4, eq 11.13, EF = 0.20 t C per t urea, i.e. 0.733 kg CO2 per kg urea. The "Urea" production factor (0.785) can't be assumed to include this.
- **Liming CO2 is missing.** Eq 11.12 (EF 0.12 limestone, 0.13 dolomite) is absent; "Lime-application" = 0 and isn't wired in.

**Impact.** Fertiliser N2O can be zero while fertiliser manufacture is reported. Urea CO2 is roughly equal to urea manufacture emissions and is fully missing.

**Fix.** Derive product N% from `fertilizer_table.percent_N`, a single source of truth. Add CAN, urea CO2 and lime CO2.

### F11 — Crop residue N is wrong (Medium, CONFIRMED, verified)

**Evidence.**
- `ghg_emission.R:365` computes `crop_residue_n_per_area = dry_yield*residue_n*1000` using the main-product yield. The residue yield (`residue_dry_yield`) is used for burning (line 495) and in `nitrogen_balance`.
- Lines 374-375 set `conc_of_n_from_crop_residue` and `conc_ip_n_from_crop_residue` equal to `sum(nitrogen_balance$conc_of_min_fert_n)` and `...conc_ip_min_fert_n`, which are the fertiliser N totals (copy-paste). Verified: the imported-concentrate residue N was 0.847 kg, identical to its fertiliser N.
- Line 373 reads `nitrogen_balance$rough_of_n_from_crop_residue`, a column that doesn't exist, so it is 0.

**Expected.** Eq 11.6 (2019 eq 11.6/11.7A): F_CR = AG_DM·N_AG·(1 − Frac_remove − Frac_burnt·Cf) + BG·N_BG, with the BG ratio from Table 11.1a (2019). Below-ground residue is omitted entirely.

**Impact.**
- Residue N2O is biased in the direction of the ratio of main-product yield to residue yield. For cereals with a harvest index of about 0.4–0.5 it is roughly right in magnitude but for the wrong reason.
- Off-farm concentrate residue N2O double-counts fertiliser N.
- Below-ground residue N (often 20–30% of F_CR) is missing.

**Fix.** Use `residue_dry_yield`, add a BG term, and compute off-farm residue N the same way as on-farm.

### F12 — Leaching/runoff indirect N2O is omitted (Medium, CONFIRMED)

**Evidence.**
- `ghg_emission.R:288-291` computes only volatilisation. The comment "equation 10.28" is the leaching equation, but the code is volatilisation (eq 10.27).
- `Frac_leach_MS_*` is loaded but used only in Frac_LOSS.
- For soils (lines 468-472), only eq 11.9 is implemented. FracLEACH and EF5 are in the JSON but unused.

**Expected.** Eqs 10.28–10.29 (manure) and 11.10 (soils): N2O_L = (F_SN + F_ON + F_PRP + F_CR + F_SOM)·FracLEACH·EF5·44/28, where the water balance indicates leaching. The model has `annual_prec` and `et` for that test.

**Impact.** In humid zones, 0.24·0.011 (2019) = 0.0026 per kg N, about 26% of direct EF1. So soil N2O is biased low by up to about 20% in wet areas.

**Fix.** Implement both equations, applying the leaching condition from the water balance.

### F13 — Inconsistent area and allocation basis (Medium, CONFIRMED)

**Evidence.**
- `land_requirement.R:99-107` defines `area_total` as the whole crop area needed for the feed, and `area_feed` as the mass-allocated feed share when residues are fed.
- In `ghg_emission.R`, fertiliser manufacture (517-541), residue N (366), burning (495) and rice CH4 (583) use `area_total`.
- `nitrogen_balance.R:66` sets `area_total <- sum(area_feed)`, which feeds the fertiliser N2O, and SOC (`soc.R:106`) uses `area_feed`.

**Impact.** For residue feeds (stover, straw), livestock carry 100% of the crop's fertiliser manufacture, burning and rice CH4, but only a mass share of fertiliser N2O. For stover with a harvest index of about 0.5, those sources are overcharged about 2×.

**Fix.** Choose one allocation rule (mass, economic, or the FAO LEAP feed guidance) and apply it to all crop-stage emissions.

### F14 — Grazing N counted under both a manure system and PRP (Medium, CONFIRMED)

**Evidence.**
- Direct manure N2O (line 251) and volatilisation (line 290) apply the manure-system factors EF3 and FracGasMS to `n_excretion_rate*time_in_onfarm_grazing` whenever `manureman_onfarm_grazing` is not pasture.
- Lines 318 and 472 always treat the same N as PRP (EF3PRP, FracGASM).
- `example_input.json` sets `manureman_onfarm_grazing = "Dry lot"` (EF3 = 0.02).

**Refutation attempt.** If users always select pasture for grazing time, EF3 is NA and set to 0, so there is no double count. The UI doesn't enforce this, and the shipped example violates it.

**Impact.** Direct N2O on grazing N is about double (0.02 + 0.02), and indirect is doubled.

**Fix.** Define PRP N as the N of grazing time whose manure system is pasture. Route every other manure system's N to eq 10.34 and then to F_AM.

### F15 — Rice CH4 and rice N2O errors (Medium, CONFIRMED)

**Evidence.**
- `ghg_emission.R:581`: `SFo = (1 + fertilizer_rate*conversion_factor)^0.59`. `fertilizer_rate` is synthetic N (kg N/ha). Eq 5.3 requires the organic amendment rate ROA in t fresh weight/ha.
- JSON `table_5.13` sets "flooded pre-season (<30 days)" to SFp = 0. That zeroes the emission; the 2006 Table 5.13 note says short pre-season flooding is not considered (treat as non-flooded, about 1.0).
- Rice N is in `farm_min_fert_n` (EF1) and again in `n_synthetic_fertilizer_flooded_rice` (EF1R). Both are aggregated (`merge_outputs.R:787-795`).
- EFc = 1.30 is the 2006 value. The 2019 Refinement revised the default (I believe 1.19 kg CH4/ha/d globally; verify).
- `if (rice$source_type != "Purchased")` errors when there are multiple rice rows (R ≥ 4.2). `source_type` takes the values Main/Residue, so the test is always TRUE.

**Impact.** With 50 kg N/ha and FYM, SFo is 3.4× instead of about 1.0–1.7×. Rice CH4 is either inflated about 2–3× or zeroed.

**Fix.** Add an ROA input, correct SFp, remove the rice N double count, and update to 2019 Table 5.11–5.14.

### F16 — Ym selection (Medium, PLAUSIBLE)

**Evidence.** `ghg_emission.R:117-125`. With the default `ym_prod = FALSE`:
- Dairy Ym is chosen by DE alone, ignoring milk yield.
- Any "Non-dairy" animal with DE ≥ 0.72 gets the feedlot Ym of 4.0, and ≥ 0.75 gets 3.0. With DE computed as ME/0.81/18.45, a concentrate-heavy calf or heifer diet reaches this easily.
- Any label not matched exactly (e.g. "Dairy Cows") falls through to Ym = 0 with no warning.
- Pigs get Ym = 0. The IPCC Tier 1 swine enteric factor is about 1–1.5 kg CH4/head/yr.
- Lambs get the adult Ym of 6.7. The 2019 Table 10.13 lamb value is 4.5, as I recall.
- JSON `Table 10.12[0]` has high-producing dairy at Ym 5.85, MY 19.5. My recollection of 2019 Table 10.12 is Ym 5.7, MY 19.0 (verify). The medium, low and non-dairy rows match.

**Impact.** Up to −40 to −55% enteric CH4 for young stock on good diets. The exact-match fallback silently zeroes enteric CH4.

**Fix.** Restrict the feedlot rows to an explicit feedlot flag. Stop on unmatched categories. Add a lamb row and a swine Tier 1 value.

### F17 — SOC parameter and scope problems (Medium, CONFIRMED)

**Evidence.**
- JSON `grassland.management` includes `"Medium": 1.5`. No such FMG exists in 2006 Table 6.2; the values there are nominal 1.0, moderately degraded 0.95–0.97, severely degraded 0.7, improved 1.14–1.17. The cropland factors match 2006 Table 5.5 exactly, but the 2019 Refinement revised Table 5.5; verify the update.
- FI (`High` = 1.11) is applied whatever the FMG, although IPCC defines it only for improved grassland.
- Grassland SOC_ref is hardcoded at 40 t C/ha (`soc.R:142, 176`) with no climate or soil lookup, which is inconsistent with the measured value used for cropland.
- Off-farm and imported-concentrate land gets the farm's `soil_c` and management factors (`soc.R:106`).
- `grassland_toarable` and `arable_tograssland` are inputs but are never used. There is no LUC, and no biomass loss on conversion (2006 Vol 4 eq 2.16 and Ch 5–6). Organic soils are set to 0 (lines 210-216).

**Impact.** Selecting "Medium" grassland management gives +1 t C/ha/yr (3.7 t CO2/ha/yr) of spurious sequestration, every year. Feed expansion LUC, the largest footprint term for imported soy or maize, is excluded.

**Fix.** Remove the non-IPCC key, gate FI on "Improved", look up SOC_ref, and implement LUC from the existing inputs.

### F18 — Intensity denominators and system boundary (Medium, CONFIRMED)

**Evidence.**
- `differences.R:300-318` divides the same whole-herd total by milk (FPCM), again by meat, and again by protein. There is no allocation (IDF 2022 / FAO LEAP biophysical or protein allocation), so each intensity carries 100% of the emissions.
- FPCM uses the FAO 2010 form (0.337 + 0.116F + 0.06P). The current IDF standard is 0.1226F + 0.0776P + 0.2534.
- `protein_kg_year_milk` (`land_productivity.R:62`) multiplies FPCM mass (not raw milk) by protein%.
- The boundary excludes LUC, on-farm energy, feed transport and processing, although it includes fertiliser manufacture.

**Impact.** In dual-purpose SSA herds, "kg CO2e/kg meat" and "per kg FPCM" are both overstated relative to allocated LCA values, and can't be compared with FAO GLEAM or IDF numbers.

**Fix.** Implement an allocation option, label intensities "unallocated", and document the boundary.

### F19 — Intake taken as max(energy, CP) (Medium, PLAUSIBLE)

**Evidence.** `energy_requirement.R:174`: `dmi_s = max(dmi_required_cp, dmi_required_e)`.

This assumes animals on protein-deficient diets (e.g. stover at 3.9% CP) eat more DM to meet protein. Biologically, low CP depresses intake. GE, and so CH4, VS and Nex, scale with this DMI.

**Refutation attempt.** It may be intended as "feed required" for land-use purposes. For emissions, though, the animal's actual intake matters. The design choice partly offsets F02.

**Fix.** Use energy-based intake (with correct REM/REG) for GHG, and report the CP deficit separately.

### F20 — GWP set (Low, CONFIRMED)

**Evidence.** `merge_outputs.R:693-694` uses CH4 = 28 and N2O = 265 (AR5, no climate-carbon feedback). This is consistent across all terms and matches UNFCCC reporting under the Paris Agreement's enhanced transparency framework (ETF).

It is not documented, and there is no AR6 option (CH4 non-fossil 27.0, fossil 29.8; N2O 273) or GWP* for biogenic CH4. That matters for livestock mitigation claims.

**Fix.** Parameterise and document the GWP set.

### F21 — Fertiliser manufacturing factors (Low, CONFIRMED)

**Evidence.** In JSON `fertilizer_table`:
- DAP is stored as 2.8 kg CO2e/kg N × 0.18 = 0.504 per kg product.
- AN is stored as 2.8 per kg product (about 8.2 per kg N at 34% N). That is plausible for plants without N2O abatement, but it suggests the bases were mixed.
- No source is given.

`ghg_emission.R:523`: the final `else` assigns the urea quantity to "Anhydrous ammonia". Verified: the `fertilizer_applied` summary reports 176 kg CO2e for anhydrous ammonia that was never applied. This summary is not propagated to `ghg_balance`, which uses `fertlizer_emission_by_crop`.

**Fix.** Cite the source (e.g. Brentrup et al. 2018 or ecoinvent), use a per-kg-N basis with a regional (non-EU) production mix, and fix the `ifelse` chain.

### F22 — Examples don't run and misapply climate (Low, CONFIRMED)

**Evidence.**
- Both example inputs lack `crop_name`, and `example_input.json` also lacks `fat_milkcontent`, `cp_lys_*` and `n_manure_content`.
- `example_input.json` describes Muheza (Tanga, Tanzania: humid tropical lowland) but sets `climate_zone_2 = "Warm Temperate Dry"` and `cropland_system = "Long term cultivated, temperate/boreal, dry"`.
- `soil_depth = 2`.
- `qt_example.json` has AN at `percentage_n = 12` (AN is about 33–35% N), residue_n = 0.2 (20% N), and bulk density = 6.

Nothing checks climate consistency across `climate_zone_2`, the cropland factor labels and the grassland labels.

**Impact.** Users copying the examples inherit temperate MCFs and SOC factors. For solid storage, tropical 5% vs 4% is only a small difference, but the SOC factors differ substantially.

### F23 — Minor Tier 2 details (Low, CONFIRMED)

- Lactating Cfi 0.386 is applied to all cows year-round (`energy_requirement.R:47-50, 73-79`). IPCC applies it only during lactation, so NEm is about 5–10% high for cows with long dry periods.
- Buffalo get no class in `productivity1` (`ghg_emission.R:148-167`), so Bo is NA and manure CH4 is NA.
- `Table_m` lists "Buffalo - Steers/heifers" twice, which duplicates rows in the VS join.
- The small-ruminant and swine high/low productivity split at DE 0.72 has no IPCC basis. 2019 Table 10.16 defines productivity by system.
- Deep-bedding EF3 "no mixing" and "active mixing" are relabelled as "> 1 month" and "< 1 month".
- The `N20N` naming implies N2O-N, but most of those values are already N2O (×44/28).

---

## What's done well

- The Tier 2 chain is correctly structured for the IPCC equations: enteric (eq 10.21, /55.65 correct), VS (eq 10.24, 18.45 MJ/kg), manure CH4 (eq 10.23, 0.67 kg/m³, MCF as fractions consistent with the JSON), direct and volatilisation N2O (eqs 10.25–10.27), and eq 10.34A/B (2019).
- The 2019 Refinement Bo for Africa (high/low productivity), the MCF by climate zone (including pasture 0.47% and the anaerobic-digester rows) and the EF3 tables are loaded as data, not hardcoded.
- Units in the GHG path are carried consistently as annual herd totals, and 44/28 is applied before the GWP in every aggregated N2O term.
- The SOC factor lookup stops on unknown keys (`soc.R:39-71`). That pattern should be copied to the GHG joins (F07, F08).
- The 2006 values for the cropland FLU/FMG/FI and the burning emission factors are transcribed accurately.

## Open questions for the authors

1. What are the intended units of `soil_depth`, `soil_c`, `residue_n`, `purchased_manure` and the feed-item fertiliser amounts (kg product/ha or kg N/ha)?
2. Is SOC meant to be a baseline-to-scenario change, or an absolute annual flux? If absolute, what is the land-use history assumed?
3. Were NE requirements intentionally converted to intake with ME densities (inherited from the CLEANED Excel), and was this validated against measured intakes or GLEAM?
4. Which IPCC vintage is the target: 2006, 2019, or mixed? Should wet/dry disaggregated 2019 factors be used, given that precipitation and ET are already inputs?
5. Where do the fertiliser manufacturing factors come from (region, year, with or without N2O abatement)? Does "Urea 0.785" include the CO2 released on application?
6. What allocation rule should apply between milk, meat and manure, and between food and feed co-products of a crop (area_total vs area_feed)?
7. Is `manure_produced` a planned input? Where should exported manure be subtracted?
8. Is the off-farm grazing N2O block (`N20N_off_farm`) intentionally excluded from totals?
9. Is there a canonical manure-management vocabulary shared between the app and the JSON tables?
