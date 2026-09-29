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
      if (selected) { root.append(card(collection, selected, state, val, true)); return; }
      // list view
      const noun = ICL.common.entityNoun(collection);
      if (collection === "seasons") root.append(seasonsOverview(state, val));
      if (collection === "animals" && (state.ui.variant.V1 || "A") === "B") { root.append(animalsTable(state, val)); }
      else if (!list.length) root.append(h("div", { class: "empty" }, emptyText(collection, state), h("div", { style: "margin-top:10px" }, h("a", { class: "btn", href: ICL.router.hashFor(collection, "new") }, "+ Add " + noun))));
      else { for (const e of list) root.append(card(collection, e, state, val, false)); root.append(h("a", { class: "btn secondary", href: ICL.router.hashFor(collection, "new") }, "+ Add another " + noun)); }
      if (collection === "seasons" && list.length) root.append(h("div", { style: "margin-top:12px" }, seasonTemplates(state)));
    };
  }
  const emptyText = (c, s) => ({ plots: `Add the first ${ICL.dict.words().plot} that grows feed or is grazed.`, seasons: "Add the first feeding period, or pick a template below.", herds: "Add a herd: animals kept together and managed the same way. One herd is enough for most enterprises.", animals: "Add the first group of animals, for example the milking cows.", feeds: "Add the first feed the animals eat, for example the grass they graze or are cut." }[c]);

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
      const species = [...new Set(D.vocab().livetype.map((l) => l.species))].filter((s) => (state.system.species || ["Cattle"]).includes(s) || s === "Cattle");
      let sp = species[0]; const groupsBox = h("div", { class: "pickerlist" });
      const herdSel = h("select", { "aria-label": "Herd" }, ...state.herds.map((hd) => h("option", { value: hd.id }, hd.herd_name || "Herd")));
      const renderGroups = () => { groupsBox.innerHTML = ""; for (const lt of D.vocab().livetype.filter((l) => l.species === sp)) { const lab = D.tables().livetypeLabels[lt.desc] || { label: lt.desc.split(" - ")[1] }; groupsBox.append(h("button", { type: "button", onclick: () => { const id = addEntity("animals", { livetype: lt.code, herd_ref: herdSel.value }); ICL.router.go("animals", id); } }, h("strong", null, lab.label), h("span", { class: "small" }, `≈ ${lt.body_weight} kg · `, lab.definition || ""))); } };
      const chips = h("div", { class: "chips" }); for (const s of species) { const r = h("input", { type: "radio", name: "sp" }); r.checked = s === sp; r.addEventListener("change", () => { sp = s; renderGroups(); }); chips.append(h("label", null, r, s)); }
      renderGroups();
      box.append(h("div", { class: "field" }, h("div", { class: "field-label" }, "Herd"), herdSel), h("div", { class: "field" }, h("div", { class: "field-label" }, "Species"), chips), h("div", { class: "field" }, h("div", { class: "field-label" }, "Group"), groupsBox));
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
    frag.append(ICL.fields.renderFields("animals", ctx, (f) => ["Manure", "Collected manure"].includes(f.group)));
    frag.append(ICL.fields.renderFields("animals", ctx, (f) => f.group === "Values from the parameter set"));
    frag.append(h("p", { class: "small" }, "Values marked \"from database\" come from the parameter set ", h("a", { href: "#parameters" }, state.meta.param_set), ". Overriding here changes this scenario only; edit the parameter set to change every scenario."));
    return frag;
  }

  function feedCard(e, ctx, state) {
    const frag = document.createDocumentFragment();
    if (e._feedItem) frag.append(h("div", { class: "callout" }, h("strong", null, D.displayFeedName(e._feedItem.feed_item_name)), ` · dry matter ${e._feedItem.dm_content}% · energy ${e._feedItem.me_content} MJ/kg DM · protein ${e._feedItem.cp_content}% `, h("span", { class: "chip c-db" }, "from database"), e._crop ? h("div", { class: "small" }, `Crop: ${e._crop.crop_name} (${e._crop.category}) · typical yield ${e._crop.dry_yield} t DM/ha, residue ${e._crop.residue_dry_yield} t DM/ha`) : null));
    if (e.feed_origin === "grown" && !state.plots.length) frag.append(h("div", { class: "callout warn" }, ICL.t("This feed is grown on the {farm} but no {plot}s exist yet. "), h("a", { href: "#plots-new" }, ICL.t("Add a {plot}"))));
    frag.append(ICL.fields.renderFields("feeds", ctx, (f) => f.id !== "feed_item"));
    return frag;
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
