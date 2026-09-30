// Builds fixtures/scenarios.json: several complete, contrasting example scenarios.
// Generated rather than hand-written so seasons, time budgets and diet shares stay consistent.
// Usage: node tools/make_scenarios.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const vocab = JSON.parse(readFileSync(join(ROOT, "vocab.json"), "utf8"));
const schema = JSON.parse(readFileSync(join(ROOT, "schema.json"), "utf8"));
const optsOf = (id) => (schema.fields.find((f) => f.id === id) || {}).options?.map((o) => o.value) || [];
const ALLOWED_PLOT = { tillage: optsOf("tillage"), orgmatter: optsOf("orgmatter"), grass_condition: optsOf("grass_condition"), grass_inputs: optsOf("grass_inputs"), slope_class: optsOf("slope_class"), plot_use: optsOf("plot_use") };
const feedOf = (code) => vocab.feeditems.find((f) => f.feed_item_code === String(code));

const MAP_FIELDS = ["climate_zone_2", "annual_prec", "rain_months", "et0", "soil_description", "soil_c", "soil_n", "soil_clay", "soil_bulk", "soil_depth"];

/** Build one scenario from a compact spec. */
function build(spec) {
  const s = {
    meta: { id: spec.id, scenario_name: spec.name, scenario_purpose: spec.purpose, param_set: spec.paramSet, owner: spec.owner || "you", project: spec.project ?? "Njombe dairy 2026", updated: spec.updated },
    system: Object.assign({ scale: "farm", species: ["Cattle"], aim: "milk", growsFeed: true, buysFeed: true, buysInputs: false, fertiliser: false, nSeasons: 2, rice: false, trees: false }, spec.system || {}),
    farm: Object.assign({
      location_point: spec.location,
      in_manure: null, in_compost: null, in_organic: null, in_bedding: null,
      waste_production_milk: null, waste_distribution_milk: null, waste_processing_milk: null, waste_consume_milk: null,
      waste_production_meat: null, waste_distribution_meat: null, waste_processing_meat: null, waste_consume_meat: null,
    }, spec.climate),
    provenance: {},
    plots: [], seasons: [], herds: [], animals: [], feeds: [], fertilizer: spec.fertilizer || {}, allocation: {},
  };
  // climate/soil come "from maps" unless the spec says the user typed them
  for (const k of MAP_FIELDS) if (s.farm[k] != null && !(spec.typed || []).includes(k)) s.provenance[`farm.${k}`] = "default";
  if (spec.farmsRepresented) s.farm.farms_represented = spec.farmsRepresented;

  spec.plots.forEach((p, i) => {
    for (const [k, allowed] of Object.entries(ALLOWED_PLOT)) if (p[k] != null && allowed.length && !allowed.includes(p[k])) throw new Error(`${spec.id}: plot ${i + 1} ${k}="${p[k]}" not in [${allowed.join(", ")}]`);
    s.plots.push(Object.assign({ id: `p${i + 1}`, plot_soil: null }, p));
  });
  spec.seasons.forEach((se, i) => s.seasons.push({ id: `s${i + 1}`, season_name: se.name, season_months: se.months }));
  spec.herds.forEach((hd, i) => {
    const { manure, keptShare, ...rest } = hd;
    const m = manure || {};
    s.herds.push(Object.assign({ id: `h${i + 1}` }, rest, {
      hmanure_stable: m.stable || { handling: "piled", collected: 100, followups: {} },
      hmanure_pen: m.pen || { handling: "drylot", collected: 80, followups: {} },
      hmanure_onfarm: m.onfarm || { handling: "left", collected: 0, followups: {} },
      hmanure_offfarm: m.offfarm || { handling: "left", collected: 0, followups: {} },
      hmanure_kept_share: keptShare ?? 100,
    }));
  });
  spec.animals.forEach((a, i) => {
    const hours = a.hours; // [shed, pen, onfarm, offfarm]
    s.animals.push({
      id: `a${i + 1}`, herd_ref: a.herd || "h1", livetype: String(a.livetype), group_name: a.groupName || null, herd_n: a.n,
      body_weight: a.bodyWeight ?? null, adult_weight: a.adultWeight ?? null,
      milk_l_day: a.milkLday ?? null, lactation_days: a.lactationDays ?? null, growth_kg_yr: a.growth ?? null,
      hours_stable: hours[0], hours_pen: hours[1], hours_onfarm: hours[2], hours_offfarm: hours[3],
      // Manure follows the herd; these are only set when this group is handled differently.
      manure_stable: (a.manure || {}).stable || null,
      manure_pen: (a.manure || {}).pen || null,
      manure_onfarm: (a.manure || {}).onfarm || null,
      manure_offfarm: (a.manure || {}).offfarm || null,
      manure_kept_share: a.keptShare ?? null,
    });
    const hrs = hours.reduce((t, x) => t + x, 0);
    if (Math.abs(hrs - 24) > 0.001) throw new Error(`${spec.id}: animal ${i + 1} hours sum to ${hrs}`);
  });
  spec.feeds.forEach((f, i) => {
    const item = feedOf(f.item); if (!item) throw new Error(`${spec.id}: unknown feed item ${f.item}`);
    const row = { id: `f${i + 1}`, feed_item: String(f.item), feed_origin: f.origin, feed_part: f.part || (f.origin === "grown" ? "main" : undefined) };
    if (f.origin === "grown") {
      row.feed_plot = f.plot; row.yield_t_dm_ha = f.yield ?? null; row.intercrop_share = f.intercropShare ?? 100; row.manure_to_plot_share = f.manureShare ?? 0;
      if (row.feed_part === "residue") { row.residue_yield_t_dm_ha = f.residueYield ?? null; row.residue_fate = f.residueFate || { fed: 60, left: 40, burnt: 0 }; }
      else row.main_fed_share = f.fedShare ?? 100;
      if (f.fert) row.fert_rates = f.fert;
    } else if (f.origin === "bought") row.feed_imported = !!f.imported;
    s.feeds.push(row);
  });
  // dense diet shares, checked to 100 per animal per season
  for (const [si, se] of s.seasons.entries()) {
    s.allocation[se.id] = {};
    for (const [ai, a] of s.animals.entries()) {
      const shares = spec.diet[si][ai]; if (!shares || shares.length !== s.feeds.length) throw new Error(`${spec.id}: diet season ${si + 1} animal ${ai + 1} needs ${s.feeds.length} shares`);
      const tot = shares.reduce((t, x) => t + x, 0);
      if (Math.abs(tot - 100) > 0.001) throw new Error(`${spec.id}: diet season ${si + 1} animal ${ai + 1} sums to ${tot}`);
      const row = {}; s.feeds.forEach((f, fi) => { if (shares[fi] != null) row[f.id] = shares[fi]; });
      s.allocation[se.id][a.id] = row;
    }
  }
  const months = new Set(); for (const se of s.seasons) for (const m of se.season_months) { if (months.has(m)) throw new Error(`${spec.id}: month ${m} in two seasons`); months.add(m); }
  if (months.size !== 12) throw new Error(`${spec.id}: ${months.size} months covered`);
  return s;
}

