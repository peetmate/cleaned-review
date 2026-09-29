# Critical finding: net-energy requirements are met with metabolisable energy.
# Review refs: 01_climate_ghg F02, 02_livestock C-01.
#
# energy_requirement() sums the IPCC net-energy terms (Eq. 10.3-10.13, MJ NE/day)
# and divides by the diet's ME density (R/energy_requirement.R:170). IPCC 2019
# Eq. 10.16 converts NE to GE via REM/REG (Eq. 10.14/10.15) and DE, then
# DMI = GE / 18.45 (p. 10.30).
#
# Control test: NEm (Eq. 10.3) agrees with IPCC, so the harness can agree when
# the package is right. Finding test: energy-driven DMI vs the IPCC chain.

test_that("control: NEm matches IPCC 2019 Eq. 10.3 with Table 10.4 Cfi", {
  run <- ct_run()
  ar <- as.data.frame(run$er$annual_results)
  cow <- ar[ar$livestock_category_name == "Cattle - Cows (improved)", ]
  expect_equal(nrow(cow), 1)

  # IPCC 2019 Vol 4 Ch 10, Eq. 10.3 (p. 10.23), Table 10.4 (p. 10.24):
  # lactating cows Cfi = 0.386 MJ/day/kg.
  ref_nem <- 0.386 * cow$body_weight^0.75
  expect_equal(cow$er_maintenance, ref_nem, tolerance = 1e-6)
})

# The shipped example diet is about 5.3 MJ ME/kg DM (DE about 35%). That is
# below the range where REG (Eq. 10.15) stays positive, so the finding is tested
# on a controlled diet instead: every feed at 9.5 MJ ME/kg DM (DE about 64%) and
# realistic DM%. This isolates the NE-to-ME conversion from diet-quality effects.
ct_para_controlled_diet <- function(me = 9.5) {
  p <- ct_para()
  p$feed_items$me_content <- me
  p$feed_items$dm_content <- c(30, 29, 15, 87)[seq_len(nrow(p$feed_items))]
  p
}

test_that("finding: energy-driven DMI follows IPCC 2019 Eq. 10.14-10.16", {
  run <- ct_run(ct_para_controlled_diet())
  ar <- as.data.frame(run$er$annual_results)
  sr <- as.data.frame(run$er$seasonal_results)
  seasons <- run$para$seasons

  rows <- merge(sr, seasons, by = "season_name")
  rows <- merge(rows, ar[, c("livestock_category_code", "er_maintenance",
                             "er_activity", "er_lactation", "er_work",
                             "er_pregnancy", "er_growth", "er_wool")],
                by = "livestock_category_code")
  rows <- rows[rows$dmi_required_e > 0, ]
  expect_gt(nrow(rows), 0)

  # Diet ME density is fixed by construction (every feed 9.5 MJ ME/kg DM), so
  # it is not read back from the package result under test.
  me_density <- rep(9.5, nrow(rows))
  # Package convention DE = ME / 0.81 (R/energy_requirement.R:201). DE fraction
  # of GE uses the IPCC default GE density of 18.45 MJ/kg DM (p. 10.30).
  de_frac <- (me_density / 0.81) / 18.45

  ge_day <- ipcc_ge(rows$er_maintenance, rows$er_activity, rows$er_lactation,
                    rows$er_work, rows$er_pregnancy, rows$er_growth,
                    rows$er_wool, de_frac)
  herd <- rows$energy_required_by_season /
    ((rows$er_maintenance + rows$er_activity + rows$er_growth + rows$er_lactation +
        rows$er_pregnancy + rows$er_work + rows$er_wool) * rows$season_length)
  ref_dmi <- ipcc_dmi_from_ge(ge_day) * rows$season_length * herd

  ratio <- rows$dmi_required_e / ref_dmi
  # Tolerance of 10% allows for rounding and basket-averaging choices.
  expect_true(
    all(abs(ratio - 1) < 0.10),
    info = paste0(
      "package / IPCC energy DMI by season x category: ",
      paste(sprintf("%s %s = %.2f", rows$livestock_category_name, rows$season_name, ratio),
            collapse = "; ")
    )
  )
})

# Guard for fix F01: on a diet below the IPCC common DE range (the shipped
# example, about 35-40% DE) REG (Eq. 10.15) is near or below 0. Intake must
# still be finite and positive, and the user should be told the diet is outside
# the range (IPCC 2019 Vol 4 Ch 10, p. 10.21: common ranges start at 45%).
test_that("guard: energy DMI is finite and positive on a low-DE diet", {
  p <- ct_para()
  fq <- feed_quality(p)
  er <- suppressWarnings(energy_requirement(p, fq, ct_params()$energy))
  dmi <- as.data.frame(er$seasonal_results)$dmi_required_e
  expect_true(all(is.finite(dmi) & dmi > 0),
              info = paste("dmi_required_e:", paste(round(dmi), collapse = ", ")))
})
