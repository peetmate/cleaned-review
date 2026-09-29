# 02 — Livestock nutrition, energy and herd review of `cleaned` v0.7.0

Reviewer role: ruminant nutrition / livestock systems (adversarial). Source: `CIAT/cleaned` @ 800d53a (read-only). How I checked it: I sourced `R/feed_quality.R` and `R/energy_requirement.R` into Rscript and ran them on `inst/extdata/example_input.json`. The example needed two patches before it would run (both are findings: C-01 and M-01). I reproduced the livestock-N block of `R/ghg_emission.R` by hand and compared it with IPCC 2006/2019 Tier 2. Scripts are in the session scratchpad (`run2.R`, `run3.R`). I did not change the source.

## Verdict

The feed-demand engine has a basic unit error. It adds up IPCC **net energy** requirements (NEm, NEa, NEg, NEl, NEp) and divides them by the feed's **metabolisable energy** density. There is no km/kl/kg or REM/REG conversion anywhere. This makes energy-driven DMI about 35–50% too low for cattle, and too low by a larger margin for growth and for small ruminants. The error carries through to land requirement, enteric CH4, VS and N excretion. In the example the bias is hidden because DMI is taken as `max(DMI_energy, DMI_CP)` with no intake cap. For low-CP tropical diets this gives physically impossible intakes: 4.4% of body weight for a 600 kg cow on a 5.3 MJ ME/kg DM ration. In the IPCC N-excretion block, retention is in kg N/day but the code uses it as a fraction. For dairy cows it is also divided by 365 twice. So N excretion comes out 30–45% too high and N retention is effectively zero. Neither shipped example dataset runs end-to-end: the column names, the DM units and the livestock labels don't match the code. Herd dynamics (mortality, replacement, offtake) are not modelled at all. As it stands, I would not trust absolute DMI, land, CH4 or N outputs from this model. Scenario differences inherit the same biases, but less severely.

## Findings table

