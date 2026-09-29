# Critical finding: residue-burning CO2e counts biogenic CO2 and uses the N2O
# GWP for NOx.
# Review refs: 01_climate_ghg F03, 04_package_code F06.
#
# R/merge_outputs.R:810-812:
#   burning <- CO2 + CH4 * methane + Nox * N2O
# IPCC 2006 Vol 4 Ch 2 (p. 2.41): for Cropland and Grassland "only non-CO2
# emissions were considered, with the assumption that the CO2 emissions would be
# counterbalanced by CO2 removals from the subsequent re-growth". NOx is an
# indirect precursor with no GWP; N2O is the gas that takes the N2O GWP.
# Emission factors: IPCC 2006 Vol 4 Ch 2, Table 2.5 (p. 2.47).

test_that("control: burning emission factors equal IPCC 2006 Table 2.5", {
  t25 <- ct_params()$ghg[["table_2.5"]]
  ef <- setNames(t25$burnt_emission_factor, t25$ghg_gas)
  # Agricultural residues row, g/kg DM burnt.
  expect_equal(unname(ef[c("CO2", "CO", "CH4", "N2O", "Nox")]),
               c(1515, 92, 2.7, 0.07, 2.5))
})

test_that("finding: burning CO2e is CH4 and N2O only (IPCC 2006 Ch 2 p. 2.41)", {
  para <- ct_para()
  run <- ct_run(para)

  # Replace the burning table with 1 t DM of residue burnt so the aggregation in
  # combineOutputs() is tested with non-zero, known amounts (Eq. 2.27, p. 2.42).
  burn <- as.data.frame(run$ghg$ghg_burn)
  burn$mass_residue_burn <- 1
  burn$amount_of_ghg_emission_from_fire <-
    ipcc_fire_gas_kg(1000, burn$combusion_factor, burn$burnt_emission_factor)
  ghg <- run$ghg
  ghg$ghg_burn <- burn

  out <- combineOutputs(
    para, run$fq, run$er, run$lr, run$se,
    water_requirement(para, run$lr), run$nb,
    land_productivity(para, run$er), run$bm, run$sc, ghg,
    filePath = tempfile(fileext = ".json")
  )
  bal <- out$ghg_balance
  pkg <- as.numeric(bal$value[bal$GHG_balance == "Burning"])

  amt <- setNames(burn$amount_of_ghg_emission_from_fire, burn$ghg_gas)
  # GWPs as used by the package (R/merge_outputs.R:693-694, AR5 values).
  ref <- ipcc_burning_co2e(amt[["CH4"]], amt[["N2O"]], gwp_ch4 = 28, gwp_n2o = 265)

  expect_equal(
    pkg, ref, tolerance = 1e-6,
    info = sprintf("1 t DM burnt: package %.1f vs IPCC %.1f kg CO2e (x%.1f)",
                   pkg, ref, pkg / ref)
  )
})
