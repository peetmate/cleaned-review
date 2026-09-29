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
