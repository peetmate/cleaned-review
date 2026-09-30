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

## Information architecture, second pass (v0.7.2)

Four changes from your reading of the structure. The wizard is now **10 steps, not 13**.

**"What we count" left the wizard.** It was a page of explanation sitting in a sequence of data-entry steps, and it made the wizard look longer than it is. It is now background material, reachable from the sidebar's reference group, from the welcome screen and from the FAQ, with no step number and no place in Next/Back.

**"About this farm" is renamed.** On the web, *About* means who we are and how to contact us, so using it for the system description was a false signal. The step is now **"Your livestock system"** (sidebar: "Your system") — "a few questions about what you keep and how, so we only ask what applies to you".

**Help, FAQ and contact now exist.** A new reference page with twelve questions answered (what it calculates; scenario vs project; what belongs inside the boundary; whether every field is needed; why results come out zero; where defaults come from and what you may change; a feed not in the list; units; the comma decimal; batch; who can see your data; how to report a problem), a "stuck right now" box, links to the background pages, and a reporting table that routes an app problem to CIAT/icleaned, a wrong result or a wrong default to CIAT/cleaned, and anything workshop-related to the in-page Comment button. It carries no email address — the team's channel is filled in by whoever runs the session. Reachable from "Help & FAQ" in the top bar and the sidebar, and it shows the build stamp to quote in a report.

**Location, seasons and land are one step.** Step 2 is now "Place, climate, seasons and land": where the animals are, the climate and soil from maps, then the seasons, then the land. Seasons and plots keep their own detail screens for month strips and per-plot answers, and hang under the step in the sidebar instead of taking step numbers of their own.

**Seasons are proposed from the rainy months, which answers the naming problem.** You already tick the months with rain in a normal year. The app reads the contiguous runs of those months and offers named seasons — "Rainy season (Nov–Apr) · Dry season (May–Oct)", or "Long rains / Short rains / Dry season" where there are two wet runs — with one button to accept and inline renaming afterwards. The suggestion disappears once the seasons match it, however they are named and in whatever order they are listed, and taking it warns first when it would clear an existing feeding plan. Verified on the Kenyan template: nine rainy months became "Rainy season (Mar–Nov)" and "Dry season (Dec–Feb)", 365 days placed.

Also fixed in passing: the feeding plan showed as "not started" in the sidebar even when fully entered, because the diet lives in `allocation`, which is not provenance-tracked.

## v0.7.3 — sidebar as a map, enterprise wording, labelled chips

**Records left the sidebar.** Feeds, animals, herds, plots and seasons no longer list one line each in the contents. A step shows a count (`Feeds ×12`) and nothing more, so the sidebar stays a map of the ten steps at any enterprise size.

**Records became tabs on their own screen.** Each entity screen carries a tab strip — `5.1 Brachiaria hybrid · 5.2 Maize stover · 5.3 Rhodes grass · + Add · All feeds` — with the numbered heading on each tab, an error badge where something is blocking, and previous/next under the card. The numbers are the same ones used for feedback, so "5.2 is confusing" still resolves to one record. The filter chips and the compact list remain for long lists.

**"Farm" became "enterprise" throughout.** The scale words now read enterprise / on your own land / off your land (communal or rented) / enterprise gate, and the questions follow: "Which animals does this enterprise keep?", "Grown on land you manage", "Collected off your land". The scale question's own first option keeps the word where it is the literal unit — "One enterprise (a household or a farm)" — and the two deliberate contrasts stay ("a herd model, not a farm model"). A sweep of every screen and every entity card found no other use.

**Top-bar chips say what they are.** Each is now labelled and carries a tooltip explaining the concept and how things nest: **Project** (groups scenarios and the people who may see them; project → scenarios → the herds, land and feeds in each, with a parameter set beside them), **Scenario** (one enterprise for one year; baseline vs intervention), **Describes** (the scale and size), **Defaults from** (the parameter set, what may be edited and what wins).

### How many herds can an enterprise have? (investigated in the package, 2026-09-30)