const TZ_SOUTH = { climate_zone_2: "Tropical Montane", annual_prec: 1100, rain_months: [11, 12, 1, 2, 3, 4], et0: 1300, soil_description: "Nitosol", soil_c: 28, soil_n: 2.1, soil_clay: 38, soil_bulk: 1.25, soil_depth: 0.3 };
const KE_WEST = { climate_zone_2: "Tropical Moist", annual_prec: 1900, rain_months: [3, 4, 5, 6, 7, 8, 9, 10, 11], et0: 1500, soil_description: "Acrisol", soil_c: 25, soil_n: 2.0, soil_clay: 35, soil_bulk: 1.2, soil_depth: 0.3 };
const TWO_SEASONS = [{ name: "Rainy season", months: [11, 12, 1, 2, 3, 4] }, { name: "Dry season", months: [5, 6, 7, 8, 9, 10] }];
const ONE_SEASON = [{ name: "All year", months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] }];

const specs = [
  {
    id: "sc_njombe_baseline", name: "Njombe smallholder — baseline", purpose: "baseline", paramSet: "Southern Highland Tanzania Dairy", updated: "2026-09-29",
    location: { country: "Tanzania", region: "Njombe", district: "Njombe DC", lat: -9.33, lon: 34.77, elevation_m: 1870 }, climate: TZ_SOUTH,
    plots: [
      { plot_name: "Homestead", plot_area_ha: 0.8, plot_use: "crops", slope_class: "Hilly (5-20%)", slope_length_m: 50, land_cover: "Dense grass", tillage: "full", orgmatter: "medium" },
      { plot_name: "Lower field", plot_area_ha: 1.5, plot_use: "crops", slope_class: "Hilly (5-20%)", slope_length_m: 50, land_cover: "Maize", tillage: "full", orgmatter: "medium" },
      { plot_name: "Hill pasture", plot_area_ha: 2, plot_use: "grazing", slope_class: "Steep (20-30%)", slope_length_m: 80, land_cover: "Degraded grass", grass_condition: "moderate", grass_inputs: "None" },
    ],
    seasons: TWO_SEASONS, herds: [{ herd_name: "Home herd", herd_pattern: "night_shed", herd_plots: ["p3"] }],
    animals: [
      { livetype: 1, n: 12, milkLday: 4, lactationDays: 240, hours: [12, 4, 8, 0] },
      { livetype: 7, n: 8, growth: 60, hours: [12, 4, 8, 0] },
    ],
    feeds: [
      { item: 11, origin: "grown", part: "main", plot: "p1", fedShare: 100, manureShare: 60 },
      { item: 8, origin: "grown", part: "residue", plot: "p2", residueFate: { fed: 60, left: 40, burnt: 0 }, manureShare: 40 },
      { item: 9, origin: "grown", part: "main", plot: "p3", fedShare: 100, manureShare: 0 },
      { item: 3, origin: "bought" },
    ],
    diet: [[[45, 15, 30, 10], [55, 10, 35, 0]], [[25, 45, 20, 10], [35, 40, 25, 0]]],
  },
  {
    id: "sc_njombe_napier", name: "Njombe smallholder — Napier & biogas", purpose: "intervention", paramSet: "Southern Highland Tanzania Dairy", updated: "2026-09-29",
    location: { country: "Tanzania", region: "Njombe", district: "Njombe DC", lat: -9.33, lon: 34.77, elevation_m: 1870 }, climate: TZ_SOUTH,
    system: { buysInputs: false, fertiliser: true }, fertilizer: { NPK: 17 },
    plots: [
      { plot_name: "Homestead (Napier)", plot_area_ha: 0.8, plot_use: "crops", slope_class: "Hilly (5-20%)", slope_length_m: 50, land_cover: "Dense grass", tillage: "reduced", orgmatter: "high_manure" },
      { plot_name: "Lower field", plot_area_ha: 1.5, plot_use: "crops", slope_class: "Hilly (5-20%)", slope_length_m: 50, land_cover: "Maize", tillage: "reduced", orgmatter: "high_manure" },
      { plot_name: "Hill pasture", plot_area_ha: 2, plot_use: "grazing", slope_class: "Steep (20-30%)", slope_length_m: 80, land_cover: "Dense grass", grass_condition: "improved", grass_inputs: "Medium" },
    ],
    seasons: TWO_SEASONS, herds: [{ herd_name: "Home herd", herd_pattern: "zero", herd_plots: [], manure: { stable: { handling: "biogas", collected: 100, followups: {} } }, keptShare: 100 }],
    animals: [
      { livetype: 1, n: 12, milkLday: 6.5, lactationDays: 270, hours: [24, 0, 0, 0] },
      { livetype: 7, n: 8, growth: 75, hours: [24, 0, 0, 0] },
    ],
    feeds: [
      { item: 10, origin: "grown", part: "main", plot: "p1", fedShare: 100, manureShare: 55, fert: { NPK: { mode: "kg_ha", value: 120 } } },
      { item: 8, origin: "grown", part: "residue", plot: "p2", residueFate: { fed: 80, left: 20, burnt: 0 }, manureShare: 35 },
      { item: 7, origin: "grown", part: "main", plot: "p2", fedShare: 100, intercropShare: 70, manureShare: 10 },
      { item: 3, origin: "bought" },
    ],
    diet: [[[55, 15, 15, 15], [60, 15, 20, 5]], [[35, 40, 12, 13], [45, 35, 15, 5]]],
  },
  {
    id: "sc_rungwe_commercial", name: "Rungwe commercial dairy — 180 cows", purpose: "baseline", paramSet: "Southern Highland Tanzania Dairy", updated: "2026-09-26",
    location: { country: "Tanzania", region: "Mbeya", district: "Rungwe", lat: -9.0, lon: 33.5, elevation_m: 1700 }, climate: { climate_zone_2: "Tropical Montane", annual_prec: 1300, rain_months: [11, 12, 1, 2, 3, 4, 5], et0: 1350, soil_description: "Lixisol", soil_c: 44, soil_n: 3.6, soil_clay: 23, soil_bulk: 1.3, soil_depth: 0.3 },
    system: { aim: "both", buysInputs: true, fertiliser: true }, fertilizer: { Urea: 46, NPK: 17 },
    plots: [
      { plot_name: "Irrigated pasture block", plot_area_ha: 45, plot_use: "grazing", slope_class: "Flat (0-5%)", slope_length_m: 120, land_cover: "Dense grass", grass_condition: "improved", grass_inputs: "High" },
      { plot_name: "Silage maize", plot_area_ha: 30, plot_use: "crops", slope_class: "Flat (0-5%)", slope_length_m: 150, land_cover: "Maize", tillage: "full", orgmatter: "high_manure" },
      { plot_name: "Hay paddocks", plot_area_ha: 22, plot_use: "crops", slope_class: "Hilly (5-20%)", slope_length_m: 90, land_cover: "Dense grass", tillage: "none", orgmatter: "high" },
    ],
    seasons: TWO_SEASONS, herds: [{ herd_name: "Milking herd", herd_pattern: "night_shed", herd_plots: ["p1"], manure: { stable: { handling: "pit", collected: 100, followups: { pit_months: "3" } }, pen: { handling: "drylot", collected: 90, followups: {} } }, keptShare: 70 }, { herd_name: "Young stock", herd_pattern: "mostly_grazing", herd_plots: ["p1"], keptShare: 70 }],
    animals: [
      { livetype: 2, n: 180, milkLday: 16, lactationDays: 305, hours: [12, 2, 10, 0] },
      { livetype: 6, herd: "h2", n: 95, growth: 160, hours: [6, 0, 18, 0] },
      { livetype: 8, herd: "h2", n: 70, growth: 95, hours: [8, 2, 14, 0] },
    ],
    feeds: [
      { item: 2, origin: "grown", part: "main", plot: "p1", fedShare: 100, manureShare: 30, fert: { Urea: { mode: "kg_ha", value: 80 } } },
      { item: 8, origin: "grown", part: "main", plot: "p2", fedShare: 90, manureShare: 45, fert: { NPK: { mode: "kg_ha", value: 200 } } },
      { item: 11, origin: "grown", part: "main", plot: "p3", fedShare: 100, manureShare: 25 },
      { item: 3, origin: "bought" },
    ],
    diet: [[[30, 25, 15, 30], [45, 20, 30, 5], [40, 20, 30, 10]], [[15, 40, 20, 25], [25, 40, 30, 5], [20, 40, 30, 10]]],
  },
  {
    id: "tpl_kenya_zero", name: "Template: Kenya zero-grazing (2 cows)", purpose: "training", paramSet: "Western Kenya - Dairy", owner: "iCLEANED team", project: null, template: true, updated: "2026-06-01",
    location: { country: "Kenya", region: "Kakamega", district: "Lurambi", lat: 0.28, lon: 34.75, elevation_m: 1550 }, climate: KE_WEST,
    system: { nSeasons: 1, buysInputs: true, fertiliser: false },
    plots: [
      { plot_name: "Napier strip", plot_area_ha: 0.25, plot_use: "crops", slope_class: "Flat (0-5%)", slope_length_m: 20, land_cover: "Dense grass", tillage: "reduced", orgmatter: "high_manure" },
      { plot_name: "Maize shamba", plot_area_ha: 0.4, plot_use: "crops", slope_class: "Hilly (5-20%)", slope_length_m: 25, land_cover: "Maize", tillage: "full", orgmatter: "medium" },
    ],
    seasons: ONE_SEASON, herds: [{ herd_name: "Zero-grazing unit", herd_pattern: "zero", herd_plots: [], manure: { stable: { handling: "piled", collected: 100, followups: { covered: true } } }, keptShare: 100 }],
    animals: [
      { livetype: 2, n: 2, milkLday: 10, lactationDays: 300, hours: [24, 0, 0, 0] },
      { livetype: 8, n: 1, growth: 90, hours: [24, 0, 0, 0] },
    ],
    feeds: [
      { item: 10, origin: "grown", part: "main", plot: "p1", fedShare: 100, manureShare: 70 },
      { item: 8, origin: "grown", part: "residue", plot: "p2", residueFate: { fed: 90, left: 10, burnt: 0 }, manureShare: 30 },
      { item: 3, origin: "bought" },
      { item: 9, origin: "collected" },
    ],
    diet: [[[50, 20, 20, 10], [55, 25, 10, 10]]],
  },
  {
    id: "sc_tz_national", name: "Tanzania national dairy herd", purpose: "baseline", paramSet: "Southern Highland Tanzania Dairy", owner: "you", project: "National inventory 2026", updated: "2026-09-20",
    location: { country: "Tanzania", region: "Njombe", district: "Njombe DC", lat: -9.33, lon: 34.77, elevation_m: 1870 }, climate: TZ_SOUTH,
    system: { scale: "national", aim: "both", buysInputs: false, fertiliser: false, nSeasons: 2 },
    plots: [
      { plot_name: "Communal and open grazing land", plot_area_ha: 1250000, plot_use: "grazing", slope_class: "Hilly (5-20%)", slope_length_m: 200, land_cover: "Degraded grass", grass_condition: "moderate", grass_inputs: "None" },
      { plot_name: "Cropland providing residues", plot_area_ha: 420000, plot_use: "crops", slope_class: "Hilly (5-20%)", slope_length_m: 100, land_cover: "Maize", tillage: "full", orgmatter: "low" },
      { plot_name: "Planted fodder", plot_area_ha: 18000, plot_use: "crops", slope_class: "Flat (0-5%)", slope_length_m: 60, land_cover: "Dense grass", tillage: "reduced", orgmatter: "medium" },
    ],
    seasons: TWO_SEASONS, herds: [{ herd_name: "Indigenous herd", herd_pattern: "mostly_grazing", herd_plots: ["p1"], manure: { stable: { handling: "piled", collected: 40, followups: {} }, pen: { handling: "drylot", collected: 30, followups: {} } }, keptShare: 40 }, { herd_name: "Improved dairy herd", herd_pattern: "night_shed", herd_plots: ["p1"], keptShare: 80 }],
    animals: [
      { livetype: 1, n: 2800000, groupName: "Indigenous cows (national)", milkLday: 1.8, lactationDays: 200, hours: [2, 2, 20, 0] },
      { livetype: 7, n: 1150000, groupName: "Indigenous calves (national)", growth: 45, hours: [2, 2, 20, 0] },
      { livetype: 2, herd: "h2", n: 780000, groupName: "Improved cows (national)", milkLday: 8, lactationDays: 290, hours: [12, 2, 10, 0] },
    ],
    feeds: [
      { item: 9, origin: "grown", part: "main", plot: "p1", fedShare: 100, manureShare: 20 },
      { item: 8, origin: "grown", part: "residue", plot: "p2", residueFate: { fed: 45, left: 45, burnt: 10 }, manureShare: 40 },
      { item: 10, origin: "grown", part: "main", plot: "p3", fedShare: 100, manureShare: 40 },
      { item: 3, origin: "bought" },
    ],
    diet: [[[75, 15, 5, 5], [80, 15, 5, 0], [40, 25, 20, 15]], [[55, 35, 5, 5], [60, 35, 5, 0], [25, 40, 20, 15]]],
  },
];

