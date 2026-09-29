# iCLEANED Scenario Builder — clickable mockup

A redesigned data-entry flow for iCLEANED, built to be tested in the user workshop.

**Framing.** CLEANED is a livestock *enterprise* model, not a farm model: a herd, the land that feeds it and its manure. The first question sets the scale (one household · group of farms · district/region · national herd) and every label adapts (`{farm}`, `{plot}`, `{onfarm}` tokens in `schema.json` → `scaleWords`). The questions do not change with scale; the numbers do.

**Reducing duplication.** Reuse before rebuilding: controlled vocabularies and IPCC constants are extracted from the package JSON at build time (`tools/extract_vocab.mjs`), user-named groups follow CLEANED-flexible's mapping format, screen patterns come from the benchmarked tools (`../04_design_benchmarks.md`), and each fact is asked once (plot attributes live on the plot, not on every feed; herd time patterns live on the herd, not on every group). It compiles plain-language answers into the JSON the `cleaned` R package reads, and captures feedback (pinned comments, highlights, screengrabs, ratings, A/B votes) inside the page.

Design rationale: `../01_uiux_review.md` (section "Redesign directions") and the approved plan.

## Layout

```
schema.json          data dictionary: sections, system questions, fields, compile tables, plain-language ↔ IPCC mappings
vocab.json           controlled vocabularies extracted from the app DB + package JSONs (run `npm run vocab` to regenerate)
variants.json        design alternatives offered for voting (V1–V5)
fixtures/            Study_1.json (target format, from the current app) · demo_scenario.json (Njombe example)
src/index.html       page shell (marker comments are replaced by the build)
src/styles.css       tokens, light/dark themes, layout, feedback layer styles
src/js/              concatenated in numeric order:
  00_env  10_store  20_router  30_dict  40_conditions  50_validate  60_compile  70_render_fields  71_render_layout
  80_screens/*       home · about · location · boundary · entities (plots, seasons, herds, animals, feeds) · other (fertiliser, inputs, losses, feeding, check, results, parameters)
  90_fb/*            feedback API + adapters (claude db / localStorage / memory / composite) · comment mode, highlight, screengrab · dashboard
  99_main            boot
build.mjs            node 26, no dependencies; validates schema.json against fixtures/Study_1.json
dist/offline/        icleaned-mockup.html — single file, works from disk and is what gets published
dist/artifact/       multi-file variant (index.html + app.js + styles.css + schema.js)
tools/extract_vocab.mjs
```

## Build and run

```bash
node build.mjs            # or: npm run build
python3 -m http.server 8790 --bind 127.0.0.1 --directory dist/offline   # optional; the file also opens directly
```

`node build.mjs --watch` rebuilds on change.

## How it decides where feedback goes

| Context | Adapter | Behaviour |
|---|---|---|
| Opened on claude.ai, viewer can write | `claudeDb` | Shared store; everyone sees everyone's feedback live |
| Opened on claude.ai, viewer cannot write (public link / Viewer) | `composite` | Reads the shared store live; writes to this device; banner asks to Export and hand over |
| Opened from disk / any other host | `localStorage` | Per-device; Export JSON/CSV from the Feedback dashboard; facilitator imports |

Record ids are client-generated, so importing a participant's export into the shared store never duplicates.

## Publishing

Publish `dist/offline/icleaned-mockup.html` as a claude.ai artifact with capabilities `db`, `user`, `comments {composer_only}`, `downloads`. Invite facilitators as Editors and participants with accounts as Contributors; everyone else uses the public link (view) and a facilitator scribes, or the offline file.

## Compile rules worth knowing

- Blank means unknown. Defaults come from the parameter set (`db`), the location (`map`), or typical practice (`assumed`) and are listed on Check & run.
- One model row per animal category: same-category groups in different herds are merged weighted by head count (flagged).
- One soil and one tillage practice per farm: the largest cropped plot wins when plots differ (flagged).
- Plain-language manure choices compile to exact IPCC Table 10.17/10.21/10.22 labels; unused places compile to `Pasture/Range/Paddock` so joins never return NA.
- `region` is compiled as the IPCC label (`AFRICA`, `LATIN AMERICA`), never the app's code.
- Feed origin compiles the `OFR` / `OFC` / `IP` suffix the package detects by substring.
- `fertilizer[]` emits both `percentage_n` and `fraction` because the deployed package version is uncertain.
- Three-state values: **you entered** (overrides for this scenario only) · **from database** (parameter set; overridable inline on animal and feed cards under "Values from the parameter set") · **assumed / from maps** (listed on Check & run; database values are listed separately and not counted as assumptions).
- User-named animal groups compile to a `livestock_mapping` array `{user_name, canonical_name}` alongside the canonical `livetype_desc`, matching the CSV format of [CLEANED-flexible](https://github.com/ymutua/CLEANED-flexible).

## Editing defaults (Parameters screen)

Shipped parameter sets are read-only (🔒). "Make my own copy" creates an editable copy; edits are tracked per cell against the shipped set (`paramSets.copies[].changes[table][rowKey][col] = {from, to, at}`), highlighted in the tables with *was … · revert*, listed under the Changes tab, and applied to every scenario that uses the copy (via `dict.vocab()`, which overlays the changes on the shipped vocab). Copies can be shared with a project. IPCC factors and conversions sit under **Fixed constants** (values pulled from the package JSON at build time) and can only change through "Propose a change to the maintainers", which drafts a data-issue in the CIAT/cleaned GitHub form format. Every value chip opens a menu: enter my own value · use the parameter-set value · change it in the parameter set.

## Published

- Artifact (private until shared): https://claude.ai/artifact/XQQdVrsasQ9RWWSGMYq41q
- Republish after `node build.mjs` by publishing `dist/offline/icleaned-mockup.html` to that URL.

## Next iterations (from `../04_design_benchmarks.md`)

1. **Quick vs Detailed depth** (CAP'2ER, MLA Quick Start): a Quick mode that asks ~25 values and carries published defaults for the rest, listed on Check & run.
2. **Printable collection form** mirroring screen order (FEAST, COMET, Farm Carbon Calculator) for interview-first, key-later use offline.
3. **Live totals everywhere** (GLEAM-i, Agrecalc): head/TLU total on Animals, ha total on Plots, kg N total on Inputs.
4. **Copy across seasons/months** arrows (COMET) on the Feeding plan.
5. **Admin-unit picker first, map second** (Farmer.Chat data-cost finding) — already the V4 vote; consider making B the default for low-bandwidth deployments.
6. **Adviser-on-behalf-of-farmer** with consent record (Carbon Navigator, Agrecalc): a "Recorded for: farmer name · consent given" field on Start.