**In the mockup: as many as you keep. In the model: none — it has no herd concept at all.** A study object holds one flat `livestock` array, one row per animal category, and `livetype_code` is its de-facto primary key.

What the package does with a repeated category, verified in the source:

- **Same `livetype_code` twice → the run stops.** `feed_quality()` selects the category by code (`R/feed_quality.R:40`), gets two rows, and `rep()`s a length-2 vector against an *n*-row frame at `:137` — "arguments imply differing number of rows". A loud failure, but from a message no user could act on.
- **Same description, different code → silently wrong.** `energy_requirement.R:192-194` sums intake grouped by code, `:199` re-joins the livestock table, and `:211-212` joins twice on a non-unique key, so each duplicate's `time_in_*` and `manureman_*` are applied to the *combined* intake and a 2×2 cartesian comes out. `land_productivity.R:73` and `ghg_emission_v2.R:122` join on the description string, so duplicate names fan out there too. Nothing in the package validates for duplicates (`grep -rn "duplicated" R/` is empty); `water_requirement.R:75-80` is the only place that is duplicate-safe, because it sums row-wise off the raw input without joining.
- **`herd_composition` is not a grouping key** despite the name — it is the head count of that category, a scalar multiplier (`land_productivity.R:56-65`, `energy_requirement.R:134`). The app's own column header for it is "Number" (`30_mod_scenario_init.R:53-56`).

So the mockup's head-weighted merge is not a convenience, it is the only thing that produces a runnable file, and it is now stated as such on the Herds screen with the affected animal types named. The escape routes are real but limited: give the two groups genuinely different animal types, or describe them as two scenarios and compare.

**New finding for the current app (UX-89, High).** `30_mod_scenario_server.R:985` guards adding a livestock category with `if (!(input$livestock %in% livestock_data()[, "livetype_code"]))` — adding a category that is already in the table is a **silent no-op**: the modal closes, no row appears, no message. A user trying to describe a second group of the same cows gets nothing and no explanation. The guard is protecting the pipeline from the crash above, so the fix is a message, not removal.

**For the maintainers.** A herd dimension would need a key change in at least `feed_quality.R:27/40/148`, `energy_requirement.R:152/163/192/199/211/212`, `land_requirement.R:31`, `land_productivity.R:38/44/54/73`, `ghg_emission_v2.R:89/100/122/193/199`, plus the app's basket columns at `30_mod_scenario_server.R:2417/2628`. Short of that, the cheap win is a validation that rejects duplicate `livetype_code` with a sentence a user can act on, and a lookup that allows user-defined categories (which the CLEANED-flexible mapping the mockup already emits would then feed).

## v0.7.4 — batch made visible, a draft that survives an interruption, and a disclaimer

**Batch processing is now a first-class route, not a footnote.** It existed from v0.7.1 but sat below the reference pages where nobody would find it. It is now named "Batch processing" in a sidebar group called *Tools and reference*, has a `⇈ Batch` entry in the top bar, and has its own card on Home — "Many enterprises at once", with one paragraph on when to use it and a button straight into it. The route (`#batch`) and everything on it are unchanged.

**The form now keeps a draft, and says so.** A first pass takes 15–30 minutes, so an interruption before any save point must not cost the work. Every change is written to the browser's local draft within 300 ms, and the wizard bar carries a live `✓ Draft saved · just now` that ages by itself (`just now → 40s ago → 3 min ago`). If the browser refuses to store (private window, storage full) it says `Draft not saved` instead, with a tooltip pointing at the export on Check & run, because a silent failure here is worse than none. On reopening, the draft is restored and a toast names the time of the last change: *"Unfinished draft restored — last change 30/09/2026, 09:28:56."* Verified by typing a value and reloading with no save: both the scenario name and the changed rainfall came back.