/* An enterprise is the thing that persists; an assessment is one description of it at a
   point in time, or a described alternative. `kind` separates the two: "observed" is what
   was there, "what_if" is a described change. */
const ENTERPRISE_OF = {
  sc_njombe_baseline: ["ent_njombe", 2024, "observed", "Baseline 2024"],
  sc_njombe_napier: ["ent_njombe", 2026, "what_if", "Napier & biogas (what-if)"],
  sc_rungwe_commercial: ["ent_rungwe", 2026, "observed", "Assessment 2026"],
  tpl_kenya_zero: ["ent_kenya_tpl", 2026, "observed", "Template"],
  sc_tz_national: ["ent_tz_national", 2026, "observed", "Inventory 2026"],
};
const ENTERPRISES = [
  { id: "ent_njombe", name: "Njombe smallholder dairy", place: "Njombe, Tanzania", owner: "you", project: "Njombe dairy 2026", scale: "farm" },
  { id: "ent_rungwe", name: "Rungwe commercial dairy", place: "Rungwe, Mbeya, Tanzania", owner: "you", project: "Njombe dairy 2026", scale: "farm" },
  { id: "ent_kenya_tpl", name: "Kenya zero-grazing unit", place: "Kakamega, Kenya", owner: "iCLEANED team", project: null, scale: "farm" },
  { id: "ent_tz_national", name: "Tanzania national dairy herd", place: "Tanzania", owner: "you", project: "National inventory 2026", scale: "national" },
  { id: "ent_shared_rungwe", name: "Rungwe zero-grazing (colleague's)", place: "Rungwe, Mbeya, Tanzania", owner: "Colleague A", project: "Njombe dairy 2026", scale: "farm" },
];

