# cleaned v0.7.0: critical issues, demonstrated



This page shows each critical issue in the `cleaned` R package (v0.7.0, `staging` @ `800d53a`), which the iCLEANED app uses for its calculations. For each issue it compares three things:

- **Current:** the package as it is today.
- **Fixed:** a temporary copy of the package with the proposed fix applied. The repository itself is not changed.
- **IPCC:** an independent calculation written from the IPCC source text, citing the equation and page.

Every number is produced when this page is built, from the code shown. The full fix log is in `07_fix_log.md`.

## 1. Feed intake: net energy treated as metabolisable energy

The IPCC equations give an animal's energy requirement as **net energy** (NE). Feed supplies **metabolisable energy** (ME), and only part of it becomes net energy. IPCC 2019 Eq. 10.14–10.16 (Vol 4 Ch 10, pp. 10.29–10.30) converts between them with the efficiency ratios REM and REG. The package skips that step (`R/energy_requirement.R:170`), so it underestimates how much an animal eats. Enteric CH4, manure, land and N are all calculated from that intake.

The test diet gives every feed 9.5 MJ ME/kg DM, which is about 64% digestible.


|Animal                             | IPCC kg DM/day| Current kg DM/day| Fixed kg DM/day| Current / IPCC| Fixed / IPCC|
|:----------------------------------|--------------:|-----------------:|---------------:|--------------:|------------:|
|Cattle - Calves                    |            2.2|               1.2|             2.2|           0.55|         1.00|
|Cattle - Steers/heifers (improved) |            5.0|               2.9|             5.0|           0.57|         1.00|
|Cattle - Cows (improved)           |           13.9|               8.7|            13.9|           0.63|         1.00|

Currently the package gives these animals only 55–63% of the IPCC intake when energy is the limiting factor. The fix applies Eq. 10.14–10.16 to cattle, buffalo, sheep and goats, and warns if the diet is too poor for the equations to be valid.

```diff
--- a/R/energy_requirement.R	2026-09-29 10:30:38
+++ b/R/energy_requirement.R	2026-09-29 10:30:38
@@ -138,6 +138,9 @@
   #Compute annual energy and protein required
   annual_requirement <- lactation_cp%>%
     mutate(energy_required_annually=(er_maintenance+er_activity+er_growth+er_lactation+er_pregnancy+er_work+er_wool)*no_days*herd_composition,
+           # IPCC 2019 Eq. 10.16 splits NE into terms divided by REM and by REG
+           ne_rem_annually=(er_maintenance+er_activity+er_lactation+er_pregnancy+er_work)*no_days*herd_composition,
+           ne_reg_annually=(er_growth+er_wool)*no_days*herd_composition,
            protein_required_annually =((cp_maintenance*no_days)+
                                          ifelse(!is.finite(((cp_lys_pregnancy/(no_days*birth_interval))*no_days)),0,((cp_lys_pregnancy/(no_days*birth_interval))*no_days))+
                                          ifelse(!is.finite(((cp_lactation/(no_days*birth_interval))*no_days)),0,((cp_lactation/(no_days*birth_interval))*no_days))+
@@ -167,8 +170,16 @@
              energy_required_by_season = energy_required_annually*(sl/no_days),#compute energy require by season
              protein_required_by_season = protein_required_annually*(sl/no_days))%>% #compute protein require by season
       left_join(s_feed_basket_quality, by = "livestock_category_code")%>%
-      mutate(fresh_intake_required_e = energy_required_by_season/average_me,
-             dmi_required_e = fresh_intake_required_e*average_dm/100,
+      mutate(de_pct = ((average_me*100/average_dm)/0.81)/18.45*100, #DE as % of GE, package ME/DE = 0.81
+             # IPCC 2019 p. 10.21: common ruminant DE ranges start at 45%; below that REG
+             # (Eq. 10.15) approaches 0 and intake diverges, so 45% is used as a floor.
+             de_eq = pmax(de_pct, 45),
+             rem = 1.123-(4.092e-3*de_eq)+(1.126e-5*de_eq^2)-(25.4/de_eq), #IPCC 2019 equation 10.14
+             reg = 1.164-(5.16e-3*de_eq)+(1.308e-5*de_eq^2)-(37.4/de_eq), #IPCC 2019 equation 10.15
+             ipcc_ruminant = grepl("^(Cattle|Buffalo|Sheep|Goats)", livestock_category_name),
+             ge_required_by_season = ((ne_rem_annually*sl/no_days)/rem+(ne_reg_annually*sl/no_days)/reg)/(de_eq/100), #IPCC 2019 equation 10.16
+             dmi_required_e = ifelse(ipcc_ruminant, ge_required_by_season/18.45, (energy_required_by_season/average_me)*average_dm/100),
+             fresh_intake_required_e = dmi_required_e*100/average_dm,
              fresh_intake_required_cp = protein_required_by_season/(average_cp/100),
              dmi_required_cp = fresh_intake_required_cp*average_dm/100,
... (14 more lines in results/F01.diff)
```

