# Critical finding: N retention units and use in N excretion.
# Review refs: 02_livestock C-02 and H-04, 01_climate_ghg F04, 04_package_code F07.
#
# R/ghg_emission.R:226 computes n_retained with an extra "/ no_days" (divided by
# 365 twice for milk-only animals) and passes a growth term that divides NEg
# (MJ/day) by annual gain (kg/yr). R/ghg_emission.R:233 then uses n_retained,
# which is in kg N/day, as a dimensionless fraction: n_intake * (1 - n_retained).
#
# IPCC 2019 Vol 4 Ch 10:
#   Eq. 10.33 (p. 10.85): N retention for cattle, kg N/animal/day, with Milk and
#     WG in kg/day and NEg in MJ/day.
#   p. 10.85: "Nitrogen excretion is calculated using Equation 10.31a, Option 2."
#   Eq. 10.31A (p. 10.81): Nex = (N_intake - N_retention) * 365.

ct_cattle_nex <- function() {
  run <- ct_run()
  nx <- as.data.frame(run$ghg$n_excretion)
  nx[grepl("Cattle", nx$livetype_desc), ]
}

# Package intake columns (dmi_tot, ge_intake, n_intake) are herd totals: they
# carry herd_composition from energy_requirement(). IPCC equations are per head,
# so per-head retention is multiplied by herd_composition before comparing.

test_that("control: N intake matches IPCC 2019 Eq. 10.32", {
  nx <- ct_cattle_nex()
  expect_gt(nrow(nx), 0)
  ref <- ipcc_n_intake(nx$ge_intake / 365, nx$cp)
  expect_equal(nx$n_intake, ref, tolerance = 1e-8)
})

test_that("finding: N retention equals IPCC 2019 Eq. 10.33 (kg N/day)", {
  nx <- ct_cattle_nex()
  ref <- ipcc_n_retention_cattle(
    milk_kg_day = nx$annual_milk / 365,
    milk_pr_pct = nx$protein_milkcontent,
    wg_kg_day = nx$annual_growth / 365,
    ne_g = nx$er_growth
  )
  # n_retained is per head (no herd factor in R/ghg_emission.R:226).
  expect_equal(
    nx$n_retained, ref, tolerance = 0.02,
    info = paste(sprintf("%s: package %.5f vs IPCC %.5f kg N/day",
                         nx$livetype_desc, nx$n_retained, ref), collapse = "; ")
  )
})

test_that("finding: N excretion equals IPCC 2019 Eq. 10.31A", {
  nx <- ct_cattle_nex()
  ref_ret <- ipcc_n_retention_cattle(nx$annual_milk / 365, nx$protein_milkcontent,
                                     nx$annual_growth / 365, nx$er_growth)
  # Uses the package's own N intake, so only the retention step is under test.
  ref_nex <- ipcc_nex_option2(nx$n_intake, ref_ret * nx$herd_composition)
  expect_equal(
    nx$n_excretion_rate, ref_nex, tolerance = 0.02,
    info = paste(sprintf("%s: package %.1f vs IPCC %.1f kg N/yr",
                         nx$livetype_desc, nx$n_excretion_rate, ref_nex), collapse = "; ")
  )
})
