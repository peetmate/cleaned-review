/* Dictionary access + defaults resolution. */
(function (ICL) {
  const S = () => window.ICL_SCHEMA;
  const RAW = () => window.ICL_VOCAB;
  // Parameter-set copies: {value,label,base,changes:{table:{rowKey:{col:{from,to,at}}}}}
  const TABLE_KEY = { livetype: "code", feeditems: "feed_item_code", crops: "crop_code", soil: "desc", slope: "code", landcover: "code" };
  let memo = { sig: null, vocab: null };
  function activeCopy(state) { const st = state || (ICL.store && ICL.store.get()); if (!st) return null; return (st.paramSets && st.paramSets.copies || []).find((c) => c.value === st.meta.param_set) || null; }
  function V(state) {
    const copy = activeCopy(state); const raw = RAW();
    if (!copy || !copy.changes || !Object.keys(copy.changes).length) return raw;
    const sig = copy.value + JSON.stringify(copy.changes);
    if (memo.sig === sig) return memo.vocab;
    const out = Object.assign({}, raw);
    for (const [table, rows] of Object.entries(copy.changes)) {
      if (table === "fertilizer_default_n_pct") { out.fertilizer_default_n_pct = Object.assign({}, raw.fertilizer_default_n_pct); for (const [name, cols] of Object.entries(rows)) if (cols.n) out.fertilizer_default_n_pct[name] = cols.n.to; continue; }
      const key = TABLE_KEY[table]; if (!key || !Array.isArray(raw[table])) continue;
      out[table] = raw[table].map((r) => { const ch = rows[String(r[key])]; if (!ch) return r; const n = Object.assign({}, r); for (const [col, c] of Object.entries(ch)) n[col] = c.to; return n; });
    }
    memo = { sig, vocab: out }; return out;
  }
  const changeCount = (copy) => Object.values(copy && copy.changes || {}).reduce((n, rows) => n + Object.values(rows).reduce((m, cols) => m + Object.keys(cols).length, 0), 0);
  const byId = {};
  const init = () => { for (const f of S().fields) byId[f.id] = f; };

  const sections = () => S().sections.slice().sort((a, b) => a.order - b.order);
  const section = (id) => S().sections.find((s) => s.id === id);
  const field = (id) => byId[id] || (init(), byId[id]);
  const fieldsFor = (sectionId) => S().fields.filter((f) => f.section === sectionId);
  const T = () => S().tables;

  const livetypeOf = (code) => V().livetype.find((l) => l.code === String(code));
  const feedItemOf = (code) => V().feeditems.find((f) => f.feed_item_code === String(code));
  const cropOf = (code) => V().crops.find((c) => c.crop_code === String(code));
  const livetypeLabel = (desc) => (T().livetypeLabels[desc] && T().livetypeLabels[desc].label) || desc;
  const displayFeedName = (name) => String(name || "").replace(/\s+(OFR|OFC|IP)$/, "");

  // entity-derived flags used by predicates (entity._young etc.)
  function decorate(entity, entityType, state) {
    if (!entity) return entity;
    const e = Object.assign({}, entity);
    if (entityType === "animal") {
      const lt = livetypeOf(e.livetype);
      e._desc = lt ? lt.desc : null;
      e._young = !!(lt && T().youngGroups.includes(lt.desc));
      e._milking = !!(lt && T().milkingGroups.includes(lt.desc));
      const pat = (state.herds.find((h) => h.id === e.herd_ref) || {}).herd_pattern;
      e._pattern = pat;
      for (const k of ["hours_stable", "hours_pen", "hours_onfarm", "hours_offfarm"]) if (e[k] == null) { const d = defaultFor(field(k), e, state); e[k] = d ? d.value : null; e._hoursDefaulted = true; }
    }
    if (entityType === "herd") {
      const pat = S().herdPatterns.find((p) => p.value === e.herd_pattern);
      const groups = (state.animals || []).filter((a) => a.herd_ref === e.id).map((a) => decorate(a, "animal", state));
      const any = (k) => groups.length ? groups.some((g) => Number(g[k]) > 0) : !!(pat && pat.hours[k.replace("hours_", "")] > 0);
      e._anyStable = any("hours_stable"); e._anyPen = any("hours_pen");
      e._anyOnfarm = any("hours_onfarm"); e._anyOfffarm = any("hours_offfarm");
      e._groups = groups.length; e._head = groups.reduce((t, g) => t + (Number(g.herd_n) || 0), 0);
    }
    if (entityType === "feed") {
      const fi = feedItemOf(e.feed_item);
      const crop = fi ? cropOf(fi.crop_code) : null;
      e._feedItem = fi; e._crop = crop;
      e._isRice = !!(crop && /rice/i.test(crop.crop_name));
      e._category = crop ? crop.category : null;
      e._isConcentrate = !!(fi && /concentrate|meal|bran|cake/i.test(fi.feed_item_name));
      if (e.feed_part == null && fi) e.feed_part = /residue|stover|straw|haulm/i.test(fi.feed_item_name) ? "residue" : "main";
    }
    return e;
  }

  // Resolve the default for a field given an (decorated) entity and state. Returns {value, source} or null.
  function defaultFor(f, entity, state) {
    if (!f) return null;
    const ds = f.default_source || "";
    if (ds.startsWith("db:livetype.")) {
      const lt = entity && livetypeOf(entity.livetype); const k = ds.split(".")[1];
      if (lt) {
        if (k === "adult_weight") { if (lt.adult_weight > 0) return { value: lt.adult_weight, source: "db" }; const adultDesc = T().adultOf[lt.desc]; const adult = adultDesc ? V(state).livetype.find((l) => l.desc === adultDesc) : null; return { value: adult ? adult.body_weight : lt.body_weight, source: "db" }; }
        return lt[k] != null ? { value: lt[k], source: "db" } : null;
      }
      return null;
    }
    if (ds.startsWith("db:feed.")) {
      const fi = entity && feedItemOf(entity.feed_item); const k = ds.split(".")[1];
      return fi && fi[k] != null ? { value: fi[k], source: "db" } : null;
    }
    if (ds.startsWith("db:crop.")) {
      const fi = entity && feedItemOf(entity.feed_item); const crop = fi && cropOf(fi.crop_code); const k = ds.split(".")[1];
      return crop && crop[k] != null ? { value: crop[k], source: "db" } : null;
    }
    if (ds.startsWith("herd:")) {
      const herd = entity && (state.herds || []).find((x) => x.id === entity.herd_ref);
      if (!herd) return null;
      const hf = field(ds.slice(5));
      const raw = herd[hf.id];
      if (raw !== undefined && raw !== null && raw !== "") return { value: raw, source: "herd" };
      const hd = defaultFor(hf, decorate(herd, "herd", state), state);
      return hd ? { value: hd.value, source: hd.source } : null;
    }
    if (ds === "herd pattern") {
      const herd = entity && state.herds.find((h) => h.id === entity.herd_ref);
      const pat = herd && S().herdPatterns.find((p) => p.value === herd.herd_pattern);
      if (!pat) return null;
      const key = { hours_stable: "stable", hours_pen: "pen", hours_onfarm: "onfarm", hours_offfarm: "offfarm" }[f.id];
      return { value: pat.hours[key], source: "default" };
    }
    if (ds === "crop category") {
      const fi = entity && feedItemOf(entity.feed_item); const crop = fi && cropOf(fi.crop_code);
      const v = crop ? T().mainFedShareByCategory[crop.category] : null;
      return v != null ? { value: v, source: "default" } : null;
    }
    if (ds === "crop" && f.id === "land_cover") {
      // plots: land cover from the crops grown there (first feed on this plot)
      const feed = entity && state.feeds.find((fd) => fd.feed_plot === entity.id);
      if (entity && entity.plot_use === "grazing") return { value: "Dense grass", source: "default" };
      const fi = feed && feedItemOf(feed.feed_item); const crop = fi && cropOf(fi.crop_code);
      if (!crop) return { value: "Dense grass", source: "default" };
      return { value: T().landCoverByCrop[crop.crop_name] || T().landCoverByCategory[crop.category] || "Cereals", source: "default" };
    }
    if (ds === "feed item" && f.id === "feed_part") {
      const fi = entity && feedItemOf(entity.feed_item);
      return fi ? { value: /residue|stover|straw|haulm/i.test(fi.feed_item_name) ? "residue" : "main", source: "default" } : null;
    }
    if (ds === "product") {
      const v = V().fertilizer_default_n_pct[entity && entity.id];
      return v != null ? { value: v, source: "default" } : null;
    }
    if (f.default !== undefined && f.default !== null) return { value: f.default, source: ds === "map" ? "default" : "default" };
    return null;
  }

  // Effective value: user value if set, else default. Returns {value, prov}
  function effective(f, entity, state, pathPrefix) {
    const raw = entity ? entity[f.id] : undefined;
    const provKey = pathPrefix ? pathPrefix + "." + f.id : f.id;
    if (raw !== undefined && raw !== null && raw !== "") return { value: raw, prov: state.provenance[provKey] || "user" };
    const d = defaultFor(f, entity, state);
    if (d) return { value: d.value, prov: d.source };
    return { value: null, prov: "blank" };
  }

  function options(f, state, entity) {
    if (f.options) return f.options;
    const src = f.options_source || "";
    if (src === "vocab.region") return V().region.map((r) => ({ value: r, label: r }));
    if (src === "vocab.landcover") return V().landcover.map((l) => ({ value: l.desc, label: (T().landcoverLabels || {})[l.desc] || l.desc, definition: (T().landcoverLabels || {})[l.desc] ? `Model class: ${l.desc}` : undefined }));
    if (src === "herdPatterns") return S().herdPatterns;
    if (src === "paramSets") return T().paramSets.concat(((state.paramSets && state.paramSets.copies) || []).map((c) => ({ value: c.value, label: c.label + " · my copy" + (changeCount(c) ? ` (${changeCount(c)} change${changeCount(c) === 1 ? "" : "s"})` : "") })));
    if (src === "field:soil_description") return [{ value: "", label: "Same as the main soil" }].concat(field("soil_description").options);
    if (src === "entities:plot") return state.plots.map((p) => ({ value: p.id, label: p.plot_name || "Unnamed plot" }));
    if (src === "entities:herd") return state.herds.map((h) => ({ value: h.id, label: h.herd_name || "Unnamed herd" }));
    return [];
  }

  function words() { const st = ICL.store && ICL.store.get(); const sc = (st && st.system && st.system.scale) || "farm"; return S().scaleWords[sc] || S().scaleWords.farm; }
  const cap = (x) => x.charAt(0).toUpperCase() + x.slice(1);
  function t(str) { if (typeof str !== "string" || str.indexOf("{") === -1) return str; const w = words(); return str.replace(/\{(Farm|farm|Plot|plot|onfarm|offfarm|location|numbers|about|gate|enterprise|Enterprise)\}/g, (_, k) => { const lk = k.toLowerCase(); const v = w[lk] || lk; return k[0] === k[0].toUpperCase() && !["onfarm", "offfarm", "location", "numbers", "about", "gate"].includes(lk) ? cap(v) : v; }); }
  ICL.t = t; ICL.dict = { t, words, sections, section, field, fieldsFor, tables: T, vocab: V, rawVocab: RAW, activeCopy, changeCount, TABLE_KEY, livetypeOf, feedItemOf, cropOf, livetypeLabel, displayFeedName, decorate, defaultFor, effective, options };
})(window.ICL);