## 2. N excretion: N retention used with the wrong units

IPCC 2019 Eq. 10.33 (p. 10.85) gives N retained in milk and weight gain in **kg N per animal per day**. On the same page, IPCC says cattle excretion then uses Eq. 10.31A: Nex = (N intake − N retention) × 365.

The package divides milk retention by 365 twice (`R/ghg_emission.R:226`). It then uses the result as a *fraction* of intake (`:233`).


|Animal                             | IPCC retention (kg N/d)| Current retention| Fixed retention| Current Nex (kg N/yr)| IPCC Nex, same intake|
|:----------------------------------|-----------------------:|-----------------:|---------------:|---------------------:|---------------------:|
|Cattle - Cows (improved)           |                  0.0582|            0.0002|          0.0582|                  89.4|                  68.2|
|Cattle - Steers/heifers (improved) |                  0.0098|            0.0141|          0.0098|                  49.7|                  43.3|
|Cattle - Calves                    |                  0.0115|            0.0141|          0.0115|                  12.8|                   8.8|

For the dairy cow, the package's N retention is about 365× too small, so almost all intake N is counted as excreted. That overstates manure N2O and the nitrogen balance. The last column applies IPCC Eq. 10.31A to the package's own N intake, so it isolates the retention error from the intake error in section 1. With the fix, the package matches it exactly (test 02).

```diff
--- a/R/ghg_emission.R	2026-09-29 10:30:51
+++ b/R/ghg_emission.R	2026-09-29 10:30:51
@@ -223,14 +223,17 @@
                                                  ifelse(livetype_desc== "Pigs - growers" & body_weight %gel% c(40,80),0.024,
                                                         ifelse(livetype_desc== "Pigs - growers" & body_weight %gel% c(80,120),0.021,
                                                                ifelse(livetype_desc== "Pigs - dry sows/boars",0.021,0))))))),
-           n_retained = ifelse(!grepl("Pigs",livetype_desc),ifelse(annual_growth == 0,(annual_milk*(protein_milkcontent/100))/6.38/no_days,((annual_milk*(protein_milkcontent/100))/6.38)+(((annual_growth*(268-(7.03*er_growth/annual_growth)))/1000)/6.25))/no_days,#equation 10.33
+           n_retained = ifelse(!grepl("Pigs",livetype_desc),((annual_milk/no_days)*(protein_milkcontent/100))/6.38+ifelse(annual_growth > 0,(((annual_growth/no_days)*(268-(7.03*er_growth/(annual_growth/no_days))))/1000)/6.25,0),#equation 10.33, kg N/head/day
                                ifelse(livetype_desc=="Pigs - lactating/pregnant sows",n_gain+n_weaned, #equation 10.33A
                                       ifelse(livetype_desc== "Pigs - growers" | livetype_desc== "Pigs - dry sows/boars",(annual_growth*n_gain),0)))) #equation 10.33C
 
 
   #Nitrogen excretion rates
   n_excretion <- n_retention1%>%
-    mutate(n_excretion_rate = n_intake*(1-n_retained)*no_days) #equation 10.31
+    # n_intake is a herd total (ge_intake carries herd_composition); n_retained is per head
+    mutate(n_excretion_rate = ifelse(!grepl("Pigs",livetype_desc),
+                                     (n_intake-(n_retained*herd_composition))*no_days, #equation 10.31A
+                                     n_intake*(1-n_retained)*no_days)) #equation 10.31
 
   #################################################################################################################################
   #Direct N2O emissions
```

