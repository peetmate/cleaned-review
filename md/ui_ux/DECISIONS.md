# Mockup decisions, and why

One entry per decision that shapes the mockup. Read this before changing its structure or vocabulary — most of these were argued about once already, and several reverse an obvious-looking choice for a reason that is not obvious. Release notes are in `05_mockup_review.md`; this is the *why*.

---

## D1 · It is a herd model, not a farm model
**Decided 2026-09-29.** The object is a livestock enterprise: a herd, the land that feeds it, and its manure. Crops not fed to animals stay outside the boundary.
**Why:** the package works this way, and framing it as a farm model invites descriptions the model cannot use. **Consequence:** the vocabulary is scale-neutral (`{onfarm}`, `{plot}`, `{enterprise}` tokens in `schema.json` → `scaleWords`), so the same questions describe three cows and a national herd of 4.7 million. Only the numbers change.

## D2 · "Assessment", not "scenario"
**Decided 2026-09-30, with the user choosing from four options.** The thing you name, open, run, compare and share is an **assessment**.
**Why:** "scenario" was carrying two different things — *what was there in 2024* and *what would happen if we did X* — which is why it read as jargon and why tracking over time was impossible. "Assessment" is also what Cool Farm and Agrecalc call it, so it travels.
**Consequence:** the data key was renamed with the vocabulary (`library.assessments`), not just the labels. See the rename trap in `../CLAUDE.md`.

## D3 · Three levels: project → enterprise → assessment
**Decided 2026-09-30.** An **enterprise** persists and holds dated assessments; a **project** groups enterprises and the people who may see them; an enterprise sits in one project or none.
**Why:** tracking over time then needs no feature at all — it is another dated assessment of the same enterprise. An assessment is `observed` (what was there that year) or `what_if` (a described change), which is the distinction "scenario" hid.
**Rejected:** a flat list with a date field. It cannot express "these two describe the same herd", which is exactly the claim a trend depends on.

## D4 · Results are a sketch, and say so
**Decided 2026-09-30.** The Results screen computes every figure from the user's own inputs with deliberately crude arithmetic, prints each formula on the screen, and carries a banner saying it is not the model.
**Why:** a results screen with no numbers cannot be tested for layout, units or wording, and invented numbers with hidden arithmetic would be worse than either. **Do not** quietly improve the sketch factors into something that looks authoritative — either wire up the real model or leave it visibly crude.

## D5 · Defaults have four states, and provenance is visible
`user` · `db` (from the parameter set) · `default-assumed` · `fixed` (IPCC constants). Every prefilled value carries a chip saying which, with a menu to change or reset it. Shipped parameter sets are read-only; a copy can be edited and shared.
**Why:** the live app's worst failures are silent defaults — removal 0, land cover "Dense forest", a manure label that fails the IPCC join. A wrong number the user chose is a different problem from a wrong number nobody chose, and the interface has to distinguish them.

## D6 · Blank means "I do not know"
Blank is stored as `null`, never 0, and a blank that the model cannot run without is listed on Check & run with a link to the field. Everything else is filled with a flagged assumption.
**Why:** an empty cell becoming 0 is how the current app produces confidently wrong answers.

## D7 · Manure handling belongs to the herd
Handling and the collected share are answered once per herd; each animal group inherits, shows what it inherited, and can override.
**Why:** handling follows the place animals are kept, not the animal category. **The hard constraint:** the package keeps one row per animal type and *errors out* if two rows share a `livetype_code` (`R/feed_quality.R:40` and `:137`), so when the same type appears in two herds the compiler must merge head-weighted. That merge is not a convenience — it is the only thing that produces a runnable file, and the Herds screen says so.

## D8 · Ask what people know; compile what the model needs
Litres a day and days milked, not kg/animal/year. Hours in a normal day, not time fractions. Bags and cartloads with an N percentage, not kg of nitrogen. The compiler converts.
**Why:** every unit the user has to convert by hand is an error the model cannot detect.

## D9 · Automatic numbering
Step and heading numbers are computed from schema order and DOM order (`72_numbering.js`), stored with every comment, and renumber when a step is inserted.
**Why:** workshop feedback has to point at one field. Never hard-code a number — including in cross-references between screens, which broke twice as `#7`.

## D10 · Comparison before absolutes
The tool is built around baseline-against-alternative and year-against-year, not a single certified figure.
**Why:** absolute numbers carry all the uncertainty of the inputs; a difference between two descriptions sharing their defaults carries much less. Hence the benchmark placeholder refuses to show a national average as a target.

## D11 · Two levels of navigation
Major sections across the top; the sidebar holds only the sub-sections of the active one.
**Why:** one tree doing both jobs listed a line per feed and stopped being a map. Records are reached by tabs on their own screen, and entity steps show a count.

## D12 · No funding or fundraising content in the tool
See `../CLAUDE.md`. Stated here too because it was breached once by merged work and had to be stripped.

## D13 · Every limitation is stated where it bites
The disclaimer sits on Welcome, Assessments, Check & run, Results, Batch and Help, and in both batch exports. Screens that cannot do something say so on the screen: attribution over time, benchmarks, the advisory limit ("ranking a farmer's options is defensible; telling one farmer what their footprint is, is not").
**Why:** a workshop participant who finds a limit we hid stops trusting everything else on the page.