| ID | Sev | Verdict | Location | Issue |
|---|---|---|---|---|
| C-01 | Critical | CONFIRMED | R/energy_requirement.R:79-128,140,170 | NE requirements are divided by ME density with no NE→ME (km/kl/kg or IPCC REM/REG) conversion, so energy DMI is 50–63% of IPCC. |
| C-02 | Critical | CONFIRMED | R/ghg_emission.R:226,233 | N retention (kg N/d) is used as a fraction in `n_intake*(1-n_retained)`, and dairy retention is divided by 365 twice. Nex is 31–46% too high. |
| H-01 | High | CONFIRMED | R/energy_requirement.R:174,180 | DMI = max(energy DMI, CP DMI) with no fill or BW cap. CP-limited diets inflate DMI, ME intake, CH4, manure and land (example cow: 26.6 kg DM/d = 4.4% BW). |
| H-02 | High | CONFIRMED | R/energy_requirement.R:96-101,109; lkp_livetype | Small-ruminant growth and lactation use IPCC eq 10.7/10.10 with `body_weight_weaning`/`body_weight_year_one`, which default to 0. NEg falls to `a` only (3–10× too low) and ewe/doe NEl falls to 0. |
| H-03 | High | CONFIRMED | R/energy_requirement.R:106; R/land_productivity.R:60; example_input.json | The code needs `fat_milkcontent`, `cp_lys_pregnancy`, `cp_lys_growth`, `lw_gain_piglets`, `proportion_growth_piglets_milk` and `n_manure_content`. The example, the DB and the input mappings supply `fat_content`, `cp_pregnancy` and so on, so `energy_requirement()` errors on the shipped example. |
| H-04 | High | CONFIRMED | R/ghg_emission.R:226 | Growth N retention divides NEg (MJ/d) by WG in kg/yr (not kg/d). The 7.03·NEg/WG term shrinks about 365×, so protein in gain is about 268 g/kg instead of about 185 g/kg. |
| H-05 | High | CONFIRMED | R/energy_requirement.R:198-212 vs R/ghg_emission.R:233 | There are two independent manure-N pathways. N balance uses manure DM × 0.029 (with manure DM = 0.365 × DMI); GHG uses the IPCC Nex. For the example cow the N balance gets 0 kg collected manure N while GHG gets 89 kg N/yr. |
| M-01 | Medium | CONFIRMED | R/feed_quality.R:44; example_input.json; data/mufindi.rda | The example lacks `crop_name`, so `unnest()` errors. The example DM is a fraction (0.3) where the DB/contract use % (87). Concentrate `dm_content = 0` removes it from the diet. mufindi labels ("Cows (high productive)") don't match the class vectors, so Cfi comes out NA. |
| M-02 | Medium | CONFIRMED | lkp_livetype (cleaned.sqlite) me_* columns | The DB carries an ME-based requirement system (`me_maintenance` 60.6 MJ/d for a 600 kg cow, `me_lactmilk` 5.5, `me_growth` 50 MJ/kg). The code ignores it, and hard-codes pig growth at 45 and pig pregnancy at 171. |
| M-03 | Medium | CONFIRMED | R/ghg_emission.R:206-229 | `n_intake` is herd total (from herd-level GE); `n_retained` is per animal. They are mixed whenever herd_composition > 1. |
| M-04 | Medium | CONFIRMED | R/land_productivity.R:55-56 | Meat = herd LWG × carcass fraction. Growth of retained replacements counts as meat; culled adults, mortality and offtake are ignored. There is no herd model. |
| M-05 | Medium | CONFIRMED | R/energy_requirement.R:133,142-144 | Ewe/doe CP: `cp_lactation` (2 × cp_maint × lactation length) is added **and** `annual_milk × cp_lactmilk`, so lactation protein is counted twice when milk is recorded. |
| M-06 | Medium | CONFIRMED | lkp_feeditem (cleaned.sqlite) | Implausible feed library values: Brachiaria CP = ME (7.25/7.25), oat straw CP 0, lupin ME 19 and groundnut kernel ME 21.2 MJ/kg DM (de_fraction > 1), maize stover ME 9.13, sweet-potato tuber (fresh) DM 59%. |
| M-07 | Medium | CONFIRMED | ../cleaned/data/ilri_feed_db.xlsx sheet ilri_feed_db | 995 rows (3.1% of ME rows) have ME > 16 alongside IVDMD < 20, so the ME and IVDMD columns are swapped. DM is on a lab (air-dry) basis, median 91%. |
| M-08 | Medium | PLAUSIBLE | R/energy_requirement.R:92,110,134,141 | Pig "CP" fields in the DB look like lysine-scale values (sow cp_maintenance 0.030 kg/d) but are compared against feed CP%. The pig growth value of 45 MJ/kg gain looks like a total ME:gain that already includes maintenance. |
| M-09 | Medium | CONFIRMED | R/energy_requirement.R:146-185 | Requirements are spread pro rata over seasons, and the feed basket is always assumed to meet them. There is no availability check, no deficit or liveweight loss, and no seasonal milk variation. |
| L-01 | Low | CONFIRMED | R/energy_requirement.R:190-191 | `sum(x, na.omit=TRUE)` is not `na.rm`: it adds 1 to each total and does not drop NAs (verified: dmi_cp_total = dmi_tot + 1). |
| L-02 | Low | CONFIRMED | R/energy_requirement.R:94 | "Steers/heifers" and "Calves" use C = 1.0 (castrate). Heifers should use 0.8, so NEg is about 15% low for heifers. |
| L-03 | Low | CONFIRMED | R/energy_requirement.R:117 | Pregnancy uses Cpregnancy = 0.10 for all non-pig classes. IPCC gives sheep/goats 0.077 (single) and 0.126 (twins). |
| L-04 | Low | PLAUSIBLE | R/energy_requirement.R:84,86,100 | Sheep Ca for housed ewes is 0.0096 (IPCC 2006 Table 10.5: 0.0090). Goat grazing uses 0.019 and lambs use a = 2.3, b = 0.4; I could not match either to IPCC. |
| L-05 | Low | CONFIRMED | R/energy_requirement.R:109 | Eq 10.10 uses the weaning **weight**, where IPCC uses the lamb's **gain** from birth to weaning (about 15–25% high). Litter size is ignored. |
| L-06 | Low | CONFIRMED | R/land_productivity.R:60-62 | Milk protein and energy are applied to FPCM rather than raw milk (+5.8% in the example). The cow FPCM formula is applied to goat and sheep milk too. The `merge_outputs.R:457` fallback uses per-animal milk. |
| L-07 | Low | CONFIRMED | R/merge_outputs.R:530 vs R/differences.R:196 | Adult-male-equivalent days are computed with 2500 kcal in one file and 2100 kcal in the other. |
| L-08 | Low | CONFIRMED | R/energy_requirement.R:33,167 | Season shares use a fixed 365 days, so they are not normalised when season lengths don't sum to 365. `season_length()` handles only 2 seasons, has an off-by-one, and is unused. |

