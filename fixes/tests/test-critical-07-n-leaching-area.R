# Critical finding: N leaching is a per-ha rate added to farm-total N flows.
# Review refs: 03_landuse N-01 (area scaling) and N-02 (coefficient form).
#
# R/nitrogen_balance.R:249-253 computes out3 (leaching) as
#   (n_mineralized_kg_ha_year + fertilizer_rate + in2) * fraction
# with no "* area_total", and in2 is the farm-total organic N. The next line,
# out4 (gaseous loss), uses organic_n_kg_per_ha and multiplies by area_total.
# nout then sums out3 with farm-total terms.
#
# The area test is an internal consistency test: out3 and out4 are built from
# the same N pool and should have the same units (kg N per feed area).

ct_leaching_rows <- function() {
  nb <- as.data.frame(ct_run()$nb)
  nb[nb$area_total > 0, ]
}

ct_leach_fraction <- function(nb) {
  # The package's own coefficients (R/nitrogen_balance.R:249-252), so only the
  # area scaling is tested here.
  a <- 0.021 * (nb$annual_precipitation - 3.9) / 100
  b <- (0.014 * nb$annual_precipitation + 0.71) / 100
  c <- (0.0071 * nb$annual_precipitation + 5.4) / 100
  ifelse(nb$soil_clay < 35, a, ifelse(nb$soil_clay >= 55, c, b))
}

test_that("control: gaseous loss out4 is per-ha rate x area (same structure)", {
  nb <- ct_leaching_rows()
  expect_gt(nrow(nb), 0)
  rate <- (nb$n_mineralized_kg_ha_year + nb$fertilizer_rate + nb$organic_n_kg_per_ha) *
    (-9.4 + 0.13 * nb$soil_clay + 0.01 * nb$annual_precipitation) / 100
  expect_equal(nb$out4, rate * nb$area_total, tolerance = 1e-8)
})

test_that("finding: leaching out3 is per-ha rate x area, like out4", {
  nb <- ct_leaching_rows()
  ref <- (nb$n_mineralized_kg_ha_year + nb$fertilizer_rate + nb$organic_n_kg_per_ha) *
    ct_leach_fraction(nb) * nb$area_total
  expect_equal(
    nb$out3, ref, tolerance = 1e-6,
    info = paste(sprintf("%s (%.2f ha): package %.1f vs area-scaled %.1f kg N",
                         nb$feed, nb$area_total, nb$out3, ref), collapse = "; ")
  )
})

test_that("finding: leaching coefficient for clay < 35% is 0.021 * P - 3.9", {
  skip(paste(
    "Source not yet verified. The package has 0.021 * (P - 3.9); the NUTMON",
    "regression is reported as 0.021 * P - 3.9 (Smaling et al. 1993,",
    "Geoderma 60:235-256; De Willigen 2000). Add the page reference, then remove this skip."
  ))
  nb <- ct_leaching_rows()
  sandy <- nb[nb$soil_clay < 35, ]
  pkg <- 0.021 * (sandy$annual_precipitation - 3.9)
  ref <- 0.021 * sandy$annual_precipitation - 3.9
  expect_equal(pkg, ref)
})
