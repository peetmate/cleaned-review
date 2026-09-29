// Single-source dual build for the iCLEANED mockup.
//   node build.mjs           -> dist/artifact/{index.html,app.js,styles.css,schema.js}
//                               dist/offline/icleaned-mockup.html (everything inlined)
//   node build.mjs --watch   -> rebuild on change
import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync, watch } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const ROOT = dirname(fileURLToPath(import.meta.url));
const SRC = join(ROOT, "src");

function walk(dir) {
  const out = [];
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (p.endsWith(".js")) out.push(p);
  }
  return out;
}

function version() {
  let sha = "dev";
  try { sha = execSync("git rev-parse --short HEAD", { cwd: ROOT, stdio: ["ignore", "pipe", "ignore"] }).toString().trim(); } catch {}
  let pkg = "0.0.0";
  try { pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")).version; } catch {}
  const d = new Date();
  const p2 = (n) => String(n).padStart(2, "0");
  // minute precision: the point of the stamp is telling one build from the next
  const stamp = `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}`;
  return { semver: pkg, sha, stamp, label: `v${pkg} \u00b7 ${stamp}` };
}

// ---- dictionary validation -------------------------------------------------
function validateSchema(schema, fixture) {
  const errors = [];
  const ids = new Set();
  const fixtureKeys = new Set();
  const collect = (obj, prefix) => {
    for (const [k, v] of Object.entries(obj)) {
      const path = prefix ? `${prefix}.${k}` : k;
      fixtureKeys.add(path);
      if (Array.isArray(v) && v.length && typeof v[0] === "object") collect(v[0], `${k}[]`);
      else if (v && typeof v === "object" && !Array.isArray(v)) collect(v, path);
    }
  };
  collect(fixture, "");
  // feed_basket nested shape
  ["feed_basket[].season_name", "feed_basket[].feeds[].feed_item_code", "feed_basket[].feeds[].crop_code",
   "feed_basket[].feeds[].livestock[].livetype_code", "feed_basket[].feeds[].livestock[].allocation"].forEach((k) => fixtureKeys.add(k));
  const allowedMeta = new Set(["_meta", "scenario_purpose", "copy_from", "location_point", "region_display"]);
  for (const f of schema.fields) {
    if (!f.id) errors.push("field without id");
    if (ids.has(f.id)) errors.push(`duplicate id ${f.id}`);
    ids.add(f.id);
    for (const req of ["section", "label", "type", "na_policy"]) if (!(req in f)) errors.push(`${f.id}: missing ${req}`);
    if (!["block", "default_assumed", "not_applicable", "meta"].includes(f.na_policy)) errors.push(`${f.id}: bad na_policy ${f.na_policy}`);
    const pf = f.package_field == null ? [] : Array.isArray(f.package_field) ? f.package_field : [f.package_field];
    for (const p of pf) {
      if (p.startsWith("_")) { if (!/^_meta\.[a-z_]+$/.test(p)) errors.push(`${f.id}: package_field "${p}" must match _meta.<name>`); continue; }
      if (!fixtureKeys.has(p) && !allowedMeta.has(p)) errors.push(`${f.id}: package_field "${p}" not found in fixtures/Study_1.json`);
    }
    if (f.required_if && typeof f.required_if !== "object" && f.required_if !== "always") errors.push(`${f.id}: required_if must be "always" or a predicate object`);
    if (f.visible_if && typeof f.visible_if !== "object") errors.push(`${f.id}: visible_if must be a predicate object`);
    for (const o of f.options || []) if (o.visible_if && typeof o.visible_if !== "object") errors.push(`${f.id}: option ${o.value} visible_if must be a predicate object`);
    const TYPES = ["text", "number", "integer", "percent", "yesno", "radio", "select", "derived", "multiselect", "month_set", "triple_pct", "quantity_n", "manure", "fert_rates", "rice", "livetype", "feed", "location"];
    if (!TYPES.includes(f.type)) errors.push(`${f.id}: unknown type ${f.type}`);
  }
  // ids the JS refers to by name must exist
  for (const req of ["season_name", "season_months", "hours_stable", "hours_pen", "hours_onfarm", "hours_offfarm", "fert_n_pct", "param_set", "scenario_purpose", "milk_l_day", "lactation_days", "body_weight", "adult_weight", "growth_kg_yr", "work_h_day", "soil_description", "climate_zone_2", "annual_prec", "rain_months", "et0", "main_fed_share", "yield_t_dm_ha", "residue_yield_t_dm_ha", "intercrop_share", "manure_to_plot_share", "manure_kept_share", "slope_class", "slope_length_m", "land_cover", "tillage", "orgmatter", "grass_condition", "grass_inputs", "herd_n", "livetype", "herd_ref", "feed_item", "feed_origin", "feed_part", "feed_plot", "feed_imported", "rice_fields", "in_manure", "in_compost", "in_organic", "in_bedding"]) if (!ids.has(req)) errors.push(`required field id missing from schema: ${req}`);
  return errors;
}

function build() {
  const t0 = Date.now();
  const schema = JSON.parse(readFileSync(join(ROOT, "schema.json"), "utf8"));
  const vocab = JSON.parse(readFileSync(join(ROOT, "vocab.json"), "utf8"));
  const variants = JSON.parse(readFileSync(join(ROOT, "variants.json"), "utf8"));
  const demo = JSON.parse(readFileSync(join(ROOT, "fixtures", "demo_scenario.json"), "utf8"));
  const scenarios = JSON.parse(readFileSync(join(ROOT, "fixtures", "scenarios.json"), "utf8"));
  const fixture = JSON.parse(readFileSync(join(ROOT, "fixtures", "Study_1.json"), "utf8"));
  const errs = validateSchema(schema, fixture);
  if (errs.length) { console.error("schema.json errors:\n  " + errs.join("\n  ")); process.exitCode = 1; return; }

  const jsFiles = walk(join(SRC, "js")).sort((a, b) => relative(SRC, a).localeCompare(relative(SRC, b), "en", { numeric: true }));
  const ver = version();
  const js = jsFiles.map((f) => `/* ---- ${relative(SRC, f)} ---- */\n${readFileSync(f, "utf8")}`).join("\n\n");
  const css = readFileSync(join(SRC, "styles.css"), "utf8");
  const J = (x) => JSON.stringify(x).replace(/</g, "\\u003c");
  const dataJs = `window.ICL_SCHEMA=${J(schema)};\nwindow.ICL_VOCAB=${J(vocab)};\nwindow.ICL_VARIANTS=${J(variants)};\nwindow.ICL_DEMO=${J(demo)};\nwindow.ICL_SCENARIOS=${J(scenarios)};`;
  const html = readFileSync(join(SRC, "index.html"), "utf8");

  const buildTag = (target) => `<script>window.ICL_BUILD=${JSON.stringify({ version: ver.label, semver: ver.semver, sha: ver.sha, stamp: ver.stamp, target, built: new Date().toISOString() })};</script>`;

  // artifact target (multi-file)
  mkdirSync(join(ROOT, "dist", "artifact"), { recursive: true });
  writeFileSync(join(ROOT, "dist", "artifact", "styles.css"), css);
  writeFileSync(join(ROOT, "dist", "artifact", "schema.js"), dataJs);
  writeFileSync(join(ROOT, "dist", "artifact", "app.js"), js);
  writeFileSync(join(ROOT, "dist", "artifact", "index.html"), html
    .replace("<!-- @build -->", buildTag("artifact"))
    .replace("<!-- @css -->", `<link rel="stylesheet" href="styles.css">`)
    .replace("<!-- @data -->", `<script src="schema.js"></script>`)
    .replace("<!-- @js -->", `<script src="app.js"></script>`));

  // offline target (single file); also what we publish in v1
  mkdirSync(join(ROOT, "dist", "offline"), { recursive: true });
  const inline = "<!doctype html>\n" + html
    .replace("<!-- @build -->", buildTag("offline"))
    .replace("<!-- @css -->", `<style>\n${css}\n</style>`)
    .replace("<!-- @data -->", `<script>\n${dataJs}\n</script>`)
    .replace("<!-- @js -->", `<script>\n${js.replace(/<\/script/g, "<\\/script")}\n</script>`);
  writeFileSync(join(ROOT, "dist", "offline", "icleaned-mockup.html"), inline);
  console.log(`built ${ver.label} (${ver.sha}) in ${Date.now() - t0} ms: ${jsFiles.length} js files, offline ${(inline.length / 1024).toFixed(0)} KB, ${schema.fields.length} dictionary fields, ${Object.keys(scenarios.scenarios).length} example scenarios`);
}

build();
if (process.argv.includes("--watch")) {
  let t;
  for (const d of [SRC, join(SRC, "js"), join(SRC, "js", "80_screens"), join(SRC, "js", "90_fb"), ROOT]) {
    watch(d, { recursive: false }, () => { clearTimeout(t); t = setTimeout(() => { try { build(); } catch (e) { console.error(e.message); } }, 150); });
  }
  console.log("watching…");
}