## 3. Soil carbon: a permanent loss on land that hasn't changed

IPCC 2006 Eq. 2.25 (Vol 4 Ch 2, p. 2.30) calculates soil carbon change from a *change* in land use or management between two points in time: ΔC = (SOC₀ − SOC₍₀₋T₎)/D. The package applies the stock-change factors to the measured stock every year (`R/soc.R:125-132`). So any cropland whose factors are below 1 shows a carbon loss every year, even if nothing has changed.


|1 ha, unchanged cropland | IPCC| Current| Fixed|
|:------------------------|----:|-------:|-----:|
|t C per year             | 0.00|   -7.02|  0.00|

The fix adds optional `*_previous` inputs for the previous land use and management. If they aren't given, the change is 0, as Eq. 2.25 requires. This changes the method, so the authors need to agree it (see the fix log).

```diff
--- a/R/soc.R	2026-09-29 10:31:04
+++ b/R/soc.R	2026-09-29 10:31:04
@@ -33,6 +33,12 @@
 #' @export
 
 soil_organic_carbon <- function(para, stock_change_para, land_required, biomass) {
+
+  # Previous land use / management key; defaults to the current one (no change).
+  soc_prev_key <- function(para, key) {
+    k <- para[[paste0(key, "_previous")]]
+    if (is.null(k) || length(k) == 0 || is.na(k) || !nzchar(k)) para[[key]] else k
+  }
   
   co2_conversion_factor <- 44 / 12
   
@@ -122,12 +128,27 @@
         para[["cropland_orgmatter"]],
         "cropland_orgmatter"
       ),
+      prev_factor_land_use = lookup_soc_factor(
+        crop_landuse_tbl,
+        soc_prev_key(para, "cropland_system"),
+        "cropland_system"
+      ),
+      prev_factor_management = lookup_soc_factor(
+        crop_tillage_tbl,
+        soc_prev_key(para, "cropland_tillage"),
+        "cropland_tillage"
+      ),
+      prev_factor_input = lookup_soc_factor(
... (90 more lines in results/F03.diff)
```

## 4. Residue burning: about 24× too high

The package's burning total adds the CO2 from burning, and multiplies NOx by the N2O warming factor (GWP) (`R/merge_outputs.R:810-812`). IPCC 2006 Vol 4 Ch 2 (p. 2.41) counts only non-CO2 gases for burning on cropland and grassland, because the CO2 is taken back up when the crop regrows. NOx has no GWP.


|1 t DM residue burnt | IPCC| Current| Fixed|
|:--------------------|----:|-------:|-----:|
|kg CO2e              | 75.3| 1,802.5|  75.3|

```diff
--- a/R/merge_outputs.R	2026-09-29 10:31:17
+++ b/R/merge_outputs.R	2026-09-29 10:31:17
@@ -807,9 +807,11 @@
 
   burning <- 0
   if (nrow(ghg_burn) > 0 && ncol(ghg_burn) >= 5 && "ghg_gas" %in% names(ghg_burn)) {
-    burning <- sum_num(ghg_burn[ghg_burn$ghg_gas == "CO2", 5]) +
-      sum_num(ghg_burn[ghg_burn$ghg_gas == "CH4", 5]) * methane +
-      sum_num(ghg_burn[ghg_burn$ghg_gas == "Nox", 5]) * N2O
+    # IPCC 2006 Vol 4 Ch 2 p. 2.41: residue-burning CO2 is re-absorbed and not counted.
+    # NOx has no GWP. Read the amount by name, not by column position.
+    burn_amount <- ghg_burn$amount_of_ghg_emission_from_fire
+    burning <- sum_num(burn_amount[ghg_burn$ghg_gas == "CH4"]) * methane +
+      sum_num(burn_amount[ghg_burn$ghg_gas == "N2O"]) * N2O
   }
   burning_per_ha_kg_co2_e <- safe_zero_div(burning, area_required_on_farm_ha)
   burning_kg_co2_e_per_kg_fpcm <- safe_zero_div(burning, total_milk_produced_kg_fpcm_per_year)
@@ -1326,4 +1328,4 @@
   )
 
   c(app_output, batch_output[setdiff(names(batch_output), names(app_output))])
-}
+}
```

