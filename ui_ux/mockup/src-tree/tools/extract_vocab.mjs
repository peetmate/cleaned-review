// Extracts controlled vocabularies for the mockup from the app's parameter
// database CSVs and the cleaned package's IPCC parameter JSONs.
// Usage: node tools/extract_vocab.mjs  (writes ../vocab.json)
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, "..");
const DB = "/Users/pstewarda/Documents/rprojects/icleaned_review_src/data/primary_database/Southern Highland Tanzania Dairy";
const EXT = "/Users/pstewarda/Documents/rprojects/cleaned_review_src/inst/extdata";

function csv(file) {
  let text = readFileSync(join(DB, file), "utf8").replace(/^﻿/, "");
  // rows may contain quoted fields with embedded newlines (lkp_manureman)
  const rows = [];
  let cur = [], field = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') q = false;
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ",") { cur.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      cur.push(field); field = ""; rows.push(cur); cur = [];
    } else field += c;
  }
  if (field.length || cur.length) { cur.push(field); rows.push(cur); }
  const head = rows[0].map((h) => h.trim());
  return rows.slice(1).filter((r) => r.length > 1 && r.some((x) => x.trim())).map((r) =>
    Object.fromEntries(head.map((h, i) => [h, (r[i] ?? "").trim()]))
  );
}
const num = (x) => (x === "" || x == null ? null : Number(x));

const ghg = JSON.parse(readFileSync(join(EXT, "ghg_parameters.json"), "utf8"));
const stock = JSON.parse(readFileSync(join(EXT, "stock_change_parameters.json"), "utf8"));

const uniq = (a) => [...new Set(a.map((s) => String(s).trim()))];
const t17 = ghg["Table 10.17"], t21 = ghg["Table 10.21"], t22 = ghg["Table 10.22"];
const mms17 = uniq(t17.map((r) => r.Manure_management_systems));
const mms21 = uniq(t21.map((r) => r.system));
const mms22 = uniq(t22.map((r) => r.system));

const livetype = csv("lkp_livetype.csv").map((r) => ({
  code: r.livetype_code, desc: r.livetype_desc,
  species: r.livetype_desc.split(" - ")[0],
  body_weight: num(r.body_weight), body_weight_weaning: num(r.body_weight_weaning),
  body_weight_year_one: num(r.body_weight_year_one), adult_weight: num(r.adult_weight),
  litter_size: num(r.litter_size), lactation_length: num(r.lactation_length),
  proportion_growth_piglets_milk: num(r.proportion_growth_piglets_milk), lw_gain_piglets: num(r.lw_gain_piglets),
  cp_maintenance: num(r.cp_maintenance), cp_lys_pregnancy: num(r.cp_lys_pregnancy), cp_lactmilk: num(r.cp_lactmilk),
  cp_lys_growth: num(r.cp_lys_growth), birth_interval: num(r.birth_interval),
  protein_milkcontent: num(r.protein_milkcontent), fat_milkcontent: num(r.fat_milkcontent),
  energy_milkcontent: num(r.energy_milkcontent), energy_meatcontent: num(r.energy_meatcontent),
  protein_meatcontent: num(r.protein_meatcontent), carcass_fraction: num(r.carcass_fraction),
  n_manure_content: num(r.n_manure_content), meat_product: r.meat_product, milk_product: r.milk_product,
  ipcc_ef_category_t1: r.ipcc_meth_ef_t1, ipcc_ef_category_t2: r.ipcc_meth_ef_t2,
  ipcc_meth_man_category: r.ipcc_meth_man, ipcc_n_exc_category: r.ipcc_meth_exc,
}));

const crops = csv("lkp_crops.csv").map((r) => ({
  crop_code: r.crop_code, crop_name: r.crop_name, dry_yield: num(r.dry_yield),
  residue_dry_yield: num(r.residue_dry_yield), main_n: num(r.main_n), residue_n: num(r.residue_n),
  c_factor: num(r.c_factor), kc_initial: num(r.kc_initial), kc_midseason: num(r.kc_midseason), kc_late: num(r.kc_late),
  category: r.category,
  trees_ha_dbh25: num(r.trees_ha_dbh25), average_dbh25: num(r.average_dbh25), increase_dbh25: num(r.increase_dbh25),
  trees_ha_dbh2550: num(r.trees_ha_dbh2550), average_dbh2550: num(r.average_dbh2550), increase_dbh2550: num(r.increase_dbh2550),
  trees_ha_dbh50: num(r.trees_ha_dbh50), average_dbh50: num(r.average_dbh50), increase_dbh50: num(r.increase_dbh50),
  time_horizon: num(r.time_horizon),
}));

const feeditems = csv("lkp_feeditem.csv").map((r) => ({
  feed_item_code: r.feed_item_code, crop_code: r.crop_code, feed_item_name: r.feed_item_name,
  dm_content: num(r.dm_content), me_content: num(r.me_content), cp_content: num(r.cp_content),
}));