**Requirement for the real app** (bigger than the mockup can show): the draft must be local-first *and* sync to the account, so that closing a laptop, losing the connection or a server restart cannot lose a part-finished description. Concretely: write locally on every change; sync in the background with a visible state (saved / saving / offline, last-synced time); on reopening, offer the newer of local and server rather than silently picking one; keep a short version history per scenario so a bad edit can be undone; and never block a user behind an explicit Save button, since the current app has none and people still lose work on a grey screen (UX-01, UX-39). The same applies to a batch: an upload and its QAQC result should be recoverable after a browser crash.

**Disclaimer, on every screen where a number might be believed.** Welcome, Home, Check & run, Results, Batch and Help now carry it, and it is written into both batch exports (a comment line at the top of the QAQC CSV, a `disclaimer` field in the model-input JSON):

> **Garbage in, garbage out.** iCLEANED calculates from the description you enter and the defaults you accept. It cannot tell whether a number is right: a wrong herd size, unit or yield produces a wrong result that looks just as confident as a right one. Check the inputs, and the assumed values listed on Check & run, before quoting any output. Results are indicative, for comparing scenarios rather than for reporting absolute figures, and the developers and their institutions accept no responsibility for the accuracy of the outputs or for decisions taken on them.

On Check & run it also states how many assumed values the scenario carries — "every one of them is a number nobody typed" — and on Batch that one mistaken column applies to every row in the file. The wording is a starting point: the institutional half of it should be checked by whoever owns the tool before release.

## v0.8 — a horizontal contents bar, a real Results section, and a feature queue

**Two levels of navigation, so neither has to do both jobs.** The major sections now sit in a horizontal bar under the header — **Scenarios · Describe · Results · Batch processing · Parameters · Feature requests · Help**, with Feedback on the right — and the sidebar holds only what is inside the section you are in. In *Describe* that is the ten steps (with Seasons and Land nested under step 2); in *Results* it is Summary / Greenhouse gases / Land & feed / Water / Nitrogen / Compare; in *Parameters* the nine parameter tables; in *Scenarios* mine / shared / templates; in *Feature requests* open / shipped / everything. The header and the bar scroll as one sticky block, and the bar scrolls sideways on a phone. Batch processing is a top-level section in its own right, so it is no longer reachable only through a shortcut.

**Results exists properly now.** It was a placeholder, which is why it kept not being findable: it was excluded from the navigation entirely. It is now a full section with six tabs: headline indicators (greenhouse gases, emission intensity per kg of milk, feed eaten, land, water, nitrogen balance), production (milk, meat, milk per cow), emissions split into enteric methane and manure nitrous oxide with a ranked bar per animal group, land and feed with a per-plot supply-against-demand check, water, a nitrogen in/out balance with a plain-language explanation of why a negative balance matters, and a comparison tab.

The numbers are **a sketch, not the model** — the mockup cannot run `cleaned`, and the screen says so in a banner that cannot be missed. Each figure comes from a deliberately crude calculation from the actual inputs (enteric methane from head counts and IPCC-ish per-head factors × GWP100; nitrogen excretion from live weight; intake at 2.5 % of live weight per day; 1,200 litres of green water per kg of feed dry matter), and every formula is printed on the screen under "How this sketch got its numbers", with the factors in the download too. This is deliberate: a results screen with no numbers cannot be tested for layout, units or wording, and invented numbers with hidden arithmetic would be worse than either. A 20-animal Njombe baseline sketches at 54.8 t CO₂e a year and 4.62 kg CO₂e per kg of milk — the right order of magnitude, which is all it claims.

**Feature requests are a visible, ranked queue.** A section listing what is queued, what is being built and what is already in the mockup, each with its rank, a rough size (days / weeks / months), where the request came from, what it would let you do, and — the part that usually gets lost — **why it matters**. Anyone can add a request from the page and vote on an existing one. Eleven are seeded from this work, with **#1 Scenario planning for ex-ante assessment**: define an intervention once, apply it to one or many baselines, compare side by side with the input uncertainty visible, and include adoption assumptions so a district or national effect can be estimated from an enterprise-level description. The rank is shown precisely so it can be argued with in the workshop; comments are about what exists, this queue is about what does not.

## v0.8.1 — "Why iCLEANED": the case, the offer, use cases, and an honest comparison

