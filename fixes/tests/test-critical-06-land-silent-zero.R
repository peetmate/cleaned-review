# Critical finding: impossible land-area results are silently replaced by 0 ha.
# Review refs: 03_landuse LU-01, 04_package_code F04.
#
# R/land_requirement.R:99-102 divides feed DM by yield * removal. With a zero
# yield or zero removal the result is Inf/NaN, and lines 120-121 then do
#   mutate_if(is.numeric, na_if(., Inf)) %>% replace(is.na(.), 0)
# so the feed is reported as needing 0 ha with no message.
#
# Standard: a feed with positive DM demand cannot be grown on 0 ha. The package
# should either stop or warn (R Packages 2e, "Signalling conditions"; the tidyverse
# style guide's error-message chapter). This is a contract test, not an IPCC test.

ct_capture_condition <- function(expr) {
  tryCatch({ force(expr); NULL },
           warning = function(w) w,
           error = function(e) e)
}

test_that("control: the fixture gives positive land for a normal Main feed", {
  run <- ct_run()
  lr <- as.data.frame(run$lr$land_requirements_all)
  pasture <- lr[grepl("pasture", lr$feed, ignore.case = TRUE) & lr$feed_item_dm > 0, ]
  expect_gt(nrow(pasture), 0)
  expect_true(all(pasture$area_feed > 0))
})

test_that("finding: a zero-yield feed with DM demand is flagged, not set to 0 ha", {
  para <- ct_para()
  pasture <- grepl("pasture", para$feed_items$feed_item_name, ignore.case = TRUE)
  para$feed_items$dry_yield[pasture] <- 0

  fq <- feed_quality(para)
  er <- energy_requirement(para, fq, ct_params()$energy)
  cond <- ct_capture_condition(land_requirement(fq, er, para))

  lr <- suppressWarnings(as.data.frame(land_requirement(fq, er, para)$land_requirements_all))
  silent_zero <- lr[grepl("pasture", lr$feed, ignore.case = TRUE) &
                      lr$feed_item_dm > 0 & lr$area_feed == 0, ]

  expect_true(
    !is.null(cond),
    info = sprintf("%d season rows with %.0f kg DM demand reported as 0 ha, no warning or error",
                   nrow(silent_zero), sum(silent_zero$feed_item_dm))
  )
})
