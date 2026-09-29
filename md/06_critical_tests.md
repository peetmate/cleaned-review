# Critical findings: unit tests against authoritative methods

This file is kept locally and has not been pushed.

- **Package tested:** `cleaned` v0.7.0 (`staging` @ `800d53a`)
- **Tests:** `fixes/tests/` in this folder (the earlier local git branch has been removed)
- **Run:** R 4.6.0, testthat, `pkgload::load_all()`

## How the tests are built

- **Independent reference.** `helper-ipcc-reference.R` implements each method directly from the source text, not from the package code. Every function cites the equation and the printed page.
- **Checked against the source PDFs.** I extracted the equations from the IPCC PDFs with `pdftotext` and checked each transcription line by line. Page numbers come from the page footers.
- **A control check for every finding.** Each finding has a control test on a part of the same module that the package gets right. If a control passes, the harness is set up correctly (units, herd scaling, column meanings), so a failing finding test next to it is the package's error, not the test's.
- **Minimal fixture patching.** `helper-critical-fixture.R` patches the shipped example only as far as needed to run: `crop_name`, the dry yields, and the renamed livestock columns. Every patch is listed in that file, and none touches a value that a test asserts on. Test 09 checks the unpatched file.
- **Failures are the evidence.** A failing finding test means the package differs from the source. A skip means I couldn't verify the source.

## Results

| # | Finding (review ids) | Control | Finding test | Package vs reference |
|---|---|---|---|---|
| 01 | NE requirements met with ME, no REM/REG (F02, C-01) | PASS: NEm = 0.386·BW^0.75 (Eq. 10.3, Table 10.4) | **FAIL** | Energy DMI is **0.55–0.63×** IPCC Eq. 10.16 on a controlled diet at 64% DE (cows 0.63, steers 0.57, calves 0.55) |
| 02a | N retention units (C-02, H-04, F04, F07) | PASS: N intake = Eq. 10.32 | **FAIL** | Cow N retention **0.00016 vs 0.058** kg N/day (365× too small) |
| 02b | N excretion formula (same ids) | (as 02a) | **FAIL** | Cow **89.4 vs 68.2** kg N/yr (+31%). Steers 49.7 vs 43.3. Calves 12.8 vs 8.8 |
| 03 | SOC factors applied every year to the measured stock (F01, S-02) | PASS: Eq. 2.25 reference gives 0 when nothing changes | **FAIL** | 1 ha of unchanged cropland shows **−7.02 t C/yr** (Eq. 2.25 gives 0) |
| 04 | Burning counts CO2 and uses the N2O GWP for NOx (F03, F06) | PASS: EFs = Table 2.5 | **FAIL** | 1 t DM burnt: **1,802 vs 75** kg CO2e (**24×**) |
| 05 | Tree SOC never added (F02 code, S-01) | PASS: `biomass_calculation()` returns a data frame with no `trees_non_feed_biomass` element | **FAIL** | +2.5 tree `c_increase_soc` changes the SOC total by **0** |
| 06 | Zero yield silently becomes 0 ha (LU-01, F04) | PASS: a normal pasture gets area > 0 | **FAIL** | **9 season rows, 14,231 kg DM** of demand reported as 0 ha, with no warning |
| 07a | Leaching not multiplied by area (N-01) | PASS: `out4` = per-ha rate × area | **FAIL** | Pasture on 109 ha: **2.6 vs 278 kg N** |
| 07b | Leaching coefficient `0.021*(P-3.9)` (N-02) | none | SKIP | Primary source not verified (see below) |
| 08 | Hidden lookup of inputs in the caller (F03 code) | PASS: explicit argument gives the same result | **FAIL ×2** | `n_balance()` and `ghg_emission()` silently use another scenario's object from the caller |
| 09 | Shipped example does not run (F01, D-01, H-03, M-01) | none | **FAIL ×3** | ``Column `crop_name` doesn't exist``; `object 'fat_milkcontent' not found`; `dm_content` given as fractions (0.3) where the code expects %, with 0 for the concentrate |

Totals on v0.7.0 across 22 tests: 8 control PASS, 13 finding FAIL, 1 SKIP. No test errored for harness reasons. (An earlier version of this file said 9 and 12, which was a miscount.) Two guard tests for the proposed fixes were added later; see `07_fix_log.md`.

## Source excerpts used (verbatim equations, with printed page)