Counts: Critical 2, High 5, Medium 9, Low 8.

## Detailed findings

### C-01 NE requirements met with ME (no efficiency conversion). Critical, CONFIRMED
- **Evidence.** `energy_parameters.json` "Table 10.4" gives the IPCC NEm Cfi (0.322/0.386/0.370/0.217/0.236/0.315). L79 computes `er_maintenance = Cfi*BW^0.75`, which is **NEm**. L93-101 compute NEg (IPCC 10.6/10.7), L106-111 NEl (10.8), L117 NEp and L122 NEwork. L140 sums them and L170 does `fresh_intake_required_e = energy_required_by_season/average_me`, where `average_me` is ME from `me_content` (MJ ME/kg DM). I found no km, kl, kg, REM or REG anywhere in `R/`.
- **Expected.** IPCC 2006/2019 Eq 10.16: GE = [(NEm+NEa+NEl+NEwork+NEp)/REM + NEg/REG]/(DE%/100). Or, in an ME system (AFRC 1993/CSIRO), MEm = NEm/km (≈0.70), MEl = NEl/kl (≈0.62), MEg = NEg/kg (≈0.3–0.45).
- **Magnitude.** I ran the example (run3.R). Code DMI as a share of IPCC DMI: cow 0.58/0.61/0.63, heifers 0.51/0.55/0.58, calves 0.49/0.53/0.56, at DE = 55/60/65% respectively. The DB's own ME system (`lkp_livetype`) gives about 119 MJ ME/d for the example cow; the code uses 82.8. For small ruminants: DB ewe me_maintenance is 8.64 MJ ME/d, while the code gives 0.217·53^0.75 = 3.76 (−56%).
- **Impact.** Energy-limited DMI is about 35–50% too low, which drives land requirement, enteric CH4 (GE = DMI·18.45), VS and N intake down. Pigs are internally consistent (Cfi 0.44 is ME, NRC 1998), so ruminant and pig results are on different bases.
- **Fix.** Implement IPCC Eq 10.14–10.16 (REM/REG from diet DE) and derive GE→DMI. Alternatively, convert each NE term with AFRC km/kl/kg from qm = ME/GE. Then use the same DMI for land and GHG.

### C-02 IPCC N retention used as a fraction and double-annualised. Critical, CONFIRMED
- **Evidence.** `ghg_emission.R:226`: `n_retained = ifelse(!Pigs, ifelse(annual_growth==0, milkN/6.38/no_days, milkN+growthN)/no_days, …)`. The `/no_days` outside the ifelse applies again to the dairy branch, so dairy retention is divided by 365². Then L233 does `n_excretion_rate = n_intake*(1-n_retained)*no_days`.
- **Expected.** IPCC 2019 Eq 10.31 is Nex = (N_intake − N_retention)·365, with both terms in kg N/animal/day. The 2006 form uses N_intake·(1 − N_retention_frac) with a *fraction* from Table 10.20.
- **Magnitude (example).** Nex code vs correct: cow 89.4 vs 68.2 kg N/yr (+31%); heifers (herd) 49.7 vs 43.3 (+15%); calf 12.8 vs 8.8 (+46%). Cow retention used: 0.00016 against the correct 0.058 kg N/d. The overstatement propagates to direct and indirect manure N2O, and to `total_n_from_manure_mgmt`.
- **Fix.** Compute everything per animal per day (milk/365, WG = annual_growth/365), use Nex = N_intake − N_ret, then multiply by herd.

