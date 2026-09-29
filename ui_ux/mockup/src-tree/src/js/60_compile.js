/* Compile mockup answers → cleaned package input JSON, with provenance per path. */
(function (ICL) {
  const D = ICL.dict, C = ICL.cond;
  const r4 = (x) => Math.round(x * 10000) / 10000;

  function compile(state) {
    const prov = {}; // json path → user|default|db|derived|blocked
    const assumed = [], blocked = [];
    const T = D.tables(), V = D.vocab(), S = window.ICL_SCHEMA;
    const set = (obj, key, val, p, path) => { obj[key] = val; prov[path || key] = p; };
    const eff = (fieldId, entity, prefix) => D.effective(D.field(fieldId), entity, state, prefix);
    const farm = state.farm;
    const out = {};

    // --- scalars ---------------------------------------------------------
    set(out, "database_code", state.meta.param_set || null, state.meta.param_set ? "user" : "blocked");
    set(out, "farm_name", state.meta.scenario_name || "", "user");
    const loc = farm.location_point || {};
    const region = regionForCountry(loc.country);
    set(out, "region", region, region ? "derived" : "blocked");
    const cz = eff("climate_zone_2", farm, "farm"); set(out, "climate_zone_2", cz.value, cz.prov);
    set(out, "climate_zone", cz.value ? (/^Tropical/.test(cz.value) ? "Warm" : /^Warm/.test(cz.value) ? "Temperate" : "Cool") : null, "derived");
    for (const [fid, key] of [["annual_prec", "annual_prec"], ["et0", "et"], ["soil_c", "soil_c"], ["soil_n", "soil_n"], ["soil_clay", "soil_clay"], ["soil_bulk", "soil_bulk"], ["soil_depth", "soil_depth"]]) {
      const e = eff(fid, farm, "farm"); set(out, key, e.value == null ? null : Number(e.value), e.value == null ? "blocked" : e.prov);
    }
    const rm = eff("rain_months", farm, "farm"); set(out, "rain_length", Array.isArray(rm.value) ? rm.value.length : rm.value == null ? null : Number(rm.value), rm.value == null ? "blocked" : rm.prov);
    const soil = eff("soil_description", farm, "farm");
    set(out, "soil_description", soil.value, soil.prov);
    const soilRow = V.soil.find((s) => s.desc === soil.value);
    set(out, "soil_k_value", soilRow ? soilRow.k : soil.value === "Acrisol" ? 0.25 : null, soilRow ? "derived" : "blocked");

    // land-use labels from plots + climate bucket
    const bucket = T.climateBucket[cz.value] || "trop_moist";
    const cropPlot = ICL.largestPlot(state, "crops"), grazePlot = ICL.largestPlot(state, "grazing");
    const isRicePlot = state.system.rice && state.feeds.some((f) => D.decorate(f, "feed", state)._isRice && f.feed_plot === (cropPlot && cropPlot.id));
    set(out, "cropland_system", isRicePlot ? "Paddy rice" : T.cropland_system[bucket], "derived");
    const till = cropPlot ? eff("tillage", cropPlot, `plots[${cropPlot.id}]`) : { value: "full", prov: "default" };
    set(out, "cropland_tillage", T.tillage[till.value || "full"][bucket], till.prov === "user" ? "derived" : "default");
    const om = cropPlot ? eff("orgmatter", cropPlot, `plots[${cropPlot.id}]`) : { value: "medium", prov: "default" };
    set(out, "cropland_orgmatter", T.orgmatter[om.value || "medium"][bucket], om.prov === "user" ? "derived" : "default");
    const gc = grazePlot && grazePlot.plot_use !== "crops" ? eff("grass_condition", grazePlot, `plots[${grazePlot.id}]`) : { value: "nominal", prov: "default" };
    set(out, "grassland_management", T.grass[gc.value || "nominal"][bucket], gc.prov === "user" ? "derived" : "default");
    const gi = grazePlot && grazePlot.plot_use !== "crops" ? eff("grass_inputs", grazePlot, `plots[${grazePlot.id}]`) : { value: "None", prov: "default" };
    set(out, "grassland_implevel", gi.value || "None", gi.prov);
    for (const k of ["cropland_system", "cropland_tillage", "cropland_orgmatter", "grassland_management", "grassland_implevel"]) {
      if (!V.stock_change[k].includes(out[k])) { blocked.push({ path: k, msg: `Internal: land-use label "${out[k]}" not recognised by the model.` }); prov[k] = "blocked"; }
    }
    // factors (unused by package but present in file format)
    set(out, "cropland_system_ipcc", null, "derived"); set(out, "cropland_tillage_ipcc", null, "derived"); set(out, "cropland_orgmatter_ipcc", null, "derived"); set(out, "grassland_management_ipcc", null, "derived"); set(out, "grassland_implevel_ipcc", null, "derived");
    set(out, "grassland_toarable", 0, "derived"); set(out, "arable_tograssland", 0, "derived");

    // purchased inputs (quantity + unit + N%)
    for (const [fid, key] of [["in_manure", "purchased_manure"], ["in_compost", "purchased_compost"], ["in_organic", "purchased_organic_n"], ["in_bedding", "purchased_bedding"]]) {
      const f = D.field(fid); const q = farm[fid];
      if (!state.system.buysInputs || !q || q.qty == null || q.qty === "") { set(out, key, 0, "derived"); continue; }
      const factor = f.units[q.unit] || 1; const npct = q.n_pct != null && q.n_pct !== "" ? Number(q.n_pct) : f.n_pct_default;
      set(out, key, r4(Number(q.qty) * factor * npct / 100), "derived");
    }
    for (const f of D.fieldsFor("losses")) { const e = eff(f.id, farm, "farm"); set(out, f.id, e.value == null ? 0 : Number(e.value), e.value == null ? "default" : e.prov); }

    // --- seasons ----------------------------------------------------------
    out.seasons = state.seasons.map((s) => ({ season_name: s.season_name || "Season", season_length: (s.season_months || []).reduce((d, m) => d + ICL.MONTH_DAYS[m - 1], 0) }));
    state.seasons.forEach((s, i) => { prov[`seasons[${i}].season_name`] = "user"; prov[`seasons[${i}].season_length`] = "derived"; });

    // --- livestock: one row per livetype, merged by head count ------------
    const mapping = [];
    const groups = {};
    for (const raw of state.animals) { const a = D.decorate(raw, "animal", state); (groups[a.livetype] = groups[a.livetype] || []).push(a); }
    out.livestock = [];
    Object.values(groups).forEach((list, idx) => {
      const lt = D.livetypeOf(list[0].livetype); if (!lt) return;
      const heads = list.map((a) => Number(a.herd_n) || 0); const N = heads.reduce((s, x) => s + x, 0) || 1;
      const w = (fn) => list.reduce((s, a, i) => s + fn(a) * heads[i], 0) / N; // head-weighted mean
      const merged = list.length > 1;
      const P = (p) => (merged ? "derived" : p);
      const row = {}; const pf = (k, v, p) => set(row, k, v, p, `livestock[${idx}].${k}`);
      pf("livetype_code", lt.code, "db"); pf("livetype_desc", lt.desc, "db");
      pf("herd_composition", N, "user");
      const bw = list.map((a) => eff("body_weight", a, `animals[${a.id}]`)); pf("body_weight", r4(w((a, i) => Number(bw[list.indexOf(a)].value) || lt.body_weight)), P(bw[0].prov));
      const young = list[0]._young;
      if (young) { const aw = list.map((a) => eff("adult_weight", a, `animals[${a.id}]`)); pf("adult_weight", r4(w((a) => Number(aw[list.indexOf(a)].value) || 0)), P(aw[0].prov)); }
      else pf("adult_weight", row.body_weight, "derived");
      pf("body_weight_weaning", lt.body_weight_weaning || 0, "db"); pf("body_weight_year_one", lt.body_weight_year_one || 0, "db");
      // milk
      if (list[0]._milking && ["milk", "both"].includes(state.system.aim)) {
        const milk = list.map((a) => { const l = eff("milk_l_day", a, `animals[${a.id}]`), d = eff("lactation_days", a, `animals[${a.id}]`); return l.value == null ? null : Number(l.value) * Number(d.value || 270) * 1.03; });
        if (milk.some((m) => m == null)) { pf("annual_milk", null, "blocked"); } else pf("annual_milk", r4(w((a) => milk[list.indexOf(a)])), "derived");
      } else pf("annual_milk", 0, "derived");
      const growthVisible = young || ["meat", "both"].includes(state.system.aim);
      if (growthVisible) { const g = list.map((a) => eff("growth_kg_yr", a, `animals[${a.id}]`)); pf("annual_growth", g.some((x) => x.value == null) && young ? null : r4(w((a) => Number(g[list.indexOf(a)].value) || 0)), g.some((x) => x.value == null) && young ? "blocked" : P(g[0].prov)); }
      else pf("annual_growth", 0, "derived");
      pf("annual_wool", 0, "derived");
      const wh = list.map((a) => eff("work_h_day", a, `animals[${a.id}]`)); pf("work_hour", state.system.aim === "draught" ? r4(w((a) => Number(wh[list.indexOf(a)].value) || 0)) : 0, "derived");
      // time budget hours → fractions summing to 1
      const keys = [["hours_stable", "time_in_stable"], ["hours_pen", "time_in_non_roofed_enclosure"], ["hours_onfarm", "time_in_onfarm_grazing"], ["hours_offfarm", "time_in_offfarm_grazing"]];
      const hrs = keys.map(([hk]) => w((a) => Number(a[hk]) || 0));
      const tot = hrs.reduce((s, x) => s + x, 0) || 24;
      let fr = hrs.map((x) => r4(x / tot)); const diff = r4(1 - fr.reduce((s, x) => s + x, 0)); if (diff) { const i = fr.indexOf(Math.max(...fr)); fr[i] = r4(fr[i] + diff); }
      keys.forEach(([hk, pk], i) => { const p = list.some((a) => state.provenance[`animals[${a.id}].${hk}`] === "user" || (a[hk] != null && state.provenance[`animals[${a.id}].${hk}`] !== "default")) ? "derived" : "default"; pf(pk, fr[i], p); });
      // manure per place
      const places = [["manure_stable", "hours_stable", "manureman_stable", "manure_in_stable"], ["manure_pen", "hours_pen", "manureman_non_roofed_enclosure", "manure_in_non_roofed_enclosure"], ["manure_onfarm", "hours_onfarm", "manureman_onfarm_grazing", "manure_in_field"], ["manure_offfarm", "hours_offfarm", "manureman_offfarm_grazing", null]];
      for (const [fid, hk, mmKey, collKey] of places) {
        const f = D.field(fid);
        const active = list.filter((a) => Number(a[hk]) > 0);
        if (!active.length) { pf(mmKey, "Pasture/Range/Paddock", "derived"); if (collKey) pf(collKey, 0, "derived"); continue; }
        // dominant handling by head; collected weighted
        const vals = active.map((a) => { const e = eff(fid, a, `animals[${a.id}]`); return { v: e.value || f.default, prov: e.prov, n: Number(a.herd_n) || 0 }; });
        const dom = vals.slice().sort((x, y) => y.n - x.n)[0];
        pf(mmKey, ipccManure(dom.v), dom.prov === "user" ? "derived" : "default");
        if (collKey) pf(collKey, r4(vals.reduce((s, x) => s + (Number(x.v.collected) || 0) / 100 * x.n, 0) / (vals.reduce((s, x) => s + x.n, 0) || 1)), dom.prov === "user" ? "derived" : "default");
      }
      const kept = list.map((a) => eff("manure_kept_share", a, `animals[${a.id}]`)); const keptV = w((a) => Number(kept[list.indexOf(a)].value) || 0) / 100;
      pf("manure_onfarm_fraction", r4(keptV), P(kept[0].prov)); pf("manure_sales_fraction", r4(1 - keptV), "derived");
      pf("distance_to_pasture", 0, "derived");
      for (const k of ["litter_size", "lactation_length", "proportion_growth_piglets_milk", "lw_gain_piglets", "meat_product", "milk_product", "ipcc_ef_category_t1", "ipcc_ef_category_t2", "ipcc_meth_man_category", "ipcc_n_exc_category"]) pf(k, lt[k] ?? 0, "db");
      for (const k of ["cp_maintenance", "cp_lys_pregnancy", "cp_lactmilk", "cp_lys_growth", "birth_interval", "protein_milkcontent", "fat_milkcontent", "energy_milkcontent", "energy_meatcontent", "protein_meatcontent", "carcass_fraction", "n_manure_content"]) {
        const vals = list.map((a) => eff(k, a, `animals[${a.id}]`)); const anyUser = vals.some((v) => v.prov === "user");
        pf(k, r4(w((a) => Number(vals[list.indexOf(a)].value) ?? lt[k] ?? 0)), anyUser ? (merged ? "derived" : "user") : "db");
      }
      const names = list.map((a) => (a.group_name || "").trim()).filter(Boolean);
      if (names.length) for (const n of names) mapping.push({ user_name: n, canonical_name: lt.desc });
      pf("piglets_relying_on_milk", 0, "db");
      out.livestock.push(row);
    });

    // --- feed items -------------------------------------------------------
    out.feed_items = [];
    state.feeds.forEach((raw, idx) => {
      const fe = D.decorate(raw, "feed", state); const fi = fe._feedItem, crop = fe._crop; if (!fi) return;
      const row = {}; const pf = (k, v, p) => set(row, k, v, p, `feed_items[${idx}].${k}`);
      const base = D.displayFeedName(fi.feed_item_name);
      let tag = "";
      if (fe.feed_origin === "collected") tag = " OFR";
      else if (fe.feed_origin === "bought") tag = fe._isConcentrate ? (fe.feed_imported ? " IP" : " OFC") : " OFR";
      pf("feed_item_code", fi.feed_item_code, "db"); pf("crop_code", fi.crop_code, "db");
      pf("feed_item_name", base + tag, tag ? "derived" : "db"); pf("crop_name", crop ? crop.crop_name : base, "db");
      const grown = fe.feed_origin === "grown";
      pf("source_type", grown ? (fe.feed_part === "residue" ? "Residue" : "Main") : "Purchased", grown ? "derived" : "derived");
      const plot = grown ? state.plots.find((p) => p.id === fe.feed_plot) : null;
      // land / erosion from plot
      const sl = plot ? eff("slope_class", plot, `plots[${plot.id}]`) : { value: "Flat (0-5%)", prov: "derived" };
      const slRow = V.slope.find((s) => s.desc === sl.value) || V.slope[0];
      pf("slope_desc", slRow.desc, plot ? sl.prov : "derived"); pf("slope", slRow.code, "derived"); pf("slope_p_factor", slRow.p, "derived");
      const sln = plot ? eff("slope_length_m", plot, `plots[${plot.id}]`) : { value: 1, prov: "derived" }; pf("slope_length", Number(sln.value) || 1, plot ? sln.prov : "derived");
      const lc = plot ? eff("land_cover", plot, `plots[${plot.id}]`) : { value: crop ? (T.landCoverByCrop[crop.crop_name] || T.landCoverByCategory[crop.category] || "Cereals") : "Cereals", prov: "derived" };
      const lcRow = V.landcover.find((l) => l.desc === lc.value) || V.landcover.find((l) => l.desc === "Cereals");
      pf("land_cover_desc", lcRow.desc, plot ? lc.prov : "derived"); pf("land_cover", lcRow.code, "derived"); pf("landcover_c_factor", lcRow.c, "derived");
      pf("grassman_desc", out.grassland_management, "derived"); pf("grassman", null, "derived"); pf("grassman_change_factor", null, "derived");
      // yields & removal
      if (grown) {
        const y = eff("yield_t_dm_ha", fe, `feeds[${fe.id}]`); pf("dry_yield", y.value == null ? null : Number(y.value), y.value == null ? "blocked" : y.prov);
        const ry = eff("residue_yield_t_dm_ha", fe, `feeds[${fe.id}]`); pf("residue_dry_yield", ry.value == null ? (crop ? crop.residue_dry_yield : 0) : Number(ry.value), ry.value == null ? "db" : ry.prov);
        if (fe.feed_part === "main") {
          const ms = eff("main_fed_share", fe, `feeds[${fe.id}]`); pf("main_product_removal", ms.value == null ? null : r4(Number(ms.value) / 100), ms.value == null || Number(ms.value) <= 0 ? "blocked" : ms.prov);
          pf("residue_removal", 0, "derived"); pf("residue_burnt", 0, "derived");
        } else {
          const rf = fe.residue_fate || {}; const ok = rf.fed != null;
          pf("main_product_removal", 0, "derived");
          pf("residue_removal", ok ? r4(Number(rf.fed) / 100) : null, ok ? "user" : "blocked"); pf("residue_burnt", ok ? r4(Number(rf.burnt || 0) / 100) : 0, ok ? "user" : "derived");
        }
        const ic = eff("intercrop_share", fe, `feeds[${fe.id}]`); const icv = Number(ic.value) || 100;
        pf("intercrop", icv < 100 ? 1 : 0, "derived"); pf("intercrop_fraction", icv < 100 ? r4(icv / 100) : 0, "derived");
        const mp = eff("manure_to_plot_share", fe, `feeds[${fe.id}]`); pf("fraction_as_fertilizer", r4((Number(mp.value) || 0) / 100), mp.prov);
        const area = plot ? Number(plot.plot_area_ha) || 1 : 1;
        for (const [name, key] of [["Urea", "urea"], ["NPK", "npk"], ["DAP", "dap"], ["Ammonium nitrate", "ammonium_nitrate"], ["Ammonium sulfate", "ammonium_sulfate"], ["N solutions", "n_solutions"], ["Ammonia", "ammonia"]]) {
          const fr = (fe.fert_rates || {})[name];
          if (!state.system.fertiliser || !fr || fr.value == null || fr.value === "") { pf(key, 0, "derived"); continue; }
          const v = Number(fr.value); const rate = fr.mode === "kg_plot" ? v / area : fr.mode === "bags_plot" ? v * 50 / area : v;
          pf(key, r4(rate), "derived");
        }
      } else {
        pf("dry_yield", crop ? crop.dry_yield : 0, "db"); pf("residue_dry_yield", crop ? crop.residue_dry_yield : 0, "db");
        pf("main_product_removal", 1, "derived"); pf("residue_removal", 0, "derived"); pf("residue_burnt", 0, "derived");
        pf("intercrop", 0, "derived"); pf("intercrop_fraction", 0, "derived"); pf("fraction_as_fertilizer", 0, "derived");
        for (const key of ["urea", "npk", "dap", "ammonium_nitrate", "ammonium_sulfate", "n_solutions", "ammonia"]) pf(key, 0, "derived");
      }
      pf("cut_carry_fraction", 0, "derived");
      for (const k of ["dm_content", "me_content", "cp_content", "main_n", "residue_n"]) { const e = eff(k, fe, `feeds[${fe.id}]`); pf(k, e.value == null ? (fi[k] ?? (crop ? crop[k] : 0) ?? 0) : Number(e.value), e.prov === "user" ? "user" : "db"); }
      for (const k of ["kc_initial", "kc_midseason", "kc_late", "category", "trees_ha_dbh25", "average_dbh25", "increase_dbh25", "trees_ha_dbh2550", "average_dbh2550", "increase_dbh2550", "trees_ha_dbh50", "average_dbh50", "increase_dbh50", "time_horizon"]) pf(k, crop ? crop[k] ?? 0 : 0, "db");
      for (const k of ["trees_ha", "trees_dhb", "trees_growth", "trees_removal", "diameter_breast"]) pf(k, 0, "db");
      const rice = fe._isRice && state.system.rice ? fe.rice_fields || {} : {};
      pf("water_regime", rice.water_regime || "", fe._isRice ? (rice.water_regime ? "user" : "blocked") : "derived");
      pf("ecosystem_type", rice.ecosystem_type || "", fe._isRice ? (rice.ecosystem_type ? "user" : "blocked") : "derived");
      pf("organic_amendment", rice.organic_amendment || "", fe._isRice ? (rice.organic_amendment ? "user" : "blocked") : "derived");
      pf("cultivation_period", rice.cultivation_period != null ? Number(rice.cultivation_period) : 0, fe._isRice ? (rice.cultivation_period != null ? "user" : "blocked") : "derived");
      pf("fraction_as_manure", null, "derived"); pf("n_fertilizer", null, "derived");
      out.feed_items.push(row);
    });

    // --- fertilizer products used anywhere --------------------------------
    out.fertilizer = [];
    const used = new Set(); for (const f of state.feeds) for (const [name, fr] of Object.entries(f.fert_rates || {})) if (fr && Number(fr.value) > 0) used.add(name);
    const fertCodes = { Urea: "1", NPK: "2", DAP: "3", "Ammonium nitrate": "4", "Ammonium sulfate": "5", "N solutions": "6", Ammonia: "7" };
    [...used].forEach((name, i) => {
      const pct = state.fertilizer[name] != null && state.fertilizer[name] !== "" ? Number(state.fertilizer[name]) : V.fertilizer_default_n_pct[name];
      const row = {}; const pf = (k, v, p) => set(row, k, v, p, `fertilizer[${i}].${k}`);
      pf("fertilizer_code", fertCodes[name] || null, "db"); pf("fertilizer_desc", name, "user");
      pf("percentage_n", pct ?? null, pct == null ? "blocked" : state.fertilizer[name] != null && state.fertilizer[name] !== "" ? "user" : "default");
      pf("fraction", pct == null ? null : r4(pct / 100), pct == null ? "blocked" : "derived");
      out.fertilizer.push(row);
    });

    // --- dense feed basket, merged by livetype -----------------------------
    out.feed_basket = state.seasons.map((s, si) => ({
      season_name: s.season_name || "Season",
      feeds: state.feeds.map((f, fi) => {
        const item = D.feedItemOf(f.feed_item);
        return {
          feed_item_code: item ? item.feed_item_code : null, crop_code: item ? item.crop_code : null,
          livestock: Object.values(groups).map((list, li) => {
            const N = list.reduce((t, a) => t + (Number(a.herd_n) || 0), 0) || 1;
            const alloc = list.reduce((t, a) => t + (Number((((state.allocation[s.id] || {})[a.id]) || {})[f.id]) || 0) * (Number(a.herd_n) || 0), 0) / N;
            prov[`feed_basket[${si}].feeds[${fi}].livestock[${li}].allocation`] = list.length > 1 ? "derived" : (((state.allocation[s.id] || {})[list[0].id] || {})[f.id] == null ? "default" : "user");
            return { livetype_code: list[0].livetype, allocation: r4(alloc) };
          }),
        };
      }),
    }));
    // rescale columns to exactly 100 where within tolerance
    for (const [si, season] of out.feed_basket.entries()) for (const li of Object.keys(groups).keys()) {
      const col = season.feeds.map((f) => f.livestock[li].allocation); const sum = col.reduce((a, b) => a + b, 0);
      if (sum > 0 && Math.abs(sum - 100) <= 0.5 && sum !== 100) season.feeds.forEach((f) => (f.livestock[li].allocation = r4(f.livestock[li].allocation * 100 / sum)));
    }

    if (mapping.length) { out.livestock_mapping = mapping; prov["livestock_mapping"] = "user"; }
    for (const [p, v] of Object.entries(prov)) if (v === "blocked") blocked.push({ path: p });
    for (const [p, v] of Object.entries(prov)) if (v === "default") assumed.push({ path: p });
    return { input: out, prov, assumed, blocked };
  }

  function regionForCountry(country) {
    if (!country) return null;
    const c = country.toLowerCase();
    const AFR = ["tanzania", "kenya", "uganda", "ethiopia", "rwanda", "burundi", "malawi", "zambia", "zimbabwe", "mozambique", "nigeria", "ghana", "senegal", "mali", "burkina", "niger", "cameroon", "south africa", "tunisia", "morocco", "egypt", "sudan", "somalia", "madagascar", "botswana", "namibia", "angola", "congo", "benin", "togo", "ivory", "côte", "liberia", "sierra", "guinea", "gambia", "chad", "eritrea", "djibouti", "lesotho", "eswatini", "mauritius"];
    const LATAM = ["ecuador", "honduras", "nicaragua", "haiti", "colombia", "peru", "bolivia", "brazil", "mexico", "guatemala", "el salvador", "costa rica", "panama", "cuba", "dominican", "venezuela", "argentina", "chile", "uruguay", "paraguay"];
    const ASIA = ["vietnam", "viet nam", "nepal", "mongolia", "uzbekistan", "cambodia", "laos", "lao", "thailand", "indonesia", "philippines", "myanmar", "china", "kazakhstan", "kyrgyz", "tajik", "malaysia", "bangladesh"];
    const INDIA = ["india", "pakistan", "sri lanka", "bhutan"];
    if (AFR.some((x) => c.includes(x))) return "AFRICA"; if (LATAM.some((x) => c.includes(x))) return "LATIN AMERICA"; if (INDIA.some((x) => c.includes(x))) return "INDIA SUB-CONTINENT"; if (ASIA.some((x) => c.includes(x))) return "ASIA";
    return "AFRICA";
  }
  function ipccManure(v) {
    const S = window.ICL_SCHEMA; if (!v || !v.handling) return "Pasture/Range/Paddock";
    const opt = S.manureOptions.find((o) => o.value === v.handling); if (!opt) return "Pasture/Range/Paddock";
    let label = opt.ipcc; const fu = v.followups || {};
    for (const f of opt.followups || []) {
      if (f.type === "select") { const o = (f.options || []).find((o) => o.value === fu[f.id]); if (o) label = o.ipcc; }
      else if (fu[f.id] === true && f.yes) label = f.yes;
    }
    return label;
  }
  ICL.compile = compile; ICL.ipccManure = ipccManure; ICL.regionForCountry = regionForCountry;
})(window.ICL);
