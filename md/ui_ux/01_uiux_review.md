# iCLEANED web app: adversarial UI/UX review before the user-testing workshop

- **Date:** 2026-09-29
- **Source reviewed:** `icleaned_review_src` at `fb8498c` (CIAT/icleaned; merge of APPLITICS#16).
- **Live app:** https://icleaned.alliance.cgiar.org/.
  - First pass: login page only; the reviewer may not enter credentials.
  - Second pass: a full walkthrough in your logged-in Chrome session, from New Scenario to Run (four runs). See "Live walkthrough log" below.
- **Model issues:** cross-referenced to `../01_climate_ghg.md`, `../02_livestock.md`, `../03_landuse.md` and `../04_package_code.md`. `00_summary.md` and `05_app_relevance_and_workshop.md` did not exist when this was written.
- **Paths:** every file path below is relative to `icleaned_review_src/`. Package paths are relative to `cleaned_review_src/`.

**Verdict labels**
- **CONFIRMED** means observed live on icleaned.alliance.cgiar.org by the reviewer (login page only, first pass).
- **CONFIRMED (live)** means reproduced by the reviewer in a live walkthrough on 2026-09-29, in your logged-in Chrome session, using the approved throwaway scenario `ZZ_UXREVIEW_DELETE_ME` (Southern Highland Tanzania Dairy DB, 2 seasons, 12 local cows + 8 calves, Rhodes grass, NPK). Four runs were made. No other scenarios were touched, and consent was declined.
- **CONFIRMED (user)** means reported by you from your own live walkthrough on the same day.
- **REFUTED (live)** means a code-based claim that the live app contradicted.
- **PLAUSIBLE** means found in the code only.
- **PLAUSIBLE + probe** means the input behaviour was also reproduced in a throwaway local Shiny/DT app. That app used the same DT 0.33 widgets, ran on localhost in Chromium with an English locale, and has since been stopped.

For every finding the reviewer searched for a refutation, meaning handling code elsewhere. The result is recorded under "Refutation" wherever it changed the verdict or the severity.

## Verdict (5 sentences)

1. A first-time user can click through Farm → Livestock → Feed Production → Livestock Feeding → Run, but **the result is wrong or empty unless they override hidden defaults**. In the live walkthrough, a complete-looking scenario built with the app's own defaults produced **four empty charts** (all indicators 0, including enteric CH₄), with no message:
   - all validation is advisory, and nothing blocks a run;
   - a comma decimal became a 10× value (`200,5` → 2005);
   - "first row of the lookup" defaults silently zero model terms: manure CH₄ ("Pasture / range / paddock"), land area (removal 0), erosion (land cover "Dense forest");
   - the climate list lacks Cool Temperate and Boreal, even for the Mongolia and Uzbekistan DBs.
2. The app has **no error handling at all**: `tryCatch`, `validate` and `need` appear nowhere. The model run is synchronous in the Shiny process. So one participant's bad input can grey-screen their session, and with ~20 people clicking "Run" together every session on the same R worker will freeze.
3. The comparison dashboard can mislead experts as well as novices. Relative (%) charts keep the absolute unit on the y-axis. A zero baseline shows as "0 %". A negative baseline (N balance, carbon balance) flips the sign of the change. The GHG axis is literally labelled "ghg_emission".
4. Two guide steps have no UI at all: extrapolation (§3.2) and benchmarks (§3.4). "New Parameters Database" ignores the database the guide tells users to pick. Help is hover-only and there is almost none of it: 0 "?" icons on the Farm › Area slide and none on any table column. There is no data dictionary, no "don't know" option, and no geospatial prefill. A first-time user will not finish a meaningful scenario without the PDF and a facilitator (see "Redesign directions").
5. Recommendation: run the workshop on **pre-built template scenarios**, announce the known issues below, stagger the runs, and treat numeric results as illustrative. The Blocker fixes are mostly small and local (UX-01 to UX-09, UX-76, UX-77). The three "first row of lookup" defaults and the climate list are one-line data or code fixes that should go in before the session.

## Findings table

**Counts:** 12 Blocker, 33 High, 32 Medium, 10 Low, plus 1 refuted (88 rows). CONFIRMED (live), from the reviewer's walkthrough: UX-03, 05, 08, 09, 10, 13, 16, 17, 19, 26, 36, 39, 50, 74–88. CONFIRMED (user): UX-28, 30, 61–75. CONFIRMED: UX-58/59 (login page). REFUTED (live): UX-27. All others are PLAUSIBLE (code only).

| ID | Sev | Verdict | Screen / step | file:line | Issue |
|---|---|---|---|---|---|
| UX-01 | Blocker | PLAUSIBLE | Dashboard › Run; Compare; load scenario | `R/10_mod_board_simulation_server.R:160-355`; `R/20_mod_board_comparison_server.R:133-203`; no `tryCatch` anywhere | Any model or JSON error is uncaught inside an observer. The session dies (grey "disconnected" screen), or a raw R error shows in the plot area |
| UX-02 | Blocker | PLAUSIBLE | Dashboard › Run (many users) | `R/10_mod_board_simulation_server.R:174-300` | The run is synchronous, with no `ExtendedTask`/`future`. It blocks every session sharing the R process, which is fatal when a whole room clicks Run together |
| UX-03 | Blocker | CONFIRMED (live) | Livestock › Add livestock | `R/30_mod_scenario_server.R:987,997-1005`; pkg `R/ghg_emission.R:185-194,237-245` | Every new animal defaults to manure system `"Pasture / range / paddock"`. IPCC tables join on `"Pasture/Range/Paddock"`, so the join returns NA and the manure CH₄/N₂O term is silently lost **Live:** manure bar = 0 with default; switching stable system to "Solid storage" made it appear (41 px vs ~4 px expected for a real PRP MCF). |
| UX-04 | Blocker | PLAUSIBLE | Livestock table | `R/30_mod_scenario_init.R:72`; `R/30_mod_scenario_server.R:1007` | `manure_onfarm_fraction` is labelled "Collection of manure during off-farm grazing". It multiplies **all** collected manure, and its default of 0 zeroes manure N |
| UX-05 | Blocker | CONFIRMED (live) | All numeric inputs and DT cells | `R/helpers_shiny.R:201-203`; `R/30_mod_scenario_server.R:2567` | Blank DT cell → 0. Blank numericInput → the string `"NA"` in the JSON. `"1,5"` → **15** (probe). No `min`/`max` on any of 28 numericInputs **Live:** `200,5` in a Days cell → 2005; `1,5` in compost numericInput → 15; all 28 numeric fields start at 0. |
| UX-06 | Blocker | PLAUSIBLE | Feed Production › edit table | `R/30_mod_scenario_server.R:2527-2533`, `1860-1871` | Duplicate feed/crop name → autosave is silently skipped (stderr only). Run then simulates the **stale** saved JSON, although the banner says the simulation "will fail" |
| UX-07 | Blocker | PLAUSIBLE | Comparison › relative mode | `R/20_mod_board_comparison_ui.R:201-206`; `R/graphs.R:373-375`; pkg `R/compare_scenario.R:50-54` | The y-axis keeps the absolute unit on % bars. Baseline 0 → "0 %". A negative baseline flips the sign (divides by `base`, not `abs(base)`) |
| UX-08 | Blocker | CONFIRMED (live) | Dashboard › Run / Compare | `R/30_mod_scenario_validation.R:200-257`; `R/10_mod_board_simulation_server.R:160-170` | All validation (seasons ≠ 365 days, feeding ≠ 100 %, time fractions ≠ 1) is a banner only. Run never checks validity **Live:** ran with calves at 0 % feed in Short rains and 100 000 kg milk; no block. |
| UX-09 | Blocker | CONFIRMED (live) | Feed Production › Add feed | `R/30_mod_scenario_server.R:1449,1546-1548` | New feed: `main_product_removal = 0`. For non-residue rows, residue removal is forced to 0. So land requirement = 0 ha, with no warning **Live:** complete scenario with default removal = 0 produced four empty charts (GHG, N, land, water all 0, incl. enteric CH₄); setting 0.9 gave GHG ≈ 7.3, land ≈ 4 ha, N ≈ −840 kg. |
| UX-10 | High | CONFIRMED (live) | Farm › Area | `R/30_mod_scenario_ui.R:614-630`; `R/30_mod_scenario_validation.R:50-91` | Precipitation and rainy-season length default to 0 and have no validation. Erosivity divides by `rain_length`, giving NaN/Inf, then 0 **Live:** rainy season = 14 months and precipitation = 0 accepted, no warning. |
| UX-11 | High | PLAUSIBLE | Farm › Area (soil) | `R/30_mod_scenario_validation.R:50-91` | Soil N/C/clay/bulk density/depth are checked only for ≥ 0, and default to 0. SOC stock = 0 without a warning |
| UX-12 | High | PLAUSIBLE | Livestock / Feed tables (orange columns) | `R/30_mod_scenario_init.R:265-305`; `R/helpers_shiny.R:276-303` | DB-parameter columns look editable, but they are overwritten from the parameters DB on load or DB change. User edits are silently reverted |
| UX-13 | High | CONFIRMED (live) | Farm › Fertilizer | `R/30_mod_scenario_server.R:783-784,865-878` | NPK gets %N = 0 by default, with no warning. Removing a fertilizer leaves its kg/ha in the crop inputs, and the stale amounts are saved **Live:** NPK added with 0 % N, no warning. |
| UX-14 | High | PLAUSIBLE | Deployment | `renv.lock:717-762`; `global.R:15-17` | renv pins a fork (`M-Emmanuel/cleaned-staging-v2`, labelled 0.6.0), and `global.R` falls back to `CIAT/cleaned@cleaned_v0.6.0`. The field names the app writes match v0.7.0 only. On true 0.6.0, fertilizer N reads the hidden `fraction` = 0 |
| UX-15 | High | PLAUSIBLE | Livestock Feeding | `R/30_mod_scenario_validation.R:547-552`; `R/30_mod_scenario_server.R:2417-2453` | Negative %s are accepted (−50 + 150 = 100 passes). Renaming a season, feed or animal silently resets its allocations to 0, and can error in `rbind` |
| UX-16 | High | CONFIRMED (live) | Dashboard › Run picker | `R/10_mod_board_simulation_server.R:15-24` | The Run picker preselects the alphabetically first scenario, not the one just edited, so participants run the wrong scenario **Live:** Dashboard preselected `New_file.json` after editing ZZ scenario. |
| UX-17 | High | CONFIRMED (live) | Dashboard › GHG chart | `data/iCLEANED - Graphs Information.xlsx` sheet 2 row 1; `R/10_mod_board_simulation_ui.R:167-170`; `R/graphs.R:48-58` | The y-axis/unit text reads "ghg_emission". The values are t CO₂e **per ha**, which is not stated |
| UX-18 | High | PLAUSIBLE | Dashboard › Water pie | `R/graphs.R:303-305`; `R/10_mod_board_simulation_server.R:577-585` | Unnamed `scale_fill_manual` gives alphabetical colour order, while the HTML legend uses data order. Legend colours can point to the wrong feed |
| UX-19 | High | CONFIRMED (live) | Scenario › Share to pool | `R/30_mod_scenario_server.R:263,274-279`; `R/helpers_shiny.R:348-363` | Share overwrites another user's pooled JSON (`overwrite = TRUE`). If a DB of the same name exists, the DB is **not** copied, so the JSON is paired with someone else's DB **Live:** the app's own tooltip warns "someone could overwrite your file". |
| UX-20 | High | PLAUSIBLE | Scenario › Rename; DB rename | `R/30_mod_scenario_server.R:336-349`; `R/40_mod_params_db_server.R:224-240` | The new name is not sanitised (`../`, `/`), which allows path traversal into other users' folders. Renaming a DB silently unbinds its scenarios (they fall back to the default DB, with a 5 s toast) |
| UX-21 | High | PLAUSIBLE | Guide §3.2 / §3.4 | grep: 0 hits | Extrapolation and benchmarks are described in the guide but absent from the UI. The guide does not say they are manual or offline |
| UX-22 | High | PLAUSIBLE | Edit Parameters › New Parameters Database | `R/40_mod_params_db_server.R:189-199`; `global.R:49` | It always clones "Southern Highland Tanzania Dairy", whatever DB the user selected. The guide says to select a regional DB, then click New |
| UX-23 | High | PLAUSIBLE | First load / consent | `www/js/bg-modal.js:164`; `server.R:120-134,296-305`; `R/helpers_shiny.R:224-238` | Every visitor's IP goes to api.ipify.org before consent. Consent is re-asked every session. On "Yes", email + IP are stored together, which the consent text does not disclose |
| UX-24 | High | PLAUSIBLE | Whole app, keyboard | `ui.R:33-35,52-66`; `R/30_mod_scenario_ui.R:23-29` | Nav links, the logo and "Edit Parameters" are `<a>`/`<div onclick>` with no `href` or `tabindex`, so they are not keyboard-reachable. There are 0 `aria-`/`role` attributes in the app |
| UX-25 | High | PLAUSIBLE | All "?" help | `www/sass/app.scss:255-308` | Tooltips appear on CSS `:hover` only. They cannot be opened by touch or keyboard, and they are `display:none` to assistive tech |
| UX-26 | High | CONFIRMED (live) | Farm/Livestock forms | `R/30_mod_scenario_ui.R` (~45× `label = NULL`, e.g. `:301-306`, `:384-389`) | Visible labels are `h2`s, not `<label>`s. Screen readers get unlabelled fields and ~80 fake headings **Live:** Add-season textbox exposes accessible name "(no name)". |
| UX-27 | — | REFUTED (live) | Scenario input screens | `R/helpers_shiny.R:16-22` | The GUIDE button is hidden on the Scenario and Edit Parameters screens, which is exactly where users need it **Live:** GUIDE button visible on Scenario (at load and after returning from Dashboard) and on Dashboard; may still hide on Edit Parameters (not tested). |
| UX-28 | High | CONFIRMED (user) | Tables (Livestock ~50 cols, Feed ~30) | `R/30_mod_scenario_init.R:3-103`; `R/30_mod_scenario_server.R:1086-1141` | Data-entry columns have no tooltips (0 on any table header). Units are missing on several columns (see UX-33). Constraints such as "fractions sum to 1" appear only after the error |
| UX-29 | High | PLAUSIBLE | Livestock | `R/30_mod_scenario_server.R:1010-1011` | Small-ruminant weaning and one-year weights default to 0. They are styled as DB parameters but not synced, and there is no warning |
| UX-30 | Medium | CONFIRMED (user) | Farm › Seasons | `R/30_mod_scenario_server.R:648-651,734-741` | A sum ≠ 365 is only warned. A new season gets `max(365 − sum, 0)`, so a 0-day season is added silently. Duplicate names typed into a cell are accepted |
| UX-31 | Medium | PLAUSIBLE | Livestock / Feed › Add | `R/30_mod_scenario_server.R:985,1435` | A duplicate add is silently ignored, with no toast |
| UX-32 | Medium | PLAUSIBLE | Livestock (pigs) | `R/30_mod_scenario_init.R:83`; pkg `R/energy_requirement.R:134` | "Proportion growth piglets covered by milk (%)" is entered as 60, but the package uses it as a fraction, so CP comes out ~100× |
| UX-33 | Medium | PLAUSIBLE | Tables | `R/30_mod_scenario_init.R:19,25,56,91-92` | Units are missing or misleading: "Number" (herd), "Average N content manure" (a fraction), "Cultivation period", "Energy content milk/meat", "Trees DBH", "dry yield (t DM/ha)" without "/year" |
| UX-34 | Medium | PLAUSIBLE | Feed Production › Rice | `R/30_mod_scenario_server.R:1535,2090` | Rice inputs only apply when `crop_name == "Rice"` exactly. Two rice feeds are allowed, and they crash the model (pkg F16) |
| UX-35 | Medium | PLAUSIBLE | Farm carousel | `R/30_mod_scenario_ui.R:291-910`; `www/sass/app.scss:795-798` | The 5 Farm sub-sections are carousel slides, reached only by arrows, with no indicators or slide count. Validation banners sit on individual slides and are easy to miss |
| UX-36 | Medium | CONFIRMED (live) | Tables | `R/30_mod_scenario_server.R:1086,1605,1910` | Cells are edited by double-click only, with no KeyTable. Nothing on screen says "double-click to edit" **Live:** Enter does not commit a DT edit; value commits only on blur. |
| UX-37 | Medium | PLAUSIBLE | Autosave | `R/30_mod_scenario_server.R:2516-2659` | The whole JSON is rewritten on every keystroke, with no debounce and no "saved" indicator. On a slow link every edit is a round trip plus a disk write |
| UX-38 | Medium | PLAUSIBLE | Switching scenario | `R/30_mod_scenario_server.R:2669-2736,2889` | Possible race: autosave writes the new file name with the old scenario's scalar inputs. `basket_data <- list()` is local, so stale allocations persist |
| UX-39 | Medium | CONFIRMED (live) | Disconnect / reload / back | `ui.R:154-156`; `R/helpers_shiny.R:13-27`; `www/js/auth-url-cleanup.js:13` | No reconnect or bookmarking. A reload lands on Scenario with nothing selected. The URL never changes, so the browser Back button leaves the app **Live:** URL stays `/` across all screens. |
| UX-40 | Medium | PLAUSIBLE | Two tabs, same user | `R/30_mod_scenario_server.R:2646-2650` | Last writer wins. A stale tab overwrites newer edits on its next keystroke |
| UX-41 | Medium | PLAUSIBLE | Params DB tables | `R/40_mod_params_db_server.R:812-829,965-995` | Row delete has no confirmation. Cell edits are written to disk immediately. No undo anywhere, and JSON deletes are permanent |
| UX-42 | Medium | PLAUSIBLE | Dashboard › traceability | `R/10_mod_board_simulation_server.R:38-48`; `server.R:187-194` | No run timestamp, input version or DB is shown with the results. "Last scenario created" is really the autosave mtime. Comparisons go stale silently after a re-run |
| UX-43 | Medium | PLAUSIBLE | Downloads | `R/10_mod_board_simulation_server.R:358-432`; `R/20_mod_board_comparison_server.R:207-264` | The ZIP omits the input JSON, includes an internal `.rds`, and offers no CSV. The comparison ZIP/PNG names don't encode the base scenario (abs vs %) |
| UX-44 | Medium | PLAUSIBLE | Dashboard (single run) | `R/10_mod_board_simulation_ui.R:131-317` vs guide ~L1077 | The guide promises an indicator dropdown per run. The single-run view has 4 fixed charts; the 44 indicators exist only in Comparison |
| UX-45 | Medium | PLAUSIBLE | N balance chart | `R/graphs.R:136-140` | A non-interactive `geom_bar` drawn over the interactive layer blocks the tooltips |
| UX-46 | Medium | PLAUSIBLE | Charts, colour | `R/graphs.R:10-15` | The 20-colour palette is not colour-blind safe (red/green, near-duplicate greens and blues). More than 20 feeds gives NA colours |
| UX-47 | Medium | PLAUSIBLE | Contrast | `www/sass/app.scss:6,48-49,422,801-810`; `typo.scss:86` | Nav links 2.2:1, inactive tabs 2.0:1, placeholder 1.6:1, GUIDE button 3.2:1, success button 3.25:1, focus ring 1.6:1 (all WCAG AA failures) |
| UX-48 | Medium | PLAUSIBLE | Small screens | `www/sass/app.scss:209-212,1003-1008,809`; `typo.scss:61` | Modals are 60 % wide with 100 px side padding, tabs are 290 px wide and buttons have 80 px padding, so the layout is unusable below ~900 px. Only 2 media queries |
| UX-49 | Medium | PLAUSIBLE | Onboarding | `server.R:88-119` | The user folder is created before the modal, so a reload skips onboarding forever. Empty answers are accepted |
| UX-50 | Medium | CONFIRMED (live) | Translation | whole app | No i18n layer. ~150 UI strings and ~125 messages are hard-coded English. `LC_TIME="C"` forced. No `lang` attribute **Live:** `<html lang="">`. |
| UX-51 | Medium | PLAUSIBLE | Comparison config | `R/20_mod_board_comparison_server.R:238,356,391`; `_ui.R:126,176` | `indicator[5:48]` is hard-coded, while the xlsx says rows may be reordered. Editing the xlsx silently breaks the charts shown |
| UX-52 | Low | PLAUSIBLE | Progress bar | `R/10_mod_board_simulation_server.R:178` | `incProgress` runs before each scenario, so the bar shows 100 % while the last run is still computing |
| UX-53 | Low | PLAUSIBLE | Help modal | `www/html/helper.html:3,7,17` | Describes a "desktop application". No guide link, no contact email. MS Form iframe is 720 px fixed |
| UX-54 | Low | PLAUSIBLE | Guide wording | guide ~L531, 673, 807, 877 | Labels differ: "farm code" (absent), "Herd composition" vs "Number", "Calving interval" vs "Parturition interval", "Feeding Periods" vs "Seasons", "JSON Input" (not on screen) |
| UX-55 | Low | PLAUSIBLE | Shared pool search | `R/30_mod_scenario_server.R:519-522` | Requires the exact file name; no browsing |
| UX-56 | Low | PLAUSIBLE | Payload | `www/img/logo.png` (72 KB at 1037 px, shown ~82 px); `ui.R:20-27` | CSS/JS are inlined, so not cacheable. The oversized logo doubles as the favicon |
| UX-57 | Low | PLAUSIBLE | Copy | `R/10_mod_board_simulation_ui.R:29`; `ui.R:180` | "andclick" typo; "Copyright ©" with no year or holder; "click here" link text |
| UX-76 | Blocker | CONFIRMED (live) + code | Farm › Climate | all 14 `data/primary_database/*/lkp_climate.csv`; pkg `inst/extdata/ghg_parameters.json` Table 10.17 | The climate picker offers only 6 zones (Tropical ×4, Warm Temperate ×2) in **every** DB, including Mongolia, Uzbekistan and Nepal. The package supports Cool Temperate and Boreal (moist/dry). Users in those systems must pick a wrong zone, which gives wrong MCFs |
| UX-77 | Blocker | CONFIRMED (live) + code | Feed Production › Add feed | `R/30_mod_scenario_server.R:1445,1460,1488` (`lkp_landcover[1]`) | Every new feed/crop defaults to land cover **"Dense forest"** (C factor 0.001), e.g. Rhodes grass forage. Soil erosion is driven to ~0 unless the user finds column 7 of a 50-column table. Same "first row of lookup" anti-pattern as UX-03 |
| UX-78 | High | CONFIRMED (live) | Dashboard › results | `R/graphs.R:74-82`; `R/10_mod_board_simulation_server.R:488-590` | All-zero results render as blank charts on a default 0–0.100 axis, with no message, empty state or diagnostic ("land requirement is 0 ha: check main product removal"). A user cannot tell "no emissions" from "model got nothing" |
| UX-79 | High | CONFIRMED (live) + code | Feed Production › feed list (Southern Highland Tanzania Dairy) | `data/primary_database/Southern Highland Tanzania Dairy/lkp_feeditem.csv` | The default dairy DB offers 11 feeds and **no Napier grass**, the dominant planted forage in that system. Rhodes grass forage DM = 93.97 % (hay-like, not fresh), so as-fed/DM confusion is baked into the defaults. File as a data issue |
| UX-80 | Medium | CONFIRMED (live) | Scenario › New Scenario | `R/30_mod_scenario_server.R` (create_new_json) | "New Scenario" instantly creates `New_file (1).json`, with no name or purpose prompt and no template choice. The DB is silently set to Southern Highland Tanzania Dairy. The toast says "The JSON has been created successfully!" (file-format jargon) |
| UX-81 | Low | CONFIRMED (live) | Scenario picker / top bar | `ui.R:130-133`; picker rendering | Underscores display doubled (`ZZ__UXREVIEW__DELETE__M…`) and names are truncated. "Last scenario created: <existing scenario>.json" did not change after a new scenario was created and renamed |
| UX-82 | Medium | CONFIRMED (live) | Whole app (1036 px window) | `www/sass/app.scss` (alerts, `.help`, carousel overflow) | Unstable layout causes misclicks. Validation banners grow and shrink above tables, shifting every row. The "?" tooltip covers the scenario picker and Rename button. The Climate dropdown is clipped inside the carousel (3 of 6 options visible), doesn't close on Esc, and hides the Farm-name field. Header nav wraps into a vertical stack. Tabs wrap 2×2 at half width, and more than one tab can look active |
| UX-83 | Medium | CONFIRMED (live) | Farm › Area (soil, land management) | `lkp_soil.csv`, `lkp_croplandsystem.csv`, `lkp_tillageregime.csv` | Only 9 soil types (no Ferralsol, Luvisol, Arenosol, Leptosol, Gleysol, which are common in SSA and SE Asia), plus the obsolete FAO-74 "Xerosol". "Estimated K Value" is unexplained (it is USLE erodibility). Cropland system and tillage options restate the climate ("tropical, moist/wet", "temperate/boreal, dry"), but nothing checks them against the Climate picker |
| UX-84 | Medium | CONFIRMED (live) | Farm › Fertilizer; Feed Production › Crop inputs | `R/30_mod_scenario_init.R:334-341`; `R/30_mod_scenario_server.R:1878-1937` | 7 fertiliser types (no CAN, TSP/SSP, MOP, "other"). The Farm tab collects only type and % N; application rates (kg/ha) sit in a "Crop inputs" table on another tab, with no signposting. All 7 product columns appear there whatever was selected |
| UX-85 | High | CONFIRMED (live) | Livestock / Feed tables | validation `R/30_mod_scenario_server.R:1177-1290` | No cross-field logic. Accepted without comment: 100 % of time in stable with 0 % manure collected and a "Pasture" system for stable manure; milk for calves; 14 tree/DBH columns for a grass forage; "Main product" source with 0 removal |
| UX-86 | Medium | CONFIRMED (live) | Feed Production | `R/30_mod_scenario_ui.R:1020-1080` | The table headed "Crop areas and residue management" has no area field. Area is only derived from demand ÷ yield. Users who know their plot sizes can neither enter nor check them |
| UX-87 | Low | CONFIRMED (live) | Copy / labels | various | "Selected a Feed" / "Selected a Crop"; "coefficiencies"; row label "…forage of Rhodes"; season re-cased ("Long rains" → "Long Rains"); "Soil" appears twice on the GHG x-axis; "Feed Item" axis title floats under the N chart; lower-case "water regime", "rice ecosystem type"; inconsistent "(kgs)" |
| UX-88 | Medium | CONFIRMED (live) | Dashboard › DMI warning | `R/10_mod_board_simulation_server.R:251-269` | "daily dry matter intake greater than 4% of their body weight: Cattle – Cows (local)" gives no cause, consequence or fix. It did not fire for calves producing 100 000 kg milk |
| UX-58 | Medium | CONFIRMED | Login | live: Auth0 login page | Every participant needs their own account (email+password sign-up or Google). Production runs on an Auth0 tenant whose name starts with `dev-`; its rate/email limits need checking |
| UX-59 | Low | CONFIRMED | Login | live | The login page carries the tagline only: no app name or purpose, no link to the guide, no language choice |
| UX-60 | Low | PLAUSIBLE | Code hygiene | `R/20_mod_board_comparison_server.R:355-386`; `global.R:14-17,86-92`; `R/sass.R` | 44 copy-paste observers; startup `install_github`; SCSS recompiled at every start; dead globals; leftover dev comments (`R/graphs.R:206`) |
| UX-61 | High | CONFIRMED (user) | Landing / first screen | `R/30_mod_scenario_ui.R:30-60`; `ui.R:130-148` | The first screen after login is a file manager: "Choose a file option", "New Scenario", "Select Scenario", Clone/Rename/Share. Nothing says what iCLEANED is, which decisions it informs, who it is for, who built it, where it has been used, or what is new. Help is a CGSpace PDF that goes stale with every release |
| UX-62 | High | CONFIRMED (user) | Farm › Climate | `R/30_mod_scenario_ui.R:311-320`; `data/primary_database/*/lkp_climate.csv` (`climate_code == climate_desc`) | IPCC climate zone is a bare picker with no definition, criteria (MAT/MAP/PET) or map. The zone keys the manure MCF lookup (pkg `R/ghg_emission.R:185`), so a guessed zone gives wrong CH₄ unknowingly |
| UX-63 | High | CONFIRMED (user) | All pickers and fields | whole UI; no dictionary in repo | No data dictionary or controlled vocabulary behind labels, units, definitions, ranges and defaults. Selected values show no definition (tillage, cropland system, organic-matter input, grassland management, input level, manure systems, soil types). This single gap underlies UX-28, UX-33, UX-50 and UX-72 |
| UX-64 | Medium | CONFIRMED (user) | Farm › Seasons | `R/30_mod_scenario_server.R:636-657,734-741` | The Add-season modal asks for a name only; days are auto-filled with the remainder. Editing days means double-clicking a table cell (not discoverable). No running total is shown, only "must be 365". No explanation of what seasons are for (feed-basket periods). Not linked to location |
| UX-65 | Blocker | CONFIRMED (user) + code | Farm › Manure/Fertilizer | `R/30_mod_scenario_ui.R:384-450`; pkg `R/ghg_emission.R:343-359`, `R/nitrogen_balance.R:151-153` | "Annual purchase of manure / compost / other organic N / bedding (kg N)" asks for nitrogen mass, which no farmer knows. Users will type kg of material, and the package uses it as kg N with no conversion, overstating N inputs ~50–200× (fresh manure ≈ 0.5–2 % N). Bedding "kg N" is especially opaque |
| UX-66 | High | CONFIRMED (user) | Farm (whole tab) | `R/30_mod_scenario_ui.R:288-330` | The unit of analysis is undefined: the whole farm, or only the land and inputs serving the livestock enterprise? The answer changes land, N and GHG results. No on-screen definition; the guide's "enterprise" framing is not repeated in the UI |
| UX-67 | Medium | CONFIRMED (user) | Farm › Manure vs Feed Production | `R/30_mod_scenario_server.R:1878-1937`; pkg `R/ghg_emission.R:359` | Purchased organic N is one farm-level lump. Per-field rates (pasture vs fodder) must be pre-aggregated by the user, while manure *produced* is split per crop via "fraction of manure used as fertilizer". Two different allocation models, and neither is explained |
| UX-68 | High | CONFIRMED (user) + code | Farm › Waste of milk and meat | `R/30_mod_scenario_ui.R:453-600`; pkg `R/merge_outputs.R:1095-1104` | Eight % fields with no explanation, source or "don't know" option. They only feed the output summary (food-loss adjusted products), not emissions or N, but nothing says they are optional. Participants stall here |
| UX-69 | High | CONFIRMED (user) | Farm › Area | `R/30_mod_scenario_ui.R:607-910` | Precipitation, rainy-season months, soil type and properties, and ET₀ are typed by hand, with no prefill from location. "Rainy season (months/year)" gives no instruction for bimodal rainfall; erosivity divides P by it (pkg `R/soil_health.R:28`), so the answer matters. No "I have my own soil test" override pattern; selected cropland, tillage, OM and grassland options show no description |
| UX-70 | High | CONFIRMED (user) | Whole scenario flow | `R/30_mod_scenario_ui.R` (all tabs rendered at once) | No progressive disclosure. Every field for every system is shown to every user. A few system questions (species, grazing vs zero-grazing, grows own feed?, buys manure/fertiliser?, rice?) could hide irrelevant fields |
| UX-71 | Medium | CONFIRMED (user) | Navigation | `R/30_mod_scenario_ui.R:289,913,982,1125`; carousel `:291-910` | Four fixed-width tabs plus a hidden 5-slide carousel inside Farm. A hierarchical sidebar (Farm › General / Seasons / Manure / Waste / Area; Livestock › per category …) with completion and error status per node would show where the user is and what is left |
| UX-72 | High | CONFIRMED (user) | All inputs | no `required` markers anywhere; validation `R/30_mod_scenario_validation.R:213` | Required vs optional is never indicated, and there is no "I don't know / use default" option. Users either stall or type guesses; neither is recorded as such |
| UX-73 | High | CONFIRMED (user) | Livestock | `R/30_mod_scenario_init.R:53-103`; `R/30_mod_scenario_server.R:958-1141` | One flat picker of ~22 species×category labels, then a ~50-column wide table (min 250 px per column, `www/sass/app.scss:651-692`). Fields such as "Average annual live weight gain (kg/animal)" have no guidance, default source or "not applicable" for mature animals. Species → category two-level choice and one form (card) per category would fit the screen and the mental model |
| UX-74 | High | CONFIRMED (live) | Livestock › milk, weights | `R/30_mod_scenario_server.R:992`; pkg `R/energy_requirement.R:109-111,144` | Milk can be entered for any category (calves, bulls, steers) and any size (100 000 kg/animal/yr is accepted). The package adds lactation energy and CP for any category with `annual_milk > 0`, so impossible entries change results. No per-category applicability or plausible range |
| UX-75 | High | CONFIRMED (live) | All numeric fields | defaults in `data/primary_json.json`; `R/30_mod_scenario_server.R:991-1015` | Fields show 0 rather than blank, so "not entered", "unknown" and "true zero" are indistinguishable. A fix needs explicit NA semantics end to end: UI blank → stored `null` → model applies a documented default with a provenance flag, or refuses to run. See UX-05 |

## Live walkthrough log (2026-09-29, Chrome, 1036 px window)

This is the step-by-step record of the approved throwaway scenario `ZZ_UXREVIEW_DELETE_ME`. The scenario and its results are still in your User Folder; delete them when you are done.

| # | Step | What happened | Findings |
|---|---|---|---|
| 1 | Load app | The navigation-consent sweetalert appears before anything else (declined). The landing screen is a file manager: "Choose a file option", New Scenario, Select Scenario, Rename/Share/Clone/Delete. Header nav wraps vertically | UX-23, UX-61, UX-82 |
| 2 | Hover "?" by Select Scenario | The tooltip covers the picker and the Rename button, and its own text warns that pooled files can be overwritten | UX-19, UX-25, UX-82 |
| 3 | New Scenario | Creates `New_file (1).json` immediately. The DB silently becomes Southern Highland Tanzania Dairy. The toast says "The JSON has been created successfully!" | UX-80, UX-22 |
| 4 | Rename | Works, but the picker shows `ZZ__UXREVIEW__DELETE__M…`, and "Last scenario created" still says <existing scenario>.json | UX-81 |
| 5 | Farm › General | Region lists AFRICA/ASIA/LATIN AMERICA. Climate lists 6 zones with no definitions or map. The dropdown is clipped, won't close on Esc, and hides Farm name | UX-62, UX-76, UX-82 |
| 6 | Farm › Seasons | The modal asks for a name only. The first season gets 365 days, the second 0, silently. `200,5` → **2005**. The warning doesn't show the total. Enter doesn't commit an edit. A blank cell shows empty (the code stores 0) | UX-05, UX-30, UX-36, UX-64 |
| 7 | Farm › Manure/Fertilizer | Fields are kg **N**. `-500` → banner only. `1,5` → **15**. NPK added at 0 % N with no warning. 7 fertiliser types; the amounts live on another tab | UX-05, UX-13, UX-65, UX-84 |
| 8 | Farm › Waste | 8 × "0" % fields with no explanation or "optional" marker | UX-68 |
| 9 | Farm › Area | Precipitation 0 and **14 rainy months** accepted. 9 soil types (Xerosol, no Ferralsol). K unexplained. 0 help icons | UX-10, UX-69, UX-83 |
| 10 | Livestock › Add | 22 flat species–category labels, default "Buffalo - Calves". Each new row: every numeric field 0, all 4 manure systems "Pasture / range / paddock". ~50 columns; 3 visible at 1036 px; frozen column overlaps headers | UX-03, UX-73, UX-75, UX-82 |
| 11 | Livestock edits | Calves 100 000 kg milk accepted. Time fractions validated (banner). Stable 100 % with 0 collection and a "Pasture" system accepted | UX-74, UX-85 |
| 12 | Feed Production › Add | Tanzania DB: 11 feeds, no Napier. "Selected a Feed". Rhodes grass defaults: land cover **Dense forest**, removal **0**, DM 93.97 %, 14 tree columns. No area field despite the heading | UX-09, UX-77, UX-79, UX-86, UX-87 |
| 13 | Livestock Feeding | There is a Total row (good). The banner lists missing 100 % allocations; the banner resizing shifts the table. Left calves/Short rains at 0 % on purpose | UX-15, UX-82 |
| 14 | Dashboard › Run #1 | Preselected `New_file.json`, not the edited scenario. Ran in <3 s despite invalid feeding. Result: **all four charts empty** (axis 0–0.100), plus a cryptic DMI > 4 % BW note for cows only | UX-08, UX-16, UX-78, UX-88 |
| 15 | Set removal 0.9 → Run #2 | GHG ≈ 7.3 (enteric only; axis "ghg_emission"). Land ≈ 4 ha. N balance ≈ −840 kg N/yr. Manure bar 0 | UX-09 → Blocker, UX-17 |
| 16 | Stable collection 1 → Run #3 | Manure bar still 0 | UX-03 |
| 17 | Stable system "Solid storage" → Run #4 | Manure bar appears (41 px). Confirms the default label drops manure CH₄ | UX-03 |
| — | Not tested live | Comparison (needs a second scenario), Download (saves a file), Edit Parameters, Share/Clone, disconnect | — |

## Redesign directions (from your notes, cross-checked against the code and the live walkthrough)

These are structural changes, not bug fixes. Together they answer notes 1–14. Build order is suggested at the end.

1. **A public front door.** The landing page should say what iCLEANED is and which decisions it informs (e.g. feed interventions, manure management, herd changes). It should also cover who it is for, the team and partners, where it has been used (case studies or testimonials), news and roadmap, and a "Try an example" button that opens a read-only demo scenario, with no login needed to look around. Move the file manager behind "My scenarios". (UX-61)
2. **Help that lives in the app and is versioned with it.** Replace the CGSpace PDF as the primary help with in-app docs, e.g. a Quarto or pkgdown site served at `/docs` and built in CI from the same repo. Then every release ships matching help. Add contextual "Learn more" links from each section to its doc anchor, and keep the PDF as an export of the docs, not the source. (UX-27 refuted, but the GUIDE button still points at a static PDF; UX-53)
3. **A data dictionary / controlled vocabulary as the single source of truth.** One table (YAML/CSV) per input and per lookup value, with these fields:
   - `id` and `package_field`
   - `label` and `label_fr/pt/sw/vi/id…`
   - `definition`
   - `unit` and `unit_display`
   - `type`
   - `min` / `max` / `typical_range`
   - `default` and `default_source` (DB / region / IPCC / user)
   - `required_if` (a condition on system answers)
   - `na_policy` (block / use default with flag / allowed)
   - `help_url`
   - `applies_to` (species / category / feed type)

   From it, generate the labels, tooltips, validation, units, the translations, the "definition shown on selection" for every picker (climate zones with IPCC criteria, tillage, cropland system, OM input, grassland management, manure systems, soils), and the docs pages. This fixes UX-28, 33, 50, 63, 72 and 87 in one mechanism, and gives multilingual access almost for free.
4. **Ask first, then show only what matters (progressive disclosure).** Start with 6–8 system questions:
   - species kept
   - production aim (milk / meat / both / draught)
   - grazing regime (zero-grazing / semi / free / off-farm)
   - grows own feed?
   - buys feed, manure or fertiliser?
   - rice?
   - trees in the feed system?
   - number of distinct seasons

   Use the answers to hide irrelevant sections: tree columns, rice columns, off-farm grazing, milk for non-lactating categories, waste. They also set sensible defaults (e.g. zero-grazing → stable time = 1, manure system ≠ pasture). (UX-70, UX-74, UX-85)
5. **Location-first prefill, with override and provenance.** Ask for a point: a map click, GPS, or an admin-area picker. Then prefill:
   - IPCC climate zone from the JRC/ESDAC IPCC climate-zone raster;
   - annual precipitation and rainy months from a CHIRPS/TerraClimate climatology;
   - bimodal detection → propose seasons with day counts;
   - ET₀ from TerraClimate or FAO;
   - soil type and soil C, N, clay and bulk density from SoilGrids (ISRIC REST API);
   - K factor derived from soil.

   Each value shows its source and an "I have my own measurement" override that is stored with provenance. Cache the lookups server-side and keep an offline fallback, because of slow connections. (UX-10, 11, 62, 64, 69, 76, 83)
6. **Ask for what users know, convert server-side.** For each purchased input, ask for the quantity and form: manure (kg fresh, or bags/cart-loads with a mass per unit), compost, bedding (kg straw, sawdust or other). Apply an editable default N content from the dictionary and show the resulting kg N. Allow inputs per field or feed (pasture vs fodder) and aggregate for the model, instead of asking the user to pre-sum. Apply the same idea to milk: litres per day × lactation days, converted to kg per year. (UX-65, UX-67)
7. **Define the system boundary on screen.** Add one sentence and a diagram at the top of Farm, e.g. "Describe only the land, animals and inputs of this livestock enterprise; crops sold off-farm are excluded", with examples. (UX-66)
8. **Livestock as species → category → card.** Use a two-level picker (species, then category, with definitions of "local / improved / high productive"). Give each category its own card or form with grouped sections (herd & production, housing & time budget, manure, advanced parameters collapsed). This replaces the 50-column table. Fields that don't apply are hidden (e.g. live-weight gain for mature animals, milk for calves). Each field shows its DB default with a "use default" chip, rather than 0. (UX-12, UX-29, UX-73, UX-74)
9. **Hierarchical sidebar navigation with status.** Replace the 4 tabs and hidden carousel with a left sidebar: Farm › General / Seasons / Manure & fertiliser / Waste / Soil & climate; Livestock › [each category]; Feeds › [each feed]; Feeding › [each season]; Run & results. Each node shows ✓ complete, ! needs attention or ○ optional, plus a running summary: season days total, herd size, feed-basket totals. (UX-35, UX-64, UX-71, UX-82)
10. **Blank means unknown; never show 0 as a default.** Empty fields stay empty. The dictionary's `na_policy` decides what happens: block the run, fill a documented default flagged "assumed" in the results, or treat as not applicable. The model receives `null`, not 0, and the package gains explicit NA handling instead of NA→0 coercion. The results page lists every assumed value, so a number can be traced back. (UX-05, UX-42, UX-72, UX-75, UX-78; package `04_package_code.md` §F04)
11. **Pre-run check and meaningful empty states.** Run opens a checklist of blocking errors and warnings, each with a "go to field" link. A result that is 0 or empty says why ("0 ha of land: main product removal is 0 for Rhodes grass"). (UX-08, UX-78, UX-88)

**Suggested build order:**
- **Before the workshop:** dictionary skeleton for Farm and Livestock (labels, units, definitions, ranges); fix the three "first row" defaults and the climate list; blank-not-zero on new rows; pre-run check.
- **Next release:** system questions and progressive disclosure; purchased-input conversions; livestock cards; sidebar.
- **Later:** geospatial prefill; landing site; versioned in-app docs; translations.

## Detailed findings

### Blockers

#### UX-01: Errors kill the session; raw R errors can reach users
- **Evidence:**
  - `grep tryCatch|validate(|need(|safeError` over `R/`, `server.R` and `global.R` returns nothing. The reviewer re-ran this personally.
  - The run observer calls `fromJSON` and the whole model chain directly (`R/10_mod_board_simulation_server.R:160-300`). An uncaught error in an `observeEvent` ends the Shiny session.
  - Inside `renderGirafe` the error text is printed in place of the plot, because `shiny.sanitize.errors` is not set in `global.R:20-26`.
- **Known triggers:**
  - two rice feeds (package `04_package_code.md` §F16);
  - duplicate feed×crop display names, which raise "duplicate 'row.names' are not allowed" at `R/30_mod_scenario_server.R:2417-2421`;
  - a missing results `.rds` (`10_…:144,488`).
- **Refutation:**
  - Only up-front guards exist: at least one scenario (`:163`) and at least two for Compare (`20_…:125`).
  - Autosave limits data loss, but not the context loss.
  - Not refuted.
- **Workshop impact:** a participant sees the screen grey out with no explanation and has to reload. They land back on the Scenario tab with nothing selected (UX-39) and assume their work is gone.
- **Fix:**
  - Wrap each scenario run in `tryCatch`, and show a `showModal` naming the scenario and a plain-language cause.
  - Continue with the other scenarios when one fails.
  - Set `options(shiny.sanitize.errors = TRUE)`.
  - Validate before running (see UX-08).

#### UX-02: The synchronous model run blocks everyone
- **Evidence:**
  - `observeEvent(input$run_scenario)` → `withProgress` → `lapply` over the scenarios, running `feed_quality` … `combineOutputs` in-process (`R/10_mod_board_simulation_server.R:174-300`).
  - There is no `future`, `promises` or `ExtendedTask` in the app.
  - Comparison (`20_…:133-203`) and ZIP creation (`10_…:364`, `20_…:215`) are also synchronous.
- **Refutation:**
  - A spinner and a progress bar exist (`10_…:171-178`), so the running user gets feedback.
  - The hosting setup (Posit Connect or Shiny Server workers, processes per app) was not visible. If each user gets their own process, the impact drops to that user's session.
  - Kept at Blocker until the deployment is confirmed, because a room of 20 on one worker is the default risk.
- **Workshop impact:** during the "run your scenario" task, runs queue behind each other. Participants on slow links see frozen UIs and click Run again.
- **Fix:**
  - Short term: confirm the worker settings and raise `max processes`/`min processes` for the session. Stagger the runs by table.
  - Real fix: `ExtendedTask` + `mirai`/`future` with a disabled Run button while a run is in progress.

#### UX-03: The default manure-management system does not match the IPCC tables
- **Evidence:**
  - `manureman_selection <- lkp_manureman()$manureman_desc[1]` is used for all four systems (`R/30_mod_scenario_server.R:987,997-1005`). In the primary DBs, row 1 is `"Pasture / range / paddock"` (e.g. `data/primary_database/Central Uganda - Livestock General/lkp_manureman.csv`).
  - The package joins on `Table 10.17$Manure_management_systems` and `Table 10.21$system` (`cleaned_review_src/R/ghg_emission.R:188-194,239-245`). Their value is `"Pasture/Range/Paddock"`. The reviewer checked this in R: the spaced label exists only in the descriptive second column.
  - There is no `trimws`/`tolower`/normalisation in the app or the package. The unmatched join gives MCF NA, which becomes 0.
- **Refutation:**
  - Users who change every manure system in the picker avoid the problem.
  - But the picker itself lists both spellings, and "Solid storage" twice.
  - Other labels also fail: "Anaer digester … HQ tec." has a trailing dot.
  - Related package notes: `01_climate_ghg.md` §F07/F08.
- **Workshop impact:** manure CH₄/N₂O is silently understated for every animal left on the default, so manure-management scenario comparisons show "no effect".
- **Fix:**
  - Store `manureman_code` rather than the description.
  - Harmonise the `lkp_manureman.csv` labels with the IPCC keys.
  - Default to a blank value that validation must flag.
  - Add a post-run check that warns when any MCF/EF is NA.

#### UX-04: The mislabelled `manure_onfarm_fraction` zeroes collected manure
- **Evidence:**
  - The label "Collection of manure during off-farm grazing (fraction)" is at `R/30_mod_scenario_init.R:72`, with default 0 (`R/30_mod_scenario_server.R:1007`).
  - The package multiplies all collected manure by it (`02_livestock.md` §H-05; `03_landuse.md` N-05).
- **Refutation:** there is no validation or tooltip. Not refuted.
- **Workshop impact:** a user who "doesn't collect off-farm" enters 0 and gets no manure N for crops. This is invisible in the outputs.
- **Fix:** relabel the field to match the package semantics (or fix the package), and warn when it is 0 while `manure_in_*` > 0.

#### UX-05: Blanks, commas and out-of-range numbers are accepted silently
- **Evidence:**
  - DT cells: `update_cell` does `ifelse(new_value == "", 0, new_value)` (`R/helpers_shiny.R:201-203`).
  - numericInputs: blank → `NA` → `as.numeric` → `toJSON` writes `"NA"` (`R/30_mod_scenario_server.R:2567`), and validation treats NA as acceptable (`R/30_mod_scenario_validation.R:213`).
  - None of the 28 numericInputs has `min`, `max` or `step` (`R/30_mod_scenario_ui.R`).
  - In the local probe (Chromium, en locale), typing `1,5` produced **15** in both widget types.
- **Refutation:**
  - Browsers in a French, Portuguese, Indonesian or Vietnamese locale may parse `1,5` as 1.5 in `<input type=number>`. The probe did not test this, so the behaviour is locale-dependent.
  - DT's numeric coercion itself is correct: the probe refuted an earlier crash hypothesis.
- **Workshop impact:** many participants (francophone Africa, Indonesia, Vietnam) habitually type comma decimals. A 10× yield or weight error produces plausible-looking charts.
- **Fix:**
  - Add `min`/`max`/`step` to the numericInputs.
  - Server-side, reject non-finite values and blanks with a field-level message.
  - Normalise `,` → `.` explicitly, or reject it with a message.
  - Never coerce blank to 0 silently.

#### UX-06: Duplicate names silently stop saving, and Run uses stale data
- **Evidence:**
  - The autosave observer returns early with only `cat(file = stderr(), "20 - Skipping JSON save…")` (`R/30_mod_scenario_server.R:2527-2533`).
  - The banner says the simulation will fail (`R/30_mod_scenario_validation.R:486-488`). But Run reads the last saved JSON (`10_…:181`), so it **succeeds with old inputs**.
- **Refutation:**
  - A banner exists, but its content is false.
  - Package `04_package_code.md` §F18 notes the underlying fragility.
- **Workshop impact:** a participant copies a feed row and edits it. Every edit after that point is lost, and their results do not change. They conclude the intervention has no effect.
- **Fix:**
  - Block Run while `has_errors`.
  - Show "Not saved: fix duplicate names" beside the tab.
  - Or save anyway and block only the run.

#### UX-07: Comparison charts mislead about relative change
- **Evidence:**
  - The static y-axis span holds `graphs_desc$unit` (e.g. "kg FPCM/year") even when the bars show `scales::percent` (`R/20_mod_board_comparison_ui.R:201-206`; `R/graphs.R:373-375`).
  - The package computes `(scen − base)/base*100` and maps non-finite results to 0 (`cleaned_review_src/R/compare_scenario.R:50-54` and following).
    - Baseline 0 therefore shows as "0 %".
    - A negative base (N balance, carbon stock change, carbon balance) flips the direction of the change.
  - The base scenario itself is excluded from the plot (`:41-42`).
- **Refutation:**
  - The package's `y_title` ("% change in …") is used in the PNG export only.
  - The short description does switch to relative text (`20_…:327-349`), but the axis does not.
- **Workshop impact:** "Carbon balance improved by −40 %" gets read as worse. A zero-emission baseline shows as "no change".
- **Fix:**
  - Switch the axis label to "% change vs <base>".
  - Divide by `abs(base)`.
  - Show "n/a" (not 0) when base = 0.
  - Display the absolute base value in the tooltip.

#### UX-08: Validation never blocks a run
- **Evidence:**
  - Every check renders an inline `alert-danger` (`R/30_mod_scenario_validation.R:200-257`; server `:734-741,1177-1290,1731-1875,2363-2370`).
  - `run_scenario` checks only that a scenario is selected (`10_…:163`).
  - After the run, the only check is DMI > 4 % BW (`10_…:251-269`).
- **Refutation:** none found.
- **Workshop impact:** these all run silently:
  - seasons summing to 300 days (package `02_livestock.md` L-08: shares are not normalised);
  - feeding columns at 80 %;
  - time fractions summing to 0.
- **Fix:**
  - Add a pre-run validator over the saved JSON that lists all errors per tab, with "Go to field" links. Refuse to run while errors exist.
  - Show a red dot on the tab labels.

### High (condensed)

- **UX-09 (zero land for new feeds).**
  - **Evidence:** `main_product_removal = 0` on add (`30_…server:1449`), and the validator accepts 0 (`:1829-1832`). "Purchased" feeds always get 0 ha, which is correct but not explained. See `03_landuse.md` §LU-01.
  - **Fix:** default removal to NA and require it for "Main" rows; show the ha per feed after the run.
- **UX-10 / UX-11 (rain and soil defaults of 0).**
  - **Evidence:** erosion and SOC are silently lost (`03_landuse.md` SE-01/02, S-03, N-07/08).
  - **Refutation:** the default templates may carry real values, but a new scenario from `primary_json.json` does not.
  - **Fix:** plausible ranges (P 100–4000 mm, rain months 1–12, BD 0.8–1.8, depth 0.1–2 m) with warnings; pre-fill from the region.
- **UX-12 (DB-synced columns revert silently).**
  - **Evidence:** `sync_columns_by_key` (`helpers_shiny.R:276-303`) runs on load and on DB change (`30_…server:940-952,1356-1381,2749-2754`). The comment at `helpers_shiny.R:259-260` confirms that only unlisted columns are preserved.
  - **Workshop impact:** sensitivity edits (e.g. a changed body weight) vanish the next day.
  - **Fix:** make the orange columns read-only in the scenario tables, with a link to "Edit Parameters".
- **UX-13 (fertilizer N can be lost).**
  - **Evidence:** NPK %N is 0 by default; removing a product leaves stale kg/ha, which are then saved (`30_…server:783-784,865-878,2588-2593`). See `01_climate_ghg.md` §F10, `03_landuse.md` N-04.
  - **Fix:** require %N > 0 for NPK; clear the amounts on remove.
- **UX-14 (which package build is deployed?).**
  - **Evidence:** the renv fork vs the `install_github` fallback; the field names the app writes (`fat_milkcontent`, `n_manure_content`, `percentage_n`) are v0.7.0 names.
  - **Workshop impact:** if production runs genuine v0.6.0, several inputs are ignored.
  - **Action:** ask the host for `packageVersion("cleaned")` and `packageDescription("cleaned")$RemoteSha` before the workshop.
- **UX-15 (feeding tables).**
  - **Evidence:** the column-sum check uses `na.rm = TRUE` and allows negatives (`validation.R:547-552`). Allocations are keyed by display name (`30_…server:2417-2453`), so renames reset them.
  - **Fix:** key allocations by code; require 0–100 per cell.
- **UX-16 (wrong scenario preselected on the Dashboard).**
  - **Evidence:** `selected = list.files(...)[1]` (`10_…server:20-23`).
  - **Fix:** preselect the scenario currently open on the Scenario tab.
- **UX-17 (GHG unit label).**
  - **Evidence:** the xlsx `unit` cell for `ghg_emission` literally reads `ghg_emission` (checked with readxl). The chart plots `t_CO2e_per_ha`.
  - **Fix:** a one-cell xlsx edit to "t CO₂e/ha/year", and add "per ha" to the title.
- **UX-18 (pie legend order).**
  - **Evidence:** unnamed palette (`graphs.R:303-305`) vs `unique(feed)` in the legend builder. Land-required uses a named palette and is correct.
  - **Fix:** `setNames(color_palette[seq_along(feeds)], feeds)`.
- **UX-19 / UX-20 (shared pool and rename).**
  - **Workshop impact:** if participants are told to "share your scenario", they will overwrite each other's same-named files ("Baseline.json").
  - **Fix:** sanitise names (`fs::path_sanitize`, reject `/` and `..`); namespace pooled files by user; copy the DB on share.
- **UX-21 (extrapolation and benchmarks missing).**
  - **Evidence:** guide §3.2 (~L1132-1211) prescribes multiplying the enterprise indicators by the number of enterprises and adoption rates; §3.4 (~L1416+) gives the Africa benchmarks. The app has 0 hits for either feature.
  - **Workshop impact:** the "extrapolate" task can only be done in a spreadsheet.
  - **Fix:** state this in the guide. Better, add a small "Scale up" panel (number of enterprises × adoption %) and a benchmark reference line on the per-kg charts.
- **UX-22 (New Parameters Database ignores the selection).**
  - **Evidence:** it clones `default_parameters_database` (`40_…server:189-199`). A Uganda or Vietnam participant silently starts from Tanzania dairy parameters.
  - **Fix:** clone the selected DB (the Clone button already does this; rename or merge the buttons).
- **UX-23 (privacy).**
  - **Evidence:** the ipify fetch runs on page load (`www/js/bg-modal.js:164`).
  - **Workshop impact:** a data-protection question you should not be answering on the day.
  - **Fix:** fetch only after consent, remember the consent answer, and disclose the email–IP linkage in the consent text.
- **UX-24 / UX-25 / UX-26 (keyboard, hover-only help, labels).**
  - **Fix:** `actionLink`/`<button>`; `:focus-within` plus a click toggle for `.help`; pass `label =` and drop the `h2`s.
- **UX-27 (GUIDE button hidden).**
  - **Evidence:** `go_to()` hides `#maj_helper_btn` except on the board (`helpers_shiny.R:16-22`).
  - **Fix:** always show it, and deep-link it to the relevant guide section per tab.
- **UX-28 (no column help).**
  - **Fix:** DT `headerCallback` tooltips taken from a single dictionary (label, unit, range, meaning). The same dictionary can drive validation and translation.
- **UX-29 (zero weights for small ruminants).**
  - **Evidence:** `30_…server:1010-1011`; see `02_livestock.md` §H-02.
  - **Fix:** sync the weights from the DB, or require them.

### Medium and Low
The table above gives the evidence for these. The ones most relevant on the workshop day:
- **UX-35:** the carousel hides the Farm sub-sections, so tell participants there are five slides.
- **UX-36:** double-click to edit.
- **UX-37:** autosave with no "saved" indicator, which unsettles users on slow links.
- **UX-39:** Back leaves the app.
- **UX-43:** the download ZIP contents.
- **UX-48:** laptops only; no phones.
- **UX-58:** accounts must exist before the session.

## Done well (max 5)

1. **Autosave to per-user JSON.** Most edits survive a disconnect. Deletes of scenarios, results, comparisons and DBs ask for confirmation (`30_…server:201-216`; `10_…:435-451`; `20_…:267-285`; `40_…:126-158`).
2. **Indicator explanations come from one spreadsheet** (`data/iCLEANED - Graphs Information.xlsx`). There are short and long, absolute and relative texts for all 48 charts, which is a good seed for help and translation.
3. **Honest axes.** There is no truncation (`ylim`/`coord_cartesian`); zero baselines use `expansion(mult = c(0, .1))`, and a dashed 0-line appears when values go negative (`graphs.R:74-82`).
4. **Many data-model mismatches are prevented.** Livestock types are click-locked in the params DB; every feed × livestock basket row is always written, which avoids package F18; the climate and fertilizer names all match the package (refuted suspicions in the input sweep).
5. **Light asset payload.** `www/` is ~370 KB, the fonts are local, there is no CDN dependency for core rendering, and the tables are small.
