/* Batch upload: a spreadsheet or JSON of many enterprises, checked (QAQC), exported, and summarised.
   The mockup does not run the model, so "results" here are input-derived and labelled as such. */
(function (ICL) {
  const { h, fmt } = ICL; const D = ICL.dict; const { screenHead } = ICL.common;

  // ---- the file contract -------------------------------------------------------
  // One sheet (or CSV) per table, joined on enterprise_id. Names, not codes: a field
  // officer's spreadsheet has "Napier grass", never feed_item_code 10.
  const SHEETS = {
    enterprises: { key: ["enterprise_id"], cols: ["enterprise_id", "name", "scale", "country", "region", "district", "lat", "lon", "climate_zone", "annual_prec_mm", "rain_months", "et0_mm", "soil", "soil_c", "soil_n", "soil_clay", "soil_bulk_g_cm3", "soil_depth_m", "purpose"], required: ["enterprise_id", "name"] },
    seasons: { key: ["enterprise_id", "season_name"], cols: ["enterprise_id", "season_name", "months"], required: ["enterprise_id", "season_name", "months"] },
    plots: { key: ["enterprise_id", "plot_name"], cols: ["enterprise_id", "plot_name", "area_ha", "use", "slope_class", "slope_length_m", "land_cover", "tillage", "orgmatter"], required: ["enterprise_id", "plot_name"] },
    herds: { key: ["enterprise_id", "herd_name"], cols: ["enterprise_id", "herd_name", "pattern", "manure_shed", "collected_shed_pct", "manure_pen", "collected_pen_pct", "kept_on_farm_pct"], required: ["enterprise_id", "herd_name"] },
    animals: { key: ["enterprise_id", "herd_name", "group"], cols: ["enterprise_id", "herd_name", "group", "group_name", "head", "body_weight_kg", "milk_l_day", "lactation_days", "growth_kg_yr", "hours_shed", "hours_pen", "hours_grazing_onfarm", "hours_grazing_offfarm"], required: ["enterprise_id", "herd_name", "group", "head"] },
    feeds: { key: ["enterprise_id", "feed"], cols: ["enterprise_id", "feed", "origin", "part", "plot_name", "yield_t_dm_ha", "main_fed_share_pct", "residue_fed_pct", "residue_left_pct", "residue_burnt_pct", "manure_to_plot_pct"], required: ["enterprise_id", "feed", "origin"] },
    diet: { key: ["enterprise_id", "season_name", "herd_name", "group", "feed"], cols: ["enterprise_id", "season_name", "herd_name", "group", "feed", "share_pct"], required: ["enterprise_id", "season_name", "group", "feed", "share_pct"] },
  };
  const PATTERNS = { zero: "zero", "zero-grazing": "zero", shed: "zero", night_shed: "night_shed", "shed at night": "night_shed", grazing: "mostly_grazing", mostly_grazing: "mostly_grazing", offfarm: "offfarm", communal: "offfarm" };
  const MANURE_WORDS = { left: "left", "left where it drops": "left", daily: "daily", "spread daily": "daily", piled: "piled", heap: "piled", heaped: "piled", "solid storage": "piled", drylot: "drylot", "dry lot": "drylot", pen: "drylot", bedding: "bedding", "deep bedding": "bedding", pit: "pit", slurry: "pit", tank: "pit", compost: "compost", composted: "compost", biogas: "biogas", digester: "biogas", burnt: "burnt", burned: "burnt" };

  // ---- tiny CSV reader (RFC 4180) ----------------------------------------------
  function parseCsv(text) {
    const rows = []; let row = [], cell = "", q = false;
    const t = text.replace(/^﻿/, "");
    for (let i = 0; i < t.length; i++) {
      const c = t[i];
      if (q) { if (c === '"') { if (t[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
      else if (c === '"') q = true;
      else if (c === ",") { row.push(cell); cell = ""; }
      else if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
      else if (c !== "\r") cell += c;
    }
    if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
    if (!rows.length) return [];
    const head = rows[0].map((x) => String(x).trim().toLowerCase().replace(/\s+/g, "_"));
    return rows.slice(1).filter((r) => r.some((x) => String(x).trim() !== "")).map((r) => {
      const o = {}; head.forEach((k, i) => (o[k] = String(r[i] ?? "").trim())); return o;
    });
  }
  const csvCell = (c) => { let v = String(c ?? ""); if (/^[=+\-@\t\r]/.test(v)) v = "'" + v; return `"${v.replace(/"/g, '""')}"`; };
  const toCsv = (rows) => rows.map((r) => r.map(csvCell).join(",")).join("\n");
  const num = (v) => { if (v == null || v === "") return null; const p = ICL.parseNumber(String(v)); return p.value == null || Number.isNaN(p.value) ? NaN : p.value; };

  // ---- name resolution ---------------------------------------------------------
  function findLivetype(name) {
    if (!name) return null; const q = String(name).trim().toLowerCase();
    const V = D.vocab(); const labels = D.tables().livetypeLabels || {};
    return V.livetype.find((l) => l.desc.toLowerCase() === q)
      || V.livetype.find((l) => ((labels[l.desc] || {}).label || "").toLowerCase() === q)
      || V.livetype.find((l) => String(l.code) === q)
      || V.livetype.find((l) => l.desc.toLowerCase().includes(q) || ((labels[l.desc] || {}).label || "").toLowerCase().includes(q))
      || null;
  }
  function findFeed(name) {
    if (!name) return null; const q = String(name).trim().toLowerCase();
    const V = D.vocab(); const syn = D.tables().feedSynonyms || {};
    return V.feeditems.find((f) => D.displayFeedName(f.feed_item_name).toLowerCase() === q)
      || V.feeditems.find((f) => String(f.feed_item_code) === q)
      || V.feeditems.find((f) => (syn[f.feed_item_code] || []).some((s) => s.toLowerCase() === q))
      || V.feeditems.find((f) => D.displayFeedName(f.feed_item_name).toLowerCase().includes(q) || (syn[f.feed_item_code] || []).some((s) => s.toLowerCase().includes(q)))
      || null;
  }
  const MONTH_LOOKUP = {}; ICL.MONTHS.forEach((m, i) => (MONTH_LOOKUP[m.toLowerCase()] = i + 1));
  function parseMonths(v) {
    if (!v) return [];
    return String(v).split(/[,;|/]+/).map((x) => x.trim()).filter(Boolean).map((x) => {
      const n = Number(x); if (Number.isFinite(n) && n >= 1 && n <= 12) return n;
      const k = x.slice(0, 3).toLowerCase(); return MONTH_LOOKUP[k] || null;
    }).filter(Boolean);
  }

  // ---- build one scenario state from the sheet rows -----------------------------
  function buildOne(id, sheets, problems) {
    const ent = (sheets.enterprises || []).find((r) => r.enterprise_id === id) || { enterprise_id: id, name: id };
    const say = (severity, where, msg) => problems.push({ id, severity, where, msg });
    const base = ICL.store.blankState ? ICL.store.blankState() : null;
    const st = {
      meta: { id: "b_" + id, scenario_name: ent.name || id, scenario_purpose: ent.purpose || "baseline", param_set: ICL.store.get().meta.param_set, owner: "you", project: "Batch upload" },
      system: { scale: ent.scale || "farm", species: ["Cattle"], aim: null, growsFeed: null, buysFeed: null, buysInputs: false, fertiliser: false, nSeasons: null, rice: false, trees: false },
      farm: {}, provenance: {}, plots: [], seasons: [], herds: [], animals: [], feeds: [], fertilizer: {}, allocation: {},
    };
    // location and climate
    const F = st.farm;
    if (ent.country || ent.region || ent.district || ent.lat || ent.lon) F.location_point = { country: ent.country || null, region: ent.region || null, district: ent.district || null, lat: num(ent.lat) || null, lon: num(ent.lon) || null };
    else say("error", "enterprises.country", "no location given; the model needs at least the country to pick the IPCC region");
    if (ent.climate_zone) F.climate_zone_2 = ent.climate_zone;
    if (ent.annual_prec_mm) { const v = num(ent.annual_prec_mm); if (Number.isNaN(v)) say("error", "enterprises.annual_prec_mm", `"${ent.annual_prec_mm}" is not a number`); else F.annual_prec = v; }
    if (ent.et0_mm) { const v = num(ent.et0_mm); if (!Number.isNaN(v)) F.et0 = v; }
    if (ent.soil) F.soil_description = ent.soil;
    if (ent.rain_months) { const m = parseMonths(ent.rain_months); if (m.length) F.rain_months = m; }
    for (const [c, k] of [["soil_c", "soil_c"], ["soil_n", "soil_n"], ["soil_clay", "soil_clay"], ["soil_bulk_g_cm3", "soil_bulk"], ["soil_depth_m", "soil_depth"]]) { const v = num(ent[c]); if (v != null && !Number.isNaN(v)) F[k] = v; }
    if (ent.country) { const reg = ICL.regionForCountry && ICL.regionForCountry(ent.country); if (!reg) say("warning", "enterprises.country", `"${ent.country}" did not match a country list; the world region falls back to a default`); }
    // seasons
    for (const r of (sheets.seasons || []).filter((r) => r.enterprise_id === id)) {
      const months = parseMonths(r.months);
      if (!months.length) say("error", "seasons.months", `season "${r.season_name}" has no months the app understands ("${r.months}")`);
      st.seasons.push({ id: "s" + (st.seasons.length + 1), season_name: r.season_name, season_months: months });
    }
    if (!st.seasons.length) { st.seasons.push({ id: "s1", season_name: "Whole year", season_months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] }); say("warning", "seasons", "no seasons given; the whole year was used as one season"); }
    st.system.nSeasons = st.seasons.length;
    // plots
    for (const r of (sheets.plots || []).filter((r) => r.enterprise_id === id)) {
      const area = num(r.area_ha);
      if (r.area_ha && Number.isNaN(area)) say("error", "plots.area_ha", `plot "${r.plot_name}" area "${r.area_ha}" is not a number`);
      st.plots.push({ id: "p" + (st.plots.length + 1), plot_name: r.plot_name, plot_area_ha: Number.isNaN(area) ? null : area, plot_use: r.use || "crops", slope_class: r.slope_class || null, slope_length_m: num(r.slope_length_m) || null, land_cover: r.land_cover || null, tillage: r.tillage || null, orgmatter: r.orgmatter || null, plot_soil: null });
    }
    st.system.growsFeed = st.plots.length > 0;
    // herds
    const herdByName = {};
    for (const r of (sheets.herds || []).filter((r) => r.enterprise_id === id)) {
      const pat = PATTERNS[String(r.pattern || "").trim().toLowerCase()] || null;
      if (r.pattern && !pat) say("warning", "herds.pattern", `herd "${r.herd_name}" pattern "${r.pattern}" not recognised; the hours from the animal rows are used`);
      const mk = (word, pct, fallback) => {
        const hv = MANURE_WORDS[String(word || "").trim().toLowerCase()];
        if (word && !hv) say("warning", "herds.manure", `herd "${r.herd_name}": manure handling "${word}" not recognised; "${fallback}" assumed`);
        const p = num(pct);
        return { handling: hv || fallback, collected: Number.isNaN(p) || p == null ? (hv === "left" ? 0 : 100) : p, followups: {} };
      };
      const kept = num(r.kept_on_farm_pct);
      const hd = { id: "h" + (Object.keys(herdByName).length + 1), herd_name: r.herd_name, herd_pattern: pat, herd_plots: [], hmanure_stable: mk(r.manure_shed, r.collected_shed_pct, "piled"), hmanure_pen: mk(r.manure_pen, r.collected_pen_pct, "drylot"), hmanure_onfarm: { handling: "left", collected: 0, followups: {} }, hmanure_offfarm: { handling: "left", collected: 0, followups: {} }, hmanure_kept_share: Number.isNaN(kept) || kept == null ? 100 : kept };
      herdByName[r.herd_name] = hd; st.herds.push(hd);
    }
    if (!st.herds.length) { const hd = { id: "h1", herd_name: "Herd", herd_pattern: null, herd_plots: [], hmanure_stable: { handling: "piled", collected: 100, followups: {} }, hmanure_pen: { handling: "drylot", collected: 80, followups: {} }, hmanure_onfarm: { handling: "left", collected: 0, followups: {} }, hmanure_offfarm: { handling: "left", collected: 0, followups: {} }, hmanure_kept_share: 100 }; herdByName["Herd"] = hd; st.herds.push(hd); }
    // animals
    const animalKey = {};
    for (const r of (sheets.animals || []).filter((r) => r.enterprise_id === id)) {
      const lt = findLivetype(r.group);
      if (!lt) { say("error", "animals.group", `"${r.group}" is not an animal group in this parameter set`); continue; }
      const hd = herdByName[r.herd_name] || st.herds[0];
      if (r.herd_name && !herdByName[r.herd_name]) say("warning", "animals.herd_name", `herd "${r.herd_name}" has no row in the herds sheet; "${hd.herd_name}" used`);
      const head = num(r.head);
      if (Number.isNaN(head) || head == null) say("error", "animals.head", `"${r.group}": head count "${r.head}" is not a number`);
      const hrs = ["hours_shed", "hours_pen", "hours_grazing_onfarm", "hours_grazing_offfarm"].map((k) => { const v = num(r[k]); return Number.isNaN(v) || v == null ? null : v; });
      const a = {
        id: "a" + (st.animals.length + 1), herd_ref: hd.id, livetype: String(lt.code), group_name: r.group_name || null,
        herd_n: Number.isNaN(head) ? null : head, body_weight: num(r.body_weight_kg) || null, adult_weight: null,
        milk_l_day: num(r.milk_l_day) || null, lactation_days: num(r.lactation_days) || null, growth_kg_yr: num(r.growth_kg_yr) || null,
        hours_stable: hrs[0], hours_pen: hrs[1], hours_onfarm: hrs[2], hours_offfarm: hrs[3],
        manure_stable: null, manure_pen: null, manure_onfarm: null, manure_offfarm: null, manure_kept_share: null,
      };
      if (hrs.every((x) => x != null)) { const t = hrs.reduce((s, x) => s + x, 0); if (Math.abs(t - 24) > 0.01) say("error", "animals.hours_*", `"${r.group}": the day adds up to ${fmt(t)} hours, not 24`); }
      if (a.milk_l_day != null) st.system.aim = st.system.aim === "meat" ? "both" : (st.system.aim || "milk");
      if (a.growth_kg_yr != null && st.system.aim === "milk") st.system.aim = "both";
      st.animals.push(a); animalKey[`${r.herd_name || hd.herd_name}||${r.group}`] = a; animalKey[r.group] = animalKey[r.group] || a;
    }
    if (!st.animals.length) say("error", "animals", "no animal rows for this enterprise");
    if (!st.system.aim) st.system.aim = "milk";
    // feeds
    const feedByName = {};
    for (const r of (sheets.feeds || []).filter((r) => r.enterprise_id === id)) {
      const fi = findFeed(r.feed);
      if (!fi) { say("error", "feeds.feed", `"${r.feed}" is not a feed in this parameter set`); continue; }
      const origin = ["grown", "bought", "collected"].includes(String(r.origin || "").toLowerCase()) ? String(r.origin).toLowerCase() : null;
      if (!origin) say("error", "feeds.origin", `"${r.feed}": origin must be grown, bought or collected (found "${r.origin}")`);
      const plot = st.plots.find((p) => p.plot_name === r.plot_name) || (origin === "grown" ? st.plots[0] : null);
      if (origin === "grown" && r.plot_name && !st.plots.find((p) => p.plot_name === r.plot_name)) say("warning", "feeds.plot_name", `"${r.feed}": plot "${r.plot_name}" has no row in the plots sheet`);
      const fd = {
        id: "f" + (st.feeds.length + 1), feed_item: String(fi.feed_item_code), feed_origin: origin || "bought",
        feed_part: (r.part || "").toLowerCase() === "residue" ? "residue" : "main",
        feed_plot: plot ? plot.id : null, yield_t_dm_ha: num(r.yield_t_dm_ha) || null,
        main_fed_share: num(r.main_fed_share_pct) || null, manure_to_plot_share: num(r.manure_to_plot_pct) || null,
      };
      if (fd.feed_part === "residue" && origin === "grown") {
        const parts = { fed: num(r.residue_fed_pct), left: num(r.residue_left_pct), burnt: num(r.residue_burnt_pct) };
        const given = Object.values(parts).filter((x) => x != null && !Number.isNaN(x));
        if (!given.length) say("error", "feeds.residue_*_pct", `"${r.feed}" is a residue, so the model needs what happens to it: residue_fed_pct, residue_left_pct and residue_burnt_pct, adding to 100`);
        else {
          const v = { fed: parts.fed || 0, left: parts.left || 0, burnt: parts.burnt || 0 };
          const tot = v.fed + v.left + v.burnt;
          if (Math.abs(tot - 100) > 0.5) say("error", "feeds.residue_*_pct", `"${r.feed}": the residue shares add up to ${fmt(tot)}%, not 100`);
          fd.residue_fate = v;
        }
      }
      if (origin === "bought") st.system.buysFeed = true;
      st.feeds.push(fd); feedByName[String(r.feed).trim().toLowerCase()] = fd;
    }
    if (!st.feeds.length) say("error", "feeds", "no feed rows for this enterprise");
    // diet
    for (const r of (sheets.diet || []).filter((r) => r.enterprise_id === id)) {
      const season = st.seasons.find((s) => s.season_name === r.season_name) || st.seasons[0];
      if (r.season_name && !st.seasons.find((s) => s.season_name === r.season_name)) say("warning", "diet.season_name", `season "${r.season_name}" has no row in the seasons sheet; "${season.season_name}" used`);
      const a = animalKey[`${r.herd_name || ""}||${r.group}`] || animalKey[r.group];
      if (!a) { say("error", "diet.group", `diet given for "${r.group}", which has no animal row`); continue; }
      const fd = feedByName[String(r.feed).trim().toLowerCase()];
      if (!fd) { say("error", "diet.feed", `diet given for feed "${r.feed}", which has no feed row`); continue; }
      const share = num(r.share_pct);
      if (Number.isNaN(share) || share == null) { say("error", "diet.share_pct", `"${r.group}" / "${r.feed}": share "${r.share_pct}" is not a number`); continue; }
      st.allocation[season.id] = st.allocation[season.id] || {};
      st.allocation[season.id][a.id] = st.allocation[season.id][a.id] || {};
      st.allocation[season.id][a.id][fd.id] = share;
    }
    return st;
  }

  /** Full state object the validator and compiler expect (they read ui/route/library too). */
  function asState(data) {
    const live = ICL.store.get();
    return Object.assign({}, live, data, { route: { screen: "batch", entity: null }, ui: Object.assign({}, live.ui, { validateAll: true }) });
  }

  function checkRows(sheets) {
    const ids = [...new Set((sheets.enterprises || []).map((r) => r.enterprise_id).concat(
      ["seasons", "plots", "herds", "animals", "feeds", "diet"].flatMap((k) => (sheets[k] || []).map((r) => r.enterprise_id))))].filter(Boolean);
    return ids.map((id) => {
      const problems = [];
      const data = buildOne(id, sheets, problems);
      const state = asState(data);
      const val = ICL.validate(state);
      const compiled = ICL.compile(state);
      const errors = problems.filter((p) => p.severity === "error").length + val.errors.length;
      const warnings = problems.filter((p) => p.severity === "warning").length + val.warnings.length;
      const head = data.animals.reduce((t, a) => t + (Number(a.herd_n) || 0), 0);
      const area = data.plots.reduce((t, p) => t + (Number(p.plot_area_ha) || 0), 0);
      const milk = (compiled.input.livestock || []).reduce((t, l) => t + (Number(l.annual_milk) || 0) * (Number(l.herd_composition) || 0), 0);
      return { id, name: data.meta.scenario_name, data, state, val, compiled, problems, errors, warnings, assumptions: val.assumptions.length, head, area, milk, status: errors ? "blocked" : warnings ? "warn" : "ready" };
    });
  }

  // ---- sample batch ------------------------------------------------------------
  /** Sheets built from the example scenarios, jittered, with three rows broken on purpose. */
  function sampleSheets() {
    const out = { enterprises: [], seasons: [], plots: [], herds: [], animals: [], feeds: [], diet: [] };
    const SRC = window.ICL_SCENARIOS.scenarios;
    const labels = D.tables().livetypeLabels || {};
    const bases = ["sc_njombe_baseline", "sc_njombe_napier", "tpl_kenya_zero", "sc_rungwe_commercial"].filter((k) => SRC[k]);
    let n = 0;
    for (const bk of bases) {
      const b = SRC[bk];
      for (let copy = 0; copy < 3; copy++) {
        n++;
        const id = `E${String(n).padStart(3, "0")}`;
        const j = 1 + (copy - 1) * 0.15; // ±15 % so the batch is not twelve identical rows
        const broken = n === 4 ? "hours" : n === 8 ? "diet" : n === 11 ? "feed" : null;
        const L = b.farm.location_point || {};
        out.enterprises.push({ enterprise_id: id, name: `${b.meta.scenario_name} — household ${copy + 1}`, scale: b.system.scale || "farm", country: L.country || "Tanzania", region: L.region || "", district: L.district || "", lat: L.lat ?? "", lon: L.lon ?? "", climate_zone: b.farm.climate_zone_2 || "", annual_prec_mm: b.farm.annual_prec || "", rain_months: (b.farm.rain_months || []).join(","), et0_mm: b.farm.et0 ?? "", soil: b.farm.soil_description || "", soil_c: b.farm.soil_c ?? "", soil_n: b.farm.soil_n ?? "", soil_clay: b.farm.soil_clay ?? "", soil_bulk_g_cm3: b.farm.soil_bulk ?? "", soil_depth_m: b.farm.soil_depth ?? "", purpose: "baseline" });
        for (const s of b.seasons) out.seasons.push({ enterprise_id: id, season_name: s.season_name, months: (s.season_months || []).join(",") });
        for (const p of b.plots) out.plots.push({ enterprise_id: id, plot_name: p.plot_name, area_ha: p.plot_area_ha ? Math.round(p.plot_area_ha * j * 100) / 100 : "", use: p.plot_use, slope_class: p.slope_class, slope_length_m: p.slope_length_m, land_cover: p.land_cover, tillage: p.tillage || "", orgmatter: p.orgmatter || "" });
        for (const hd of b.herds) out.herds.push({ enterprise_id: id, herd_name: hd.herd_name, pattern: hd.herd_pattern || "", manure_shed: (hd.hmanure_stable || {}).handling || "", collected_shed_pct: (hd.hmanure_stable || {}).collected ?? "", manure_pen: (hd.hmanure_pen || {}).handling || "", collected_pen_pct: (hd.hmanure_pen || {}).collected ?? "", kept_on_farm_pct: hd.hmanure_kept_share ?? "" });
        for (const a of b.animals) {
          const lt = D.vocab().livetype.find((l) => String(l.code) === String(a.livetype));
          const hd = b.herds.find((x) => x.id === a.herd_ref) || b.herds[0];
          const hours = [a.hours_stable, a.hours_pen, a.hours_onfarm, a.hours_offfarm];
          if (broken === "hours") hours[2] = (hours[2] || 0) + 3; // day adds up to 27
          out.animals.push({ enterprise_id: id, herd_name: hd ? hd.herd_name : "", group: (labels[lt && lt.desc] || {}).label || (lt ? lt.desc : ""), group_name: a.group_name || "", head: Math.max(1, Math.round((a.herd_n || 1) * j)), body_weight_kg: "", milk_l_day: a.milk_l_day ?? "", lactation_days: a.lactation_days ?? "", growth_kg_yr: a.growth_kg_yr ?? "", hours_shed: hours[0], hours_pen: hours[1], hours_grazing_onfarm: hours[2], hours_grazing_offfarm: hours[3] });
        }
        for (const f of b.feeds) {
          const fi = D.vocab().feeditems.find((x) => String(x.feed_item_code) === String(f.feed_item));
          const plot = b.plots.find((p) => p.id === f.feed_plot);
          const rf = f.residue_fate || {};
          out.feeds.push({ enterprise_id: id, feed: broken === "feed" && f === b.feeds[0] ? "Napier (local variety)" : D.displayFeedName(fi ? fi.feed_item_name : ""), origin: f.feed_origin, part: f.feed_part || "main", plot_name: plot ? plot.plot_name : "", yield_t_dm_ha: f.yield_t_dm_ha ?? "", main_fed_share_pct: f.main_fed_share ?? "", residue_fed_pct: rf.fed ?? "", residue_left_pct: rf.left ?? "", residue_burnt_pct: rf.burnt ?? "", manure_to_plot_pct: f.manure_to_plot_share ?? "" });
        }
        for (const [sid, byAnimal] of Object.entries(b.allocation || {})) {
          const season = b.seasons.find((s) => s.id === sid);
          for (const [aid, byFeed] of Object.entries(byAnimal)) {
            const a = b.animals.find((x) => x.id === aid); const hd = b.herds.find((x) => x.id === (a || {}).herd_ref);
            const lt = D.vocab().livetype.find((l) => String(l.code) === String((a || {}).livetype));
            for (const [fid, share] of Object.entries(byFeed)) {
              const f = b.feeds.find((x) => x.id === fid);
              const fi = D.vocab().feeditems.find((x) => String(x.feed_item_code) === String((f || {}).feed_item));
              let sh = share;
              if (broken === "diet" && f === b.feeds[0]) sh = Math.max(0, Number(share) - 15); // column no longer reaches 100
              out.diet.push({ enterprise_id: id, season_name: season ? season.season_name : "", herd_name: hd ? hd.herd_name : "", group: (labels[lt && lt.desc] || {}).label || (lt ? lt.desc : ""), feed: D.displayFeedName(fi ? fi.feed_item_name : ""), share_pct: sh });
            }
          }
        }
      }
    }
    return out;
  }

  // ---- state helpers -----------------------------------------------------------
  const setBatch = (patch) => ICL.store.set((s) => { s.batch = Object.assign({}, s.batch, patch); return s; });
  function load(sheets, source) {
    const t0 = Date.now();
    const rows = checkRows(sheets);
    setBatch({ sheets, rows, source, loadedAt: new Date().toISOString(), ms: Date.now() - t0, filter: "all", tab: "check" });
    ICL.toast(`${rows.length} enterprise${rows.length === 1 ? "" : "s"} checked in ${Date.now() - t0} ms.`);
  }

  async function readFile(file) {
    const name = (file.name || "").toLowerCase();
    if (name.endsWith(".json")) {
      const obj = JSON.parse(await file.text());
      if (obj && obj.sheets) return { sheets: obj.sheets, source: file.name };
      if (obj && Array.isArray(obj.enterprises)) return { sheets: obj, source: file.name };
      throw new Error("The JSON must be {sheets:{enterprises:[…],…}} or an object with an enterprises array.");
    }
    if (name.endsWith(".csv")) {
      const rows = parseCsv(await file.text());
      const cols = new Set(Object.keys(rows[0] || {}));
      // Score by how completely a sheet's own columns are matched, so animals.csv is not
      // mistaken for herds.csv just because both start with enterprise_id and herd_name.
      const scored = Object.entries(SHEETS).map(([k, spec]) => {
        const req = spec.required.filter((c) => cols.has(c)).length / spec.required.length;
        const known = spec.cols.filter((c) => cols.has(c)).length;
        const extra = [...cols].filter((c) => !spec.cols.includes(c)).length;
        return { k, rows, req, score: known - extra * 2 };
      }).filter((x) => x.req === 1).sort((a, b) => b.score - a.score);
      if (!scored.length) throw new Error("Could not tell which table this CSV is. Its header must match one of the template files — download them above.");
      const key = scored[0].k;
      // One CSV at a time is normal, so a CSV is merged into whatever is already loaded.
      const prev = (ICL.store.get().batch || {}).sheets || {};
      const merged = Object.assign({}, prev, { [key]: rows });
      const have = Object.keys(merged).filter((k) => (merged[k] || []).length);
      return { sheets: merged, source: `${file.name} (read as the ${key} table; loaded so far: ${have.join(", ")})` };
    }
    if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
      const XLSX = await loadXlsx();
      const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const sheets = {};
      for (const sn of wb.SheetNames) {
        const key = Object.keys(SHEETS).find((k) => k.toLowerCase() === sn.trim().toLowerCase());
        if (!key) continue;
        sheets[key] = XLSX.utils.sheet_to_json(wb.Sheets[sn], { defval: "", raw: false }).map((r) => {
          const o = {}; for (const [k, v] of Object.entries(r)) o[String(k).trim().toLowerCase().replace(/\s+/g, "_")] = String(v).trim(); return o;
        });
      }
      if (!Object.keys(sheets).length) throw new Error(`No sheet named ${Object.keys(SHEETS).join(", ")} was found in that workbook.`);
      return { sheets, source: `${file.name} (${Object.keys(sheets).join(", ")})` };
    }
    throw new Error("Upload a .xlsx workbook, a .csv table or a .json file.");
  }
  let xlsxP = null;
  function loadXlsx() {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    if (xlsxP) return xlsxP;
    xlsxP = new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
      s.onload = () => (window.XLSX ? res(window.XLSX) : rej(new Error("The spreadsheet reader did not load.")));
      s.onerror = () => rej(new Error("The spreadsheet reader could not be downloaded. Save the sheets as CSV and upload those instead."));
      document.head.append(s);
    });
    return xlsxP;
  }

  // ---- screen ------------------------------------------------------------------
  const tile = (n, l, color) => h("div", { class: "tile" }, h("b", { style: color ? `color:${color}` : "" }, String(n)), h("span", { class: "small" }, l));

  ICL.screens.batch = function (root, { state }) {
    root.append(screenHead(D.section("batch")));
    const b = state.batch || {};
    root.append(h("div", { class: "callout", dataset: { fb: "batch:what", fbLabel: "What batch mode is for", noNumber: "" } },
      h("strong", null, "One file, many enterprises. "),
      "Use this when the descriptions already exist — a household survey, a project's monitoring sheet, a district inventory — instead of typing each one into the wizard. ",
      "The file is checked the same way as a typed scenario, enterprise by enterprise, and anything the model would reject is listed with the sheet, the column and the row it came from. ",
      h("strong", null, "This mockup checks and compiles but does not run the model.")));

    // 1. template
    const tpl = h("div", { class: "card", dataset: { fb: "batch:template", fbLabel: "Template section" } },
      h("h2", null, "Get the template"),
      h("p", { class: "small" }, `One table per thing you are describing, joined on "enterprise_id": ${Object.keys(SHEETS).join(", ")}. Names, not codes — write "Napier grass" and "Cows, local breed", exactly as they appear in the parameter set. Unknown names are reported rather than guessed.`));
    const tplRow = h("div", { class: "control" });
    tplRow.append(h("button", { type: "button", class: "btn", onclick: () => ICL.download("icleaned-batch-template.json", JSON.stringify({ sheets: Object.fromEntries(Object.entries(SHEETS).map(([k, s]) => [k, [Object.fromEntries(s.cols.map((c) => [c, ""]))]])) }, null, 1), "application/json") }, "Download the JSON template"));
    for (const [k, spec] of Object.entries(SHEETS))
      tplRow.append(h("button", { type: "button", class: "btn-sm", onclick: () => ICL.download(`icleaned-batch-${k}.csv`, toCsv([spec.cols]), "text/csv") }, `${k}.csv`));
    tpl.append(tplRow, h("p", { class: "small" }, "A .xlsx workbook with one sheet per table works too; sheets must be named as above. Required columns: ",
      ...Object.entries(SHEETS).map(([k, s]) => h("span", { class: "chip", style: "margin:2px 4px 2px 0" }, `${k}: ${s.required.join(", ")}`))));
    root.append(tpl);

    // 2. upload
    const up = h("div", { class: "card", dataset: { fb: "batch:upload", fbLabel: "Upload section" } }, h("h2", null, "Upload the file"));
    const input = h("input", { type: "file", accept: ".xlsx,.xls,.csv,.json", "aria-label": "Batch file" });
    const status = h("div", { class: "msg" });
    const take = async (file) => {
      if (!file) return;
      status.className = "msg"; status.textContent = `Reading ${file.name}…`;
      try { const { sheets, source } = await readFile(file); load(sheets, source); }
      catch (e) { status.className = "msg err"; status.textContent = e && e.message ? e.message : String(e); }
    };
    input.addEventListener("change", () => take(input.files[0]));
    const drop = h("div", { class: "dropzone" }, h("strong", null, "Drop a file here"), h("span", { class: "small" }, "or choose one below · .xlsx · .csv · .json"));
    ["dragover", "dragenter"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("over"); }));
    ["dragleave", "drop"].forEach((ev) => drop.addEventListener(ev, () => drop.classList.remove("over")));
    drop.addEventListener("drop", (e) => { e.preventDefault(); take(e.dataTransfer.files[0]); });
    up.append(drop, h("div", { class: "control" }, input,
      h("button", { type: "button", class: "btn secondary", onclick: () => load(sampleSheets(), "sample batch (12 enterprises, 3 with deliberate errors)") }, "Load a sample batch instead")),
      status,
      h("p", { class: "small" }, "Nothing leaves this browser: the file is read and checked in the page. The real app would also store the batch against your project."));
    root.append(up);

    if (!b.rows || !b.rows.length) {
      root.append(h("div", { class: "empty" }, "No batch loaded yet. Upload a file or load the sample to see the checks."));
      return;
    }

    // 3 + 4. results tabs
    const tab = b.tab || "check";
    const tabs = h("div", { class: "tabs", role: "tablist" });
    for (const [k, l] of [["check", `QAQC check (${b.rows.length})`], ["viz", "Visualise the batch"], ["export", "Download"]])
      tabs.append(h("button", { type: "button", role: "tab", "aria-selected": String(tab === k), onclick: () => setBatch({ tab: k }) }, l));
    root.append(h("p", { class: "small" }, `From ${b.source} · checked ${b.ms} ms ago on ${(b.loadedAt || "").slice(0, 16).replace("T", " ")}`), tabs);
    if (tab === "check") checkTab(root, b);
    else if (tab === "viz") vizTab(root, b);
    else exportTab(root, b);
  };

  function checkTab(root, b) {
    const ready = b.rows.filter((r) => r.status === "ready").length;
    const warn = b.rows.filter((r) => r.status === "warn").length;
    const blocked = b.rows.filter((r) => r.status === "blocked").length;
    root.append(h("div", { class: "tile-row", dataset: { fb: "batch:tiles", fbLabel: "QAQC summary" } },
      tile(b.rows.length, "enterprises"),
      tile(ready, "ready to run", "var(--success)"),
      tile(warn, "run, but check", "var(--warn)"),
      tile(blocked, "blocked", blocked ? "var(--danger)" : "var(--success)"),
      tile(b.rows.reduce((t, r) => t + r.assumptions, 0), "assumed values", "var(--prov-default)")));
    const flt = b.filter || "all";
    const chips = h("div", { class: "chips" });
    for (const [k, l, n] of [["all", "All", b.rows.length], ["blocked", "Blocked", blocked], ["warn", "Check", warn], ["ready", "Ready", ready]])
      chips.append(h("button", { type: "button", class: "filterchip" + (k === "blocked" && n ? " bad" : ""), "aria-pressed": String(flt === k), onclick: () => setBatch({ filter: k }) }, l, h("span", { class: "cnt" }, String(n))));
    root.append(h("div", { class: "listfilter" }, chips));
    const shown = b.rows.filter((r) => flt === "all" || r.status === flt);
    if (!shown.length) { root.append(h("div", { class: "empty" }, "Nothing in that group.")); return; }
    const t = h("table", { class: "grid" }, h("thead", null, h("tr", null, h("th", null, "Enterprise"), h("th", null, "Animals"), h("th", null, "Land"), h("th", null, "Status"), h("th", null, "What to fix"), h("th", null, ""))));
    const tb = h("tbody");
    for (const r of shown) {
      const first = [...r.problems.filter((p) => p.severity === "error"), ...r.val.errors.map((e) => ({ where: e.label, msg: e.msg, severity: "error" })), ...r.problems.filter((p) => p.severity === "warning"), ...r.val.warnings.map((e) => ({ where: e.label, msg: e.msg, severity: "warning" }))];
      const detail = h("details", null, h("summary", null, first.length ? `${first.length} item${first.length === 1 ? "" : "s"}` : "nothing to fix"),
        h("ul", { class: "problems" }, ...first.map((p) => h("li", null, h("span", { class: "chip " + (p.severity === "error" ? "c-blank" : "") , style: p.severity === "error" ? "color:var(--danger);border-color:var(--danger)" : "color:var(--warn);border-color:var(--warn)" }, p.severity === "error" ? "fix" : "check"), " ", h("strong", null, p.where), " — ", p.msg))));
      tb.append(h("tr", null,
        h("td", null, r.name, h("div", { class: "small" }, r.id)),
        h("td", null, ICL.fmt(r.head, 0)),
        h("td", null, r.area ? ICL.fmt(r.area, r.area < 100 ? 2 : 0) + " ha" : "—"),
        h("td", null, h("span", { class: "chip", style: `color:${r.status === "blocked" ? "var(--danger)" : r.status === "warn" ? "var(--warn)" : "var(--success)"};border-color:currentColor` }, r.status === "blocked" ? `${r.errors} to fix` : r.status === "warn" ? `${r.warnings} to check` : "ready")),
        h("td", null, detail),
        h("td", null, h("button", { type: "button", class: "btn-sm", onclick: () => openInBuilder(r) }, "Open in the builder"))));
    }
    t.append(tb);
    root.append(h("div", { class: "tablewrap card", dataset: { fb: "batch:table", fbLabel: "QAQC table" } }, t));
    root.append(h("p", { class: "small" }, "Every check here is the same one the wizard runs, so a batch that passes would pass field by field. “Open in the builder” loads one enterprise into the wizard so you can see and fix it in context; the batch keeps the original."));
  }

  function openInBuilder(r) {
    ICL.store.set((s) => {
      for (const k of ["meta", "system", "farm", "provenance", "plots", "seasons", "herds", "animals", "feeds", "fertilizer", "allocation"]) s[k] = JSON.parse(JSON.stringify(r.data[k]));
      s.meta.id = "b_" + r.id;
      if (!s.library.scenarios.find((x) => x.id === s.meta.id)) s.library.scenarios.unshift({ id: s.meta.id, name: r.name, owner: "you", project: "Batch upload", param_set: s.meta.param_set, updated: new Date().toISOString().slice(0, 10), purpose: "baseline", shared: [], scale: s.system.scale || "farm", headline: `${ICL.fmt(r.head, 0)} animals · ${ICL.fmt(r.area, 1)} ha · from the batch` });
      return s;
    });
    ICL.toast(`Opened "${r.name}" from the batch.`);
    ICL.router.go("about");
  }

  function vizTab(root, b) {
    const ok = b.rows.filter((r) => r.status !== "blocked");
    root.append(h("div", { class: "callout" }, h("strong", null, "These are your inputs added up, not model results. "),
      "The mockup does not run the model. After a run this tab would show the same enterprises ranked by emissions per kilogram of milk, land per animal, and the nitrogen balance, with the distribution across the batch and the outliers called out — which is what a batch is for."));
    root.append(h("div", { class: "tile-row" },
      tile(ok.length, "enterprises included"),
      tile(ICL.fmt(ok.reduce((t, r) => t + r.head, 0), 0), "animals"),
      tile(ICL.fmt(ok.reduce((t, r) => t + r.area, 0), 0), "ha of land"),
      tile(ICL.fmt(ok.reduce((t, r) => t + r.milk, 0), 0), "kg of milk a year"),
      tile(b.rows.length - ok.length, "left out (blocked)", b.rows.length - ok.length ? "var(--danger)" : undefined)));
    const bars = (label, get, unit, digits) => {
      const vals = ok.map((r) => ({ name: r.name, v: get(r) })).filter((x) => Number.isFinite(x.v)).sort((a, b2) => b2.v - a.v);
      if (!vals.length) return null;
      const max = vals[0].v || 1;
      const card = h("div", { class: "card", dataset: { fb: "batch:dist:" + label, fbLabel: "Distribution: " + label } }, h("h3", null, label));
      for (const x of vals) card.append(h("div", { class: "distrow" },
        h("span", { class: "dl" }, x.name),
        h("span", { class: "db" }, h("span", { class: "dbf", style: `width:${Math.max(1, x.v / max * 100)}%` })),
        h("span", { class: "dv" }, ICL.fmt(x.v, digits) + " " + unit)));
      const mean = vals.reduce((t, x) => t + x.v, 0) / vals.length;
      card.append(h("p", { class: "small" }, `Median ${ICL.fmt(vals[Math.floor(vals.length / 2)].v, digits)} ${unit} · mean ${ICL.fmt(mean, digits)} ${unit} · highest ${ICL.fmt(max, digits)}, lowest ${ICL.fmt(vals[vals.length - 1].v, digits)}.`));
      return card;
    };
    root.append(bars("Animals per enterprise", (r) => r.head, "animals", 0));
    root.append(bars("Land per enterprise", (r) => r.area, "ha", 2));
    root.append(bars("Milk per animal a year", (r) => (r.head ? r.milk / r.head : NaN), "kg", 0));
    root.append(bars("Animals per hectare", (r) => (r.area ? r.head / r.area : NaN), "per ha", 2));
    root.append(h("p", { class: "small" }, "A number far from the rest is usually a unit mistake in the file — litres a day typed as litres a year, hectares as acres, a herd entered once per animal. That is the check this tab is for."));
  }

  function exportTab(root, b) {
    const report = [["enterprise_id", "name", "status", "errors", "warnings", "assumed", "animals", "area_ha", "annual_milk_kg", "severity", "where", "problem"]];
    for (const r of b.rows) {
      const list = [...r.problems, ...r.val.errors.map((e) => ({ severity: "error", where: e.label, msg: e.msg })), ...r.val.warnings.map((e) => ({ severity: "warning", where: e.label, msg: e.msg }))];
      if (!list.length) report.push([r.id, r.name, r.status, r.errors, r.warnings, r.assumptions, r.head, r.area, Math.round(r.milk), "", "", ""]);
      for (const p of list) report.push([r.id, r.name, r.status, r.errors, r.warnings, r.assumptions, r.head, r.area, Math.round(r.milk), p.severity, p.where, p.msg]);
    }
    const bundle = { exportedAt: new Date().toISOString(), appVersion: ICL.env.build.version, source: b.source, parameter_set: ICL.store.get().meta.param_set, enterprises: b.rows.map((r) => ({ enterprise_id: r.id, name: r.name, status: r.status, input: r.compiled.input, assumed: r.compiled.assumed, blocked: r.compiled.blocked, livestock_mapping: r.compiled.livestock_mapping })) };
    const readyBundle = Object.assign({}, bundle, { enterprises: bundle.enterprises.filter((e) => e.status !== "blocked") });
    root.append(h("div", { class: "card", dataset: { fb: "batch:export", fbLabel: "Download section" } },
      h("h2", null, "Download"),
      h("div", { class: "control" },
        h("button", { type: "button", class: "btn", onclick: () => ICL.download("icleaned-batch-qaqc.csv", toCsv(report), "text/csv") }, "QAQC report (CSV)"),
        h("button", { type: "button", class: "btn secondary", onclick: () => ICL.download("icleaned-batch-model-input.json", JSON.stringify(readyBundle, null, 1), "application/json") }, `Model input, ready only (${readyBundle.enterprises.length})`),
        h("button", { type: "button", class: "btn-sm", onclick: () => ICL.download("icleaned-batch-model-input-all.json", JSON.stringify(bundle, null, 1), "application/json") }, `Model input, everything (${bundle.enterprises.length})`),
        h("button", { type: "button", class: "btn-sm", onclick: () => ICL.download("icleaned-batch-as-uploaded.json", JSON.stringify({ sheets: b.sheets }, null, 1), "application/json") }, "The file as read")),
      h("p", { class: "small" }, "The QAQC report has one row per problem, with the sheet and column, so it can go straight back to whoever filled the sheet. The model input is one compiled study object per enterprise, in the shape the ", h("em", null, "cleaned"), " package reads, each with its assumed values listed."),
      h("p", { class: "small" }, "In the real app this is also where a run would be queued for the whole batch, and where the results would come back as a table you could join onto your own data.")));
  }
})(window.ICL);