A new top-level section, first in the bar, with five sub-sections.

**The question it answers.** The argument stated in one line — *most tools tell you the carbon; livestock decisions are rarely only about carbon* — then the five indicators with a sentence each, and the three things that follow: one description at any scale, built for systems where feed is residues and communal grazing rather than a formulated ration, and comparison before absolutes.

**What we offer.** Six concrete things rather than a product pitch: the open R package (no lock-in), this app as a hosted entry point, **regional parameter sets** built with a partner from their own data and published as named, versioned, citable sets, batch assessment of data that already exists, training and facilitation with the workshop materials, and co-developed analysis on a specific question. With an explicit *what we do not offer*: no certification, no audited footprint, no farm-management system — and a pointer to Cool Farm or Agrecalc where an audited number is what's needed.

**Working with partners.** Five partner types (ministry or statistics office, research programme, NGO or project, dairy hub or processor, extension service), what each needs, and what we would actually set up for them; plus the six steps an engagement goes through, with the honest note that steps 3 and 5 — building the parameter set and running the real data — are where the time goes, and both are data work rather than modelling.

**Use cases — explicitly placeholders.** Five sketched (national inventory, project baseline and ex-ante appraisal, dairy hub sourcing, intensification pathways, teaching), each carrying a *"before this can be written"* line naming what is missing: a partner, real data, or a queued feature. A banner says plainly that none of them has been done. They are there so the shape can be argued about, not to imply a track record.

**How it compares.** Seven tools side by side — iCLEANED, Cool Farm Tool (Beef & Dairy), GLEAM-i 2.0, Agrecalc Cloud, CAP'2ER, COMET-Farm, FEAST — on who it is for, what it reports, where, at what scale and how it is accessed, drawn from the manuals read for `04_design_benchmarks.md`. **Every entry has a "better than us at" line**, and iCLEANED's own says "young, thin documentation, and the interface is what this mockup exists to fix". The closing paragraph sends the reader elsewhere where that is the right answer: Cool Farm or Agrecalc for an audited supply-chain figure, GLEAM-i for a national estimate from country defaults, CAP'2ER and COMET-Farm inside France and the United States. What is left is the case iCLEANED is actually for: a mixed crop–livestock system in the tropics, where the question is land, water and nitrogen as well as carbon, and where one description has to work from a household to a national herd.

A comparison that only flattered the tool would be worth nothing in front of the partners who already use those tools, so the dates and the basis are stated and a comment can correct anything out of date.

## v0.8.2 — use cases by segment, and capacity sharing in the queue

Work drafted in a parallel session, reviewed and kept here with two corrections.

**Use cases are now organised by the four segments the team named**, replacing five flat placeholder cards. Research networks, implementing partners, advisory services and government institutions, because each makes a different decision, uses a different interface and needs different training. Each segment carries: who it actually is (named institutions), how CLEANED fits as a first pass written to be argued with, **the honest part** — what is wrong or missing in that segment — a table of candidate use cases with a "Blocked on" column cross-referencing the feature queue, and a list of what somebody still has to go and find out, most of which is asking a partner a question rather than research.

Two of the four carry a **"Never tried"** chip: advisory services and government institutions. The other two say "Done before". The old placeholder cases were redistributed into the segments they belong to rather than thrown away.

Three things in it are worth keeping visible because they are the kind of thing a pitch usually hides:
- *Research networks*: reproducibility is listed as the **weak point, not a strength** — the batch workflow sources its functions over HTTP from a moving development branch, so the same script run a month apart can give different answers.
- *Advisory services*: "CLEANED is a rapid ex-ante estimate built for comparison, not a farm-specific prediction. Ranking a farmer's options is defensible. Telling one farmer what their footprint is, is not."
- *Government institutions*: the GLEAM question is named as a decision for the team — complementary or competing — and stated as something to settle *before* any government conversation.

A fifth possible segment, value chains and processors, is raised as an explicit **in-or-out decision** rather than quietly included or quietly dropped, with the recommendation to leave it out until verification exists, since corporate reporting needs an audited figure against a recognised standard and CLEANED is not close to that bar.

