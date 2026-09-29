# Run one configuration of proposed fixes against a temporary copy of cleaned.
# Usage: Rscript run_one.R <config> <src> <results_dir> [app_dir]
#   config: "baseline", a fix id such as "F04", or "ALL"

args <- commandArgs(TRUE)
config <- args[1]
src <- normalizePath(args[2])
results <- normalizePath(args[3], mustWork = FALSE)
app_dir <- if (length(args) >= 4) normalizePath(args[4]) else NA
here <- dirname(normalizePath(sub("^--file=", "", grep("^--file=", commandArgs(FALSE), value = TRUE))))
dir.create(results, showWarnings = FALSE, recursive = TRUE)

source(file.path(here, "proposed_fixes.R"))

# Fresh copy of the package source.
work <- file.path(tempdir(), paste0("cleaned_", config))
unlink(work, recursive = TRUE)
dir.create(work)
for (x in c("DESCRIPTION", "NAMESPACE", "R", "inst", "data", "man")) {
  file.copy(file.path(src, x), work, recursive = TRUE)
}
pristine <- file.path(tempdir(), "cleaned_pristine")
unlink(pristine, recursive = TRUE)
dir.create(pristine)
for (x in c("R", "inst")) file.copy(file.path(src, x), pristine, recursive = TRUE)

ids <- switch(config, baseline = character(0), ALL = names(fixes), config)
applied <- vapply(ids, function(id) {
  tryCatch({ fixes[[id]]$apply(work); "applied" },
           error = function(e) paste("NOT APPLIED:", conditionMessage(e)))
}, character(1))

# Diff of the change, for the log.
if (length(ids)) {
  d <- suppressWarnings(system2("diff", c("-ru", shQuote(file.path(pristine, "R")), shQuote(file.path(work, "R"))),
                                stdout = TRUE))
  d2 <- suppressWarnings(system2("diff", c("-ru", shQuote(file.path(pristine, "inst")), shQuote(file.path(work, "inst"))),
                                 stdout = TRUE))
  d <- gsub(pristine, "a", gsub(work, "b", c(d, d2), fixed = TRUE), fixed = TRUE)
  writeLines(d, file.path(results, paste0(config, ".diff")))
}

# Keep the all-fixes copy for the demo (a plain folder, not a git checkout).
if (config == "ALL") {
  keep <- file.path(here, "cleaned_fixed_copy")
  unlink(keep, recursive = TRUE)
  dir.create(keep)
  for (x in list.files(work, all.files = FALSE)) file.copy(file.path(work, x), keep, recursive = TRUE)
}

suppressMessages(pkgload::load_all(work, quiet = TRUE, export_all = FALSE, helpers = FALSE))

# Critical tests.
res <- as.data.frame(testthat::test_dir(file.path(here, "tests"), reporter = "silent",
                                        stop_on_failure = FALSE, load_package = "none"))
res$status <- ifelse(res$skipped, "SKIP", ifelse(res$error, "ERROR", ifelse(res$failed > 0, "FAIL", "PASS")))
res$config <- config
write.csv(res[, c("config", "file", "test", "status")],
          file.path(results, paste0(config, "_tests.csv")), row.names = FALSE)

# The two example studies shipped with iCLEANED, run the way the app runs them
# (icleaned R/10_mod_board_simulation_server.R): n_balance() and ghg_emission()
# are called without energy_required / feed_basket_quality.
if (!is.na(app_dir) && config %in% c("baseline", "ALL")) {
  suppressPackageStartupMessages({ library(dplyr); library(tidyr) })
  ext <- function(f) system.file("extdata", f, package = "cleaned")
  ghg_ipcc_data <- jsonlite::fromJSON(ext("ghg_parameters.json"), flatten = TRUE)
  stock_change_para <- jsonlite::fromJSON(ext("stock_change_parameters.json"), flatten = TRUE)
  energy_parameters <- jsonlite::fromJSON(ext("energy_parameters.json"), flatten = TRUE)
  run_app <- function(para) {
    environment(n_balance) <- environment()
    environment(ghg_emission) <- environment()
    feed_basket_quality <- feed_quality(para = para)
    energy_required <- energy_requirement(para = para, feed_basket_quality = feed_basket_quality,
                                          energy_parameters = energy_parameters)
    land_required <- land_requirement(feed_basket_quality = feed_basket_quality,
                                      energy_required = energy_required, para = para)
    soil_erosion <- soil_health(para = para, land_required = land_required)
    water_required <- water_requirement(para = para, land_required = land_required)
    nitrogen_balance <- n_balance(para = para, land_required = land_required, soil_erosion = soil_erosion)
    livestock_productivity <- land_productivity(para = para, energy_required = energy_required)
    biomass <- biomass_calculation(para = para, land_required = land_required)
    soil_carbon <- soil_organic_carbon(para = para, stock_change_para = stock_change_para,
                                       land_required = land_required, biomass = biomass)
    ghg_emissions <- ghg_emission(para = para, energy_required = energy_required,
                                  ghg_ipcc_data = ghg_ipcc_data, land_required = land_required,
                                  nitrogen_balance = nitrogen_balance)
    out <- combineOutputs(para = para, feed_basket_quality = feed_basket_quality,
                          energy_required = energy_required, land_required = land_required,
                          soil_erosion = soil_erosion, water_required = water_required,
                          nitrogen_balance = nitrogen_balance, livestock_productivity = livestock_productivity,
                          biomass = biomass, soil_carbon = soil_carbon, ghg_emission = ghg_emissions,
                          filePath = tempfile(), primary_excel = file.path(app_dir, "www", "ReadMe.xlsx"))
    list(er = energy_required, lr = land_required, nb = nitrogen_balance, sc = soil_carbon,
         ghg = ghg_emissions, out = out)
  }
  studies <- list.files(file.path(app_dir, "data", "shared_folder", "study_objects"),
                        pattern = "json$", full.names = TRUE)
  app <- lapply(setNames(studies, tools::file_path_sans_ext(basename(studies))), function(s) {
    para <- jsonlite::fromJSON(s, flatten = TRUE)
    warns <- character(0)
    r <- withCallingHandlers(
      tryCatch(run_app(para), error = function(e) list(error = conditionMessage(e))),
      warning = function(w) { warns <<- c(warns, conditionMessage(w)); invokeRestart("muffleWarning") })
    r$warnings <- unique(warns)
    r
  })
  saveRDS(app, file.path(results, paste0(config, "_app.rds")))
}

cat(config, ":", paste(names(applied), applied, sep = "=", collapse = "; "), "\n")
print(table(res$status))
