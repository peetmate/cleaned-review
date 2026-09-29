# Critical finding: n_balance() and ghg_emission() fetch a missing input from
# the caller's environment by name.
# Review ref: 04_package_code F03.
#
# R/nitrogen_balance.R:36-37:
#   energy_required <- get("energy_required", envir = parent.frame(), inherits = TRUE)
# R/ghg_emission.R:46-48 does the same for feed_basket_quality.
#
# Standard: a function's result should depend only on its arguments (Advanced R
# 2e, section 6.4 "Lexical scoping"; R Packages 2e, "Understand when code is
# executed"). If a required input is missing, the function should stop, or at
# least warn. It must not silently pick up whatever object of that name the
# caller has, which may belong to another scenario. A warning passes, because
# iCLEANED currently relies on this lookup (see the fix log, F08).

test_that("control: n_balance() gives the same result when energy_required is passed", {
  run <- ct_run()
  a <- n_balance(run$para, run$lr, run$er, run$se)
  expect_equal(a$nbalance_kg_n_total, run$nb$nbalance_kg_n_total)
})

test_that("finding: n_balance() signals, not silently uses a caller object, when energy_required is missing", {
  run <- ct_run()
  # A different scenario's energy result is lying around in the caller.
  para_b <- ct_para()
  para_b$livestock$herd_composition <- para_b$livestock$herd_composition * 10
  energy_required <- energy_requirement(para_b, feed_quality(para_b), ct_params()$energy)

  cond <- tryCatch({
    n_balance(run$para, run$lr, soil_erosion = run$se)
    NULL
  }, warning = function(w) w, error = function(e) e)

  expect_s3_class(cond, "condition")
  if (inherits(cond, "condition")) expect_match(conditionMessage(cond), "energy_required")
})

test_that("finding: ghg_emission() signals, not silently uses a caller object, when feed_basket_quality is missing", {
  run <- ct_run()
  para_b <- ct_para()
  para_b$feed_items$cp_content <- para_b$feed_items$cp_content * 2
  feed_basket_quality <- feed_quality(para_b)

  cond <- tryCatch({
    ghg_emission(run$para, run$er, ct_params()$ghg, run$lr, run$nb)
    NULL
  }, warning = function(w) w, error = function(e) e)

  expect_s3_class(cond, "condition")
  if (inherits(cond, "condition")) expect_match(conditionMessage(cond), "feed_basket_quality")
})
