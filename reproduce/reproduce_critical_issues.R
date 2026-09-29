#!/usr/bin/env Rscript
#
# Reproduce the critical issues found in the `cleaned` R package (v0.7.0).
#
# What it does
#   1. Installs any missing packages into its own library folder
#      (./cleaned_review_lib), so nothing you already have is changed.
#   2. Installs `cleaned` at the exact reviewed commit (CIAT/cleaned @ 800d53a).
#   3. Runs each issue and prints the package's value next to an independent
#      calculation from the IPCC source text (equation and page cited).
#   4. Optionally applies the proposed fixes to a temporary copy of the package
#      and adds a "fixed" column (set FIXES below, or the CLEANED_FIXES variable).
#
# Usage
#   Rscript reproduce_critical_issues.R            # all issues
#   Rscript reproduce_critical_issues.R 1 4 5      # selected issues
#   CLEANED_FIXES=proposed_fixes.R Rscript reproduce_critical_issues.R
#
# Sources
#   IPCC 2019 Refinement, Vol. 4, Ch. 10 (Livestock)
#     https://www.ipcc-nggip.iges.or.jp/public/2019rf/pdf/4_Volume4/19R_V4_Ch10_Livestock.pdf
#   IPCC 2006 Guidelines, Vol. 4, Ch. 2 (Generic methods)
#     https://www.ipcc-nggip.iges.or.jp/public/2006gl/pdf/4_Volume4/V4_02_Ch2_Generic.pdf
#   Page numbers below are the printed page numbers in those PDFs.

CLEANED_REPO <- "CIAT/cleaned"
CLEANED_SHA  <- "800d53a356be1179bc24bc47fd58545e911e8874"   # staging, 2026-09-29
FIXES        <- Sys.getenv("CLEANED_FIXES", "")            # path or URL to proposed_fixes.R, or ""

# ------------------------------------------------------------------------------
# 0. Setup: private library, dependencies, cleaned at the reviewed commit
# ------------------------------------------------------------------------------
if (!exists(".reproduce_child")) {
  lib <- normalizePath(file.path(getwd(), "cleaned_review_lib"), mustWork = FALSE)
  dir.create(lib, showWarnings = FALSE)
  .libPaths(c(lib, .libPaths()))

  need <- c("remotes", "jsonlite", "dplyr", "tidyr", "openxlsx", "knitr")
  if (nzchar(FIXES)) need <- c(need, "pkgload", "callr")
  missing <- need[!vapply(need, requireNamespace, logical(1), quietly = TRUE)]
  if (length(missing)) {
    message("Installing: ", paste(missing, collapse = ", "))
    install.packages(missing, lib = lib, repos = "https://cloud.r-project.org")
  }

  have_sha <- suppressWarnings(tryCatch(utils::packageDescription("cleaned")$RemoteSha, error = function(e) NULL))
  if (is.null(have_sha) || !identical(have_sha, CLEANED_SHA)) {
    message("Installing cleaned @ ", substr(CLEANED_SHA, 1, 7), " into ", lib)
    remotes::install_github(paste0(CLEANED_REPO, "@", CLEANED_SHA), lib = lib,
                            upgrade = "never", quiet = TRUE, build_vignettes = FALSE)
  }
  suppressPackageStartupMessages({ library(cleaned); library(dplyr); library(tidyr) })
  cat("cleaned", as.character(utils::packageVersion("cleaned")), "@",
      substr(utils::packageDescription("cleaned")$RemoteSha, 1, 7), "\n\n")
}

