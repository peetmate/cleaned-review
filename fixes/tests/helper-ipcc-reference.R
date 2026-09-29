# Independent reference implementations used by the test-critical-*.R files.
#
# Each function is transcribed from the cited source, not from package code,
# so a test can compare the package against the published method.
#
# Sources (page numbers are the printed page in the PDF):
#   IPCC 2019: 2019 Refinement to the 2006 IPCC Guidelines, Vol. 4, Ch. 10
#     https://www.ipcc-nggip.iges.or.jp/public/2019rf/pdf/4_Volume4/19R_V4_Ch10_Livestock.pdf
#   IPCC 2006: 2006 IPCC Guidelines, Vol. 4, Ch. 2
#     https://www.ipcc-nggip.iges.or.jp/public/2006gl/pdf/4_Volume4/V4_02_Ch2_Generic.pdf

# IPCC 2019 Vol 4 Ch 10, Eq. 10.14, p. 10.29 (Gibbs & Johnson 1993).
# de_pct is DE as % of GE.
ipcc_rem <- function(de_pct) {
  1.123 - (4.092e-3 * de_pct) + (1.126e-5 * de_pct^2) - (25.4 / de_pct)
}

# IPCC 2019 Vol 4 Ch 10, Eq. 10.15, p. 10.30.
ipcc_reg <- function(de_pct) {
  1.164 - (5.16e-3 * de_pct) + (1.308e-5 * de_pct^2) - (37.4 / de_pct)
}

# IPCC 2019 Vol 4 Ch 10, Eq. 10.16 (updated), p. 10.30. All NE terms MJ/day;
# de_frac is DE%/100. Returns GE in MJ/day.
ipcc_ge <- function(ne_m, ne_a, ne_l, ne_work, ne_p, ne_g, ne_wool, de_frac) {
  de_pct <- de_frac * 100
  ((ne_m + ne_a + ne_l + ne_work + ne_p) / ipcc_rem(de_pct) +
     (ne_g + ne_wool) / ipcc_reg(de_pct)) / de_frac
}

# IPCC 2019 Vol 4 Ch 10, text after Eq. 10.16, p. 10.30: "divide GE by the
# energy density of the feed. A default value of 18.45 MJ kg-1 of dry matter".
ipcc_dmi_from_ge <- function(ge_mj_day, ge_density = 18.45) ge_mj_day / ge_density

# IPCC 2019 Vol 4 Ch 10, Eq. 10.32, p. 10.82. GE in MJ/day, cp_pct in %.
# Returns kg N/animal/day.
ipcc_n_intake <- function(ge_mj_day, cp_pct) (ge_mj_day / 18.45) * ((cp_pct / 100) / 6.25)

# IPCC 2019 Vol 4 Ch 10, Eq. 10.33, p. 10.85. Milk and WG in kg/day,
# NEg in MJ/day. Returns kg N/animal/day (not a fraction).
ipcc_n_retention_cattle <- function(milk_kg_day, milk_pr_pct, wg_kg_day, ne_g) {
  milk_term <- (milk_kg_day * (milk_pr_pct / 100)) / 6.38
  gain_term <- ifelse(wg_kg_day > 0,
                      (wg_kg_day * (268 - (7.03 * ne_g / wg_kg_day)) / 1000) / 6.25,
                      0)
  milk_term + gain_term
}

# IPCC 2019 Vol 4 Ch 10, Eq. 10.31A (Option 2), p. 10.81. The text on p. 10.85
# says cattle N excretion "is calculated using Equation 10.31a, Option 2".
# Returns kg N/animal/year.
ipcc_nex_option2 <- function(n_intake_kg_day, n_retention_kg_day) {
  (n_intake_kg_day - n_retention_kg_day) * 365
}

# IPCC 2006 Vol 4 Ch 2, Eq. 2.25, p. 2.30.
#   SOC = SOCref * FLU * FMG * FI * A, evaluated at time 0 and at time 0-T.
#   dC  = (SOC0 - SOC(0-T)) / D, D default 20 yr.
# Returns t C/yr.
ipcc_soc_change <- function(soc_ref, f_now, f_before, area, d = 20) {
  soc_0 <- soc_ref * prod(f_now) * area
  soc_0_t <- soc_ref * prod(f_before) * area
  (soc_0 - soc_0_t) / d
}

# IPCC 2006 Vol 4 Ch 2, Eq. 2.27, p. 2.42: Lfire = A * MB * Cf * Gef * 1e-3.
# Here mass_burnt is A*MB in kg DM and gef in g/kg DM, so the result is kg of gas.
ipcc_fire_gas_kg <- function(mass_burnt_kg_dm, cf, gef_g_per_kg) {
  mass_burnt_kg_dm * cf * gef_g_per_kg / 1000
}

# IPCC 2006 Vol 4 Ch 2, section 2.4, p. 2.41: for Cropland and Grassland "only
# non-CO2 emissions were considered, with the assumption that the CO2 emissions
# would be counterbalanced by CO2 removals from the subsequent re-growth".
# NOx is an indirect precursor with no GWP. The CO2e of residue burning is
# therefore CH4 and N2O only.
ipcc_burning_co2e <- function(ch4_kg, n2o_kg, gwp_ch4, gwp_n2o) {
  ch4_kg * gwp_ch4 + n2o_kg * gwp_n2o
}
