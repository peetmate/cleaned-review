# Scenario Builder mockup: adversarial review and fixes

- **Date:** 2026-09-29
- **Subject:** `ui_ux/mockup/` (build `dev-20260929`), reviewed by three independent passes: compile/validation correctness against the `cleaned` v0.7.0 input contract (node harness over ~45 mutated states), live UX walkthrough at 1280 px and phone width, and feedback-layer/runtime-contract/security hygiene against the artifact runtime `.d.ts` files.
- **Outcome:** 93 findings (4 Blocker, 21 High, 47 Medium, 21 Low). All Blockers and Highs and most Mediums are fixed in the same build; the rest are listed under "Open".

## Verdict

The redesign's core promise held under attack: compiled JSON has key/shape parity with the app's study-object format (0 missing, 0 extra keys apart from the intentional `livestock_mapping` and `param_set_copy` sidecars), unit conversions are exact, herd merges are head-weighted and flagged, every emitted manure/climate/slope/stock-change label is in the package's vocabulary, and the parameter-set copy overlay reaches the compiler. What failed was around the edges: a freshly added animal group broke (default objects stored as values), the dry-matter entry mode did not round-trip, several "silent zero" paths the redesign exists to close still slipped through (residue yield 0, blank rice fields, duplicate feed rows, 0 % N urea), screengrabs always failed (`color-mix()` in CSS), and keyboard entry lost focus after every value. The render scheduler could also stall for good in a hidden tab. All of these are fixed and re-verified live.

## Blockers (all fixed)

| ID | Where | Issue | Fix |
|---|---|---|---|
| C01 | `30_dict.js decorate` | A new animal group with no hours stored the `{value, source}` default object as its hours; the card showed `[object Object]`, validation emitted nonsense, compile sent `time_in_stable = 1` and dropped manure questions. | Store `d.value`; head-weighting falls back to equal weights when no group has a head count yet. Verified: fresh improved cows compile to 0.5/0/0.5/0. |
| F-01 | `styles.css` | html2canvas 1.4.1 cannot parse `color-mix()`; every screengrab failed and the failure toast was overwritten by the save toast. | All seven `color-mix()` uses replaced with rgba tokens; "Capturing the screen…" toast while capturing. |
| F-02 | `30_location.js` | Location variant B (dropdowns) reset the region to "Region…" on change, so it could never set a location. | Region handler captures the chosen value before rebuilding options. Verified: Kenya › Kakamega fills Lurambi, Tropical Moist, 1900 mm. |
| F-33 / render stall | `10_store.js notify` | rAF never fires while the pane is hidden or unpainted; the `scheduled` flag stayed set and every later update was dropped for the life of the page. | rAF raced with a 40 ms timeout; first to fire renders. |

## High (fixed unless marked)

| ID | Issue | Fix |
|---|---|---|
| C02 / F-12 | DM-mode diet entry did not round-trip; DM totals always read 100 %. | The whole row is rebuilt from DM shares, other cells rescaled to fill the remainder, then converted to as-fed; the footer shows the as-fed total. |
| C03 | The same feed item could appear twice (main + residue, or two plots), producing duplicate `feed_items` rows the package mis-pairs. | Validation error naming the feed. |
| C04 | Fields the compiler could not fill (`rice_fields`, `soil_k_value`, `region`) were "blocked" but not errors; Run stayed enabled. | Every compile-blocked path becomes a Check & run error; rice fields are required for grown rice. |
| C05 | Residue feeds with residue yield 0 passed (0 ha silently). | Blocked with a message naming the feed. |
| F-03 / F-04 | Season templates wiped the whole feeding plan silently; Copy/Same-for-all/Clear had no confirmation or toast. | Two-step confirm when a plan exists; toasts name what happened. |
| F-05 / F-06 / F1 / F2 | Focus lost after every committed value (inputs had no ids); dashboard search lost focus per keystroke. | Focus restored by a stable key (nearest `data-fb` + control identity + index); search debounced with an id. Verified: focus stays on "In a roofed shed" after change. |
| F-07 / F3 | "Reset example data" wiped feedback state; votes/ratings looked unsaved. | `reset()` preserves `fb`. |
| F-08 | Blank scenario had no way to name itself; Check linked to Home. | Editable scenario name on About; error links there. |
| F-09 | Manure follow-ups rendered above the choices they belong to. | Radios appended before follow-ups. |
| F-10 | "napier" found nothing. | `feedSynonyms` table (Napier/elephant grass, Rhodes, dairy meal…) searched and shown first. |
| F-11 | Three A/B vote widgets pushed content 250–540 px down on every card. | Collapsed into one "Design alternatives (n)" box on list views only. |
| F4 | Rating/vote ids built from a `null` viewer id collided. | Falls back to the device's anonymous id; ids sanitised to the path grammar. |
| F5 | A refused shared write went to a throwaway adapter nothing read. | One local adapter kept from init; on refusal the page switches to composite (read live / write local) with the banner. |