# ------------------------------------------------------------------------------
# 1. Independent IPCC reference calculations (transcribed from the source text)
# ------------------------------------------------------------------------------
# IPCC 2019 Eq. 10.14, p. 10.29. de_pct = DE as % of GE.
ipcc_rem <- function(de_pct) 1.123 - (4.092e-3 * de_pct) + (1.126e-5 * de_pct^2) - (25.4 / de_pct)
# IPCC 2019 Eq. 10.15, p. 10.30.
ipcc_reg <- function(de_pct) 1.164 - (5.16e-3 * de_pct) + (1.308e-5 * de_pct^2) - (37.4 / de_pct)
# IPCC 2019 Eq. 10.16, p. 10.30. NE terms in MJ/day; returns GE in MJ/day.
ipcc_ge <- function(ne_m, ne_a, ne_l, ne_work, ne_p, ne_g, ne_wool, de_frac) {
  de_pct <- de_frac * 100
  ((ne_m + ne_a + ne_l + ne_work + ne_p) / ipcc_rem(de_pct) + (ne_g + ne_wool) / ipcc_reg(de_pct)) / de_frac
}
# IPCC 2019 p. 10.30: DMI = GE / 18.45 MJ per kg DM (default).
ipcc_dmi_from_ge <- function(ge) ge / 18.45
# IPCC 2019 Eq. 10.32, p. 10.82. Returns kg N/animal/day.
ipcc_n_intake <- function(ge_day, cp_pct) (ge_day / 18.45) * ((cp_pct / 100) / 6.25)
# IPCC 2019 Eq. 10.33, p. 10.85. Milk and WG in kg/day; NEg in MJ/day. Returns kg N/animal/day.
ipcc_n_retention_cattle <- function(milk_day, milk_pr_pct, wg_day, ne_g) {
  (milk_day * (milk_pr_pct / 100)) / 6.38 +
    ifelse(wg_day > 0, (wg_day * (268 - (7.03 * ne_g / wg_day)) / 1000) / 6.25, 0)
}
# IPCC 2019 Eq. 10.31A, p. 10.81 (p. 10.85 says cattle use this option). kg N/animal/yr.
ipcc_nex <- function(n_intake_day, n_ret_day) (n_intake_day - n_ret_day) * 365
# IPCC 2006 Eq. 2.25, p. 2.30. Returns t C/yr.
ipcc_soc_change <- function(soc_ref, f_now, f_before, area, d = 20) (soc_ref * prod(f_now) * area - soc_ref * prod(f_before) * area) / d
# IPCC 2006 Eq. 2.27, p. 2.42. mass in kg DM, gef in g/kg. Returns kg of gas.
ipcc_fire_gas_kg <- function(mass_kg, cf, gef) mass_kg * cf * gef / 1000
# IPCC 2006 p. 2.41: residue-burning CO2 is not counted (re-absorbed by regrowth). NOx has no GWP.
ipcc_burning_co2e <- function(ch4_kg, n2o_kg, gwp_ch4 = 28, gwp_n2o = 265) ch4_kg * gwp_ch4 + n2o_kg * gwp_n2o

# ------------------------------------------------------------------------------
# 2. Inputs: the package's own example, patched only so far as it will run
# ------------------------------------------------------------------------------
extdata <- function(f) jsonlite::fromJSON(system.file("extdata", f, package = "cleaned"))

example_para <- function() {
  p <- extdata("example_input.json")
  fi <- p$feed_items
  fi$crop_name <- fi$feed_item_name                       # feed_quality() needs it
  num <- function(x) suppressWarnings(as.numeric(x))
  fy <- num(fi$fresh_yield); hi <- num(fi$harvest_index)
  fi$dry_yield <- fy * num(fi$dm_content) / 100           # land_requirement() needs these
  res <- ifelse(is.finite(fy * (1 - hi) / hi), fy * (1 - hi) / hi, 0)
  fi$residue_dry_yield <- (1 - num(fi$water_content) / 100) * res
  p$feed_items <- fi
  lv <- p$livestock                                        # columns the code expects under other names
  lv$fat_milkcontent <- lv$fat_content; lv$cp_lys_pregnancy <- lv$cp_pregnancy
  lv$cp_lys_growth <- lv$cp_growth; lv$lw_gain_piglets <- 0
  lv$proportion_growth_piglets_milk <- 0; lv$n_manure_content <- lv$n_content
  p$livestock <- lv
  p
}

run_pipeline <- function(p = example_para()) {
  ep <- extdata("energy_parameters.json"); gp <- extdata("ghg_parameters.json"); sp <- extdata("stock_change_parameters.json")
  fq <- feed_quality(p); er <- energy_requirement(p, fq, ep)
  lr <- land_requirement(fq, er, p); se <- soil_health(p, lr); nb <- n_balance(p, lr, er, se)
  bm <- biomass_calculation(p, lr); sc <- soil_organic_carbon(p, sp, lr, bm)
  gh <- ghg_emission(p, er, gp, lr, nb, fq)
  list(para = p, fq = fq, er = er, lr = lr, se = se, nb = nb, bm = bm, sc = sc, ghg = gh)
}

# 1 ha of cropland, 30 cm deep, bulk density 1.3, 1.5 % C
soc_land <- function(area = 1) list(land_requirements_all = data.frame(
  feed = "test crop", area_feed = area, grasses = 0, tree_legume = 0, farm = area, rough_of = 0))
