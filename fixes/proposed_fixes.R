# Proposed fixes for the critical findings in cleaned v0.7.0.
#
# Nothing here edits the repository. run_fixes.R copies the package source to a
# temporary folder and calls apply_fix() on that copy. Each edit is an exact
# find-and-replace that must match once, so a fix fails loudly rather than
# landing in the wrong place if the source has moved on.

edit_once <- function(root, file, old, new) {
  path <- file.path(root, file)
  txt <- paste(readLines(path, warn = FALSE), collapse = "\n")
  hits <- gregexpr(old, txt, fixed = TRUE)[[1]]
  n <- if (hits[1] == -1) 0 else length(hits)
  if (n != 1) stop(sprintf("%s: expected 1 match, found %d for:\n%s", file, n, old), call. = FALSE)
  writeLines(sub(old, new, txt, fixed = TRUE), path)
}

fixes <- list()

# F01 ---------------------------------------------------------------------------
fixes$F01 <- list(
  title = "Convert net energy to feed intake with IPCC REM/REG (Eq. 10.14-10.16)",
  finding = "Critical 1: NE requirements divided by ME density",
  tests = "01",
  status = "Needs author decision: changes every livestock output",
  apply = function(root) {
    f <- "R/energy_requirement.R"
    edit_once(root, f,
      "    mutate(energy_required_annually=(er_maintenance+er_activity+er_growth+er_lactation+er_pregnancy+er_work+er_wool)*no_days*herd_composition,",
      paste0(
        "    mutate(energy_required_annually=(er_maintenance+er_activity+er_growth+er_lactation+er_pregnancy+er_work+er_wool)*no_days*herd_composition,\n",
        "           # IPCC 2019 Eq. 10.16 splits NE into terms divided by REM and by REG\n",
        "           ne_rem_annually=(er_maintenance+er_activity+er_lactation+er_pregnancy+er_work)*no_days*herd_composition,\n",
        "           ne_reg_annually=(er_growth+er_wool)*no_days*herd_composition,"))
    edit_once(root, f,
      paste0(
        "      mutate(fresh_intake_required_e = energy_required_by_season/average_me,\n",
        "             dmi_required_e = fresh_intake_required_e*average_dm/100,"),
      paste0(
        "      mutate(de_pct = ((average_me*100/average_dm)/0.81)/18.45*100, #DE as % of GE, package ME/DE = 0.81\n",
        "             # IPCC 2019 p. 10.21: common ruminant DE ranges start at 45%; below that REG\n",
        "             # (Eq. 10.15) approaches 0 and intake diverges, so 45% is used as a floor.\n",
        "             de_eq = pmax(de_pct, 45),\n",
        "             rem = 1.123-(4.092e-3*de_eq)+(1.126e-5*de_eq^2)-(25.4/de_eq), #IPCC 2019 equation 10.14\n",
        "             reg = 1.164-(5.16e-3*de_eq)+(1.308e-5*de_eq^2)-(37.4/de_eq), #IPCC 2019 equation 10.15\n",
        "             ipcc_ruminant = grepl(\"^(Cattle|Buffalo|Sheep|Goats)\", livestock_category_name),\n",
        "             ge_required_by_season = ((ne_rem_annually*sl/no_days)/rem+(ne_reg_annually*sl/no_days)/reg)/(de_eq/100), #IPCC 2019 equation 10.16\n",
        "             dmi_required_e = ifelse(ipcc_ruminant, ge_required_by_season/18.45, (energy_required_by_season/average_me)*average_dm/100),\n",
        "             fresh_intake_required_e = dmi_required_e*100/average_dm,"))
    edit_once(root, f,
      "    #Binding seasonal results",
      paste0(
        "    low_de <- temp$ipcc_ruminant & temp$de_pct < 45 & temp$energy_required_by_season > 0\n",
        "    if (any(low_de, na.rm = TRUE)) {\n",
        "      warning(sprintf(\"energy_requirement(): diet DE of %.0f%% in season %s is below the IPCC common range (45%%); intake for %s is calculated at 45%% DE.\",\n",
        "                      min(temp$de_pct[low_de]), seasons$season_name[i], paste(unique(temp$livestock_category_name[low_de]), collapse = \", \")), call. = FALSE)\n",
        "    }\n\n",
        "    #Binding seasonal results"))
  }
)