**Capacity sharing entered the feature queue at #7**, which pushed the printable form to #8, languages to #9, maps to #10 and the two shipped items to #11 and #12. Three parts: a structured *request training* route that records who is asking, which segment, how many people, which interface and what data they hold — so demand is visible instead of arriving as email to individuals; a modular short course whose worked examples run on the requester's own country and data (a context module they supply, so a new country is a config file and a dataset rather than a fork of the materials), with a credit-bearing version a university could adopt; and short task-shaped videos indexed by task and segment. The reason it is a feature and not a workplan line: training is already listed under what we offer, there is no way to ask for it, nothing to hand over, every workshop is rebuilt from scratch, and a recorded queue of requests is the evidence a capacity-sharing budget line needs in a proposal.

Corrections made when merging: the cross-references to the queue were written against the old numbering and pointed the printable form and languages at the wrong ranks; both were fixed, and the feature body now renders its markup like the other rich entries.

## v0.8.3 — no funding or fundraising content in the tool

The merged draft carried two traces of it — a training-request field recording “whether funding is attached” framed as making demand visible, and a line arguing that a request queue is the evidence a capacity-sharing budget line needs in a proposal. Both are removed: the tool describes what it does for the people using it, and anything about instruments, budget lines or demand evidence lives in internal notes outside this repository. Also reworded: a “the money” phrase in the value-chain question, a compile item asking what a partner’s donor wanted in the donor’s own words, and a use case titled “Reporting a change to the donor”, now “Reporting the change at endline”. A sweep of every screen and every tab for funding vocabulary comes back empty.

## v0.9 — "scenario" becomes "assessment", and an enterprise now holds a timeline

**The word changed because the thing was two things.** "Scenario" was carrying both *this is the herd as it was in 2024* and *this is what would happen if we did X*, which is why it read as jargon and why tracking over time was impossible. Split:

- An **enterprise** is what persists — a herd and the land that feeds it. It has a name, a place and an owner.
- An **assessment** is one description of that enterprise: dated when it records what was there that year, marked **what-if** when it describes a change being considered.

The section, the tab and the counts are all **Assessments** — that is the thing you name, open, run, compare and share. “Enterprise” is only the grouping the assessments hang under, and the word was already in use in the tool for the physical unit (a livestock enterprise), so it adds no new vocabulary. Tracking over time is then ordinary rather than a feature: another dated assessment of the same enterprise. Home is now a list of enterprises, each showing its assessments as a timeline with year, label, kind and size, and three actions — *Assess again this year*, *Test a change*, *See the change over time*. A follow-up copies the most recent observed assessment, so a re-assessment is a review of what changed rather than a re-entry from nothing. The examples were regrouped into five enterprises, and the Njombe enterprise gained a real 2026 follow-up (herd 20 → 26, fodder plot 0.8 → 1.2 ha) so the timeline has something behind it.

**Results gained three comparison modes**, replacing a single mocked one:
- **Over time** — the same enterprise's dated assessments in a table, each figure carrying the percentage change on the previous one. On the Njombe enterprise: animals +30 %, total sketch emissions +32 %, **emissions per kg of milk −28 %**, which is exactly the trade-off shape a monitoring conversation needs. It also states what it cannot do: it shows *that* something changed, not *why*, and attribution is queued.
- **Against another assessment** — the baseline-versus-what-if comparison, now able to reach any assessment of any enterprise.
- **Against a benchmark** — deliberately unbuilt, with what it would compare against listed in order of honesty (others in the same project or batch first, since method and parameter set match) and the trap named: a single national average presented as a target invites a like-for-unlike judgement.

**Three feature requests added**, at ranks 3, 4 and 5:
- **Track an enterprise over time, and attribute what changed.** The structure now exists; trends, a stated comparison basis and attribution do not. Without a stated basis, a trend line is worse than no trend line — it is how a rainfall year gets attributed to a project.
- **Benchmark context for every result.** A figure with no context is the most common way a result is misread.
- **Test a range of values, not one value at a time.** Enter several candidate values for one or more inputs and run every combination; ranked results and the inputs that move the answer most. Covers sensitivity and option screening, and is the cheapest honest answer to the uncertainty problem: if an input can plausibly take three values and the ranking does not change, the ranking is robust.