soc_para <- function() { p <- example_para(); p$soil_depth <- 30; p$soil_bulk <- 1.3; p$soil_c <- 1.5; p }

row <- function(issue, quantity, current, reference, unit = "", note = "") {
  data.frame(issue = issue, quantity = quantity, current = as.character(current),
             reference = as.character(reference), unit = unit, note = note, stringsAsFactors = FALSE)
}
f1 <- function(x, d = 1) formatC(x, format = "f", digits = d, big.mark = ",")

# ------------------------------------------------------------------------------
# 3. The issues
# ------------------------------------------------------------------------------
issues <- list()

# Issue 1: net-energy requirements are met with metabolisable energy.
# R/energy_requirement.R:170 divides NE by ME density; IPCC Eq. 10.14-10.16 convert NE -> GE -> DMI.
# Controlled diet: every feed 9.5 MJ ME/kg DM (about 64 % DE), realistic DM %.
issues[[1]] <- function() {
  p <- example_para()
  p$feed_items$me_content <- 9.5
  p$feed_items$dm_content <- c(30, 29, 15, 87)[seq_len(nrow(p$feed_items))]
  r <- run_pipeline(p)
  ar <- as.data.frame(r$er$annual_results)
  sr <- merge(as.data.frame(r$er$seasonal_results), p$seasons, by = "season_name")
  sr <- merge(sr, ar[, c("livestock_category_code", "er_maintenance", "er_activity", "er_lactation", "er_work",
                         "er_pregnancy", "er_growth", "er_wool", "herd_composition")], by = "livestock_category_code")
  de <- (9.5 / 0.81) / 18.45                                # package ME/DE = 0.81; GE 18.45 MJ/kg DM
  ge <- ipcc_ge(sr$er_maintenance, sr$er_activity, sr$er_lactation, sr$er_work, sr$er_pregnancy, sr$er_growth, sr$er_wool, de)
  sr$ipcc <- ipcc_dmi_from_ge(ge) * sr$season_length * sr$herd_composition
  a <- aggregate(cbind(dmi_required_e, ipcc) ~ livestock_category_name + herd_composition, data = sr, FUN = sum)
  do.call(rbind, lapply(seq_len(nrow(a)), function(i) row(
    1, paste("Energy-driven intake,", a$livestock_category_name[i]),
    f1(a$dmi_required_e[i] / 365 / a$herd_composition[i]), f1(a$ipcc[i] / 365 / a$herd_composition[i]),
    "kg DM/head/day", "IPCC 2019 Eq. 10.14-10.16, pp. 10.29-10.30; diet 9.5 MJ ME/kg DM")))
}

# Issue 2: N retention in kg N/day used as a fraction, and divided by 365 twice (R/ghg_emission.R:226, 233).
issues[[2]] <- function() {
  nx <- as.data.frame(run_pipeline()$ghg$n_excretion)
  nx <- nx[grepl("Cattle", nx$livetype_desc), ]
  ret <- ipcc_n_retention_cattle(nx$annual_milk / 365, nx$protein_milkcontent, nx$annual_growth / 365, nx$er_growth)
  nex <- ipcc_nex(nx$n_intake, ret * nx$herd_composition)   # package n_intake is a herd total
  rbind(
    do.call(rbind, lapply(seq_len(nrow(nx)), function(i) row(
      2, paste("N retention,", nx$livetype_desc[i]), f1(nx$n_retained[i], 4), f1(ret[i], 4),
      "kg N/head/day", "IPCC 2019 Eq. 10.33, p. 10.85"))),
    do.call(rbind, lapply(seq_len(nrow(nx)), function(i) row(
      2, paste("N excretion,", nx$livetype_desc[i]), f1(nx$n_excretion_rate[i]), f1(nex[i]),
      "kg N/yr", "IPCC 2019 Eq. 10.31A, p. 10.81, on the package's own N intake"))))
}

# Issue 3: SOC stock-change factors applied every year to the measured stock (R/soc.R:125-132).
issues[[3]] <- function() {
  sc <- soil_organic_carbon(soc_para(), extdata("stock_change_parameters.json"), soc_land(1), data.frame(c_increase_soc = 0))
  row(3, "SOC change, 1 ha unchanged cropland", f1(sc$total_annual_change_carbon_soils, 2), f1(0, 2),
      "t C/yr", "IPCC 2006 Eq. 2.25, p. 2.30: no change in land use or management means no change in stock")
}

