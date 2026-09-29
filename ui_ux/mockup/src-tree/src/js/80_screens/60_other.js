/* Fertiliser products, inputs bought in, losses, feeding plan, check & run, results, parameters. */
(function (ICL) {
  const { h, fmt } = ICL; const D = ICL.dict; const { screenHead, variantVote, farmCtx, errorList } = ICL.common;

  ICL.screens.fertiliser = function (root, { state, val }) {
    root.append(screenHead(D.section("fertiliser")));
    const used = new Set(); for (const f of state.feeds) for (const [n, r] of Object.entries(f.fert_rates || {})) if (r && Number(r.value) > 0) used.add(n);
    if (!used.size) { root.append(h("div", { class: "empty" }, "No fertiliser is applied to any crop yet. Add amounts on the feed cards under Feeds; the products you use will appear here.")); return; }
    const f = D.field("fert_n_pct");
    for (const name of used) {
      const ctx = { state, entity: { id: name, fert_n_pct: state.fertilizer[name] }, entityId: name, collection: null, errors: val.errors.map((e) => e.entityId === "NPK" && name === "NPK" ? Object.assign({}, e, { fieldId: "fert_n_pct" }) : e), warnings: [], onChange: (fid, v, prov) => ICL.store.update("fertilizer." + name, v, prov) };
      const fld = ICL.fields.renderField(Object.assign({}, f, { label: `${name}: nitrogen % on the bag` }), ctx);
      root.append(h("div", { class: "card", dataset: { fb: "fert:" + name, fbLabel: "Fertiliser " + name } }, fld));
    }
  };

  ICL.screens.inputs = function (root, { state, val }) {
    root.append(screenHead(D.section("inputs")));
    root.append(h("div", { class: "callout" }, "Enter what you know: the amount of material and its unit. We convert it to nitrogen using a typical content, which you can change."));
    root.append(ICL.fields.renderFields("inputs", farmCtx(state, val)));
  };

  ICL.screens.losses = function (root, { state, val }) {
    root.append(screenHead(D.section("losses")));
    root.append(h("div", { class: "callout" }, "Optional. These only adjust the reported milk and meat that reach consumers; they do not change emissions, land or water."));
    root.append(ICL.fields.renderFields("losses", farmCtx(state, val), (f) => f.group === "Milk" || ["meat", "both"].includes(state.system.aim)));
  };

  // ---- feeding plan -----------------------------------------------------------
  ICL.screens.feeding = function (root, { state, val }) {
    root.append(screenHead(D.section("feeding")));
    root.append(variantVote("V3", state));
    if (!state.seasons.length || !state.animals.length || !state.feeds.length) { root.append(h("div", { class: "empty" }, "You need at least one season, one animal group and one feed before planning the diet.", h("div", { class: "control", style: "justify-content:center;margin-top:8px" }, !state.seasons.length ? h("a", { class: "btn-sm", href: "#seasons" }, "Seasons") : null, !state.animals.length ? h("a", { class: "btn-sm", href: "#animals" }, "Animals") : null, !state.feeds.length ? h("a", { class: "btn-sm", href: "#feeds" }, "Feeds") : null))); return; }
    const sid = state.seasons.some((s) => s.id === state.ui.feedingSeason) ? state.ui.feedingSeason : state.seasons[0].id;
    const season = state.seasons.find((s) => s.id === sid); const si = state.seasons.indexOf(season);
    const tabs = h("div", { class: "tabs", role: "tablist" }); for (const s of state.seasons) { const errs = val.errors.filter((e) => e.screen === "feeding" && e.entityId === s.id).length; tabs.append(h("button", { type: "button", role: "tab", "aria-selected": String(s.id === sid), onclick: () => ICL.store.update("ui.feedingSeason", s.id) }, s.season_name || "Season", errs ? h("span", { class: "badge", style: "margin-left:6px" }, errs) : null)); }
    root.append(tabs);
    const herdFilter = state.herds.length > 1 ? h("select", { "aria-label": "Herd", onchange: (ev) => ICL.store.update("ui.feedingHerd", ev.target.value || null) }, h("option", { value: "" }, "All herds"), ...state.herds.map((hd) => h("option", { value: hd.id, selected: state.ui.feedingHerd === hd.id }, hd.herd_name))) : null;
    const animals = state.animals.filter((a) => !state.ui.feedingHerd || a.herd_ref === state.ui.feedingHerd);
    const dm = !!state.ui.dmMode;
    const modeBtn = h("button", { type: "button", class: "btn-sm", "aria-pressed": String(dm), onclick: () => ICL.store.update("ui.dmMode", !dm) }, dm ? "Showing: dry-matter shares" : "Showing: as-fed shares (fresh weight)");
    const tools = h("div", { class: "control", style: "margin-bottom:10px" }, herdFilter, modeBtn, h("span", { class: "small" }, dm ? "Shares of the dry matter eaten. Stored as as-fed using each feed's DM%." : "Shares of the fresh weight eaten. Toggle to enter dry-matter shares instead."),
      si > 0 ? h("button", { type: "button", class: "btn-sm", onclick: () => ICL.store.set((s) => { s.allocation[sid] = JSON.parse(JSON.stringify(s.allocation[state.seasons[si - 1].id] || {})); return s; }) }, `Copy from ${state.seasons[si - 1].season_name}`) : null,
      animals.length > 1 ? h("button", { type: "button", class: "btn-sm", onclick: () => ICL.store.set((s) => { const first = ((s.allocation[sid] || {})[animals[0].id]) || {}; s.allocation[sid] = s.allocation[sid] || {}; for (const a of animals) s.allocation[sid][a.id] = Object.assign({}, first); return s; }) }, "Same for all groups") : null,
      h("button", { type: "button", class: "btn-sm", onclick: () => ICL.store.set((s) => { delete s.allocation[sid]; return s; }) }, "Clear season"));
    root.append(tools);
    const cell = (a, f) => Number((((state.allocation[sid] || {})[a.id]) || {})[f.id]);
    const dmOf = (f) => { const d = D.decorate(f, "feed", state); return d._feedItem ? d._feedItem.dm_content / 100 : 1; };
    const shown = (a, f) => { const v = cell(a, f); if (!Number.isFinite(v)) return ""; if (!dm) return v; const tot = state.feeds.reduce((t, ff) => t + (cell(a, ff) || 0) * dmOf(ff), 0); return tot ? Math.round(v * dmOf(f) / tot * 1000) / 10 : ""; };
    const write = (a, f, v) => ICL.store.set((s) => { s.allocation[sid] = s.allocation[sid] || {}; s.allocation[sid][a.id] = s.allocation[sid][a.id] || {}; if (v == null) delete s.allocation[sid][a.id][f.id]; else if (!dm) s.allocation[sid][a.id][f.id] = v; else { /* DM entry: convert this cell to as-fed keeping others' DM shares */ const row = s.allocation[sid][a.id]; row[f.id] = v / dmOf(f); const tot = state.feeds.reduce((t, ff) => t + (Number(row[ff.id]) || 0), 0); if (tot) for (const ff of state.feeds) if (row[ff.id] != null) row[ff.id] = Math.round(row[ff.id] / tot * 1000) / 10; } return s; });
    const variant = state.ui.variant.V3 || "A";
    if (variant === "A") {
      const tbl = h("table", { class: "grid", dataset: { fb: "feeding:grid:" + sid, fbLabel: "Feeding plan grid" } }, h("thead", null, h("tr", null, h("th", null, "Feed"), ...animals.map((a) => h("th", null, D.livetypeLabel(D.decorate(a, "animal", state)._desc), h("div", { class: "small" }, `${a.herd_n || "?"} head`))))));
      const tb = h("tbody");
      for (const f of state.feeds) { const d = D.decorate(f, "feed", state); tb.append(h("tr", null, h("td", null, d._feedItem ? D.displayFeedName(d._feedItem.feed_item_name) : "?", h("div", { class: "small" }, { grown: "grown", bought: "bought", collected: "collected" }[f.feed_origin] || "")), ...animals.map((a) => { const inp = h("input", { type: "text", inputmode: "decimal", value: shown(a, f), "aria-label": `${d._feedItem ? D.displayFeedName(d._feedItem.feed_item_name) : "feed"} for ${D.livetypeLabel(D.decorate(a, "animal", state)._desc)}` }); inp.addEventListener("change", () => { const p = ICL.parseNumber(inp.value); write(a, f, p.value == null || Number.isNaN(p.value) ? null : p.value); }); return h("td", null, inp, h("span", { class: "small" }, " %")); }))); }
      tbl.append(tb);
      const tf = h("tfoot", null, h("tr", null, h("td", null, "Total"), ...animals.map((a) => { const t = state.feeds.reduce((s, f) => s + (Number(shown(a, f)) || 0), 0); const ok = Math.abs(t - 100) < 0.5; const mini = h("div", { class: "mini" }); state.feeds.forEach((f, i) => mini.append(h("span", { class: "b" + (i % 4), style: `width:${Number(shown(a, f)) || 0}%` }))); return h("td", { class: "total " + (ok ? "ok" : "bad") }, `${fmt(t)}% ${ok ? "✓" : ""}`, mini); })));
      tbl.append(tf); root.append(h("div", { class: "tablewrap card" }, tbl));
    } else {
      for (const a of animals) { const d = D.decorate(a, "animal", state); const card = h("div", { class: "card", dataset: { fb: "feeding:bars:" + a.id, fbLabel: "Feeding plan bars" } }, h("h3", null, D.livetypeLabel(d._desc))); const bar = h("div", { class: "bar" }); state.feeds.forEach((f, i) => bar.append(h("span", { class: "b" + (i % 4), style: `width:${Number(shown(a, f)) || 0}%` }))); card.append(bar); for (const [i, f] of state.feeds.entries()) { const fd = D.decorate(f, "feed", state); const rng = h("input", { type: "range", min: 0, max: 100, step: 1, value: Number(shown(a, f)) || 0, "aria-label": fd._feedItem ? D.displayFeedName(fd._feedItem.feed_item_name) : "feed" }); const out = h("output", null, (Number(shown(a, f)) || 0) + "%"); rng.addEventListener("input", () => (out.value = rng.value + "%")); rng.addEventListener("change", () => write(a, f, Number(rng.value))); card.append(h("div", { class: "slider-row" }, h("span", { class: "b" + (i % 4), style: "width:10px;height:10px;display:inline-block;border-radius:2px" }), h("span", { style: "min-width:160px" }, fd._feedItem ? D.displayFeedName(fd._feedItem.feed_item_name) : "?"), rng, out)); } const t = state.feeds.reduce((s, f) => s + (Number(shown(a, f)) || 0), 0); card.append(h("div", { class: "total " + (Math.abs(t - 100) < 0.5 ? "ok" : "bad") }, `Total ${fmt(t)}%`)); root.append(card); }
    }
    root.append(h("p", { class: "small" }, "Each column must add up to 100% for every season. A feed that is never fed anywhere will be flagged on the Check screen."));
  };

  // ---- check & run ---------------------------------------------------------------
  ICL.screens.check = function (root, { state, val, compiled }) {
    root.append(screenHead(D.section("check")));
    const blocking = val.errors;
    root.append(h("div", { class: "tile-row" }, tile(blocking.length, "to fix", blocking.length ? "var(--danger)" : "var(--success)"), tile(val.warnings.length, "to double-check", "var(--warn)"), tile(val.assumptions.length, "assumed values", "var(--prov-default)"), tile(state.animals.reduce((s, a) => s + (Number(a.herd_n) || 0), 0), "animals"), tile(state.feeds.length, "feeds"), tile(state.plots.length, "plots")));
    root.append(h("div", { class: "card", dataset: { fb: "check:blocking", fbLabel: "Blocking list" } }, h("h2", null, blocking.length ? `Fix these ${blocking.length} things before running` : "Nothing is blocking ✓"), errorList(blocking, "err") || h("p", { class: "small" }, "Every needed value is present and within range.")));
    if (val.warnings.length) root.append(h("div", { class: "card", dataset: { fb: "check:warnings", fbLabel: "Warnings list" } }, h("h2", null, "Worth a second look"), errorList(val.warnings, "warn")));
    const byScreen = {}; for (const a of val.assumptions) (byScreen[a.screen] = byScreen[a.screen] || []).push(a);
    const acard = h("div", { class: "card", dataset: { fb: "check:assumptions", fbLabel: "Assumptions list" } }, h("h2", null, `We assumed ${val.assumptions.length} value${val.assumptions.length === 1 ? "" : "s"}`), h("p", { class: "small" }, "These are filled from maps, the parameter set or typical practice. Change any of them if you know better; otherwise the model runs with them and the results say so."));
    for (const [sc, items] of Object.entries(byScreen)) acard.append(h("h3", { style: "margin-top:10px" }, D.section(sc).title), errorList(items.map((a) => Object.assign({}, a)), "warn"));
    root.append(acard);
    if (val.fromDb.length) { const det = h("details", { class: "advanced", dataset: { fb: "check:fromdb", fbLabel: "Values from the parameter set" } }, h("summary", null, `${val.fromDb.length} values come from the parameter set "${state.meta.param_set}" (not counted as assumptions)`)); det.append(errorList(val.fromDb, ""), h("p", { class: "small" }, "Override any of them on the animal or feed card if you have measurements, or ", h("a", { href: "#parameters" }, "edit the parameter set"), ".")); root.append(det); }
    const run = h("button", { type: "button", class: "btn", disabled: blocking.length > 0, onclick: () => { ICL.toast("Mockup: the model does not run here. In the real app this would take a few seconds."); ICL.router.go("results"); } }, blocking.length ? `Run (fix ${blocking.length} first)` : `Run with ${val.assumptions.length} assumption${val.assumptions.length === 1 ? "" : "s"}`);
    root.append(h("div", { class: "card soft", dataset: { fb: "check:run", fbLabel: "Run button" } }, h("div", { class: "control" }, run, h("button", { type: "button", class: "btn secondary", onclick: () => ICL.store.update("ui.previewOpen", true) }, "Show what the model receives"), h("span", { class: "small" }, `${compiled.blocked.length} model field${compiled.blocked.length === 1 ? "" : "s"} still empty`))));
  };
  const tile = (n, l, color) => h("div", { class: "tile" }, h("b", { style: color ? `color:${color}` : "" }, String(n)), h("span", { class: "small" }, l));

  ICL.screens.results = function (root, { state }) {
    root.append(screenHead(D.section("results")));
    const tabs = h("div", { class: "tabs" }); for (const t of ["Emissions", "Land", "Water", "Soil", "Nitrogen", "Compare"]) tabs.append(h("button", { type: "button", role: "tab", "aria-selected": String(t === "Emissions") }, t));
    root.append(tabs, h("div", { class: "empty", dataset: { fb: "results:placeholder", fbLabel: "Results placeholder" } }, h("p", null, "Results will appear here after running: per-hectare and per-kg-milk indicators, each with a one-line meaning, the assumptions that fed it, and a link back to the inputs that drive it."), h("p", { class: "small" }, "Out of scope for this mockup. Tell us in a comment what you would want to see first.")));
  };

  // ---- parameter set -----------------------------------------------------------
  const TABLES = {
    "Animal types": { table: "livetype", cols: [["desc", "Group", "text"], ["body_weight", "Weight kg"], ["adult_weight", "Adult kg"], ["fat_milkcontent", "Milk fat %"], ["protein_milkcontent", "Milk protein %"], ["birth_interval", "Calving interval yr"], ["n_manure_content", "Manure N kg/kg"], ["ipcc_meth_man_category", "IPCC manure class", "locked"]], note: "Starting values for each animal group. Body weights can also be overridden per group on its card." },
    "Feeds & crops": { table: "feeditems", cols: [["feed_item_name", "Feed", "text"], ["dm_content", "DM %"], ["me_content", "ME MJ/kg DM"], ["cp_content", "CP % DM"]], second: { table: "crops", cols: [["crop_name", "Crop", "text"], ["category", "Type", "locked"], ["dry_yield", "Yield t DM/ha"], ["residue_dry_yield", "Residue t DM/ha"], ["main_n", "N in product"], ["residue_n", "N in residue"]] }, note: "Feed quality and typical crop yields for this region." },
    "Soils & slopes": { table: "soil", cols: [["desc", "Soil", "text"], ["k", "Erodibility K"]], second: { table: "slope", cols: [["desc", "Slope class", "locked"], ["p", "P factor"]] }, note: "USLE erosion factors. Slope classes are fixed because the model matches them by name." },
    "Land cover": { table: "landcover", cols: [["desc", "Cover", "text"], ["c", "C factor (lower = more protected)"]] },
    "Fertilisers": { table: "fertilizer_default_n_pct", cols: [["name", "Product", "text"], ["n", "Default N %"]], note: "Default nitrogen content; the bag value entered in a scenario always wins." },
  };
  ICL.screens.parameters = function (root, { state }) {
    root.append(screenHead(D.section("parameters")));
    const V = D.vocab(), RAW = D.rawVocab(); const T = D.tables();
    const copy = D.activeCopy(); const shipped = T.paramSets.find((p) => p.value === state.meta.param_set) || (copy ? T.paramSets.find((p) => p.value === copy.base) : T.paramSets[0]);
    const nChanges = copy ? D.changeCount(copy) : 0;
    // header
    const switcher = h("select", { "aria-label": "Switch parameter set", onchange: (ev) => ICL.store.update("meta.param_set", ev.target.value) }, ...D.options(D.field("param_set"), state).map((o) => h("option", { value: o.value, selected: o.value === state.meta.param_set }, o.label)));
    const head = h("div", { class: "card soft", dataset: { fb: "params:head", fbLabel: "Parameter set header" } },
      h("div", { class: "card-head" }, h("h2", null, copy ? `${copy.label} · my copy` : shipped.label), h("div", { class: "actions" }, switcher)),
      copy
        ? h("p", { class: "small" }, `Your editable copy of "${shipped.label}". ${nChanges ? `${nChanges} value${nChanges === 1 ? "" : "s"} changed` : "No changes yet"}. Every scenario that uses this copy gets these values as its defaults. `, copy.shared ? h("span", { class: "chip c-derived" }, "shared with project") : h("span", { class: "chip c-blank" }, "private"))
        : h("p", { class: "small" }, h("span", { class: "lock" }, "🔒 "), `Shipped by ${shipped.owner} for ${shipped.countries.join(", ")}. Read-only so results stay comparable across users. To change a value: override it on a scenario card (that scenario only), or make your own copy of the set (all your scenarios that use the copy).`),
      h("div", { class: "control" },
        copy ? h("button", { type: "button", class: "btn-sm", onclick: () => ICL.store.set((s) => { const c = s.paramSets.copies.find((x) => x.value === copy.value); c.shared = !c.shared; return s; }) }, copy.shared ? "Stop sharing" : "Share with project") : h("button", { type: "button", class: "btn", onclick: () => makeCopy(shipped) }, "Make my own copy"),
        copy && nChanges ? ICL.common.confirmButton("Discard all changes", () => ICL.store.set((s) => { s.paramSets.copies.find((x) => x.value === copy.value).changes = {}; return s; }), "btn-sm") : null,
        copy ? h("button", { type: "button", class: "btn-sm", onclick: () => ICL.store.update("meta.param_set", copy.base) }, "Use the shipped set instead") : null,
        h("button", { type: "button", class: "btn-sm", onclick: () => ICL.store.update("ui.paramTab", "Propose a change") }, "Propose a change to the maintainers")));
    root.append(head);
    // legend of value states
    root.append(h("div", { class: "card", dataset: { fb: "params:legend", fbLabel: "Value states legend" } }, h("h2", null, "How values are set"), h("div", { class: "states" },
      h("div", { class: "st" }, h("strong", null, h("span", { class: "chip c-user" }, "✎ you entered")), "Your number for this scenario. Overrides everything below. Reset from the chip menu."),
      h("div", { class: "st" }, h("strong", null, h("span", { class: "chip c-db" }, "🗄 from database")), "An editable default from the parameter set. Change it here (all scenarios using the set) or override it on the card (one scenario)."),
      h("div", { class: "st" }, h("strong", null, h("span", { class: "chip c-default" }, "≈ assumed / from maps")), "Filled from the location or typical practice because you left it blank. Listed on Check & run until you confirm or change it."),
      h("div", { class: "st" }, h("strong", null, h("span", { class: "chip c-fixed" }, "🔒 fixed")), "Model constants (IPCC factors, conversions). Nobody edits these in the app; propose a change to the maintainers with a source."))));
    const tabs = [...Object.keys(TABLES), "Manure systems", "Land-use factors", "Fixed constants", copy ? `Changes (${nChanges})` : null, "Propose a change"].filter(Boolean);
    let cur = state.ui.paramTab || tabs[0]; if (!tabs.includes(cur) && !cur.startsWith("Changes")) cur = tabs[0]; if (cur.startsWith("Changes") && copy) cur = `Changes (${nChanges})`;
    const tb = h("div", { class: "tabs", role: "tablist" }); for (const t of tabs) tb.append(h("button", { type: "button", role: "tab", "aria-selected": String(t === cur), onclick: () => ICL.store.update("ui.paramTab", t) }, t)); root.append(tb);

    const editable = !!copy;
    const cell = (tableName, row, key, col, type) => {
      const rowKey = String(row[key]); const ch = copy && copy.changes && copy.changes[tableName] && copy.changes[tableName][rowKey] && copy.changes[tableName][rowKey][col];
      const raw = RAW[tableName] && Array.isArray(RAW[tableName]) ? (RAW[tableName].find((r) => String(r[key]) === rowKey) || {})[col] : (tableName === "fertilizer_default_n_pct" ? RAW.fertilizer_default_n_pct[rowKey] : undefined);
      if (type === "text") return h("td", null, String(row[col] ?? ""));
      if (type === "locked" || !editable) return h("td", { class: type === "locked" ? "cell-locked" : "" }, type === "locked" ? h("span", { title: "Matched by name inside the model; cannot be edited" }, "🔒 " + String(row[col] ?? "")) : String(row[col] ?? ""));
      const inp = h("input", { type: "text", inputmode: "decimal", value: row[col] ?? "", "aria-label": `${row[key]} ${col}` });
      inp.addEventListener("change", () => { const p = ICL.parseNumber(inp.value); if (p.value == null || Number.isNaN(p.value)) return; setChange(copy.value, tableName, rowKey, col, raw, p.value); });
      const td = h("td", { class: "cell-edit" + (ch ? " cell-changed" : "") }, inp);
      if (ch) td.append(h("span", { class: "was" }, `was ${raw}`, h("button", { type: "button", onclick: () => revert(copy.value, tableName, rowKey, col) }, "revert")));
      return td;
    };
    const table = (spec) => {
      const rows = spec.table === "fertilizer_default_n_pct" ? Object.keys(RAW.fertilizer_default_n_pct).map((n) => ({ name: n, n: V.fertilizer_default_n_pct[n] })) : V[spec.table];
      const key = spec.table === "fertilizer_default_n_pct" ? "name" : D.TABLE_KEY[spec.table];
      const t = h("table", { class: "grid" }, h("thead", null, h("tr", null, ...spec.cols.map((c) => h("th", null, c[1])))));
      const body = h("tbody"); for (const r of rows) body.append(h("tr", null, ...spec.cols.map((c) => cell(spec.table, r, key, c[0], c[2])))); t.append(body);
      return h("div", { class: "tablewrap card", dataset: { fb: "params:" + spec.table, fbLabel: "Parameter table " + spec.table } }, t);
    };
    if (TABLES[cur]) { const spec = TABLES[cur]; if (spec.note) root.append(h("p", { class: "small" }, spec.note, editable ? " Edit a cell and press Enter; changed cells are highlighted and can be reverted." : " Make your own copy to edit.")); root.append(table(spec)); if (spec.second) root.append(table(spec.second)); }
    if (cur === "Manure systems") root.append(h("p", { class: "small" }, "The plain-language choices on the Animals screen map to these IPCC systems. The mapping is fixed; the factors behind each system are under Fixed constants."), h("div", { class: "tablewrap card" }, h("table", { class: "grid" }, h("thead", null, h("tr", null, h("th", null, "You see"), h("th", null, "Model uses"), h("th", null, "Meaning"))), h("tbody", null, ...window.ICL_SCHEMA.manureOptions.map((o) => h("tr", null, h("td", null, o.label), h("td", { class: "cell-locked" }, "🔒 " + o.ipcc), h("td", null, o.definition)))))));
    if (cur === "Land-use factors") root.append(h("p", { class: "small" }, "IPCC stock-change labels the model recognises. Derived from your climate and plot answers; the labels themselves are fixed."), ...Object.entries(V.stock_change).map(([k, arr]) => h("div", { class: "card" }, h("h3", null, k), h("div", { class: "small" }, arr.join(" · ")))));
    if (cur === "Fixed constants") {
      const C = RAW.constants || {};
      root.append(h("div", { class: "callout" }, "🔒 These come from IPCC 2019 tables shipped inside the model. They are the same for every user and cannot be edited in the app. If you believe one is wrong or outdated, use ", h("a", { href: "#parameters", onclick: () => ICL.store.update("ui.paramTab", "Propose a change") }, "Propose a change"), " with a source."));
      const gen = (title, rows, source) => { if (!rows || !rows.length) return null; const cols = Object.keys(rows[0]); return h("div", { class: "tablewrap card", dataset: { fb: "params:fixed:" + title, fbLabel: "Fixed constants " + title } }, h("h3", null, title, " ", h("span", { class: "chip c-fixed" }, "🔒 fixed")), h("div", { class: "small" }, source), h("table", { class: "grid" }, h("thead", null, h("tr", null, ...cols.map((c) => h("th", null, c.replace(/_/g, " "))))), h("tbody", null, ...rows.map((r) => h("tr", null, ...cols.map((c) => h("td", { class: "cell-locked" }, typeof r[c] === "object" && r[c] ? Object.entries(r[c]).map(([k, v]) => `${k}: ${v}`).join(" · ") : String(r[c] ?? "")))))))); };
      root.append(gen("Enteric methane conversion factor Ym", C.ym_table_10_12, "IPCC 2019 Table 10.12"), gen("Manure methane conversion factors (MCF) by climate", C.mcf_table_10_17, "IPCC 2019 Table 10.17"), gen("Direct N2O emission factors for manure systems (EF3)", C.ef3_table_10_21, "IPCC 2019 Table 10.21"), gen("Maximum methane producing capacity Bo", C.bo_table_10_16, "IPCC 2019 Table 10.16 / 10A.9"), gen("Conversions used by the app", C.other, "Fixed in the app and the model"));
    }
    if (cur.startsWith("Changes") && copy) {
      const list = []; for (const [tbl, rows] of Object.entries(copy.changes || {})) for (const [rk, cols] of Object.entries(rows)) for (const [col, c] of Object.entries(cols)) list.push({ tbl, rk, col, ...c });
      const card = h("div", { class: "card", dataset: { fb: "params:changes", fbLabel: "Changes list" } }, h("h2", null, list.length ? `${list.length} change${list.length === 1 ? "" : "s"} in this copy` : "No changes yet"));
      if (list.length) card.append(h("div", { class: "tablewrap" }, h("table", { class: "grid" }, h("thead", null, h("tr", null, h("th", null, "Table"), h("th", null, "Row"), h("th", null, "Value"), h("th", null, "Was"), h("th", null, "Now"), h("th", null, "When"), h("th", null, ""))), h("tbody", null, ...list.map((c) => h("tr", null, h("td", null, c.tbl), h("td", null, rowLabel(c.tbl, c.rk)), h("td", null, c.col), h("td", null, String(c.from)), h("td", null, h("strong", null, String(c.to))), h("td", { class: "small" }, (c.at || "").slice(0, 16).replace("T", " ")), h("td", null, h("button", { type: "button", class: "btn-sm", onclick: () => revert(copy.value, c.tbl, c.rk, c.col) }, "Revert"))))))));
      card.append(h("p", { class: "small" }, "Changes are tracked per cell against the shipped set, so a shared copy shows colleagues exactly what differs and why."));
      root.append(card);
    }
    if (cur === "Propose a change") {
      const ta = h("textarea", { style: "width:100%;min-height:200px", readonly: true }, proposalDraft(state, copy));
      root.append(h("div", { class: "card", dataset: { fb: "params:propose", fbLabel: "Propose a change form" } }, h("h2", null, "Propose a change to the maintainers"), h("p", { class: "small" }, "Fixed constants and shipped sets change only through the maintainers. This drafts a 'Data or parameter issue' in the format of the CIAT/cleaned GitHub form; add your source and send it."), ta, h("div", { class: "control" }, h("button", { type: "button", class: "btn-sm", onclick: () => navigator.clipboard.writeText(ta.value).then(() => ICL.toast("Copied."), () => ta.select()) }, "Copy draft"), h("span", { class: "small" }, "Mocked: the real app would open the GitHub form prefilled."))));
    }
  };
  function rowLabel(tbl, rk) { const V = D.rawVocab(); const key = D.TABLE_KEY[tbl]; if (!key) return rk; const r = (V[tbl] || []).find((x) => String(x[key]) === rk); return r ? (r.desc || r.feed_item_name || r.crop_name || rk) : rk; }
  function makeCopy(shipped) {
    const value = shipped.value + " (my copy)";
    ICL.store.set((s) => { if (!s.paramSets.copies.find((c) => c.value === value)) s.paramSets.copies.push({ value, label: shipped.label, base: shipped.value, createdAt: new Date().toISOString(), shared: false, changes: {} }); s.meta.param_set = value; s.ui.paramTab = "Animal types"; return s; });
    ICL.toast("Copy created. Cells are now editable; the shipped set is untouched.");
  }
  function setChange(copyValue, tbl, rk, col, from, to) {
    ICL.store.set((s) => { const c = s.paramSets.copies.find((x) => x.value === copyValue); c.changes[tbl] = c.changes[tbl] || {}; c.changes[tbl][rk] = c.changes[tbl][rk] || {}; if (Number(from) === Number(to)) delete c.changes[tbl][rk][col]; else c.changes[tbl][rk][col] = { from, to, at: new Date().toISOString() }; if (!Object.keys(c.changes[tbl][rk]).length) delete c.changes[tbl][rk]; if (!Object.keys(c.changes[tbl]).length) delete c.changes[tbl]; return s; });
  }
  function revert(copyValue, tbl, rk, col) { ICL.store.set((s) => { const c = s.paramSets.copies.find((x) => x.value === copyValue); if (c.changes[tbl] && c.changes[tbl][rk]) { delete c.changes[tbl][rk][col]; if (!Object.keys(c.changes[tbl][rk]).length) delete c.changes[tbl][rk]; if (!Object.keys(c.changes[tbl]).length) delete c.changes[tbl]; } return s; }); }
  function proposalDraft(state, copy) {
    const lines = ["[Data]: <what looks wrong>", "", "Which data or parameter set? Other package data (app parameter set: " + (copy ? copy.base : state.meta.param_set) + ")", "", "Current value:", ""];
    if (copy) for (const [tbl, rows] of Object.entries(copy.changes || {})) for (const [rk, cols] of Object.entries(rows)) for (const [col, c] of Object.entries(cols)) lines.push(`- ${tbl} · ${rowLabel(tbl, rk)} · ${col}: ${c.from}`);
    if (lines.length === 6) lines.push("- <table · row · value>");
    lines.push("", "Proposed value:", ""); if (copy) for (const [tbl, rows] of Object.entries(copy.changes || {})) for (const [rk, cols] of Object.entries(rows)) for (const [col, c] of Object.entries(cols)) lines.push(`- ${tbl} · ${rowLabel(tbl, rk)} · ${col}: ${c.to}`);
    lines.push("", "Source or reference: <citation, DOI, survey>", "", "Effect on results: <which outputs change>", "", "cleaned version: <from the app footer>");
    return lines.join("\n");
  }
})(window.ICL);
