# Critical finding: the shipped example input cannot run the pipeline.
# Review refs: 04_package_code F01, 03_landuse D-01, 02_livestock H-03 and M-01.
#
# README "Standard Model Run" and the vignettes use
# inst/extdata/example_input.json. feed_quality() needs feed_items$crop_name,
# and energy_requirement() needs livestock$fat_milkcontent. The example has
# neither. The fixture in helper-critical-fixture.R patches these so the other
# tests can run; this file tests the unpatched file.

ct_raw_example <- function() jsonlite::fromJSON(ct_extdata("example_input.json"))

test_that("finding: feed_quality() runs on the shipped example", {
  expect_no_error(feed_quality(ct_raw_example()))
})

test_that("finding: energy_requirement() runs on the shipped example", {
  p <- ct_raw_example()
  # Give feed_quality() what it needs, so this test isolates energy_requirement().
  p$feed_items$crop_name <- p$feed_items$feed_item_name
  fq <- feed_quality(p)
  expect_no_error(energy_requirement(p, fq, ct_params()$energy))
})

test_that("finding: example dm_content is on the documented % basis", {
  # feed_quality() divides dm_content by 100 (R/feed_quality.R:39). The example
  # uses fractions (0.30) and the concentrate has 0, which removes it from the diet.
  dm <- as.numeric(ct_raw_example()$feed_items$dm_content)
  expect_true(all(dm > 1 & dm <= 100),
              info = paste("dm_content values:", paste(dm, collapse = ", ")))
})