# Issue 4: burning total counts CO2 and applies the N2O GWP to NOx (R/merge_outputs.R:810-812).
issues[[4]] <- function() {
  r <- run_pipeline(); p <- r$para
  burn <- as.data.frame(r$ghg$ghg_burn)
  burn$mass_residue_burn <- 1
  burn$amount_of_ghg_emission_from_fire <- ipcc_fire_gas_kg(1000, burn$combusion_factor, burn$burnt_emission_factor)
  ghg <- r$ghg; ghg$ghg_burn <- burn
  out <- combineOutputs(p, r$fq, r$er, r$lr, r$se, water_requirement(p, r$lr), r$nb,
                        land_productivity(p, r$er), r$bm, r$sc, ghg, filePath = tempfile(fileext = ".json"))
  pkg <- as.numeric(out$ghg_balance$value[out$ghg_balance$GHG_balance == "Burning"])
  amt <- setNames(burn$amount_of_ghg_emission_from_fire, burn$ghg_gas)
  row(4, "Burning, 1 t DM residue", f1(pkg), f1(ipcc_burning_co2e(amt[["CH4"]], amt[["N2O"]])),
      "kg CO2e", "IPCC 2006 p. 2.41 (CO2 not counted), Table 2.5 p. 2.47, GWP AR5 as in the package")
}

# Issue 5: tree carbon never reaches the SOC total (R/soc.R:234 reads a list element that does not exist).
issues[[5]] <- function() {
  p <- soc_para(); sp <- extdata("stock_change_parameters.json"); land <- soc_land(1)
  d <- soil_organic_carbon(p, sp, land, data.frame(c_increase_soc = 2.5))$total_annual_change_carbon_soils -
       soil_organic_carbon(p, sp, land, data.frame(c_increase_soc = 0))$total_annual_change_carbon_soils
  row(5, "Change in SOC total when tree carbon = 2.5", f1(d, 2), f1(2.5, 2), "t C/yr",
      "internal contract: biomass_calculation() returns c_increase_soc as a column")
}

# Issue 6: a feed with zero yield or removal silently gets 0 ha (R/land_requirement.R:120-121).
issues[[6]] <- function() {
  p <- example_para()
  past <- grepl("pasture", p$feed_items$feed_item_name, ignore.case = TRUE)
  p$feed_items$dry_yield[past] <- 0
  fq <- feed_quality(p); er <- energy_requirement(p, fq, extdata("energy_parameters.json"))
  msg <- "(none)"
  lr <- withCallingHandlers(land_requirement(fq, er, p),
                            warning = function(w) { if (grepl("pasture", conditionMessage(w), ignore.case = TRUE)) msg <<- conditionMessage(w); invokeRestart("muffleWarning") })
  d <- as.data.frame(lr$land_requirements_all); d <- d[grepl("pasture", d$feed, ignore.case = TRUE), ]
  rbind(row(6, "Pasture with zero yield: DM demand", f1(sum(d$feed_item_dm), 0), "> 0", "kg DM"),
        row(6, "Pasture with zero yield: area", f1(sum(d$area_feed), 2), "warning or error", "ha", "silent 0 ha"),
        row(6, "Message to the user", msg, "a warning naming the feed"))
}

# Issue 7: leaching is a per-ha rate added to farm totals without area (R/nitrogen_balance.R:249-253).
issues[[7]] <- function() {
  nb <- as.data.frame(run_pipeline()$nb); nb <- nb[nb$area_total > 0, ]
  frac <- ifelse(nb$soil_clay < 35, 0.021 * (nb$annual_precipitation - 3.9) / 100,
          ifelse(nb$soil_clay >= 55, (0.0071 * nb$annual_precipitation + 5.4) / 100, (0.014 * nb$annual_precipitation + 0.71) / 100))
  ref <- (nb$n_mineralized_kg_ha_year + nb$fertilizer_rate + nb$organic_n_kg_per_ha) * frac * nb$area_total
  do.call(rbind, lapply(seq_len(nrow(nb)), function(i) row(
    7, sprintf("Leaching, %s (%.1f ha)", nb$feed[i], nb$area_total[i]), f1(nb$out3[i]), f1(ref[i]),
    "kg N/yr", "same structure as the package's gaseous loss out4: per-ha rate x area")))
}