# F02 ---------------------------------------------------------------------------
fixes$F02 <- list(
  title = "N retention in kg N/head/day and N excretion by IPCC Eq. 10.31A",
  finding = "Critical 2: N retention units",
  tests = "02",
  status = "Ready for cattle; sheep and goats reuse Eq. 10.33 (IPCC gives it for cattle), pigs unchanged",
  apply = function(root) {
    f <- "R/ghg_emission.R"
    edit_once(root, f,
      "ifelse(annual_growth == 0,(annual_milk*(protein_milkcontent/100))/6.38/no_days,((annual_milk*(protein_milkcontent/100))/6.38)+(((annual_growth*(268-(7.03*er_growth/annual_growth)))/1000)/6.25))/no_days,#equation 10.33",
      "((annual_milk/no_days)*(protein_milkcontent/100))/6.38+ifelse(annual_growth > 0,(((annual_growth/no_days)*(268-(7.03*er_growth/(annual_growth/no_days))))/1000)/6.25,0),#equation 10.33, kg N/head/day")
    edit_once(root, f,
      "    mutate(n_excretion_rate = n_intake*(1-n_retained)*no_days) #equation 10.31",
      paste0(
        "    # n_intake is a herd total (ge_intake carries herd_composition); n_retained is per head\n",
        "    mutate(n_excretion_rate = ifelse(!grepl(\"Pigs\",livetype_desc),\n",
        "                                     (n_intake-(n_retained*herd_composition))*no_days, #equation 10.31A\n",
        "                                     n_intake*(1-n_retained)*no_days)) #equation 10.31"))
  }
)

# F03 ---------------------------------------------------------------------------
soc_prev_key <- function(para, key) {
  k <- para[[paste0(key, "_previous")]]
  if (is.null(k) || length(k) == 0 || is.na(k) || !nzchar(k)) para[[key]] else k
}

fixes$F03 <- list(
  title = "SOC change only from a change in land use or management (IPCC 2006 Eq. 2.25)",
  finding = "Critical 3: SOC factors applied every year to the measured stock",
  tests = "03",
  status = "Needs author decision: adds optional *_previous inputs; without them the change is 0",
  apply = function(root) {
    f <- file.path(root, "R/soc.R")
    txt <- paste(readLines(f, warn = FALSE), collapse = "\n")
    old_formula <- paste0(
      "      annual_change_carbon_stocks_mineral_soils =\n",
      "        ((carbon_stock_last_year_inventory_period *\n",
      "            stock_change_factor_land_use *\n",
      "            stock_change_factor_management *\n",
      "            stock_change_factor_input) -\n",
      "           carbon_stock_last_year_inventory_period) /\n",
      "        time_dependence_stock_change *\n",
      "        area_last_year_inventory_period")
    blocks <- strsplit(txt, old_formula, fixed = TRUE)[[1]]
    if (length(blocks) != 4) stop("soc.R: expected 3 stock-change formulas", call. = FALSE)
    for (b in 1:3) {
      # The three lookup_soc_factor() calls of this block, re-used with the
      # previous-state keys.
      start <- regexpr("stock_change_factor_land_use = lookup_soc_factor(", blocks[b], fixed = TRUE)
      lookups <- substring(blocks[b], start)
      prev <- gsub("para\\[\\[\"([a-z_]+)\"\\]\\]", "soc_prev_key(para, \"\\1\")", lookups)
      prev <- gsub("stock_change_factor_(land_use|management|input) = ", "prev_factor_\\1 = ", prev)
      blocks[b] <- paste0(blocks[b], "      ", sub("\\s+$", "", prev), "\n",
        "      # IPCC 2006 Eq. 2.25: dC = (SOC0 - SOC(0-T)) / D. The measured stock is SOC0,\n",
        "      # so SOC(0-T) = SOC0 * F(0-T) / F0. No previous state given means no change.\n",
        "      annual_change_carbon_stocks_mineral_soils =\n",
        "        (carbon_stock_last_year_inventory_period *\n",
        "           (1 - (prev_factor_land_use * prev_factor_management * prev_factor_input) /\n",
        "              (stock_change_factor_land_use * stock_change_factor_management * stock_change_factor_input))) /\n",
        "        time_dependence_stock_change *\n",
        "        area_last_year_inventory_period")
    }
    txt <- paste(blocks, collapse = "")
    txt <- sub("soil_organic_carbon <- function(para, stock_change_para, land_required, biomass) {",
               paste0("soil_organic_carbon <- function(para, stock_change_para, land_required, biomass) {\n\n",
                      "  # Previous land use / management key; defaults to the current one (no change).\n",
                      "  soc_prev_key <- function(para, key) {\n",
                      "    k <- para[[paste0(key, \"_previous\")]]\n",
                      "    if (is.null(k) || length(k) == 0 || is.na(k) || !nzchar(k)) para[[key]] else k\n",
                      "  }"),
               txt, fixed = TRUE)
    writeLines(txt, f)
  }
)

