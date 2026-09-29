# Critical finding: SOC stock change applied to the measured stock every year.
# Review refs: 01_climate_ghg F01, 03_landuse S-02.
#
# R/soc.R:103-133 computes
#   ((SOC_measured * FLU * FMG * FI) - SOC_measured) / 20 * area
# for a single land-use state. IPCC 2006 Vol 4 Ch 2, Eq. 2.25 (p. 2.30):
#   SOC = SOCref * FLU * FMG * FI * A at time 0 and at time 0-T,
#   dC  = (SOC0 - SOC(0-T)) / D.
# The package input describes one state (no earlier land use or management),
# so SOC0 equals SOC(0-T) and dC is 0. A permanent annual loss means the
# stock-change factors are being applied to a stock that already reflects them.

test_that("control: IPCC 2006 Eq. 2.25 reference gives 0 when nothing changes", {
  f <- c(flu = 0.80, fmg = 1.00, fi = 0.95)
  expect_equal(ipcc_soc_change(soc_ref = 50, f_now = f, f_before = f, area = 1), 0)
})

test_that("finding: steady-state cropland has no SOC change (IPCC 2006 Eq. 2.25)", {
  p <- ct_soc_para()
  pr <- ct_params()
  # The shipped factors are not all 1, so any non-zero result is the factors
  # being applied year on year to an unchanged system.
  f_lu <- pr$stock_change$cropland$landuse[[1]]$factor_variables
  expect_true(length(f_lu) > 0)

  no_trees <- data.frame(c_increase_soc = 0)
  sc <- soil_organic_carbon(p, pr$stock_change, ct_soc_land(1), no_trees)
  expect_equal(
    sc$total_annual_change_carbon_soils, 0, tolerance = 1e-9,
    info = sprintf(
      "package reports %.2f t C/yr for 1 ha of unchanged '%s' cropland",
      sc$total_annual_change_carbon_soils, p$cropland_system
    )
  )
})

# Guard for fix F03: a fix that always returned 0 would pass the test above.
# With a previous land use given, the change must follow Eq. 2.25. The measured
# stock is SOC0 (package convention: 1e6 * depth/100 * bulk * C% * 0.001), so
# SOCref = SOC0 / F0 and SOC(0-T) = SOCref * F(0-T).
test_that("guard: a land-use change gives the IPCC 2006 Eq. 2.25 stock change", {
  p <- ct_soc_para()
  p$cropland_system <- "Long term cultivated, temperate/boreal, dry"
  p$cropland_system_previous <- "Perennial/tree crop"
  sp <- ct_params()$stock_change
  fac <- function(part, key) {
    t <- tidyr::unnest(tidyr::unnest(sp$cropland, cols = dplyr::all_of(part)), cols = c(factor_variables))
    as.numeric(t[[key]][1])
  }
  f_now <- c(fac("landuse", p$cropland_system), fac("tillage", p$cropland_tillage), fac("input", p$cropland_orgmatter))
  f_before <- c(fac("landuse", p$cropland_system_previous), f_now[2], f_now[3])
  soc0 <- 1e6 * (p$soil_depth / 100) * p$soil_bulk * p$soil_c * 0.001
  ref <- ipcc_soc_change(soc_ref = soc0 / prod(f_now), f_now = f_now, f_before = f_before, area = 1)

  sc <- soil_organic_carbon(p, sp, ct_soc_land(1), data.frame(c_increase_soc = 0))
  expect_equal(sc$total_annual_change_carbon_soils, ref, tolerance = 1e-6,
               info = sprintf("package %.3f vs IPCC %.3f t C/yr", sc$total_annual_change_carbon_soils, ref))
})