### H-01 DMI = max(energy DMI, CP DMI), uncapped. High, CONFIRMED
- **Evidence.** L174 `dmi_s = ifelse(dmi_required_cp>dmi_required_e, dmi_required_cp, dmi_required_e)` and L180 `me_intake_s = dmi_s*…`. Example (5.8% CP, 5.3 MJ ME/kg DM): every season is CP-limited, and the cow DMI is 26.6 kg DM/d (4.4% BW), the calf 4.2% BW.
- **Expected.** A 600 kg cow on NDF-rich forage can eat roughly 1.2% BW as NDF, which is about 2–2.5% BW as DM (Mertens; NASEM 2021 DMI equations). An animal on a CP-deficient diet eats *less* and produces less; it does not over-eat to meet CP.
- **Impact.** On low-CP tropical rations, DMI, ME intake, enteric CH4, manure and land are all inflated. The error also partly and accidentally cancels C-01, so results depend on which constraint happens to bind. Scenario comparisons can flip sign.
- **Fix.** Base DMI on energy, apply an intake cap (BW or NDF fill), and *report* CP deficit and energy/CP balance instead of force-feeding. Optionally back-calculate the milk or growth the diet can support.

### H-02 Small-ruminant growth and lactation silently collapse with default weights. High, CONFIRMED
- **Evidence.** L96-101: NEg = annual_growth·(a + 0.5·b·(BW_weaning + BW_year_one))/365. The example and the DB defaults have `body_weight_weaning = body_weight_year_one = 0`, so NEg = annual_growth·a/365 (e.g. castrates 4.4 MJ/kg, where IPCC gives about 14 MJ/kg at 20→40 kg, and the DB `me_growth` is 46 MJ ME/kg). L109: if `annual_milk == 0`, ewe/doe NEl = 5·BW_weaning/365·EV, which is 0.
- **Impact.** Sheep/goat growth energy is 3–10× too low and suckling-ewe lactation energy is zero unless the user fills fields that are not in `lkp_livetype`.
- **Fix.** Validate that these fields are > 0 for sheep and goats, or fall back to the DB ME values. Use WG = BWf − BWi, consistent with eq 10.7.

### H-03 Column contract broken between the code and every data source. High, CONFIRMED
- **Evidence.** Running on the example stops at L106 with `object 'fat_milkcontent' not found`. The example JSON, `lkp_livetype` and `data/mappings/input_mappings.csv` all use `fat_content`, `cp_pregnancy`, `cp_growth`, `lw_gain`, `proportion_growth` and `n_content`. The code and `vignettes/input-contract.Rmd` use `fat_milkcontent`, `cp_lys_pregnancy`, `cp_lys_growth`, `lw_gain_piglets`, `proportion_growth_piglets_milk` and `n_manure_content`. The same break is in `land_productivity.R:60`.
- **Refutation attempt.** I searched `R/` for a rename or mapping step and found none apart from the `livetype_code` rename. The app may rename columns upstream; this is not visible in the package.
- **Fix.** Add a validation and rename layer at the entry point, and ship a runnable example with a regression test. The only test file is a `context()` line with no tests.

### H-04 Growth N retention unit error. High, CONFIRMED
- `268 − 7.03·er_growth/annual_growth` mixes MJ/d with kg/yr. Heifer example: NEg/WG should be 3.86/0.329 = 11.7 MJ/kg, which gives 186 g protein/kg. The code gives about 268 g/kg (+44% protein in gain). This is partly masked by C-02. Fix: WG = annual_growth/365.