# Issue 8: a missing input is fetched from the caller's environment (R/nitrogen_balance.R:36, R/ghg_emission.R:47).
issues[[8]] <- function() {
  r <- run_pipeline()
  energy_required <- energy_requirement(r$para, r$fq, extdata("energy_parameters.json"))  # an object lying around
  msg <- "(none: used the caller's object silently)"
  withCallingHandlers(n_balance(r$para, r$lr, soil_erosion = r$se),
                      warning = function(w) { msg <<- conditionMessage(w); invokeRestart("muffleWarning") },
                      error = function(e) msg <<- conditionMessage(e))
  row(8, "n_balance() called without energy_required", msg, "error or warning naming the missing input", "",
      "Advanced R 2e s. 6.4: a result should not depend on objects in the caller")
}

# Issue 9: the shipped example input cannot run the pipeline.
issues[[9]] <- function() {
  p <- extdata("example_input.json")
  res <- tryCatch({ fq <- feed_quality(p); energy_requirement(p, fq, extdata("energy_parameters.json")); "runs" },
                  error = function(e) paste("error:", sub("\n.*", "", conditionMessage(e))))
  rbind(row(9, "inst/extdata/example_input.json through energy_requirement()", res, "runs"),
        row(9, "example dm_content values", paste(p$feed_items$dm_content, collapse = ", "), "percent (1-100)", "",
            "feed_quality() divides dm_content by 100"))
}

run_issues <- function(which = seq_along(issues)) {
  do.call(rbind, lapply(which, function(i) {
    tryCatch(issues[[i]](), error = function(e) row(i, "run failed", conditionMessage(e), ""))
  }))
}

# ------------------------------------------------------------------------------
# 4. Run and report
# ------------------------------------------------------------------------------
if (!exists(".reproduce_child")) {
  which <- suppressWarnings(as.integer(commandArgs(TRUE)))
  which <- which[!is.na(which) & which %in% seq_along(issues)]
  if (!length(which)) which <- seq_along(issues)

  current <- suppressWarnings(run_issues(which))
  current$fixed <- NULL

  if (nzchar(FIXES)) {
    # Apply the proposed fixes to a fresh copy of the package source, in a
    # separate R process, and rerun the same issues there.
    fixes_file <- FIXES
    if (grepl("^https?://", FIXES)) { fixes_file <- tempfile(fileext = ".R"); download.file(FIXES, fixes_file, quiet = TRUE) }
    tarball <- tempfile(fileext = ".tar.gz")
    download.file(sprintf("https://github.com/%s/archive/%s.tar.gz", CLEANED_REPO, CLEANED_SHA), tarball, quiet = TRUE)
    src_root <- tempfile("cleaned_src_"); dir.create(src_root)
    utils::untar(tarball, exdir = src_root)
    src <- list.dirs(src_root, recursive = FALSE)[1]
    this_script <- sub("^--file=", "", grep("^--file=", commandArgs(FALSE), value = TRUE))[1]
    fixed <- callr::r(function(script, fixes_file, src, which) {
      .reproduce_child <- TRUE
      source(fixes_file, local = TRUE)                       # defines `fixes` and edit_once()
      for (id in names(fixes)) fixes[[id]]$apply(src)
      suppressMessages(pkgload::load_all(src, quiet = TRUE, helpers = FALSE))
      suppressPackageStartupMessages({ library(dplyr); library(tidyr) })
      source(script, local = TRUE)
      suppressWarnings(run_issues(which))
    }, args = list(script = this_script, fixes_file = fixes_file, src = src, which = which), libpath = .libPaths())
    current$fixed <- fixed$current
  }

  cols <- c("issue", "quantity", "current", if (nzchar(FIXES)) "fixed", "reference", "unit", "note")
  out <- current[, cols]
  names(out)[names(out) == "current"] <- "package (current)"
  names(out)[names(out) == "reference"] <- "IPCC / expected"
  if (nzchar(FIXES)) names(out)[names(out) == "fixed"] <- "package (fixed)"

  md <- knitr::kable(out, format = "pipe", row.names = FALSE)
  cat(md, sep = "\n")
  writeLines(c(sprintf("# cleaned %s @ %s: critical issues", utils::packageVersion("cleaned"), substr(CLEANED_SHA, 1, 7)),
               "", md), "reproduce_results.md")
  cat("\nWritten to reproduce_results.md\n")
}
