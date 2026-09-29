# Shared fixture for the test-critical-*.R files.
#
# The shipped inst/extdata/example_input.json cannot run the pipeline (see
# test-critical-09). ct_para() applies the minimum patch needed to reach each
# module, so the other critical tests exercise the model code rather than the
# input contract. Every patch is listed here; none changes a model value that
# the tests assert on.

ct_extdata <- function(file) {
  path <- system.file("extdata", file, package = "cleaned")
  if (path == "") path <- testthat::test_path("..", "..", "inst", "extdata", file)
  path
}

ct_para <- function() {
  p <- jsonlite::fromJSON(ct_extdata("example_input.json"))

  # feed_quality() needs crop_name; land_requirement() needs dry yields.
  fi <- p$feed_items
  fi$crop_name <- fi$feed_item_name
  num <- function(x) suppressWarnings(as.numeric(x))
  fy <- num(fi$fresh_yield)
  hi <- num(fi$harvest_index)
  fi$dry_yield <- fy * num(fi$dm_content) / 100
  residue_fresh <- ifelse(is.finite(fy * ((1 - hi) / hi)), fy * ((1 - hi) / hi), 0)
  fi$residue_dry_yield <- (1 - num(fi$water_content) / 100) * residue_fresh
  p$feed_items <- fi

  # Column names the code expects but the example spells differently.
  lv <- p$livestock
  lv$fat_milkcontent <- lv$fat_content
  lv$cp_lys_pregnancy <- lv$cp_pregnancy
  lv$cp_lys_growth <- lv$cp_growth
  lv$lw_gain_piglets <- 0
  lv$proportion_growth_piglets_milk <- 0
  lv$n_manure_content <- lv$n_content
  p$livestock <- lv

  p
}

ct_params <- function() {
  list(
    energy = jsonlite::fromJSON(ct_extdata("energy_parameters.json")),
    ghg = jsonlite::fromJSON(ct_extdata("ghg_parameters.json")),
    stock_change = jsonlite::fromJSON(ct_extdata("stock_change_parameters.json"))
  )
}

# Runs the documented pipeline order (README "Standard Model Run").
ct_run <- function(para = ct_para()) {
  pr <- ct_params()
  fq <- feed_quality(para)
  er <- energy_requirement(para, fq, pr$energy)
  lr <- land_requirement(fq, er, para)
  se <- soil_health(para, lr)
  nb <- n_balance(para, lr, er, se)
  bm <- biomass_calculation(para, lr)
  sc <- soil_organic_carbon(para, pr$stock_change, lr, bm)
  gh <- ghg_emission(para, er, pr$ghg, lr, nb, fq)
  list(para = para, fq = fq, er = er, lr = lr, se = se, nb = nb, bm = bm, sc = sc, ghg = gh)
}

# Minimal SOC inputs: 1 ha of cropland, 30 cm, bulk density 1.3, 1.5 % C.
ct_soc_land <- function(area = 1) {
  list(land_requirements_all = data.frame(
    feed = "test crop", area_feed = area, grasses = 0, tree_legume = 0,
    farm = area, rough_of = 0
  ))
}

ct_soc_para <- function() {
  p <- ct_para()
  p$soil_depth <- 30
  p$soil_bulk <- 1.3
  p$soil_c <- 1.5
  p
}