### H-05 Two inconsistent manure-N estimates. High, CONFIRMED
- `energy_requirement.R:203` sets manure DM = DMI·0.365 (fixed, whatever the diet digestibility; example DE is 36%, which implies faecal DM of about 60% of DMI). L207/L211 then set N = manure DM·`n_manure_content`. `nitrogen_balance.R:135-148` uses that value, while GHG uses the IPCC Nex (C-02). In the example, `manure_in_stable = 0` with `time_in_stable = 1`, so the N balance gets 0 collected manure N while GHG N2O is computed on 89 kg N/yr. **Fix:** derive a single Nex from N intake minus retention, and partition it by time and location for both modules.

### M-01 Shipped examples are not runnable, and their units are inconsistent. Medium, CONFIRMED
- `feed_quality.R:44` needs `crop_name`, which the example lacks. Example `dm_content` values are 0.3, 0.29, 0.15 and 0 (fractions); the DB and contract use % (87, 15, 90). DMI is invariant to DM scaling (it cancels: DMI = E·Σf·DM/Σf·DM·ME), but `fresh_intake_required_*` comes out 100× too high (about 5.5 t fresh/cow/day in S1). Concentrate DM = 0 zeroes its ME and DM silently, and L132 turns NA/NaN into 0. `mufindi.rda` livetype labels lack the "Cattle - " prefix, so every Cfi is NA.

### M-02 ME requirement data in the DB bypassed. Medium, CONFIRMED
- `lkp_livetype` has `me_maintenance` (≈0.50 MJ ME/kg^0.75 for cattle and sheep), `me_lactmilk` 5.5 MJ/kg, `me_growth` 50/46/45 MJ/kg and `me_pregnancy` 1500/170. None are read by the code. Pig values are hard-coded (`45` at L92, `171` at L116), which hides where they came from. Either wire this ME system in or drop it; right now the app shows parameters that have no effect.

### M-03 Herd vs per-animal mixing in N. Medium, CONFIRMED
- `ge_intake` and `dmi_tot` are herd totals (energy × herd_composition at L140); `annual_milk` and `annual_growth` in `n_retained` are per head. The mismatch scales with herd size.

### M-04 No herd dynamics; meat from LWG. Medium, CONFIRMED
- `herd_composition` is a static count. There is no mortality, fertility-driven calf crop, replacement rate or offtake. `meat_production_animal = number·annual_growth·carcass_fraction` counts replacement heifer growth as meat and gives zero meat from culled cows. For East/West African herds, where mortality is 5–15%/yr and offtake is low, per-kg-product intensities are therefore biased. The direction depends on the herd, but typically too little product is credited to the breeding herd.

### M-05 Small-ruminant lactation CP double-counted. Medium, CONFIRMED
- L133 computes `cp_lactation` (overwriting the input column). L143 adds `cp_lactation/BI`, and L144 adds `annual_milk*cp_lactmilk` without making the two exclusive. The energy side (L109) makes them exclusive; the CP side does not.

### M-06 Feed library (cleaned.sqlite `lkp_feeditem`) plausibility. Medium, CONFIRMED
- Brachiaria brizantha CP 7.2548 = ME 7.2548, and the hybrid's CP = ME + 1: a copy error. Oats straw CP 0 (expected about 3–4% DM), which forces CP-limited DMI through H-01. Lupin grain ME 19 and groundnut kernel ME 21.2 MJ/kg DM give de_fraction 1.25 and 1.40; lupin should be about 13–14 (Feedipedia). Maize stover ME 9.13 (codes 48 and 53) against about 6.5–7.5 in the ILRI/Feedipedia range (+25%). Sweet-potato tuber "fresh" DM 59%, where fresh tubers are about 25–35%. I did not audit all 132 rows.

### M-07 ILRI and ERA libraries (parent repo `data/`). Medium, CONFIRMED
- `ilri_feed_db.xlsx`/`ilri_feed_db`: 995 rows have ME 16–74 alongside IVDMD < 20, a column swap (e.g. "Food oats 1": ME 73.7, IVDMD 10.6). DM is on a lab-sample basis (median 91%) and can't be used as fresh DM for forages. `ERA_nutrition_library.xlsx`/`Means`: CP is in g/kg (max 941 g/kg, which is implausible), DM mixes "% as fed" and "g/kg", and there is Desmodium ME 16.1. These must be converted before they enter `feed_items` (the contract says % DM). These files are not read by `R/`, so the risk arises at app or connector level.

