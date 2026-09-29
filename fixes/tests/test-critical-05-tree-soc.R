# Critical finding: tree carbon never reaches the SOC total.
# Review refs: 04_package_code F02, 03_landuse S-01.
#
# biomass_calculation() returns a plain data frame with a c_increase_soc column
# (R/biomass_calculation.R:141-146). soil_organic_carbon() reads
# biomass[["trees_non_feed_biomass"]]$c_increase_soc (R/soc.R:234), which is
# NULL for that data frame, so the tree term is always sum(NULL) = 0.
#
# This is an internal contract test: whatever biomass_calculation() returns,
# soil_organic_carbon() should add its c_increase_soc to the total.

test_that("control: biomass_calculation() returns c_increase_soc as a column", {
  run <- ct_run()
  expect_true("c_increase_soc" %in% names(run$bm))
  expect_null(run$bm[["trees_non_feed_biomass"]])
})

test_that("finding: tree c_increase_soc is added to the SOC total", {
  p <- ct_soc_para()
  pr <- ct_params()
  land <- ct_soc_land(1)

  base <- soil_organic_carbon(p, pr$stock_change, land, data.frame(c_increase_soc = 0))
  trees <- soil_organic_carbon(p, pr$stock_change, land, data.frame(c_increase_soc = 2.5))

  expect_equal(
    trees$total_annual_change_carbon_soils - base$total_annual_change_carbon_soils,
    2.5,
    info = "tree c_increase_soc of 2.5 changed the SOC total by 0"
  )
})