## 5. Tree carbon never reaches soil carbon

`biomass_calculation()` returns a data frame with a `c_increase_soc` column. `soil_organic_carbon()` looks for an element called `trees_non_feed_biomass` inside it (`R/soc.R:234`), which doesn't exist. So tree carbon always contributes 0.


| Tree carbon added|Current change in SOC total |Fixed change in SOC total |
|-----------------:|:---------------------------|:-------------------------|
|               2.5|0.00                        |2.50                      |

```diff
--- a/R/soc.R	2026-09-29 10:31:31
+++ b/R/soc.R	2026-09-29 10:31:31
@@ -231,7 +231,7 @@
   
   annual_change_carbon_stocks_trees_non_feed <- data.frame(type = "trees_non_feed") %>%
     dplyr::mutate(
-      biomass = sum(biomass[["trees_non_feed_biomass"]]$c_increase_soc),
+      biomass = sum(biomass$c_increase_soc, na.rm = TRUE),
       below_ground = biomass,
       annual_change_carbon_stocks = below_ground
     )
@@ -248,4 +248,4 @@
   )
   
   return(results)
-}
+}
```

## 6. Feeds silently get 0 ha

When a feed's yield or removal fraction is 0, the area calculation divides by zero. The package then replaces the resulting infinite or missing value with 0 ha (`R/land_requirement.R:120-121`), without any message. iCLEANED pre-fills removal as 0 for new feeds, so this happens often. The demo below sets the pasture's yield to 0.


|Version |Pasture DM demand (kg) |Pasture area (ha) |Message to the user                                                                                                                     |
|:-------|:----------------------|:-----------------|:---------------------------------------------------------------------------------------------------------------------------------------|
|Current |14,231                 |0.00              |(no message)                                                                                                                            |
|Fixed   |15,631                 |0.00              |land_requirement(): Naturally occuring pasture - green fodder has 2253 kg DM demand but zero yield or removal; its area is set to 0 ha. |

The proposed fix doesn't change the result. It warns the user, so the app can show the problem. DM demand differs between the two rows because fix 1 corrects intake. How much land purchased feeds should count for is a separate question, left to the authors.

```diff
--- a/R/land_requirement.R	2026-09-29 10:31:44
+++ b/R/land_requirement.R	2026-09-29 10:31:44
@@ -28,6 +28,15 @@
 
 land_requirement <- function(feed_basket_quality, energy_required, para){
 
+  warn_zero_land <- function(df) {
+    bad <- df$feed_item_dm > 0 & !is.finite(df$area_total)
+    if (any(bad, na.rm = TRUE)) {
+      warning(sprintf("land_requirement(): %s has %.0f kg DM demand but zero yield or removal; its area is set to 0 ha.",
+                      paste(unique(df$feed[bad]), collapse = ", "), sum(df$feed_item_dm[bad])), call. = FALSE)
+    }
+    df
+  }
+
   livestock_category_code <- unique(feed_basket_quality$livestock_category_code)
 
   livestock_requirements <- list()
@@ -117,6 +126,7 @@
                  farm_dm = (feed_item_dm - rough_of_dm - conc_of_dm - conc_ip_dm),
                  grasses_dm = ifelse(feed_item_selected$category == "grass", feed_item_dm, 0),
                  tree_legume_dm = ifelse(feed_item_selected$category == "tree crop" | feed_item_selected$category == "tree legume", feed_item_dm, 0)) %>%
+          warn_zero_land() %>%
           dplyr::mutate_if(is.numeric, list(~na_if(.,Inf))) %>%
           replace(is.na(.), 0)
 
```

