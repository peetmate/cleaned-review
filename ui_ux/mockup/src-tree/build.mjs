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
  const d = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `${sha}-${d}`;
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
      if (p.startsWith("_")) continue;
      if (!fixtureKeys.has(p) && !allowedMeta.has(p)) errors.push(`${f.id}: package_field "${p}" not found in fixtures/Study_1.json`);
    }
    if (f.required_if && typeof f.required_if !== "object" && f.required_if !== "always") errors.push(`${f.id}: required_if must be "always" or a predicate object`);
    if (f.visible_if && typeof f.visible_if !== "object") errors.push(`${f.id}: visible_if must be a predicate object`);
  }
  return errors;
}

function build() {
  const t0 = Date.now();
  const schema = JSON.parse(readFileSync(join(ROOT, "schema.json"), "utf8"));
  const vocab = JSON.parse(readFileSync(join(ROOT, "vocab.json"), "utf8"));
  const variants = JSON.parse(readFileSync(join(ROOT, "variants.json"), "utf8"));
  const demo = JSON.parse(readFileSync(join(ROOT, "fixtures", "demo_scenario.json"), "utf8"));
  const fixture = JSON.parse(readFileSync(join(ROOT, "fixtures", "Study_1.json"), "utf8"));
  const errs = validateSchema(schema, fixture);
  if (errs.length) { console.error("schema.json errors:\n  " + errs.join("\n  ")); process.exitCode = 1; return; }

  const jsFiles = walk(join(SRC, "js")).sort((a, b) => relative(SRC, a).localeCompare(relative(SRC, b), "en", { numeric: true }));
  const ver = version();
  const js = jsFiles.map((f) => `/* ---- ${relative(SRC, f)} ---- */\n${readFileSync(f, "utf8")}`).join("\n\n");
  const css = readFileSync(join(SRC, "styles.css"), "utf8");
  const dataJs = `window.ICL_SCHEMA=${JSON.stringify(schema)};\nwindow.ICL_VOCAB=${JSON.stringify(vocab)};\nwindow.ICL_VARIANTS=${JSON.stringify(variants)};\nwindow.ICL_DEMO=${JSON.stringify(demo)};`;
  const html = readFileSync(join(SRC, "index.html"), "utf8");

  const buildTag = (target) => `<script>window.ICL_BUILD=${JSON.stringify({ version: ver, target, built: new Date().toISOString() })};</script>`;

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
  const inline = html
    .replace("<!-- @build -->", buildTag("offline"))
    .replace("<!-- @css -->", `<style>\n${css}\n</style>`)
    .replace("<!-- @data -->", `<script>\n${dataJs}\n</script>`)
    .replace("<!-- @js -->", `<script>\n${js.replace(/<\/script/g, "<\\/script")}\n</script>`);
  writeFileSync(join(ROOT, "dist", "offline", "icleaned-mockup.html"), inline);
  console.log(`built ${ver} in ${Date.now() - t0} ms: ${jsFiles.length} js files, offline ${(inline.length / 1024).toFixed(0)} KB, ${schema.fields.length} dictionary fields`);
}

build();
if (process.argv.includes("--watch")) {
  let t;
  for (const d of [SRC, join(SRC, "js"), join(SRC, "js", "80_screens"), join(SRC, "js", "90_fb"), ROOT]) {
    watch(d, { recursive: false }, () => { clearTimeout(t); t = setTimeout(() => { try { build(); } catch (e) { console.error(e.message); } }, 150); });
  }
  console.log("watching…");
}
