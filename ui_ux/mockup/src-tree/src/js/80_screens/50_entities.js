/* Entity screens: plots, seasons, herds, animals, feeds. List view + card editor, add flows. */
(function (ICL) {
  const { h, fmt } = ICL; const D = ICL.dict; const { screenHead, variantVote, entityCtx, addEntity, removeEntity, confirmButton } = ICL.common;
  const TYPE = { plots: "plot", seasons: "season", herds: "herd", animals: "animal", feeds: "feed" };

  function entityScreen(collection) {
    return function (root, { state, val }) {
      const sec = D.section(collection); const etype = TYPE[collection];
      root.append(screenHead(sec));
      const list = state[collection] || [];
      const route = state.route;
      if (collection === "animals" && !route.entity) root.append(ICL.common.variantsBox(["V1", "V2", "V5"], state));
      if (route.entity === "new") { root.append(addFlow(collection, state)); return; }
      const selected = route.entity ? list.find((e) => e.id === route.entity) : null;
      if (selected) {
        root.append(recordTabs(collection, list, state, val, selected.id));
        root.append(card(collection, selected, state, val, true));
        root.append(recordNav(collection, list, selected));
        return;
      }
      if (list.length) root.append(recordTabs(collection, list, state, val, null));
      // list view
      const noun = ICL.common.entityNoun(collection);
      if (collection === "seasons") root.append(seasonsOverview(state, val));
      if (collection === "herds" && !route.entity) root.append(herdsExplainer(state));
      if (collection === "animals" && (state.ui.variant.V1 || "A") === "B") { root.append(animalsTable(state, val)); }
      else if (!list.length) root.append(h("div", { class: "empty" }, emptyText(collection, state), h("div", { style: "margin-top:10px" }, h("a", { class: "btn", href: ICL.router.hashFor(collection, "new") }, "+ Add " + noun))));
      else {
        // Long lists need finding, not scrolling: chips + search, and a compact list
        // once there are more records than fit comfortably as cards.
        const flt = (state.ui.listFilter || {})[collection] || { tag: "all", q: "" };
        const shown = filterList(collection, list, state, val, flt);
        if (FILTERABLE[collection]) root.append(filterBar(collection, list, shown, state, val, flt));
        if (!shown.length) root.append(h("div", { class: "empty" }, "Nothing matches that filter.", h("div", { style: "margin-top:8px" }, h("button", { type: "button", class: "btn-sm", onclick: () => setFilter(collection, { tag: "all", q: "" }) }, "Clear the filter"))));
        else if (compactMode(collection, list, state)) root.append(compactList(collection, shown, state, val));
        else for (const e of shown) root.append(card(collection, e, state, val, false));
        root.append(h("a", { class: "btn secondary", href: ICL.router.hashFor(collection, "new") }, "+ Add another " + noun));
      }
      if (collection === "seasons" && list.length) root.append(h("div", { style: "margin-top:12px" }, seasonTemplates(state)));
    };
  }
  const emptyText = (c, s) => ({ plots: `Add the first ${ICL.dict.words().plot} that grows feed or is grazed.`, seasons: "Add the first feeding period, or pick a template below.", herds: "Add a herd: animals kept together and managed the same way. One herd is enough for most enterprises.", animals: "Add the first group of animals, for example the milking cows.", feeds: "Add the first feed the animals eat, for example the grass they graze or are cut." }[c]);

  /** How many herds an enterprise may have, and what the model actually receives. */
  function herdsExplainer(state) {
    const dup = {};
    for (const a of state.animals) { const d = D.decorate(a, "animal", state); if (!d._desc) continue; (dup[d._desc] = dup[d._desc] || []).push(a); }
    const shared = Object.entries(dup).filter(([, list]) => new Set(list.map((a) => a.herd_ref)).size > 1);
    const box = h("div", { class: "callout", dataset: { fb: "herds:explainer", fbLabel: "What a herd is", noNumber: "" } },
      h("strong", null, "As many herds as you keep. "),
      ICL.t("A herd is animals kept together and managed the same way \u2014 one shed, one grazing pattern, one way of handling dung. Most {enterprise}s have one; separate the young stock, a second site or a zero-grazing unit into their own herd when they are managed differently. Herds are how you describe and check the enterprise; the model itself receives one row per animal type."),
      h("div", { class: "small", style: "margin-top:6px" },
        "That last point matters: if the same animal type appears in two herds, their hours, manure handling and diet are merged by head count before the model sees them, and the merge is listed on ",
        h("a", { href: "#check" }, "Check & run"), ". Give the two groups different animal types, or describe them as two scenarios, when you need them kept apart in the results."));
    if (shared.length) box.append(h("div", { class: "small", style: "margin-top:6px" },
      h("span", { class: "chip", style: "color:var(--warn);border-color:var(--warn)" }, "merging"), " ",
      shared.map(([desc, list]) => `${D.livetypeLabel(desc)} is in ${new Set(list.map((a) => a.herd_ref)).size} herds (${list.map((a) => ICL.fmt(a.herd_n || 0, 0)).join(" + ")} head)`).join(" \u00b7 "), "."));
    return box;
  }

  // ---- record tabs -------------------------------------------------------------
  /** One tab per record, so moving between feeds or animals happens on the page
      rather than in the sidebar, which has to stay a map of the steps. */
  function recordTabs(collection, list, state, val, currentId) {
    const wrap = h("div", { class: "rec-tabs", role: "tablist", "aria-label": ICL.common.entityNoun(collection) + " list", dataset: { fb: "tabs:" + collection, fbLabel: "Record tabs: " + collection, noNumber: "" } });
    const num = ICL.num.prefix(collection);
    list.forEach((e, i) => {
      const errs = val.errors.filter((x) => x.screen === collection && x.entityId === e.id).length;
      wrap.append(h("a", { class: "rec-tab" + (e.id === currentId ? " on" : ""), role: "tab", "aria-selected": String(e.id === currentId), href: ICL.router.hashFor(collection, e.id) },
        num ? h("span", { class: "num" }, `${num}.${i + 1}`) : null,
        h("span", null, ICL.layout.entityLabel(collection, e, state)),
        errs ? h("span", { class: "badge" }, String(errs)) : null));
    });
    wrap.append(h("a", { class: "rec-tab add", href: ICL.router.hashFor(collection, "new") }, "+ Add"));
    if (currentId) wrap.append(h("a", { class: "rec-tab", href: ICL.router.hashFor(collection) }, "All " + (list.length > 1 ? ICL.common.entityNoun(collection) + "s" : ICL.common.entityNoun(collection))));
    return wrap;
  }
  /** Previous / next within the collection, for keyboard and for long lists. */
  function recordNav(collection, list, selected) {
    const i = list.findIndex((e) => e.id === selected.id);
    const prev = list[i - 1], next = list[i + 1];
    return h("div", { class: "control", style: "margin-top:10px" },
      prev ? h("a", { class: "btn-sm", href: ICL.router.hashFor(collection, prev.id) }, "\u2190 " + ICL.layout.entityLabel(collection, prev, ICL.store.get())) : null,
      h("span", { class: "small" }, `${i + 1} of ${list.length}`),
      next ? h("a", { class: "btn-sm", href: ICL.router.hashFor(collection, next.id) }, ICL.layout.entityLabel(collection, next, ICL.store.get()) + " \u2192") : null);
  }

  // ---- filtering and compact lists ---------------------------------------------
  const FILTERABLE = { feeds: true, animals: true, plots: true };
  const COMPACT_AT = 8;
  const setFilter = (collection, next) => ICL.store.set((s) => { s.ui.listFilter = Object.assign({}, s.ui.listFilter, { [collection]: next }); return s; });
  const compactMode = (collection, list, state) => {
    const pref = (state.ui.listView || {})[collection];
    if (pref) return pref === "list";
    return FILTERABLE[collection] && list.length > COMPACT_AT;
  };

  function searchText(collection, e, state) {
    const d = D.decorate(e, TYPE[collection], state);
    if (collection === "feeds") {
      const syn = (D.tables().feedSynonyms || {})[e.feed_item] || [];
      return [d._feedItem ? D.displayFeedName(d._feedItem.feed_item_name) : "", d._crop ? d._crop.crop_name : "", ...syn, e.feed_origin || "", e.feed_part || ""].join(" ").toLowerCase();
    }
    if (collection === "animals") return [e.group_name || "", d._desc || "", D.livetypeLabel(d._desc) || ""].join(" ").toLowerCase();
    return [e.plot_name || "", e.plot_use || "", e.land_cover || ""].join(" ").toLowerCase();
  }

  /** Chip definitions per collection: {value, label, test}. Built from the data, so a chip only appears when it matches something. */
  function chipsFor(collection, list, state) {
    const out = [{ value: "all", label: "All", test: () => true }];
    if (collection === "feeds") {
      const W = ICL.dict.words();
      for (const [v, l] of [["grown", "Grown here"], ["bought", "Bought"], ["collected", ICL.t("Collected {offfarm}")]])
        if (list.some((e) => e.feed_origin === v)) out.push({ value: "origin:" + v, label: l, test: (e) => e.feed_origin === v });
      if (list.some((e) => e.feed_part === "residue")) out.push({ value: "part:main", label: "Main product", test: (e) => (e.feed_part || "main") === "main" });
      if (list.some((e) => e.feed_part === "residue")) out.push({ value: "part:residue", label: "Residues", test: (e) => e.feed_part === "residue" });
      for (const p of state.plots) if (list.some((e) => e.feed_plot === p.id))
        out.push({ value: "plot:" + p.id, label: p.plot_name || W.plot, test: (e) => e.feed_plot === p.id });
    }
    if (collection === "animals") {
      for (const hd of state.herds) if (list.some((e) => e.herd_ref === hd.id))
        out.push({ value: "herd:" + hd.id, label: hd.herd_name || "Herd", test: (e) => e.herd_ref === hd.id });
      if (list.some((e) => D.decorate(e, "animal", state)._milking)) out.push({ value: "milking", label: "Milking", test: (e) => D.decorate(e, "animal", state)._milking });
      if (list.some((e) => D.decorate(e, "animal", state)._young)) out.push({ value: "young", label: "Young stock", test: (e) => D.decorate(e, "animal", state)._young });
    }
    if (collection === "plots") {
      for (const [v, l] of [["crops", "Feed or crops"], ["grazing", "Grazing"], ["both", "Crops and grazing"]])
        if (list.some((e) => e.plot_use === v)) out.push({ value: "use:" + v, label: l, test: (e) => e.plot_use === v });
    }
    return out;
  }

  function filterList(collection, list, state, val, flt) {
    const chip = chipsFor(collection, list, state).find((c) => c.value === flt.tag) || { test: () => true };
    const q = (flt.q || "").trim().toLowerCase();
    return list.filter((e) => {
      if (flt.tag === "attention") return val.errors.some((x) => x.screen === collection && x.entityId === e.id);
      if (!chip.test(e)) return false;
      return !q || searchText(collection, e, state).includes(q);
    });
  }

  function filterBar(collection, list, shown, state, val, flt) {
    const chips = chipsFor(collection, list, state);
    const attention = list.filter((e) => val.errors.some((x) => x.screen === collection && x.entityId === e.id)).length;
    const wrap = h("div", { class: "listfilter", dataset: { fb: "filter:" + collection, fbLabel: "Filter " + collection, noNumber: "" } });
    const row = h("div", { class: "chips", role: "group", "aria-label": "Filter" });
    for (const c of chips) {
      const n = c.value === "all" ? list.length : list.filter(c.test).length;
      row.append(h("button", { type: "button", class: "filterchip", "aria-pressed": String(flt.tag === c.value), onclick: () => setFilter(collection, Object.assign({}, flt, { tag: c.value })) }, c.label, h("span", { class: "cnt" }, String(n))));
    }
    if (attention) row.append(h("button", { type: "button", class: "filterchip bad", "aria-pressed": String(flt.tag === "attention"), onclick: () => setFilter(collection, Object.assign({}, flt, { tag: "attention" })) }, "Needs attention", h("span", { class: "cnt" }, String(attention))));
    const search = h("input", { type: "search", value: flt.q || "", placeholder: collection === "feeds" ? "Search feeds, crops, local names…" : "Search…", "aria-label": "Search " + collection });
    search.addEventListener("input", () => setFilter(collection, Object.assign({}, flt, { q: search.value })));
    const compact = compactMode(collection, list, state);
    const viewBtn = h("button", { type: "button", class: "btn-sm", onclick: () => ICL.store.set((s) => { s.ui.listView = Object.assign({}, s.ui.listView, { [collection]: compact ? "cards" : "list" }); return s; }) }, compact ? "Show as cards" : "Show as a list");
    wrap.append(row, h("div", { class: "control" }, search, viewBtn,
      h("span", { class: "small" }, shown.length === list.length ? `${list.length} in total` : `${shown.length} of ${list.length} shown`)));
    return wrap;
  }

  function compactList(collection, shown, state, val) {
    const cols = collection === "feeds" ? ["Feed", "From", "Part", "Fed"] : collection === "animals" ? ["Group", "Herd", "Head", "Day (h)"] : ["Plot", "Area", "Use", "Grows"];
    const t = h("table", { class: "grid" }, h("thead", null, h("tr", null, ...cols.map((c) => h("th", null, c)), h("th", null, ""))));
    const tb = h("tbody");
    for (const e of shown) {
      const d = D.decorate(e, TYPE[collection], state);
      const errs = val.errors.filter((x) => x.screen === collection && x.entityId === e.id).length;
      const cells = collection === "feeds"
        ? [h("td", null, d._feedItem ? D.displayFeedName(d._feedItem.feed_item_name) : "New feed", errs ? h("span", { class: "chip", style: "margin-left:6px;color:var(--danger);border-color:var(--danger)" }, `${errs} to fix`) : null),
           h("td", null, { grown: (state.plots.find((p) => p.id === e.feed_plot) || {}).plot_name || "grown here", bought: "bought", collected: ICL.t("collected {offfarm}") }[e.feed_origin] || "—"),
           h("td", null, e.feed_part === "residue" ? "residue" : "main"),
           h("td", null, e.feed_origin === "grown" ? (e.main_fed_share != null ? e.main_fed_share + "%" : "—") : "—")]
        : collection === "animals"
          ? [h("td", null, D.livetypeLabel(d._desc), errs ? h("span", { class: "chip", style: "margin-left:6px;color:var(--danger);border-color:var(--danger)" }, `${errs} to fix`) : null),
             h("td", null, (state.herds.find((x) => x.id === e.herd_ref) || {}).herd_name || "—"),
             h("td", null, e.herd_n != null ? ICL.fmt(e.herd_n, 0) : "—"),
             h("td", null, `${d.hours_stable || 0}/${d.hours_pen || 0}/${d.hours_onfarm || 0}/${d.hours_offfarm || 0}`)]
          : [h("td", null, e.plot_name || "New plot", errs ? h("span", { class: "chip", style: "margin-left:6px;color:var(--danger);border-color:var(--danger)" }, `${errs} to fix`) : null),
             h("td", null, e.plot_area_ha != null ? ICL.fmt(e.plot_area_ha, 2) + " ha" : "—"),
             h("td", null, { crops: "Feed or crops", grazing: "Grazing", both: "Crops and grazing" }[e.plot_use] || "—"),
             h("td", null, state.feeds.filter((f) => f.feed_plot === e.id).length + " feeds")];
      tb.append(h("tr", null, ...cells, h("td", null, h("a", { class: "btn-sm", href: ICL.router.hashFor(collection, e.id) }, "Edit"))));
    }
    t.append(tb);
    return h("div", { class: "tablewrap card", dataset: { fb: collection + ":list", fbLabel: ICL.common.entityNoun(collection) + " list" } }, t);
  }

  function card(collection, e, state, val, expanded) {
    const etype = TYPE[collection]; const dec = D.decorate(e, etype, state);
    const errs = val.errors.filter((x) => x.screen === collection && x.entityId === e.id);
    const title = ICL.layout.entityLabel(collection, e, state);
    const head = h("div", { class: "card-head" }, h("h2", null, title, errs.length ? h("span", { class: "chip", style: "margin-left:8px;color:var(--danger);border-color:var(--danger)" }, `${errs.length} to fix`) : null),
      h("div", { class: "actions" }, expanded ? h("a", { class: "btn-sm", href: ICL.router.hashFor(collection) }, "Done") : h("a", { class: "btn-sm", href: ICL.router.hashFor(collection, e.id) }, "Edit"), confirmButton("Remove", () => { removeEntity(collection, e.id); ICL.toast(`Removed "${title}".`); ICL.router.go(collection); }, "btn-sm")));
    const wrap = h("div", { class: "card", dataset: { fb: `${etype}:${e.id}`, fbLabel: `${etype} card: ${title}` } }, head);
    if (!expanded) { wrap.append(summary(collection, dec, state)); return wrap; }
    const ctx = entityCtx(state, val, collection, e, etype);
    const touched = Object.keys(state.provenance).some((p) => p.startsWith(`${collection}[${e.id}]`)) || state.ui.validateAll;
    if (!touched) { ctx.errors = []; ctx.warnings = []; wrap.append(h("p", { class: "small" }, "Fill in what you know; we will point out anything missing on Check & run.")); }
    if (collection === "animals") wrap.append(animalCard(dec, ctx, state));
    else if (collection === "herds") wrap.append(herdCard(dec, ctx, state, val));
    else if (collection === "feeds") wrap.append(feedCard(dec, ctx, state));
    else if (collection === "seasons") wrap.append(seasonCard(dec, ctx, state));
    else wrap.append(ICL.fields.renderFields(collection, ctx));
    return wrap;
  }

  function summary(collection, e, state) {
    const dl = h("dl", { class: "kv" }); const add = (k, v) => { if (v != null && v !== "") dl.append(h("dt", null, k), h("dd", null, v)); };
    if (collection === "plots") { add("Area", e.plot_area_ha ? ICL.fmt(e.plot_area_ha, 2) + " ha" : "not given"); add("Use", { crops: "Feed or crops", grazing: "Grazing", both: "Crops and grazing" }[e.plot_use]); add("Slope", e.slope_class ? e.slope_class.split(" (")[0] : null); add("Grown here", state.feeds.filter((f) => f.feed_plot === e.id).map((f) => { const d = D.decorate(f, "feed", state); return d._feedItem ? D.displayFeedName(d._feedItem.feed_item_name) : "?"; }).join(", ") || "nothing yet"); }
    if (collection === "seasons") { const m = e.season_months || []; add("Months", m.length ? m.map((x) => ICL.MONTHS[x - 1]).join(" ") : "none"); add("Days", m.reduce((d, x) => d + ICL.MONTH_DAYS[x - 1], 0)); }
    if (collection === "herds") { const p = window.ICL_SCHEMA.herdPatterns.find((x) => x.value === e.herd_pattern); add("Pattern", p ? ICL.t(p.label) : "not set"); add("Groups", state.animals.filter((a) => a.herd_ref === e.id).length); add("Animals", ICL.fmt(state.animals.filter((a) => a.herd_ref === e.id).reduce((t, a) => t + (Number(a.herd_n) || 0), 0), 0)); }
    if (collection === "animals") { add("Herd", (state.herds.find((x) => x.id === e.herd_ref) || {}).herd_name); const milk = D.effective(D.field("milk_l_day"), e, state).value; if (e._milking && milk != null) add("Milk", `${milk} L/day`); if (e._young) add("Growth", (e.growth_kg_yr ?? "?") + " kg/yr"); const W = ICL.dict.words(); add("Day", `${e.hours_stable || 0} h shed · ${e.hours_pen || 0} h pen · ${e.hours_onfarm || 0} h ${W.onfarm} · ${e.hours_offfarm || 0} h ${W.offfarm}`); }
    if (collection === "feeds") { add("From", { grown: `grown on ${ICL.dict.words().plot} ` + ((state.plots.find((p) => p.id === e.feed_plot) || {}).plot_name || "?"), bought: "bought", collected: ICL.t("collected {offfarm}") }[e.feed_origin] || "not set"); if (e.feed_origin === "grown") add("Part fed", e.feed_part === "residue" ? "residue" : "main product"); if (e._feedItem) add("Quality", `DM ${e._feedItem.dm_content}% · ME ${e._feedItem.me_content} MJ/kg · CP ${e._feedItem.cp_content}%`); }
    return dl;
  }

  // ---- add flows -------------------------------------------------------------
  function addFlow(collection, state) {
    const etype = TYPE[collection];
    const box = h("div", { class: "card", dataset: { fb: `add:${etype}`, fbLabel: `Add ${etype}` } }, h("h2", null, "Add " + etype));
    if (collection === "animals") {
      if (!state.herds.length) { box.append(h("p", null, "First add a herd, so we know where these animals live."), h("a", { class: "btn", href: "#herds-new" }, "Add a herd")); return box; }
      box.append(h("p", { class: "small" }, "Pick the species, then the group. The description tells you which group fits."));
      box.append(groupPicker(state, null));
      return box;
    }
    if (collection === "feeds") {
      const search = h("input", { type: "text", placeholder: "Search feeds…", "aria-label": "Search feeds" });
      const listBox = h("div", { class: "pickerlist" });
      const syn = D.tables().feedSynonyms || {};
      const render = () => { listBox.innerHTML = ""; const q = search.value.toLowerCase().trim(); const items = D.vocab().feeditems.filter((fi) => D.displayFeedName(fi.feed_item_name).toLowerCase().includes(q) || (syn[fi.feed_item_code] || []).some((x) => x.toLowerCase().includes(q))); const byCat = {}; for (const fi of items) { const crop = D.cropOf(fi.crop_code); const cat = crop ? crop.category : "other"; (byCat[cat] = byCat[cat] || []).push(fi); }
        for (const [cat, fis] of Object.entries(byCat)) { listBox.append(h("div", { class: "grp" }, { grass: "Grasses & fodder", legume: "Legumes", cereal: "Cereals & residues", "tree crop": "Tree crops" }[cat] || cat)); for (const fi of fis) listBox.append(h("button", { type: "button", title: (syn[fi.feed_item_code] || []).join(", "), onclick: () => { const id = addEntity("feeds", { feed_item: fi.feed_item_code, feed_origin: state.system.growsFeed ? "grown" : "bought", feed_plot: state.plots[0] ? state.plots[0].id : null }); ICL.store.set((s) => { s.provenance[`feeds[${id}].feed_origin`] = "default"; if (state.plots[0]) s.provenance[`feeds[${id}].feed_plot`] = "default"; return s; }); ICL.router.go("feeds", id); } }, h("strong", null, (syn[fi.feed_item_code] || [])[0] ? `${syn[fi.feed_item_code][0]} · ` : "", D.displayFeedName(fi.feed_item_name)), h("span", { class: "small" }, `DM ${fi.dm_content}% · ME ${fi.me_content} · CP ${fi.cp_content}%`))); }
        if (!items.length) listBox.append(h("div", { class: "grp" }, "Nothing matches. In the real app you could request a feed to be added to the parameter set.")); };
      search.addEventListener("input", render); render();
      box.append(h("p", { class: "small" }, `Feeds come from the parameter set "${state.meta.param_set}". `, h("a", { href: "#parameters" }, "See the full list")), search, listBox);
      return box;
    }
    // plots, seasons, herds: create immediately and open the card
    const seed = collection === "herds" ? { herd_pattern: "night_shed" } : collection === "seasons" ? { season_months: [] } : { plot_use: "crops" };
    const id = addEntity(collection, seed); setTimeout(() => ICL.router.go(collection, id), 0);
    return box;
  }

  // ---- specialised cards --------------------------------------------------------
  /** Species chips + group list. `herdId` null = ask which herd; otherwise add straight into that herd. */
  function groupPicker(state, herdId) {
    const frag = document.createDocumentFragment();
    const species = [...new Set(D.vocab().livetype.map((l) => l.species))].filter((sp) => (state.system.species || ["Cattle"]).includes(sp) || sp === "Cattle");
    let sp = species[0];
    const groupsBox = h("div", { class: "pickerlist" });
    const herdSel = herdId ? null : h("select", { "aria-label": "Herd" }, ...state.herds.map((hd) => h("option", { value: hd.id }, hd.herd_name || "Herd")));
    const renderGroups = () => {
      groupsBox.innerHTML = "";
      for (const lt of D.vocab().livetype.filter((l) => l.species === sp)) {
        const lab = D.tables().livetypeLabels[lt.desc] || { label: lt.desc.split(" - ")[1] };
        groupsBox.append(h("button", { type: "button", onclick: () => { const id = addEntity("animals", { livetype: lt.code, herd_ref: herdId || herdSel.value }); ICL.router.go("animals", id); } },
          h("strong", null, lab.label), h("span", { class: "small" }, `\u2248 ${lt.body_weight} kg \u00b7 `, lab.definition || "")));
      }
    };
    const chips = h("div", { class: "chips" });
    for (const one of species) { const r = h("input", { type: "radio", name: "sp" + (herdId || "") }); r.checked = one === sp; r.addEventListener("change", () => { sp = one; renderGroups(); }); chips.append(h("label", null, r, one)); }
    renderGroups();
    if (herdSel) frag.append(h("div", { class: "field" }, h("div", { class: "field-label" }, "Herd"), herdSel));
    frag.append(h("div", { class: "field" }, h("div", { class: "field-label" }, "Species"), chips),
      h("div", { class: "field" }, h("div", { class: "field-label" }, "Group"), groupsBox));
    return frag;
  }

  /** Herd card: the herd's own answers, its manure handling, and the animal groups inside it. */
  function herdCard(e, ctx, state, val) {
    const frag = document.createDocumentFragment();
    frag.append(ICL.fields.renderFields("herds", ctx, (f) => f.group !== "Manure in this herd"));
    const groups = state.animals.filter((a) => a.herd_ref === e.id);
    const head = groups.reduce((t, a) => t + (Number(a.herd_n) || 0), 0);
    const fs = h("fieldset", { dataset: { fb: `herd:groups:${e.id}`, fbLabel: "Animal groups in this herd" } },
      h("legend", null, "Animal groups in this herd"),
      h("p", { class: "small" }, "A group is one category of animal \u2014 milking cows, heifers, calves \u2014 because each eats and produces differently. Numbers, weights, milk and the day are on the group."));
    if (!groups.length) fs.append(h("div", { class: "empty" }, "No groups yet. Add the first one, for example the milking cows."));
    else {
      const tbl = h("table", { class: "grid" }, h("thead", null, h("tr", null, h("th", null, "Group"), h("th", null, "Head"), h("th", null, "A normal day (h)"), h("th", null, ""))));
      const tb = h("tbody");
      for (const a of groups) {
        const d = D.decorate(a, "animal", state);
        const errs = val.errors.filter((x) => x.screen === "animals" && x.entityId === a.id).length;
        tb.append(h("tr", null,
          h("td", null, D.livetypeLabel(d._desc), a.group_name ? h("div", { class: "small" }, a.group_name) : null, errs ? h("span", { class: "chip", style: "color:var(--danger);border-color:var(--danger)" }, `${errs} to fix`) : null),
          h("td", null, a.herd_n ?? "\u2014"),
          h("td", null, `${d.hours_stable || 0} / ${d.hours_pen || 0} / ${d.hours_onfarm || 0} / ${d.hours_offfarm || 0}`),
          h("td", null, h("a", { class: "btn-sm", href: ICL.router.hashFor("animals", a.id) }, "Edit"))));
      }
      tbl.append(tb);
      fs.append(h("div", { class: "tablewrap" }, tbl), h("p", { class: "small" }, `${groups.length} group${groups.length === 1 ? "" : "s"} \u00b7 ${ICL.fmt(head, 0)} animals. Hours are shed / pen / grazing ${ICL.dict.words().onfarm} / grazing ${ICL.dict.words().offfarm}.`));
    }
    const adding = state.ui.addGroupTo === e.id;
    fs.append(adding
      ? h("div", { class: "card soft" }, h("div", { class: "card-head" }, h("h3", null, "Add a group to " + (e.herd_name || "this herd")), h("button", { type: "button", class: "btn-sm", onclick: () => ICL.store.update("ui.addGroupTo", null) }, "Cancel")), groupPicker(state, e.id))
      : h("button", { type: "button", class: "btn secondary", onclick: () => ICL.store.update("ui.addGroupTo", e.id) }, "+ Add an animal group"));
    frag.append(fs);
    frag.append(ICL.fields.renderFields("herds", ctx, (f) => f.group === "Manure in this herd"));
    if (groups.length) frag.append(h("p", { class: "small" }, "Manure handling applies to every group in this herd. A group that is handled differently can override it on its own card."));
    else frag.append(h("p", { class: "small" }, "Add a group first: which manure questions apply depends on where the animals spend their day."));
    return frag;
  }

  function animalCard(e, ctx, state) {
    const frag = document.createDocumentFragment();
    frag.append(ICL.fields.renderFields("animals", ctx, (f) => ["Group", "Numbers", "Weights", "Milk", "Growth", "Work"].includes(f.group)));
    if (e.group_name) frag.append(h("div", { class: "callout" }, `The model will see "${e.group_name}" as `, h("strong", null, e._desc), ` (a CLEANED-flexible mapping row is added to the output).`));
    // time budget
    const hoursMode = (state.ui.variant.V2 || "A") === "A";
    const hk = ["hours_stable", "hours_pen", "hours_onfarm", "hours_offfarm"]; const W = ICL.dict.words(); const labels = ["In a roofed shed", "In an open pen or boma", "Grazing " + W.onfarm, "Grazing " + W.offfarm];
    const vals = hk.map((k) => Number(e[k]) || 0); const tot = vals.reduce((a, b) => a + b, 0);
    const fs = h("fieldset", { dataset: { fb: `field:hours:${e.id}`, fbLabel: "A normal day (time budget)" } }, h("legend", null, "A normal day"), h("p", { class: "small" }, hoursMode ? "Where does this group spend a normal 24 hours? Hours per day." : "Share of the day in each place, adding to 100%."));
    const grid = h("div", { class: "hours" });
    hk.forEach((k, i) => { const inp = h("input", { type: "text", inputmode: "decimal", value: hoursMode ? (e[k] ?? "") : (e[k] != null ? Math.round(e[k] / 24 * 100) : ""), "aria-label": labels[i] }); inp.addEventListener("change", () => { const p = ICL.parseNumber(inp.value); const v = p.value == null || Number.isNaN(p.value) ? null : hoursMode ? p.value : p.value / 100 * 24; ctx.onChange(k, v, v == null ? null : "user"); }); grid.append(h("label", null, h("span", null, labels[i], h("span", { class: "unit" }, hoursMode ? " (hours)" : " (%)")), inp)); });
    const bar = h("div", { class: "bar", "aria-hidden": "true" }); vals.forEach((v, i) => bar.append(h("span", { class: "b" + i, style: `width:${tot ? v / tot * 100 : 0}%`, title: labels[i] + ": " + v + " h" })));
    const ok = Math.abs(tot - 24) < 0.01;
    fs.append(grid, bar, h("div", { class: "total " + (ok ? "ok" : "bad") }, hoursMode ? `${fmt(tot)} of 24 hours placed ${ok ? "✓" : tot < 24 ? `— add ${fmt(24 - tot)} more` : `— remove ${fmt(tot - 24)}`}` : `${fmt(tot / 24 * 100)}% of the day ${ok ? "✓" : ""}`), ICL.fields.provChip(state.provenance[`animals[${e.id}].hours_stable`] || (e.hours_stable != null ? "default" : "blank"), D.field("hours_stable")));
    frag.append(fs);
    const manureMode = (state.ui.variant.V5 || "A");
    if (manureMode === "B") frag.append(h("div", { class: "callout" }, "Variant B would show the full IPCC list of 28 manure systems with definitions here. Shown as the plain-language version for now."));
    const herd = state.herds.find((x) => x.id === e.herd_ref);
    const mf = ["hmanure_stable", "hmanure_pen", "hmanure_onfarm", "hmanure_offfarm"].filter((id) => {
      const hf = D.field(id); const hd = herd ? D.decorate(herd, "herd", state) : null;
      return hd && ICL.cond.visible(hf, { system: state.system, farm: state.farm, ui: state.ui, entity: hd });
    });
    const inherited = h("div", { class: "callout", dataset: { fb: `animal:manure:${e.id}`, fbLabel: "Manure inherited from the herd" } },
      h("strong", null, "Manure: "),
      herd
        ? [`handled as set for the herd `, h("a", { href: ICL.router.hashFor("herds", herd.id) }, herd.herd_name || "this herd"), ". ",
           h("div", { class: "small" }, mf.map((id) => { const hf = D.field(id); const v = D.effective(hf, D.decorate(herd, "herd", state), state, `herds[${herd.id}]`).value || hf.default; const opt = window.ICL_SCHEMA.manureOptions.find((o) => o.value === (v || {}).handling); return `${ICL.t(hf.label)}: ${opt ? ICL.t(opt.label) : "not set"}${hf.noCollect ? "" : ` (${(v || {}).collected ?? 0}% collected)`}`; }).join(" \u00b7 ") || "nothing to handle: this group is never in a shed, pen or paddock you control."),
           h("div", { class: "small" }, `Of the collected manure, ${D.effective(D.field("hmanure_kept_share"), D.decorate(herd, "herd", state), state, `herds[${herd.id}]`).value ?? 100}% stays ${ICL.dict.words().onfarm}.`)]
        : "no herd set for this group.");
    frag.append(inherited);
    frag.append(ICL.fields.renderFields("animals", ctx, (f) => ["Manure for this group only", "Collected manure"].includes(f.group)));
    frag.append(ICL.fields.renderFields("animals", ctx, (f) => f.group === "Values from the parameter set"));
    frag.append(h("p", { class: "small" }, "Values marked \"from database\" come from the parameter set ", h("a", { href: "#parameters" }, state.meta.param_set), ". Overriding here changes this scenario only; edit the parameter set to change every scenario."));
    return frag;
  }

  function feedCard(e, ctx, state) {
    const frag = document.createDocumentFragment();
    if (e._feedItem) frag.append(h("div", { class: "callout" }, h("strong", null, D.displayFeedName(e._feedItem.feed_item_name)), ` · dry matter ${e._feedItem.dm_content}% · energy ${e._feedItem.me_content} MJ/kg DM · protein ${e._feedItem.cp_content}% `, h("span", { class: "chip c-db" }, "from database"), e._crop ? h("div", { class: "small" }, `Crop: ${e._crop.crop_name} (${e._crop.category}) · typical yield ${e._crop.dry_yield} t DM/ha, residue ${e._crop.residue_dry_yield} t DM/ha`) : null));
    if (e.feed_origin === "grown" && !state.plots.length) frag.append(h("div", { class: "callout warn" }, ICL.t("This feed is grown on the {farm} but no {plot}s exist yet. "), h("a", { href: "#plots-new" }, ICL.t("Add a {plot}"))));
    frag.append(ICL.fields.renderFields("feeds", ctx, (f) => f.id !== "feed_item" && f.group !== "Nutritional parameters"));
    frag.append(nutritionFolder(e, ctx, state));
    return frag;
  }

  /** Feed quality: shown read-only in a folder, unlockable for this scenario or in the parameter set. */
  function nutritionFolder(e, ctx, state) {
    const unlocked = state.ui.unlockFeed === e.id;
    const fields = D.fieldsFor("feeds").filter((f) => f.group === "Nutritional parameters");
    const box = h("details", { class: "advanced", open: unlocked || undefined, dataset: { fb: `feed:nutrition:${e.id}`, fbLabel: "Nutritional parameters folder" } },
      h("summary", null, "Nutritional parameters ", unlocked ? h("span", { class: "chip c-user" }, "\u270e unlocked") : h("span", { class: "chip c-db" }, "\ud83d\udd12 from the parameter set")));
    box.append(h("p", { class: "small" }, `Feed quality and nitrogen content for ${e._feedItem ? D.displayFeedName(e._feedItem.feed_item_name) : "this feed"}, from "${state.meta.param_set}". The model is sensitive to these, so they are locked until you choose where the change should apply.`));
    if (!unlocked) {
      const t = h("table", { class: "grid" }, h("thead", null, h("tr", null, h("th", null, "Value"), h("th", null, "Now"), h("th", null, "Where it comes from"))));
      const tb = h("tbody");
      for (const f of fields) {
        if (!ICL.cond.visible(f, { system: state.system, farm: state.farm, ui: state.ui, entity: e })) continue;
        const eff = D.effective(f, e, state, `feeds[${e.id}]`);
        tb.append(h("tr", null,
          h("td", null, ICL.t(f.label), f.unit ? h("span", { class: "unit" }, " " + f.unit) : null),
          h("td", null, eff.value == null ? "\u2014" : ICL.fmt(eff.value, 2)),
          h("td", null, ICL.fields.provChip(eff.prov, f))));
      }
      t.append(tb);
      box.append(h("div", { class: "tablewrap" }, t));
    } else {
      box.append(ICL.fields.renderFields("feeds", ctx, (f) => f.group === "Nutritional parameters"));
      box.append(h("p", { class: "small" }, "These values now apply to ", h("strong", null, "this scenario only"), ". The parameter set is untouched, and the chip on each value shows the change."));
    }
    const fi = e._feedItem;
    box.append(h("div", { class: "control" },
      h("button", { type: "button", class: unlocked ? "btn-sm" : "btn secondary", onclick: () => ICL.store.update("ui.unlockFeed", unlocked ? null : e.id) },
        unlocked ? "Lock again" : "Unlock for this scenario only"),
      fi ? h("button", { type: "button", class: "btn-sm", onclick: () => { ICL.store.set((s) => { s.ui.paramTab = "Feeds & crops"; s.ui.paramRow = { table: "feeditems", key: String(fi.feed_item_code) }; s.ui.paramUnlocked = true; return s; }); ICL.router.go("parameters"); } }, "Edit in the parameter set") : null,
      e._crop ? h("button", { type: "button", class: "btn-sm", onclick: () => { ICL.store.set((s) => { s.ui.paramTab = "Feeds & crops"; s.ui.paramRow = { table: "crops", key: String(e._crop.crop_code) }; s.ui.paramUnlocked = true; return s; }); ICL.router.go("parameters"); } }, `Edit the crop row (${e._crop.crop_name})`) : null));
    box.append(h("p", { class: "small" }, "Scenario only \u2192 this feed in this scenario. Parameter set \u2192 every scenario of yours that uses the set, and anyone you share the set with; it needs your own copy of the set, and each change is listed so colleagues can see what differs."));
    return box;
  }

  function seasonCard(e, ctx, state) {
    const frag = document.createDocumentFragment();
    frag.append(ICL.fields.renderField(D.field("season_name"), ctx));
    // month strip with other seasons greyed
    const taken = new Map(); state.seasons.forEach((s, i) => { if (s.id !== e.id) for (const m of s.season_months || []) taken.set(m, i); });
    const cur = e.season_months || [];
    const wrap = h("div", { class: "field", dataset: { fb: `field:season_months:${e.id}`, fbLabel: "Months in this season" } }, h("div", { class: "field-label" }, h("label", null, "Months in this season"), h("span", { class: "unit" }, "(tap to add or remove)")));
    const g = h("div", { class: "months" });
    ICL.MONTHS.forEach((m, i) => { const on = cur.includes(i + 1); const other = taken.has(i + 1); const b = h("button", { type: "button", class: other && !on ? "other" : "", "aria-pressed": String(on), title: other ? "In " + (state.seasons[taken.get(i + 1)].season_name || "another season") : "" }, m); b.addEventListener("click", () => { if (other && !on) { ICL.store.set((s) => { for (const ss of s.seasons) if (ss.id !== e.id) ss.season_months = (ss.season_months || []).filter((x) => x !== i + 1); const me = s.seasons.find((ss) => ss.id === e.id); me.season_months = [...(me.season_months || []), i + 1].sort((a, b) => a - b); return s; }); } else ctx.onChange("season_months", on ? cur.filter((x) => x !== i + 1) : [...cur, i + 1].sort((a, b) => a - b), "user"); }); g.append(b); });
    const days = cur.reduce((d, x) => d + ICL.MONTH_DAYS[x - 1], 0);
    wrap.append(g, h("div", { class: "small" }, (cur.length ? `${cur.map((x) => ICL.MONTHS[x - 1]).join(", ")} · ${days} days. ` : "No months yet. ") + "Grey months belong to another season; tapping one moves it here."));
    frag.append(wrap);
    return frag;
  }

  function seasonsOverview(state, val) {
    const strip = h("div", { class: "months", role: "img", "aria-label": "Year overview" });
    const owner = new Map(); state.seasons.forEach((s, i) => (s.season_months || []).forEach((m) => owner.set(m, i)));
    ICL.MONTHS.forEach((m, i) => strip.append(h("button", { type: "button", class: owner.has(i + 1) ? "s" + (owner.get(i + 1) % 4) : "", disabled: true }, m)));
    const days = state.seasons.reduce((t, s) => t + (s.season_months || []).reduce((d, m) => d + ICL.MONTH_DAYS[m - 1], 0), 0);
    const err = val.errors.find((e) => e.screen === "seasons" && e.fieldId === "season_months" && !e.entityId);
    return h("div", { class: "card soft", dataset: { fb: "seasons:overview", fbLabel: "Year overview" } }, h("h2", null, "The year"), strip, h("div", { class: "total " + (days === 365 ? "ok" : "bad") }, `${days} of 365 days in a season ${days === 365 ? "✓" : ""}`), err ? h("div", { class: "msg err" }, err.msg) : null);
  }
  function seasonTemplates(state) {
    const hasPlan = Object.keys(state.allocation || {}).length > 0;
    const apply = (defs) => { ICL.store.set((s) => { s.seasons = defs.map((d) => ({ id: ICL.uid("s"), season_name: d[0], season_months: d[1] })); s.allocation = {}; return s; }); ICL.toast(hasPlan ? "Seasons replaced. The feeding plan was cleared; enter it again for the new seasons." : "Seasons set."); };
    const tpl = (label, defs) => hasPlan ? confirmButton(label, () => apply(defs), "btn-sm") : h("button", { type: "button", class: "btn-sm", onclick: () => apply(defs) }, label);
    return h("div", { class: "control" }, h("span", { class: "small" }, "Templates:", hasPlan ? " (replacing seasons clears the feeding plan)" : ""),
      tpl("One season", [["All year", [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]]]),
      tpl("Rainy / dry (southern)", [["Rainy season", [11, 12, 1, 2, 3, 4]], ["Dry season", [5, 6, 7, 8, 9, 10]]]),
      tpl("Long rains / dry / short rains", [["Long rains", [3, 4, 5, 6]], ["Dry season", [7, 8, 9, 10]], ["Short rains", [11, 12, 1, 2]]]));
  }
  function animalsTable(state, val) {
    const tbl = h("table", { class: "grid" }, h("thead", null, h("tr", null, h("th", null, "Group"), h("th", null, "Herd"), h("th", null, "Head"), h("th", null, "Weight kg"), h("th", null, "Milk L/day"), h("th", null, "Shed / pen / graze / off h"), h("th", null, ""))));
    const tb = h("tbody"); for (const a of state.animals) { const d = D.decorate(a, "animal", state); tb.append(h("tr", null, h("td", null, D.livetypeLabel(d._desc)), h("td", null, (state.herds.find((x) => x.id === a.herd_ref) || {}).herd_name || ""), h("td", null, a.herd_n ?? "—"), h("td", null, D.effective(D.field("body_weight"), d, state).value ?? "—"), h("td", null, d._milking ? (a.milk_l_day ?? "—") : "n/a"), h("td", null, `${d.hours_stable}/${d.hours_pen}/${d.hours_onfarm}/${d.hours_offfarm}`), h("td", null, h("a", { class: "btn-sm", href: ICL.router.hashFor("animals", a.id) }, "Edit")))); }
    tbl.append(tb);
    return h("div", { class: "card", dataset: { fb: "animals:table", fbLabel: "Animals compact table (variant B)" } }, h("div", { class: "tablewrap" }, tbl), h("a", { class: "btn secondary", href: "#animals-new", style: "margin-top:10px" }, "+ Add a group"));
  }

  for (const c of Object.keys(TYPE)) ICL.screens[c] = entityScreen(c);
})(window.ICL);