## 7. N leaching isn't multiplied by area

Leaching (`out3`, `R/nitrogen_balance.R:249-253`) is calculated per hectare but added to farm totals, and it uses the farm-total organic N. Gaseous loss (`out4`), on the next line, is multiplied by `area_total`.


|Feed                                      |Area (ha) |Current leaching (kg N) |Fixed leaching (kg N) |
|:-----------------------------------------|:---------|:-----------------------|:---------------------|
|Naturally occuring pasture - green fodder |109.05    |2.6                     |3.1                   |
|Pennisetum purpureum - forage             |1.80      |2.6                     |0.1                   |

The fix leaves the leaching coefficient `0.021 * (P - 3.9)` unchanged, because I couldn't verify the published form (see the fix log).

```diff
--- a/R/nitrogen_balance.R	2026-09-29 10:31:58
+++ b/R/nitrogen_balance.R	2026-09-29 10:31:58
@@ -246,9 +246,9 @@
 
   n_balance_all <- n_balance_all %>%
     dplyr::mutate(
-      out3a = (n_mineralized_kg_ha_year + fertilizer_rate + in2) * (0.021 * (annual_precipitation - 3.9) / 100),
-      out3b = (n_mineralized_kg_ha_year + fertilizer_rate + in2) * (0.014 * annual_precipitation + 0.71) / 100,
-      out3c = (n_mineralized_kg_ha_year + fertilizer_rate + in2) * (0.0071 * annual_precipitation + 5.4) / 100,
+      out3a = (n_mineralized_kg_ha_year + fertilizer_rate + organic_n_kg_per_ha) * (0.021 * (annual_precipitation - 3.9) / 100) * area_total,
+      out3b = (n_mineralized_kg_ha_year + fertilizer_rate + organic_n_kg_per_ha) * (0.014 * annual_precipitation + 0.71) / 100 * area_total,
+      out3c = (n_mineralized_kg_ha_year + fertilizer_rate + organic_n_kg_per_ha) * (0.0071 * annual_precipitation + 5.4) / 100 * area_total,
       out3 = ifelse(soil_clay < 35, out3a, ifelse(soil_clay >= 55, out3c, out3b)),
       out4 = (n_mineralized_kg_ha_year + fertilizer_rate + organic_n_kg_per_ha) *
         (-9.4 + 0.13 * soil_clay + 0.01 * annual_precipitation) / 100 * area_total,
```

## 8. Missing inputs taken from the caller

When `energy_required` is left out, `n_balance()` looks for an object with that name in whatever code called it (`R/nitrogen_balance.R:36`); `ghg_emission()` does the same for `feed_basket_quality`. If another scenario's object is lying around under that name, the function uses it without saying anything. iCLEANED relies on this lookup, so the fix warns for now instead of stopping.