## Medium (fixed)

C06 fertiliser %N range and 0 % blocked · C07 dangling plot/herd references cascade to null and enum values are checked against options · C08 unknown land-use choices fall back and block instead of throwing; compile/validate wrapped in try/catch in render · C09 head/area maxima removed for macro scale · C10 country → IPCC region by whole-name table (9 regions), unknown blocks · C11 intercrop fraction inverted to "share taken by the other crop" · C12 `manure_sales_fraction = 0` (package double-discounts; matches the app) · C13 bought/collected feeds compile to `Main` so off-farm land counts; only the DB placeholder crop is `Purchased` · C14 `database_code` = the copy's base set, copy recorded in `param_set_copy` · C15 adult weight taken from the (overlaid) row before falling back · C16 validation labels translated for scale · C17 feeding errors route to the season tab · C19 parity fields (`*_ipcc`, `grassman*`, `"NULL"` strings) match the app · C20 compile/validate read the parameter copy from the passed state · C22 negative rates, out-of-range months, fertiliser rows gated · C23 "left where it drops" forces collected = 0 · C24 unknown livestock/feed codes blocked and skipped in the basket · C25 soil depth default 0.3 m · F-13/F-14 remaining "farm" and raw `{token}` leaks (herd patterns, validation labels, callouts, boundary text) · F-15 herd pattern change re-derives hours for groups without hand-entered hours (toast) · F-16/F-17 chip menu focuses the right control; "Clear the value" for user values without defaults · F-18 seeded feed origin/plot marked "assumed" · F-19 "Looks right — keep it" on assumed values; month arrays print as names · F-20 world region shown as calculated · F-21 feeding totals row carries `data-fb` so jump links flash it · F-22 new entities show no red until touched or until Check has been visited · F-23 participant-view banner clears on route change · F-24 phone top bar collapsed to one chip · F-25 placeholder contrast; theme button labelled · F-26/F15 focus rings on chips, rating scale, radios, months · F-27 skip link · F-29 "farms represented" at group scale · F-30 About says "answer the remaining questions" instead of skipping steps · F-31 "from maps" only claimed when a location exists · F-32 fertiliser status from data · F-34 plain labels for land-cover classes · F-35 "animal group" wording · F-36 rounding, version in proposal · F-37 season hint always shown · F-38 close button on the model-input panel · F-39 toast after removal · F6 one in-flight write per document · F7 subscription errors surface a banner · F8 import validates ids and fields, whitelists screenshots, throttles writes · F9 screenshot `src` must be a base64 image data URL · F10 CSV formula-injection guard · F11 session/name/group persisted separately · F12 localStorage carries the schema version; persisted `system`/`meta` merged with fresh defaults · F13 `<!doctype html>` on the offline file · F14 `aria-live` removed from the re-rendered screen · F16 highlight overlay `touch-action: none` and `pointercancel` · F17 preview not rendered while hidden · F18/F19 build validates types, option predicates, `_meta.*` names, required field ids; `<` escaped in inlined JSON · F20 byte-accurate size ladder, 4000-char text cap · F22 saves guarded until the store connects · F25 store banner has its own class.

## Open (not fixed; decisions or follow-ups)

- **C18 / manure labels:** "Burned for fuel" is the Table 10.17 label; 10.21/10.22 use "…or as waste" and hold the string `"NA"`. Kept 10.17; file a package data issue.
- **C11 intercrop direction and C12 manure sales double-discount** need confirmation from the package maintainers; both are documented in the compiler.
- **F-28 offline dependencies:** Google Fonts and html2canvas still load from CDNs; the offline file falls back to system fonts and text-only capture without network. Vendoring html2canvas into the offline build is the next step.
- **F-36 Goats → IPCC "Sheep" class** is DB data, not a mockup bug.
- **F21 participant-view variant restore**, **F24 focus return after screengrab**, **F27 object URL revoke**, **F28 composite merge preferring remote**, **F29 README note on network dependencies**: cosmetic, deferred.
- Keyboard: Tab through the full sidebar before the form is mitigated by the skip link only.