const scenarios = {}; const library = [];
const libRow = (spec) => {
  const e = ENTERPRISE_OF[spec.id] || [null, 2026, "observed", spec.name];
  return { id: spec.id, name: spec.name, enterprise: e[0], as_of: e[1], kind: e[2], label: e[3],
    owner: spec.owner || "you", project: spec.project ?? "Njombe dairy 2026", param_set: spec.paramSet,
    updated: spec.updated, purpose: spec.purpose, template: !!spec.template, shared: spec.shared || [],
    scale: (spec.system && spec.system.scale) || "farm", headline: spec.headline || null };
};
for (const spec of specs) { scenarios[spec.id] = build(spec); library.push(libRow(spec)); }

/* A second observed assessment of the Njombe enterprise two years on, so the timeline and
   the over-time comparison have something real behind them: the herd grew and the fodder
   plot was extended. */
{
  const base = specs.find((x) => x.id === "sc_njombe_baseline");
  const follow = JSON.parse(JSON.stringify(base));
  follow.id = "sc_njombe_2026"; follow.name = "Njombe smallholder dairy \u2014 2026";
  follow.updated = "2026-09-28";
  follow.animals[0].n = 16; follow.animals[0].milkLday = 5.5; follow.animals[1].n = 10;
  follow.plots[0].plot_area_ha = 1.2;
  scenarios[follow.id] = build(follow);
  library.push(Object.assign(libRow(follow), { enterprise: "ent_njombe", as_of: 2026, kind: "observed", label: "Assessment 2026" }));
}
// one scenario owned by a colleague, to exercise "Shared with me"
library.push({ id: "sc_shared_rungwe", name: "Rungwe zero-grazing 2025 (colleague)", enterprise: "ent_shared_rungwe", as_of: 2025, kind: "observed", label: "Assessment 2025", owner: "Colleague A", project: "Njombe dairy 2026", param_set: "Southern Highland Tanzania Dairy", updated: "2026-09-12", purpose: "baseline", shared: ["you"], scale: "farm" });
scenarios.sc_shared_rungwe = JSON.parse(JSON.stringify(scenarios.tpl_kenya_zero));
Object.assign(scenarios.sc_shared_rungwe.meta, { id: "sc_shared_rungwe", scenario_name: "Rungwe zero-grazing 2025 (colleague)", owner: "Colleague A", project: "Njombe dairy 2026", param_set: "Southern Highland Tanzania Dairy", scenario_purpose: "baseline" });