|Version |n_balance() without energy_required                                                                                                        |
|:-------|:------------------------------------------------------------------------------------------------------------------------------------------|
|Current |(no message; used the caller's object)                                                                                                     |
|Fixed   |n_balance(): energy_required was not supplied and was taken from the calling environment. Pass it explicitly; this lookup will be removed. |

## 9. The shipped example doesn't run


|Version |inst/extdata/example_input.json               |
|:-------|:---------------------------------------------|
|Current |error: Can't select columns that don't exist. |
|Fixed   |runs                                          |

## What this means in iCLEANED

These are the two example studies shipped with the app (`data/shared_folder/study_objects`), run the same way the app runs them, with the current package and with all fixes.


Table: On-farm GHG, kg CO2e per year (soil carbon: a loss is shown as a positive emission)

|Study   |Source                          | Current|  Fixed|
|:-------|:-------------------------------|-------:|------:|
|Study_1 |Enteric fermentation-Methane    |   4,388|  6,998|
|Study_1 |Manure-Methane                  |       0|      0|
|Study_1 |Manure-Direct N2O               |     498|    706|
|Study_1 |Manure-Indirect N2O             |     183|    256|
|Study_1 |Soil-Direct N2O                 |      15|     24|
|Study_1 |Soil-Indirect N2O               |       2|      2|
|Study_1 |Burning                         |       0|      0|
|Study_1 |Production fertilizer           |      37|     58|
|Study_1 |Soil carbon change (kg CO2/yr)  |   4,505|      0|
|Study_1 |On-farm total incl. soil carbon |   9,628|  8,045|
|Study_2 |Enteric fermentation-Methane    |  15,296| 15,296|
|Study_2 |Manure-Methane                  |       0|      0|
|Study_2 |Manure-Direct N2O               |       0|      0|
|Study_2 |Manure-Indirect N2O             |      34|     26|
|Study_2 |Soil-Direct N2O                 |   4,027|  4,027|
|Study_2 |Soil-Indirect N2O               |     385|    385|
|Study_2 |Burning                         |  13,834|    578|
|Study_2 |Production fertilizer           |   1,348|  1,348|
|Study_2 |Soil carbon change (kg CO2/yr)  |  32,397|      0|
|Study_2 |On-farm total incl. soil carbon |  67,322| 21,660|


Table: IPCC: intake should be about 2-3% of body weight, and can exceed 4% in high-producing dairy cows (2019 Vol 4 Ch 10, p. 10.30)

|Study   |Animal                             |Intake, % of body weight (current) |(fixed) |Limiting (current) |(fixed)  |
|:-------|:----------------------------------|:----------------------------------|:-------|:------------------|:--------|
|Study_1 |Cattle - Cows (improved)           |1.9                                |3.1     |CP                 |ENERGY   |
|Study_1 |Cattle - Steers/heifers (improved) |1.3                                |2.0     |CP                 |ENERGY   |
|Study_2 |Cattle - Cows (improved)           |8.4                                |8.4     |CP                 |CP       |
|Study_2 |Cattle - Steers/heifers (improved) |5.9                                |5.9     |CP                 |CP       |

Messages the app would receive with the fixes:

- **Study_1:** land_requirement(): Concentrate (commercial) has ... kg DM demand but zero yield or removal; its area is set to 0 ha.; n_balance(): energy_required was not supplied and was taken from the calling environment. Pass it explicitly; this lookup will be removed.; ghg_emission(): feed_basket_quality was not supplied and was taken from the calling environment. Pass it explicitly; this lookup will be removed.
- **Study_2:** energy_requirement(): diet DE of 40% in season wet is below the IPCC common range (45%); intake for Cattle - Cows (improved), Cattle - Steers/heifers (improved) is calculated at 45% DE.; energy_requirement(): diet DE of 39% in season dry is below the IPCC common range (45%); intake for Cattle - Cows (improved), Cattle - Steers/heifers (improved) is calculated at 45% DE.; n_balance(): energy_required was not supplied and was taken from the calling environment. Pass it explicitly; this lookup will be removed.; ghg_emission(): feed_basket_quality was not supplied and was taken from the calling environment. Pass it explicitly; this lookup will be removed.

### Not fixed by these proposals

- **Intake has no upper limit.** Intake is the larger of the energy-based and protein-based values, so a diet low in protein can push it to impossible levels. The Study_2 cow still eats more than 8% of body weight. This needs a cap on intake from rumen fill, or a flag for such diets (Livestock review H-01, Land-use review LU-02).
- **Manure CH4 is 0.** The manure-system labels don't match the keys in the IPCC emission-factor table (Climate review F07).
- **The water unit.** Water is calculated in mm·ha but labelled m³, so it is about 10× too low (Land-use review W-01).
- The rest of the High findings are in `00_summary.md`.

---
Built with `knitr::knit("demo.Rmd", "../08_demo.md")` from `cleaned_review/fixes/`, after running `./run_all.sh`.