# F04 ---------------------------------------------------------------------------
fixes$F04 <- list(
  title = "Burning CO2e from CH4 and N2O only, by column name",
  finding = "Critical 4: burning counts biogenic CO2 and uses the N2O GWP for NOx",
  tests = "04",
  status = "Ready",
  apply = function(root) {
    edit_once(root, "R/merge_outputs.R",
      paste0(
        "    burning <- sum_num(ghg_burn[ghg_burn$ghg_gas == \"CO2\", 5]) +\n",
        "      sum_num(ghg_burn[ghg_burn$ghg_gas == \"CH4\", 5]) * methane +\n",
        "      sum_num(ghg_burn[ghg_burn$ghg_gas == \"Nox\", 5]) * N2O"),
      paste0(
        "    # IPCC 2006 Vol 4 Ch 2 p. 2.41: residue-burning CO2 is re-absorbed and not counted.\n",
        "    # NOx has no GWP. Read the amount by name, not by column position.\n",
        "    burn_amount <- ghg_burn$amount_of_ghg_emission_from_fire\n",
        "    burning <- sum_num(burn_amount[ghg_burn$ghg_gas == \"CH4\"]) * methane +\n",
        "      sum_num(burn_amount[ghg_burn$ghg_gas == \"N2O\"]) * N2O"))
  }
)

# F05 ---------------------------------------------------------------------------
fixes$F05 <- list(
  title = "Read tree carbon from the data frame biomass_calculation() returns",
  finding = "Critical 5: tree SOC always 0",
  tests = "05",
  status = "Ready",
  apply = function(root) {
    edit_once(root, "R/soc.R",
      "      biomass = sum(biomass[[\"trees_non_feed_biomass\"]]$c_increase_soc),",
      "      biomass = sum(biomass$c_increase_soc, na.rm = TRUE),")
  }
)

# F06 ---------------------------------------------------------------------------
fixes$F06 <- list(
  title = "Warn when a feed with DM demand has no finite land area",
  finding = "Critical 6: divide-by-zero silently set to 0 ha",
  tests = "06",
  status = "Ready (warning only; purchased-feed land footprint is a separate design question)",
  apply = function(root) {
    f <- "R/land_requirement.R"
    edit_once(root, f,
      paste0(
        "          dplyr::mutate_if(is.numeric, list(~na_if(.,Inf))) %>%\n",
        "          replace(is.na(.), 0)"),
      paste0(
        "          warn_zero_land() %>%\n",
        "          dplyr::mutate_if(is.numeric, list(~na_if(.,Inf))) %>%\n",
        "          replace(is.na(.), 0)"))
    edit_once(root, f,
      "land_requirement <- function(feed_basket_quality, energy_required, para){",
      paste0(
        "land_requirement <- function(feed_basket_quality, energy_required, para){\n\n",
        "  warn_zero_land <- function(df) {\n",
        "    bad <- df$feed_item_dm > 0 & !is.finite(df$area_total)\n",
        "    if (any(bad, na.rm = TRUE)) {\n",
        "      warning(sprintf(\"land_requirement(): %s has %.0f kg DM demand but zero yield or removal; its area is set to 0 ha.\",\n",
        "                      paste(unique(df$feed[bad]), collapse = \", \"), sum(df$feed_item_dm[bad])), call. = FALSE)\n",
        "    }\n",
        "    df\n",
        "  }"))
  }
)

