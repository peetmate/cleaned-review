/* Validation: per-field (type/range/required/na_policy) + cross-field rules. Produces errors, warnings, assumptions. */
(function (ICL) {
  const D = ICL.dict, C = ICL.cond;
  const ENTITY_COLL = { plot: "plots", season: "seasons", herd: "herds", animal: "animals", feed: "feeds" };

  function ctxFor(state, entity) { return { system: state.system, farm: state.farm, ui: state.ui, entity }; }

  function checkField(f, entity, state, out, screen, entityId, labelPrefix) {
    const ctx = ctxFor(state, entity);
    if (!C.visible(f, ctx)) return;
    const req = C.required(f, ctx);
    const path = entityId ? `${ENTITY_COLL[f.entity] || f.entity}[${entityId}].${f.id}` : `${f.entity}.${f.id}`;
    const raw = entity ? entity[f.id] : undefined;
    const isBlank = raw === undefined || raw === null || raw === "" || (Array.isArray(raw) && raw.length === 0);
    const base = { fieldId: f.id, screen, entityId, path, label: (labelPrefix ? labelPrefix + " · " : "") + ICL.t(f.label) };
    // enum / reference integrity (C07)
    if (!isBlank && ["select", "radio"].includes(f.type) && !Array.isArray(raw)) {
      const opts = D.options(f, state, entity); if (opts.length && !opts.some((o) => String(o.value) === String(raw))) { out.errors.push({ ...base, msg: `${base.label}: "${raw}" is not one of the choices any more. Pick again.` }); return; }
    }
    if (!isBlank && f.type === "multiselect" && Array.isArray(raw)) { const opts = D.options(f, state, entity).map((o) => String(o.value)); if (raw.some((v) => !opts.includes(String(v)))) out.errors.push({ ...base, msg: `${base.label}: refers to something that was removed. Pick again.` }); }
    if (isBlank) {
      const d = D.defaultFor(f, entity, state);
      if (req && !d) { out.errors.push({ ...base, msg: `${base.label}: needed before we can run.` }); return; }
      if (d && f.na_policy !== "not_applicable" && f.na_policy !== "meta") {
        const item = { ...base, msg: `${base.label}: using ${describe(d.value, f)} (${sourceName(d.source, f, state)}).`, value: d.value, source: d.source };
        if (d.source === "db") out.fromDb.push(item); else out.assumptions.push(item);
      }
      return;
    }
    const provKey = entityId ? `${ENTITY_COLL[f.entity] || f.entity}[${entityId}].${f.id}` : `${f.entity}.${f.id}`;
    if (state.provenance[provKey] === "default" && f.na_policy !== "not_applicable" && f.na_policy !== "meta") {
      out.assumptions.push({ ...base, msg: `${base.label}: using ${describe(raw, f)} (${f.default_source === "map" ? (state.farm.location_point ? "from maps for this location" : "typical value") : "prefilled"}; use the chip menu to keep or change it).`, value: raw, source: "default" });
    }
    if (["number", "integer", "percent"].includes(f.type)) {
      const v = Number(raw);
      if (!Number.isFinite(v)) { out.errors.push({ ...base, msg: `${f.label}: not a number.` }); return; }
      if (f.min != null && v < f.min) out.errors.push({ ...base, msg: `${f.label}: ${v} is below the minimum ${f.min}${f.unit ? " " + f.unit : ""}.` });
      if (f.max != null && v > f.max) out.errors.push({ ...base, msg: `${f.label}: ${v} is above the maximum ${f.max}${f.unit ? " " + f.unit : ""}.` });
      const macro = ["group", "region", "national"].includes(state.system.scale) && ["herd_n", "plot_area_ha"].includes(f.id);
      if (f.typical && !macro && (v < f.typical[0] || v > f.typical[1]) && !(f.min != null && v < f.min) && !(f.max != null && v > f.max))
        out.warnings.push({ ...base, msg: `${f.label}: ${v} is outside the usual range ${f.typical[0]}–${f.typical[1]}${f.unit ? " " + f.unit : ""}. Check the unit.` });
      if (f.type === "integer" && !Number.isInteger(v)) out.errors.push({ ...base, msg: `${f.label}: must be a whole number.` });
    }
    if (f.type === "triple_pct") {
      const s = (raw.fed || 0) + (raw.left || 0) + (raw.burnt || 0);
      if (Math.abs(s - 100) > 0.5) out.errors.push({ ...base, msg: `${f.label}: fed + left + burnt add up to ${s}%, should be 100.` });
      if (f.id === "residue_fate" && (raw.fed || 0) <= 0) out.errors.push({ ...base, msg: `This residue is listed as a feed but 0% is fed. Enter the share fed, or remove the feed.` });
    }
  }

  function describe(v, f) {
    if (Array.isArray(v) && f.type === "month_set") return v.map((m) => ICL.MONTHS[m - 1]).join(", ");
    if (v && typeof v === "object") return v.handling ? `"${(window.ICL_SCHEMA.manureOptions.find((o) => o.value === v.handling) || {}).label || v.handling}", ${v.collected}% collected` : JSON.stringify(v);
    if (f.options) { const o = f.options.find((o) => o.value === v); if (o) return `"${o.label}"`; }
    return `${ICL.fmt(v, 2)}${f.unit ? " " + f.unit : ""}`;
  }
  const sourceName = (s, f, state) => ({ db: "from the parameter set", default: (f.default_source === "map" ? (state && state.farm && state.farm.location_point ? "from maps" : "typical value; set a location to get a map value") : "assumed"), derived: "calculated" }[s] || s);

  function validate(state) {
    const out = { errors: [], warnings: [], assumptions: [], fromDb: [] };
    const sec = (id) => D.section(id);
    // meta
    for (const f of D.fieldsFor("home")) checkField(f, state.meta, state, out, "about", null);
    // farm-level sections
    for (const sid of ["location", "inputs", "losses"]) if (C.sectionVisible(sec(sid), state)) for (const f of D.fieldsFor(sid)) checkField(f, state.farm, state, out, sid, null);
    // entities
    const entitySections = [["plots", "plot", "plot_name"], ["seasons", "season", "season_name"], ["herds", "herd", "herd_name"], ["animals", "animal", null], ["feeds", "feed", null]];
    for (const [sid, etype, nameKey] of entitySections) {
      if (!C.sectionVisible(sec(sid), state)) continue;
      const list = state[sid] || [];
      if (!list.length && sid !== "plots") out.errors.push({ fieldId: null, screen: sid, entityId: null, path: sid, label: sec(sid).title, msg: `Add at least one ${etype}.` });
      if (!list.length && sid === "plots" && state.system.growsFeed) out.errors.push({ fieldId: null, screen: sid, entityId: null, path: sid, label: sec(sid).title, msg: ICL.t("Add at least one {plot}, because feed is grown here.") });
      for (const raw of list) {
        const e = D.decorate(raw, etype, state);
        const name = nameKey ? e[nameKey] : etype === "animal" ? D.livetypeLabel(e._desc) : e._feedItem ? D.displayFeedName(e._feedItem.feed_item_name) : "";
        for (const f of D.fieldsFor(sid)) checkField(f, e, state, out, sid, e.id, name);
        if (etype === "animal") {
          const hrs = ["hours_stable", "hours_pen", "hours_onfarm", "hours_offfarm"].reduce((s, k) => s + (Number(e[k]) || 0), 0);
          if (Math.abs(hrs - 24) > 0.01) out.errors.push({ fieldId: "hours_stable", screen: sid, entityId: e.id, path: `animals[${e.id}].hours`, label: `${name} · ${ICL.t("A normal day")}`, msg: `Hours add up to ${ICL.fmt(hrs)}: ${hrs < 24 ? "add " + ICL.fmt(24 - hrs) + " more hours somewhere" : "remove " + ICL.fmt(hrs - 24) + " hours"}.` });
          const bw = D.effective(D.field("body_weight"), e, state).value, aw = D.effective(D.field("adult_weight"), e, state).value;
          if (e._young && aw != null && bw != null && aw < bw) out.errors.push({ fieldId: "adult_weight", screen: sid, entityId: e.id, path: `animals[${e.id}].adult_weight`, label: `${name} · Weight when fully grown`, msg: `Fully grown weight (${aw} kg) is below the current weight (${bw} kg).` });
        }
        if (etype === "animal" && !e._desc) out.errors.push({ fieldId: "livetype", screen: sid, entityId: e.id, path: `animals[${e.id}].livetype`, label: "Animals", msg: "This animal group is not in the current parameter set. Choose the group again." });
        if (etype === "feed" && !e._feedItem) out.errors.push({ fieldId: "feed_item", screen: sid, entityId: e.id, path: `feeds[${e.id}].feed_item`, label: "Feeds", msg: "This feed is not in the current parameter set. Choose the feed again." });
        if (etype === "feed" && e.feed_origin === "grown" && e.feed_part === "residue") {
          const ry = D.effective(D.field("residue_yield_t_dm_ha"), e, state).value;
          if (ry == null || Number(ry) <= 0) out.errors.push({ fieldId: "residue_yield_t_dm_ha", screen: sid, entityId: e.id, path: `feeds[${e.id}].residue_yield_t_dm_ha`, label: `${name} · Residue produced`, msg: `Residue yield is ${ry == null ? "blank" : "0"}, so the model would count no land for ${name}. Enter the residue produced per hectare.` });
        }
        if (etype === "feed" && e.feed_origin === "grown" && e.feed_part === "main") {
          const share = D.effective(D.field("main_fed_share"), e, state).value;
          if (share != null && Number(share) <= 0) out.errors.push({ fieldId: "main_fed_share", screen: sid, entityId: e.id, path: `feeds[${e.id}].main_fed_share`, label: `${name} · Share fed`, msg: `${name} is listed as a feed but 0% of it is fed. Enter the share fed, or feed the residue instead.` });
          const y = D.effective(D.field("yield_t_dm_ha"), e, state).value;
          if (y != null && Number(y) <= 0) out.errors.push({ fieldId: "yield_t_dm_ha", screen: sid, entityId: e.id, path: `feeds[${e.id}].yield_t_dm_ha`, label: `${name} · Harvest`, msg: `Yield is 0, so the model would count no land. Enter a yield.` });
        }
      }
    }
    // one model row per feed item (C03)
    const seenFeed = {}; for (const f of state.feeds) { const k = String(f.feed_item); if (seenFeed[k]) { const fe = D.decorate(f, "feed", state); out.errors.push({ fieldId: "feed_item", screen: "feeds", entityId: f.id, path: `feeds[${f.id}].feed_item`, label: "Feeds", msg: `${fe._feedItem ? D.displayFeedName(fe._feedItem.feed_item_name) : "A feed"} is listed twice. The model takes one row per feed: keep one card and give it the combined diet share.` }); } seenFeed[k] = true; }
    // seasons total
    const months = new Map();
    for (const s of state.seasons) for (const m of s.season_months || []) months.set(m, (months.get(m) || 0) + 1);
    const days = state.seasons.reduce((t, s) => t + (s.season_months || []).filter((m) => m >= 1 && m <= 12).reduce((d, m) => d + ICL.MONTH_DAYS[m - 1], 0), 0);
    if (state.seasons.length && days !== 365) {
      const missing = ICL.MONTHS.filter((_, i) => !months.has(i + 1));
      out.errors.push({ fieldId: "season_months", screen: "seasons", entityId: null, path: "seasons", label: "Seasons", msg: days < 365 ? `Seasons cover ${days} of 365 days. Not yet in a season: ${missing.join(", ")}.` : `Some months are in two seasons (${days} days in total). Each month belongs to one season.` });
    }
    // manure to plots
    const manureSum = state.feeds.filter((f) => f.feed_origin === "grown").reduce((s, f) => s + (Number(f.manure_to_plot_share) || 0), 0);
    if (manureSum > 100.01) out.errors.push({ fieldId: "manure_to_plot_share", screen: "feeds", entityId: null, path: "feeds.manure", label: "Feeds · Manure applied", msg: `Manure shares across crops add up to ${manureSum}%. They cannot exceed 100.` });
    // fertiliser products used anywhere: rates ≥ 0, N% in range (C06, C22)
    if (state.system.fertiliser) {
      const used = new Set();
      for (const f of state.feeds) for (const [name, r] of Object.entries(f.fert_rates || {})) { if (!r || r.value == null) continue; if (Number(r.value) < 0) out.errors.push({ fieldId: "fert_rates", screen: "feeds", entityId: f.id, path: `feeds[${f.id}].fert_rates`, label: "Feeds · Fertiliser", msg: `${name}: a negative amount is not possible.` }); if (Number(r.value) > 0) used.add(name); }
      const ff = D.field("fert_n_pct");
      for (const name of used) {
        const v = state.fertilizer[name]; const def = D.vocab(state).fertilizer_default_n_pct[name];
        const pct = v != null && v !== "" ? Number(v) : def;
        if (pct == null || !(pct > 0)) out.errors.push({ fieldId: "fert_n_pct", screen: "fertiliser", entityId: name, path: `fertilizer.${name}`, label: `Fertiliser · ${name}`, msg: `${name} is applied but its nitrogen % is ${v === 0 || v === "0" ? "0" : "blank"}. Read the nitrogen % on the bag${name === "NPK" ? " (the first number of the grade)" : ""}.` });
        else if (pct < ff.min || pct > ff.max) out.errors.push({ fieldId: "fert_n_pct", screen: "fertiliser", entityId: name, path: `fertilizer.${name}`, label: `Fertiliser · ${name}`, msg: `${name}: ${pct}% nitrogen is outside ${ff.min}–${ff.max}%. Check the bag.` });
      }
    }
    // feeding plan
    if (state.animals.length && state.feeds.length) {
      for (const s of state.seasons) for (const a of state.animals) {
        const cells = ((state.allocation[s.id] || {})[a.id]) || {};
        const sum = state.feeds.reduce((t, f) => t + (Number(cells[f.id]) || 0), 0);
        const an = D.decorate(a, "animal", state);
        if (Math.abs(sum - 100) > 0.5) out.errors.push({ fieldId: "basket_share", screen: "feeding", entityId: s.id, path: `allocation.${s.id}.${a.id}`, label: `Feeding · ${s.season_name} · ${D.livetypeLabel(an._desc)}`, msg: `Diet shares add up to ${ICL.fmt(sum)}% in ${s.season_name} for ${D.livetypeLabel(an._desc)}; they must add up to 100.` });
        for (const f of state.feeds) if (Number(cells[f.id]) < 0) out.errors.push({ fieldId: "basket_share", screen: "feeding", entityId: s.id, path: `allocation.${s.id}.${a.id}.${f.id}`, label: "Feeding", msg: "A diet share cannot be negative." });
      }
      for (const f of state.feeds) {
        const fed = state.seasons.some((s) => state.animals.some((a) => Number((((state.allocation[s.id] || {})[a.id]) || {})[f.id]) > 0));
        const fe = D.decorate(f, "feed", state);
        if (!fed) out.warnings.push({ fieldId: "basket_share", screen: "feeding", entityId: null, path: `feeds[${f.id}]`, label: "Feeding", msg: `${fe._feedItem ? D.displayFeedName(fe._feedItem.feed_item_name) : "A feed"} is never fed in any season. Add it to the plan or remove it.` });
      }
    }
    // plots disagreement (one soil / practice per farm in the model)
    if (state.plots.length > 1) {
      const soils = new Set(state.plots.map((p) => p.plot_soil || "")); if ([...soils].filter(Boolean).length > 0) out.assumptions.push({ fieldId: "plot_soil", screen: "plots", entityId: null, path: "plots.soil", label: "Plots · Soil", msg: ICL.t("The model uses one soil for the whole {enterprise}. Using the main soil; {plot}-specific soils are recorded but not sent."), source: "derived" });
      const till = new Set(state.plots.filter((p) => p.plot_use !== "grazing").map((p) => p.tillage || "full"));
      if (till.size > 1) { const big = largestPlot(state, "crops"); out.assumptions.push({ fieldId: "tillage", screen: "plots", entityId: big && big.id, path: "plots.tillage", label: "Plots · Tillage", msg: ICL.t(`{Plot}s are tilled differently. The model takes one practice for the whole {enterprise}: using "${big.plot_name}" (largest cropped {plot}, ${big.plot_area_ha || 1} ha).`), source: "derived" }); }
    }
    // herds merge
    const byType = {};
    for (const a of state.animals) (byType[a.livetype] = byType[a.livetype] || []).push(a);
    for (const [lt, list] of Object.entries(byType)) if (list.length > 1) {
      const d = D.livetypeOf(lt);
      out.assumptions.push({ fieldId: "livetype", screen: "animals", entityId: list[0].id, path: `animals.merge.${lt}`, label: `Animals · ${D.livetypeLabel(d && d.desc)}`, msg: `${D.livetypeLabel(d && d.desc)} appears in ${list.length} herds (${list.map((a) => a.herd_n || "?").join(" + ")} head). The model takes one row per animal type, so hours, manure handling and diet are merged weighted by head count.`, source: "derived" });
    }
    // anything the compiler cannot fill becomes a blocking error (C04)
    try {
      const comp = ICL.compile(state); const have = new Set(out.errors.map((e) => e.path));
      const screenFor = (p) => p.startsWith("livestock") ? "animals" : p.startsWith("feed_items") ? "feeds" : p.startsWith("fertilizer") ? "fertiliser" : p.startsWith("feed_basket") ? "feeding" : p === "database_code" || p === "farm_name" ? "home" : "location";
      const nice = { region: "World region (set from the country)", soil_k_value: "Soil type", climate_zone_2: "Climate type", annual_prec: "Rainfall", rain_length: "Months with rain", et: "Evaporation demand", database_code: "Parameter set" };
      for (const b of comp.blocked) { const p = b.path; const key = p.replace(/\[\d+\]/g, "[]"); if ([...have].some((h) => h && p.includes(h))) continue; if (out.errors.some((e) => e.msg && e.msg.includes(nice[p] || "\u0000"))) continue;
        const leaf = p.split(".").pop(); const label = nice[p] || leaf.replace(/_/g, " ");
        out.errors.push({ fieldId: null, screen: screenFor(p), entityId: null, path: "compiled." + p, label: "Model input", msg: b.msg || `${label}: the model needs this and nothing fills it yet.` }); }
    } catch (e) { out.errors.push({ fieldId: null, screen: "check", entityId: null, path: "compile", label: "Model input", msg: "Internal: the model input could not be built (" + (e && e.message) + ")." }); }
    return out;
  }
  function largestPlot(state, use) {
    const cands = state.plots.filter((p) => (use === "crops" ? p.plot_use !== "grazing" : p.plot_use !== "crops"));
    return (cands.length ? cands : state.plots).slice().sort((a, b) => (Number(b.plot_area_ha) || 1) - (Number(a.plot_area_ha) || 1))[0];
  }
  ICL.validate = validate;
  ICL.largestPlot = largestPlot;
})(window.ICL);