const vocab = {
  _source: { db: "Southern Highland Tanzania Dairy", extdata: "cleaned v0.7.0 inst/extdata", generated: new Date().toISOString().slice(0, 10) },
  region: uniq(ghg["Table 10.16"].map((r) => r.Region)),
  climate: uniq(t17.map((r) => r.climate)),
  manure_systems: { all_three: mms17.filter((m) => mms21.includes(m) && mms22.includes(m)), t17: mms17, t21: mms21, t22: mms22 },
  fertilizer_names: csv("lkp_orgfertilizer.csv").map((r) => r.fertilizer_desc),
  fertilizer_default_n_pct: { Urea: 46, DAP: 18, NPK: null, "Ammonium nitrate": 34, "Ammonium sulfate": 21, "N solutions": 30, Ammonia: 82 },
  soil: csv("lkp_soil.csv").map((r) => ({ desc: r.soil_desc, k: num(r.k_value) })),
  slope: csv("lkp_slope.csv").filter((r) => r.slope_code !== "5").map((r) => ({ code: r.slope_code, desc: r.slope_desc, p: num(r.p_factor) })),
  landcover: csv("lkp_landcover.csv").map((r) => ({ code: r.landcover_code, desc: r.landcover_desc, c: num(r.c_factor) })),
  stock_change: {
    cropland_system: Object.keys(stock.cropland[0].landuse[0].factor_variables[0]),
    cropland_tillage: Object.keys(stock.cropland[0].tillage[0].factor_variables[0]),
    cropland_orgmatter: Object.keys(stock.cropland[0].input[0].factor_variables[0]),
    grassland_management: Object.keys(stock.grassland[0].management[0].factor_variables[0]),
    grassland_implevel: Object.keys(stock.grassland[0].input[0].factor_variables[0]),
  },
  livetype, crops, feeditems,
  // Fixed model constants (read-only in the app), pulled from the package JSON so numbers are real
  constants: {
    ym_table_10_12: (ghg["Table 10.12"] || []).slice(0, 8).map((r) => ({ category: r["Livestock category"], description: r.Description, ym_pct: r.Ym })),
    mcf_table_10_17: ["Solid storage", "Dry lot", "Daily spread", "Pasture/Range/Paddock", "Liquid/Slurry Pit below animals 3 Month", "Uncovered anaerobic lagoon", "Composting - Unfrequent turning", "Anaer digester, Low leak, HQ stor, LQ tec"].map((sys) => ({ system: sys, by_climate: Object.fromEntries(t17.filter((r) => r.Manure_management_systems === sys).map((r) => [r.climate, r.MCFs])) })),
    ef3_table_10_21: t21.filter((r) => ["Solid storage", "Dry lot", "Daily spread", "Pasture/Range/Paddock", "Uncovered anaerobic lagoon", "Composting - Unfrequent turning"].includes(r.system)).map((r) => ({ system: r.system, ef3: r.direct_nitrous_oxide_factor })),
    bo_table_10_16: (ghg["Table 10.16"] || []).filter((r) => ["AFRICA", "ASIA", "LATIN AMERICA"].includes(r.Region)).map((r) => ({ region: r.Region, category: r.Category_of_animal, system: String(r.Productivity_systems).replace(/\s+/g, " "), bo_m3_per_kg_vs: r["Default_values_for_maximum_methane_producing_capacity_(Bo)_(M3_CH4Kg-1_VS)"] })),
    other: [
      { name: "Milk density", value: "1.03 kg per litre", source: "used to convert litres/day to kg/year" },
      { name: "Days in the year", value: "365 (non-leap month lengths)", source: "season lengths" },
      { name: "Manure CH4 conversion", value: "0.67 kg/m3", source: "IPCC 2019 eq. 10.23" },
      { name: "Enteric CH4 energy", value: "55.65 MJ/kg CH4", source: "IPCC 2019 eq. 10.21" },
    ],
  },
};
// sanity: DB stock labels must all exist in the package JSON
for (const [k, file] of [["cropland_system", "lkp_croplandsystem.csv"], ["cropland_tillage", "lkp_tillageregime.csv"], ["cropland_orgmatter", "lkp_organicmatter.csv"], ["grassland_management", "lkp_grasslandman.csv"], ["grassland_implevel", "lkp_grassinputlevel.csv"]]) {
  const col = Object.keys(csv(file)[0]).find((c) => c.endsWith("_desc"));
  for (const r of csv(file)) if (!vocab.stock_change[k].includes(r[col])) console.warn(`WARN ${k}: DB label not in package JSON: "${r[col]}"`);
}
writeFileSync(join(ROOT, "vocab.json"), JSON.stringify(vocab, null, 1));
console.log("vocab.json written:", Object.fromEntries(Object.entries(vocab).map(([k, v]) => [k, Array.isArray(v) ? v.length : typeof v])));