// headline numbers for the scenario cards
for (const row of library) {
  const sc = scenarios[row.id]; if (!sc) continue;
  const head = sc.animals.reduce((t, a) => t + (Number(a.herd_n) || 0), 0);
  const ha = sc.plots.reduce((t, p) => t + (Number(p.plot_area_ha) || 0), 0);
  const fmt = (n) => n >= 1000000 ? (n / 1000000).toFixed(n >= 10000000 ? 0 : 1) + "M" : n >= 1000 ? Math.round(n / 1000) + "k" : String(Math.round(n * 10) / 10);
  row.headline = `${fmt(head)} animals · ${fmt(ha)} ha · ${sc.seasons.length} season${sc.seasons.length > 1 ? "s" : ""}`;
}

writeFileSync(join(ROOT, "fixtures", "scenarios.json"), JSON.stringify({ default: "sc_njombe_baseline", scenarios, library, enterprises: ENTERPRISES, projects: [{ id: "prj1", name: "Njombe dairy 2026", members: ["you", "Colleague A", "Colleague B"] }, { id: "prj2", name: "National inventory 2026", members: ["you"] }] }, null, 1));
console.log("scenarios.json written:", Object.keys(scenarios).length, "scenarios");
for (const row of library) console.log("  ", row.id.padEnd(22), String(row.enterprise || "-").padEnd(18), String(row.as_of).padEnd(6), row.kind.padEnd(9), row.headline || "");