## Done well (from the reviewers)

Provenance chips with actionable menus and one legend everywhere; parameter-set copy workflow with per-cell "was … · revert"; plain-language manure choices with the exact IPCC mapping visible; keyboard behaviour of the comment panel (Enter opens, Tab wraps, Escape returns focus); purchased inputs in the user's units with a live kg N readout; comma-decimal normalisation with a toast.

## Re-verification (live, after fixes)

Fresh improved-cow group → `time_in_stable 0.5`, `time_in_onfarm_grazing 0.5`, manure system "Solid storage" · hours input keeps focus after change · DM entry of 50 shows 50 with the as-fed footer total · "napier" finds "Napier grass · Pennisetum purpureum" · Location variant B sets Kakamega/Lurambi with map defaults · national scale reads "About this national herd", "Grazing on private land / on communal or open land" · reset keeps the feedback store connected · demo scenario: 0 errors, 0 warnings, 10 assumptions, 45 parameter-set values · Germany → WESTERN EUROPE · no console errors · no `color-mix` in the built file.

## v0.7 — answers to your questions (2026-09-29)

Seven questions, and what changed in the mockup for each.

**1. Can the animals be entered with the herd?** Yes, and now that is the main route. The herd card carries an "Animal groups in this herd" table (group, head, the four day hours, Edit) and an **+ Add an animal group** button that opens the species → group picker inside the herd, so you never have to pick a herd from a dropdown. Step 7 (Animals) stays as the overview and the per-group editor.

**2. Should manure management be on the herd, not the animal?** Agreed, and it moved. Manure handling and the collected share are answered once per herd (`hmanure_stable`, `hmanure_pen`, `hmanure_onfarm`, `hmanure_offfarm`, `hmanure_kept_share`), because handling follows the place the animals are kept, not the animal category. Each animal group inherits them, shows what it inherited with a "⇣ from the herd" chip and a link to change it for the whole herd, and can still override in a folder called "Manure for this group only" — a calf pen handled differently is real, but it is the exception. The compiler is unchanged in shape: it still writes `manureman_*` and `manure_in_*` per `livetype_desc`, resolving herd → group override, and still merges by head count when one animal type appears in two herds.

**3. Feeding plan linked to the herd.** The feeding plan is now herd-first: a **Herd** tab row above the **Season** tabs, with a group count and an error badge per herd, plus "All herds together". "Copy from <previous season>" and "Clear" act on the herd you are in, not the whole scenario.

**4. Multiple herds — one plan each?** Yes. The screen states it: *"2 herds × 2 seasons = 4 grids"*, and every group's column must reach 100% in each. Two of the example scenarios (Rungwe commercial, Tanzania national) have two herds so this is testable in the workshop.

**5. If fertiliser is entered on the feeds, what is the Fertiliser section for?** Only for what is *in* the bag. Rates and placement stay on the feed cards; this screen asks the nitrogen percentage once per product, because the model works in kilograms of N and two crops using the same product share one number. The screen now says so, lists which feeds use each product with their rates and a "change" link, and shows the resulting kg N per hectare. It appears only when a product is actually used.

**6. Show the selected parameter above the tables, unlockable and editable.** Clicking any row in a parameter table opens it above the table as its own transposed table: plain label, unit, value in this set, shipped value, and per-cell Revert. It is locked by default (🔒) with **Unlock to edit**; on a shipped set the button is "Make my own copy to edit" instead. Column names are now plain language with units (`cp_lactmilk` → "Crude protein per kg of milk"), and values that belong to other species are parked in a folder instead of padding the table with zeros.

**7. Feed nutritional parameters: a folder you can unlock.** Each feed card has a "Nutritional parameters" folder showing dry matter, energy, protein and the two nitrogen contents read-only with their source chips. It offers the choice explicitly, because this is the part that needed deciding: **Unlock for this scenario only** (an override on this feed in this scenario, parameter set untouched) or **Edit in the parameter set** / **Edit the crop row** (jumps to the parameters screen with that row selected and unlocked, changing every scenario that uses your copy of the set). The folder spells out the difference, so nobody edits a shared default when they meant to fix one scenario.

**Where are the results shown?** On the Results screen (`#results`), which in the real app receives the model output. The mockup does not run the model, and now says so at the top of that screen, with a link to Check & run for exactly what would be sent. It also shows the size of what you described — animals, hectares, annual milk, herds, feeds, seasons — labelled as inputs added up rather than results, so a wrong scale is caught before running. What belongs on the screen is deliberately left open for the workshop.