# F07 ---------------------------------------------------------------------------
fixes$F07 <- list(
  title = "Leaching as a per-ha rate times area, using per-ha organic N",
  finding = "Critical 7: leaching not scaled by area",
  tests = "07",
  status = "Ready for area scaling; coefficient form (0.021*(P-3.9)) left unchanged until the source is checked",
  apply = function(root) {
    f <- "R/nitrogen_balance.R"
    edit_once(root, f,
      "      out3a = (n_mineralized_kg_ha_year + fertilizer_rate + in2) * (0.021 * (annual_precipitation - 3.9) / 100),",
      "      out3a = (n_mineralized_kg_ha_year + fertilizer_rate + organic_n_kg_per_ha) * (0.021 * (annual_precipitation - 3.9) / 100) * area_total,")
    edit_once(root, f,
      "      out3b = (n_mineralized_kg_ha_year + fertilizer_rate + in2) * (0.014 * annual_precipitation + 0.71) / 100,",
      "      out3b = (n_mineralized_kg_ha_year + fertilizer_rate + organic_n_kg_per_ha) * (0.014 * annual_precipitation + 0.71) / 100 * area_total,")
    edit_once(root, f,
      "      out3c = (n_mineralized_kg_ha_year + fertilizer_rate + in2) * (0.0071 * annual_precipitation + 5.4) / 100,",
      "      out3c = (n_mineralized_kg_ha_year + fertilizer_rate + organic_n_kg_per_ha) * (0.0071 * annual_precipitation + 5.4) / 100 * area_total,")
  }
)

# F08 ---------------------------------------------------------------------------
fixes$F08 <- list(
  title = "Warn (deprecation) when an input is taken from the caller's environment",
  finding = "Critical 8: hidden lookup of inputs in the caller",
  tests = "08",
  status = "Ready as a warning. A hard stop needs iCLEANED to pass energy_required and feed_basket_quality first",
  apply = function(root) {
    edit_once(root, "R/nitrogen_balance.R",
      "    energy_required <- get(\"energy_required\", envir = parent.frame(), inherits = TRUE)",
      paste0(
        "    warning(\"n_balance(): energy_required was not supplied and was taken from the calling environment. \",\n",
        "            \"Pass it explicitly; this lookup will be removed.\", call. = FALSE)\n",
        "    energy_required <- get(\"energy_required\", envir = parent.frame(), inherits = TRUE)"))
    edit_once(root, "R/ghg_emission.R",
      "    feed_basket_quality <- get(\"feed_basket_quality\", envir = parent.frame(), inherits = TRUE)",
      paste0(
        "    warning(\"ghg_emission(): feed_basket_quality was not supplied and was taken from the calling environment. \",\n",
        "            \"Pass it explicitly; this lookup will be removed.\", call. = FALSE)\n",
        "    feed_basket_quality <- get(\"feed_basket_quality\", envir = parent.frame(), inherits = TRUE)"))
  }
)

# F09 ---------------------------------------------------------------------------
fixes$F09 <- list(
  title = "Make the shipped example_input.json match the input contract",
  finding = "Critical 9: shipped example does not run",
  tests = "09",
  status = "Ready. The concentrate DM of 87% is an assumed typical value",
  apply = function(root) {
    f <- file.path(root, "inst/extdata/example_input.json")
    p <- jsonlite::fromJSON(f)
    fi <- p$feed_items
    fi$crop_name <- fi$feed_item_name
    dm <- as.numeric(fi$dm_content) * 100
    dm[dm == 0 & fi$source_type == "Purchased"] <- 87
    fi$dm_content <- dm
    p$feed_items <- fi
    lv <- p$livestock
    lv$fat_milkcontent <- lv$fat_content
    lv$cp_lys_pregnancy <- lv$cp_pregnancy
    lv$cp_lys_growth <- lv$cp_growth
    lv$lw_gain_piglets <- 0
    lv$proportion_growth_piglets_milk <- 0
    lv$n_manure_content <- lv$n_content
    p$livestock <- lv
    jsonlite::write_json(p, f, auto_unbox = TRUE, digits = NA, pretty = TRUE)
  }
)