### M-08 Pig protein and growth basis. Medium, PLAUSIBLE
- DB sow `cp_maintenance` 0.030 kg/d and grower `cp_lys_growth` 0.05 kg/kg look like lysine-scale values, yet they are compared against feed CP%. The contract itself calls them "CP/lysine". If they are lysine, the pig CP requirement is about 15× too low. Pig growth at 45 MJ ME/kg gain resembles whole-diet ME per kg gain (which includes maintenance), which would mean maintenance is counted twice. The authors need to confirm the source.

### M-09 No seasonal feed balance. Medium, CONFIRMED (design)
- The annual requirement is split by season length (L167), and DMI is whatever the basket needs, so dry-season deficits, weight loss and compensatory gain can't appear. This matters for Sahelian and East African dry seasons, where cattle routinely lose 10–20% of liveweight.

### Low items (brief)
- **L-01.** `sum(dmi_required_e, na.omit=TRUE)`: `na.omit` is swallowed by `...` as the value 1. Verified: `sum(c(1,2),na.omit=TRUE)` returns 4.
- **L-02.** IPCC C = 0.8 for females; mixed "steers/heifers" and calves use 1.0.
- **L-03.** IPCC Table 10.7: sheep and goats 0.077/0.126. The pregnancy term is also applied to any class with birth_interval > 0; the finite guard only catches 0.
- **L-04.** Sheep Ca values. Unsure of the goat source; please cite.
- **L-05.** Eq 10.10 WG_wean is the gain from birth to weaning, not the weaning weight.
- **L-06.** FPCM uses FAO/GLEAM 0.337 + 0.116F + 0.06P, which is correct for cow milk. Protein should be taken from raw milk. The fallback at merge_outputs:457 is per head.
- **L-07.** AME divisor is 2500 vs 2100.
- **L-08.** No days normalisation; `season_length()` omits the end day and is unused.
- **Also.** All "Cows" get the lactating Cfi of 0.386 all year, including the dry period (slight overestimate). `distance_to_pasture` is unused.

## Done well
- The IPCC Tier 2 equation forms (10.3, 10.4, 10.6 with C = 0.8/1.0/1.2, 10.7 a/b constants for males, castrates, females and goats, 10.8, 10.11, 10.12, 10.13) are transcribed correctly. The error is in how they are combined, not in how they are written.
- The sow lactation ME follows NRC 1998 correctly: (4.92·gain − 90·n)/0.72 → 6.83 and 0.125 Mcal, ×4.2 MJ.
- Pigs use an ME Cfi (0.44 MJ/kg^0.75, matching NRC 106 kcal) that is consistent with ME feed values.
- DMI is invariant to feed-allocation scaling and DM units, because the ratio construction cancels them (only fresh intake is affected).
- The milk "× herd number" change is applied **once** in `land_productivity.R:60` and summed once in `merge_outputs.R:502-506`. Energy uses per-head `annual_milk` × `herd_composition` once (L140). I found no double multiplication.

## Open questions for authors
1. Was the NE-divided-by-ME approach deliberate (e.g. inherited from the CLEANED Excel tool), and was it ever benchmarked (`auxilary_info/CLEANED_benchmark_RGQ.xlsx`)?
2. Is `feed_basket.allocation` meant to be % as fed or % DM? The code treats it as as-fed (`fraction_as_fed`). App users usually think in DM.
3. Is `annual_milk` offtake milk or total yield? Suckling calves' milk intake isn't credited in the calves' energy balance.
4. Where do the pig 45 MJ/kg and 171 MJ values, the goat Ca of 0.019, and the lamb a = 2.3, b = 0.4 come from?
5. Are the pig `cp_*` fields CP or lysine?
6. Which renaming layer (app side?) maps `fat_content` → `fat_milkcontent` and similar, and why does the package ship an example that fails?
7. Should there be a DMI cap and explicit deficit reporting instead of `max(E, CP)`?