**Project vs scenario.** A scenario is one description of one enterprise for one year. A project is the folder that groups related scenarios and the people who may see them; scenarios in a project can be compared with each other. Both are now defined in the welcome glossary and on the Home screen, which previously showed a Projects card with no explanation.

**Verified live:** all six example scenarios compile with 0 errors (Rungwe keeps 2 legitimate warnings) and the herd manure answers reach the package labels — biogas → `Anaer digester, Low leak, HQ stor, LQ tec`, wet pit → `Liquid/Slurry Pit below animals 3 Month`, covered heap → `Solid storage - Covered/compacted`. Editing "Live weight" in an unlocked parameter row records `{from: 350, to: 365}` in the copy; "Edit in the parameter set" from a feed card lands on feed row 11 with the panel open.

### v0.7 follow-ups

**Build stamp in the header.** The header now reads `Scenario Builder · mockup v0.7.0 · 29 Sep 16:46` — semantic version from `package.json` plus the build time to the minute, so you can tell at a glance whether what you are looking at includes the last change. The full stamp (with target) is in the title tooltip and on the welcome screen; on a phone the prefix drops and the version stays.

**Sidebar no longer lists every record.** Listing one child per feed does not survive a real feed list. Entity steps now show a count (`Feeds ×12`), and list children only while there are six or fewer — small scenarios keep the map, large ones get `12 feeds · 2 to fix · filter` linking to the step.

**Filter chips on the list screens.** Feeds, Animals and Plots gained a chip row built from the data itself, so a chip appears only when it matches something: for feeds, origin (grown / bought / collected), main product vs residues, and one chip per plot; for animals, one per herd plus milking and young stock; for plots, the land use. Each chip carries its count, there is a search box matching feed names, crop names and local synonyms, a "Needs attention" chip when something is blocking, and a card/list toggle that switches to a compact table automatically above eight records. Search keeps focus while filtering.

**Topbar crowding fixed.** Between 900 and 1200 px the scenario chips were being squeezed to 77 px because the action buttons never shrink. The scenario row now always sits on its own line.

## Batch upload (v0.7.1)

A separate **Batch** tab in the sidebar, for descriptions that already exist — a household survey, a project's monitoring sheet, a district inventory — rather than typing each enterprise into the wizard.

**The file contract.** One table per thing you are describing, joined on `enterprise_id`: `enterprises, seasons, plots, herds, animals, feeds, diet`. Either a `.xlsx` workbook with one sheet per table, one `.csv` per table (uploaded one at a time and merged), or a single `.json`. Columns hold **names, not codes** — "Napier grass", "Cows, local breed" — because that is what a field officer's spreadsheet holds; an unknown name is reported, never guessed. Templates download from the screen (JSON, and one CSV per table). The xlsx reader (SheetJS) loads from the CDN only when a workbook is actually dropped, and says to use CSV if it cannot.

**QAQC.** Every enterprise is built into a scenario and run through the same validator and compiler as a typed one, so a batch that passes would pass field by field. Problems come in two layers: file-level ones naming the sheet and column (`animals.hours_*: "Cows, local breed": the day adds up to 27 hours, not 24`; `feeds.feed: "Napier (local variety)" is not a feed in this parameter set`) and the model-level ones the wizard already knows. The table shows one row per enterprise with animals, land, status and an expandable problem list, filter chips (All / Blocked / Check / Ready), and "Open in the builder", which loads that one enterprise into the wizard while leaving the batch intact.

**Visualise.** Batch totals plus ranked distributions of animals per enterprise, land per enterprise, milk per animal and animals per hectare, each with median, mean and extremes. Labelled as inputs added up, not model results — their job is to expose the unit mistakes a batch hides: litres a day typed as litres a year, hectares as acres, a herd entered once per animal. After a run this is where the same enterprises would be ranked by emissions per kilogram of milk.

**Download.** QAQC report as CSV with one row per problem (sheet, column, message) so it can go straight back to whoever filled the sheet; compiled model input as JSON, either ready-only or everything, one study object per enterprise with its assumed values; and the file as read.

**Sample batch.** A button builds 12 enterprises from the example scenarios with ±15 % jitter and three deliberately broken rows (a 27-hour day, a diet column at 85 %, a feed name not in the parameter set), so the QAQC table has something real to show in the workshop. Verified: 7 ready, 2 with the legitimate Rungwe warnings, 3 blocked, each naming the right sheet and column.