**Also:** queue cross-references are now by name rather than by number, since they broke twice when the queue was reordered; the collection key in the data model was renamed with the vocabulary, not just the labels; and the mangled auto-rename of the first queue item ("Assessment planning for ex-ante assessment") was rewritten as "Ex-ante appraisal".

## v0.9.1 — projects become a control, and three things the rename broke

**Project was named everywhere and controlled nowhere.** It appeared as a labelled chip in the top bar, in the tooltip explaining how things nest, in the welcome glossary and on a card at the bottom of the list — and no screen let anyone create one, put anything in one, or filter by one. Now:

- **Filter chips** above the list: *All projects · one per project with its count · No project*, shown only when there is something to filter, and reset when you switch between mine / shared / templates so a filter can never leave an unexplained empty list.
- **A project select on every enterprise card**, which moves the enterprise, all of its assessments, and the open assessment's top-bar chip in one action.
- **A project field on the new-assessment card**, with `+ New project…` revealing a name box and creating the project on save.
- **The Projects card is now a control**: project, enterprises, assessments, people, a *Show* button that applies the filter, a mocked *Invite*, and a create box. Its empty state says plainly that work can sit outside a project and that one is worth making when more than one person needs the same set.

**Three defects, all introduced by the v0.9 split rather than pre-existing:**

- **Opening an assessment did not change its project.** `load()` copied the enterprise, date, kind and label from the library row onto `meta` but not the project, so the top-bar chip kept whatever the previously open assessment had — the kind of quiet wrongness that only shows up when someone works across two projects in one sitting.
- **Batch rows became orphans.** "Open in the builder" created an assessment with no enterprise, so it vanished from the Assessments screen the moment you navigated away, and it invented a "Batch upload" project that existed in no project list. It now creates a real enterprise (named and placed from the batch row), attaches the assessment to it with the right year, and registers the project once so the whole batch shows up as a group.
- **Seven "a assessment"s** left by the blind rename, and a glossary entry that was wrong on substance rather than grammar: it said a project holds assessments, when after v0.9 a project holds enterprises and an enterprise holds its assessments.

The lesson for the second one is worth keeping: a structural change is not finished when the screens it targeted work. Everything that *creates* one of the moved objects has to be found — there were three such places, and the batch was the one nobody would have opened during a demo.

Two more things the audit turned up while checking the projects work, both also rename fallout: `styles.css` still targeted `.topbar-scenario` after the markup and the JavaScript had moved to `.topbar-assessment`, so the top-bar chips had silently lost their layout rules; and the two "new project name" inputs shared one accessible name, which a screen-reader user could not tell apart. A class audit — every class referenced in the code against every class defined in the stylesheet — now comes back clean apart from two deliberate cases.

## Project documentation (2026-09-30)

The repository had no agent-facing or contributor-facing documentation, so three were written:

- **`CLAUDE.md`** at the repository root: what each document is, the four non-negotiable rules (no funding content in the tool or site, no issues filed on the upstream repositories, never commit from the stale `site/` clone, read before overwriting), how to ship a mockup change end to end, the version-bump discipline, how to verify in the browser, the house style, and the four traps this repository has already fallen into.
- **`ui_ux/DECISIONS.md`**: thirteen decisions with their reasoning — herd not farm, assessment not scenario, the three levels, why the results are deliberately a visible sketch, the four provenance states, blank as unknown, manure at herd level and why the head-weighted merge is compulsory rather than convenient, asking what people know, computed numbering, comparison before absolutes, two-level navigation, no funding content, and stating every limitation where it bites. Several of these reverse a choice that looks obvious, which is exactly why they are written down.
- **`ui_ux/mockup/README.md`** brought up to date: it still described a flat list of six scenarios and the old screen set.