**IPCC 2019 Refinement, Vol. 4, Ch. 10**
([PDF](https://www.ipcc-nggip.iges.or.jp/public/2019rf/pdf/4_Volume4/19R_V4_Ch10_Livestock.pdf))

- **Eq. 10.3 and Table 10.4 (pp. 10.23–10.24):** NEm = Cfi · Weight^0.75. Cfi for lactating cattle is 0.386.
- **Eq. 10.14 (p. 10.29):** REM = 1.123 − (4.092·10⁻³ · DE) + 1.126·10⁻⁵ · DE² − 25.4/DE.
- **Eq. 10.15 (p. 10.30):** REG = 1.164 − (5.16·10⁻³ · DE) + 1.308·10⁻⁵ · DE² − 37.4/DE.
- **Eq. 10.16 (p. 10.30):** GE = [(NEm + NEa + NEl + NEwork + NEp)/REM + (NEg + NEwool)/REG] / (DE%/100).
  - The text after it: "To convert from GE … to dry matter intake (DMI), divide GE by the energy density of the feed. A default value of 18.45 MJ kg-1 …"
- **Eq. 10.31A, Option 2 (p. 10.81):** Nex = (N_intake − N_retention) · 365. N_retention is in kg N/animal/day.
- **Eq. 10.32 (p. 10.82):** N_intake = (GE/18.45) · ((CP%/100)/6.25).
- **Eq. 10.33 (p. 10.85):** N_retention = [Milk · (Milk PR%/100)/6.38] + [WG · (268 − 7.03·NEg/WG)/1000/6.25].
  - MILK is in kg/animal/day and WG in kg/day.
  - The same page says: "Nitrogen excretion is calculated using Equation 10.31a, Option 2."

**IPCC 2006, Vol. 4, Ch. 2**
([PDF](https://www.ipcc-nggip.iges.or.jp/public/2006gl/pdf/4_Volume4/V4_02_Ch2_Generic.pdf))

- **Eq. 2.25 (p. 2.30):** ΔC = (SOC₀ − SOC₍₀₋T₎)/D, with SOC = Σ SOCref · FLU · FMG · FI · A. D is commonly 20 years.
- **Section 2.4 (p. 2.41):** for Cropland and Grassland, only non-CO2 emissions from burning are counted, on the assumption that the CO2 is taken back up when the vegetation regrows.
- **Eq. 2.27 (p. 2.42):** Lfire = A · MB · Cf · Gef · 10⁻³.
- **Table 2.5 (p. 2.47), agricultural residues (g/kg DM):** CO2 1515, CO 92, CH4 2.7, N2O 0.07, NOx 2.5.

**Code-contract standards (tests 06 and 08)**

These aren't IPCC tests. They check against standard R package practice: signal a condition when a result is impossible (R Packages 2e), and don't make a result depend on objects in the caller's environment (Advanced R 2e §6.4).

## Where the tests disagree with the reviews

- **Finding 01.** On the shipped example diet (about 5.3 MJ ME/kg DM, DE about 35%), the package-to-IPCC ratio was 0.34 for cows and *negative* for young stock. At that DE, IPCC REG (Eq. 10.15) goes below zero, because the equation isn't valid for such poor diets. So I tested at 64% DE, which reproduces the reviewers' 50–63%. The example diet quality is itself a separate problem (M-01: DM given as fractions, and 0 DM for the concentrate).
- **Finding 02.** The package's intake columns are herd totals, while retention is per head. The reference scales retention by `herd_composition`, which makes the gap *smaller* than an unscaled comparison would. That makes 02b a conservative test.
- **Finding 03.** The tests show the permanent annual loss but don't check the size of the carbon stock. With 30 cm depth, bulk density 1.3 and 1.5% C, the package stock works out at about 585 t C/ha, where the physical value is 58.5. That 10× is only an error if the inputs are in cm and %. The input contract (`vignettes/input-contract.Rmd:50-53`) gives no units, so I left it as a documentation finding rather than a test.
- **Finding 07b.** I couldn't retrieve the NUTMON leaching regression from a primary source, so the test is skipped with that reason. To enable it, add the page reference from Smaling et al. (1993) or De Willigen (2000).

## To reproduce

```bash
cd fixes
./run_all.sh
```

`openxlsx` must be installed; this run used a scratch library. The tests are written against the correct behaviour. When a finding is fixed, its test turns green and stays in the suite as a regression test.
