/* Field renderer: dictionary entry → labelled control with help, unit, provenance chip, validation message. */
(function (ICL) {
  const { h, fmt } = ICL; const D = ICL.dict, C = ICL.cond;
  const PROV_LABEL = { user: "you entered", default: "assumed", db: "from database", derived: "calculated", blank: "not entered", map: "from maps" };

  const PARAM_TAB = { animal: "Animal types", feed: "Feeds & crops", farm: "Soils & slopes", plot: "Land cover" };
  function provChip(prov, f, onReset, opts) {
    const fromDb = f.default_source && f.default_source.startsWith("db:");
    const cls = prov === "blank" ? "blank" : prov === "default" && fromDb ? "db" : prov;
    const label = prov === "default" && f.default_source === "map" ? "from maps" : prov === "default" && fromDb ? "from database" : PROV_LABEL[prov] || prov;
    const wrap = h("span", { class: "chipwrap" });
    const chip = h("button", { type: "button", class: "chip c-" + cls + " chip-menu", "aria-haspopup": "menu", "aria-expanded": "false", title: (f.default_source ? "Source: " + f.default_source + ". " : "") + "How is this value set?" }, (cls === "db" ? "🗄 " : prov === "user" ? "✎ " : prov === "default" ? "≈ " : "○ ") + label, h("span", { "aria-hidden": "true" }, " ▾"));
    const menu = h("div", { class: "prov-menu", role: "menu", hidden: true });
    const item = (txt, fn, note) => h("button", { type: "button", role: "menuitem", onclick: () => { menu.hidden = true; chip.setAttribute("aria-expanded", "false"); fn(); } }, h("span", null, txt), note ? h("small", null, note) : null);
    const focusInput = () => { const box = wrap.closest(".field, fieldset") || wrap.parentElement; const inp = box && box.querySelector("input:not([type=radio]):not([type=checkbox]), select, textarea, input"); if (inp) { inp.focus(); inp.select && inp.select(); } };
    if (prov !== "user") menu.append(item("Enter my own value", focusInput, "for this scenario only"));
    if (opts && opts.onKeep) menu.append(item("Looks right — keep it", opts.onKeep, "confirms the value as yours"));
    if (prov === "user" && onReset && (f.default !== undefined || f.default_source)) menu.append(item(fromDb ? "Use the value from the parameter set" : f.default_source === "map" ? "Use the value from maps" : "Use the default", onReset, "removes your override"));
    if (prov === "user" && onReset && !(f.default !== undefined || f.default_source)) menu.append(item("Clear the value", onReset, "leave it blank"));
    if (fromDb) menu.append(item("Change it in the parameter set", () => { ICL.store.update("ui.paramTab", PARAM_TAB[f.entity] || "Animal types"); ICL.router.go("parameters"); }, "affects every scenario that uses it"));
    menu.append(h("div", { class: "prov-legend" }, h("span", { class: "chip c-user" }, "✎ you entered"), h("span", { class: "chip c-db" }, "🗄 from database"), h("span", { class: "chip c-default" }, "≈ assumed / maps"), h("span", { class: "chip c-fixed" }, "🔒 fixed")));
    chip.addEventListener("click", () => { const open = menu.hidden; document.querySelectorAll(".prov-menu").forEach((m) => (m.hidden = true)); menu.hidden = !open; chip.setAttribute("aria-expanded", String(open)); });
    menu.addEventListener("keydown", (e) => { if (e.key === "Escape") { menu.hidden = true; chip.focus(); } });
    wrap.append(chip, menu);
    return wrap;
  }

  function helpButton(f, popId) {
    if (!f.definition && !f.help) return null;
    const btn = h("button", { type: "button", class: "help-btn", "aria-label": "About " + f.label, "aria-expanded": "false", "aria-controls": popId }, "?");
    btn.addEventListener("click", () => { const pop = document.getElementById(popId); const open = btn.getAttribute("aria-expanded") === "true"; btn.setAttribute("aria-expanded", String(!open)); pop.hidden = open; });
    return btn;
  }

  /** ctx: {state, entity(decorated), entityId, collection, onChange(fieldId, value, prov), errors:[], warnings:[], variant} */
  function renderField(f0, ctx) {
    const f = Object.assign({}, f0, { label: ICL.t(f0.label), definition: ICL.t(f0.definition), help: ICL.t(f0.help) });
    const { state, entity, onChange } = ctx;
    const predCtx = { system: state.system, farm: state.farm, ui: state.ui, entity };
    if (!C.visible(f, predCtx)) return null;
    const req = C.required(f, predCtx);
    const pathPrefix = ctx.collection ? `${ctx.collection}[${ctx.entityId}]` : f.entity === "meta" ? "meta" : "farm";
    const eff = D.effective(f, entity, state, pathPrefix);
    const raw = entity ? entity[f.id] : undefined;
    const isBlank = raw === undefined || raw === null || raw === "";
    const err = (ctx.errors || []).find((e) => e.fieldId === f.id && (e.entityId == null || e.entityId === ctx.entityId));
    const warn = (ctx.warnings || []).find((e) => e.fieldId === f.id && (e.entityId == null || e.entityId === ctx.entityId));
    const inputId = `f_${f.id}_${ctx.entityId || "x"}`, popId = inputId + "_help";
    const fbId = `field:${f.id}${ctx.entityId ? ":" + ctx.entityId : ""}`;
    const wrap = h("div", { class: "field" + (err ? " has-error" : ""), dataset: { fb: fbId, fbLabel: f.label, fieldId: f.id } });
    const labelRow = h("div", { class: "field-label" },
      h("label", { for: inputId }, f.label), f.unit ? h("span", { class: "unit" }, `(${f.unit})`) : null,
      req ? h("span", { class: "req", "aria-hidden": "true" }, "· needed") : (f.na_policy === "not_applicable" || !req ? h("span", { class: "unit" }, "· optional") : null),
      helpButton(f, popId));
    wrap.append(labelRow);
    if (f.definition || f.help) wrap.append(h("div", { id: popId, class: "help-pop", hidden: true }, f.definition ? h("div", null, f.definition) : null, f.help ? h("div", { class: "small" }, f.help) : null));
    if (f.technical) wrap.append(h("div", { class: "tech" }, "Technical name: " + f.technical));
    const control = h("div", { class: "control" }); let controlAppended = false;
    const setVal = (v, prov = "user") => onChange(f.id, v, prov);
    const reset = () => setVal(null, null);
    const numberInput = (attrs) => {
      const inp = h("input", Object.assign({ type: "text", inputmode: "decimal", id: inputId, value: isBlank ? "" : raw, placeholder: eff.value != null && isBlank ? String(fmt(eff.value, 2)) : (f.typical ? `${f.typical[0]}–${f.typical[1]}` : ""), autocomplete: "off" }, attrs));
      inp.addEventListener("change", () => {
        const p = ICL.parseNumber(inp.value);
        if (p.value === null) { setVal(null, null); return; }
        if (Number.isNaN(p.value)) { msgSlot.textContent = "Please enter a number."; msgSlot.className = "msg err"; return; }
        if (p.normalised) { ICL.toast(`Read "${inp.value}" as ${p.value} (decimal point).`); inp.value = String(p.value); }
        setVal(p.value, "user");
      });
      return inp;
    };
    const msgSlot = h("div", { class: "msg" });
    switch (f.type) {
      case "text": { const inp = h("input", { type: "text", id: inputId, value: raw || "" }); inp.addEventListener("change", () => setVal(inp.value.trim() || null, inp.value.trim() ? "user" : null)); control.append(inp); break; }
      case "number": case "integer": case "percent": control.append(numberInput(f.type === "integer" ? { inputmode: "numeric" } : {})); break;
      case "yesno": { const g = h("div", { class: "radios inline", role: "radiogroup", "aria-labelledby": inputId });
        for (const [v, l] of [[true, "Yes"], [false, "No"]]) { const r = h("input", { type: "radio", name: inputId, value: String(v) }); r.checked = eff.value === v; r.addEventListener("change", () => setVal(v)); g.append(h("label", { class: "radio" }, r, h("span", null, l))); }
        control.append(g); break; }
      case "radio": case "select": case "derived": {
        const opts = D.options(f, state, entity).filter((o) => !o.visible_if || C.evaluate(o.visible_if, predCtx));
        if (f.type === "radio" && opts.length <= 6) {
          const g = h("div", { class: "radios" + (opts.every((o) => !o.definition) ? " inline" : ""), role: "radiogroup" });
          for (const o of opts) { const r = h("input", { type: "radio", name: inputId, value: String(o.value) }); r.checked = eff.value === o.value; r.addEventListener("change", () => setVal(o.value)); g.append(h("label", { class: "radio" }, r, h("span", null, ICL.t(o.label), o.definition ? h("span", { class: "def" }, ICL.t(o.definition)) : null))); }
          control.append(g);
        } else {
          const derivedVal = f.type === "derived" && f.id === "region" ? (ICL.regionForCountry((entity.location_point || {}).country) || null) : eff.value;
          const sel = h("select", { id: inputId, disabled: f.type === "derived" }); sel.append(h("option", { value: "" }, f.type === "derived" ? (derivedVal ? derivedVal + " — calculated from the country" : "— set when a country is chosen") : "Choose…"));
          for (const o of opts) { const op = h("option", { value: String(o.value) }, o.label); if (String(eff.value) === String(o.value)) op.selected = true; sel.append(op); }
          sel.addEventListener("change", () => setVal(sel.value === "" ? null : (opts.find((o) => String(o.value) === sel.value) || {}).value ?? sel.value, sel.value === "" ? null : "user"));
          control.append(sel);
          const cur = opts.find((o) => String(o.value) === String(eff.value)); if (cur && cur.definition) wrap.append(h("div", { class: "selected-def" }, cur.definition));
        }
        break; }
      case "multiselect": {
        const opts = D.options(f, state, entity); const g = h("div", { class: "chips" }); const cur = Array.isArray(raw) ? raw : [];
        for (const o of opts) { const c = h("input", { type: "checkbox", value: String(o.value) }); c.checked = cur.includes(o.value); c.addEventListener("change", () => setVal(c.checked ? [...cur, o.value] : cur.filter((x) => x !== o.value))); g.append(h("label", null, c, o.label)); }
        if (!opts.length) g.append(h("span", { class: "muted" }, "No plots yet: add them under Land & plots."));
        control.append(g); break; }
      case "month_set": {
        const cur = Array.isArray(eff.value) ? eff.value : []; const g = h("div", { class: "months", role: "group", "aria-labelledby": inputId });
        ICL.MONTHS.forEach((m, i) => { const on = cur.includes(i + 1); const b = h("button", { type: "button", "aria-pressed": String(on) }, m); b.addEventListener("click", () => setVal(on ? cur.filter((x) => x !== i + 1) : [...cur, i + 1].sort((a, b) => a - b))); g.append(b); });
        control.append(g); wrap.append(h("div", { class: "small" }, cur.length ? `${cur.length} month${cur.length > 1 ? "s" : ""}` : "Tap the months")); break; }
      case "triple_pct": {
        const cur = raw || {}; const g = h("div", { class: "triple" }); const keys = ["fed", "left", "burnt"];
        keys.forEach((k, i) => { const inp = h("input", { type: "text", inputmode: "decimal", value: cur[k] ?? "", "aria-label": f.parts[i] }); inp.addEventListener("change", () => { const p = ICL.parseNumber(inp.value); setVal(Object.assign({}, cur, { [k]: p.value === null || Number.isNaN(p.value) ? null : p.value })); }); g.append(h("label", null, h("span", null, f.parts[i]), inp)); });
        const s = keys.reduce((t, k) => t + (Number(cur[k]) || 0), 0);
        control.append(g); wrap.append(h("div", { class: "total " + (Math.abs(s - 100) < 0.5 ? "ok" : "bad") }, `Total ${fmt(s)}% ${Math.abs(s - 100) < 0.5 ? "✓" : "(should be 100)"}`)); break; }
      case "quantity_n": {
        const cur = raw || {}; const units = Object.keys(f.units);
        const qty = h("input", { type: "text", inputmode: "decimal", value: cur.qty ?? "", "aria-label": "Quantity", placeholder: "0" });
        const unit = h("select", { "aria-label": "Unit" }); units.forEach((u) => unit.append(h("option", { value: u, selected: (cur.unit || units[0]) === u }, u)));
        const npct = h("input", { type: "text", inputmode: "decimal", value: cur.n_pct ?? "", placeholder: String(f.n_pct_default), "aria-label": "Nitrogen content %", style: "max-width:80px" });
        const upd = () => { const q = ICL.parseNumber(qty.value).value; const n = ICL.parseNumber(npct.value).value; setVal(q == null ? null : { qty: q, unit: unit.value, n_pct: n == null || Number.isNaN(n) ? null : n }); };
        [qty, unit, npct].forEach((el) => el.addEventListener("change", upd));
        const kgN = cur.qty != null ? Number(cur.qty) * (f.units[cur.unit || units[0]] || 1) * ((cur.n_pct != null && cur.n_pct !== "" ? Number(cur.n_pct) : f.n_pct_default) / 100) : null;
        control.append(qty, unit, h("span", { class: "small" }, "containing"), npct, h("span", { class: "small" }, "% nitrogen"));
        wrap.append(h("div", { class: "small" }, kgN != null ? `≈ ${fmt(kgN, 1)} kg of nitrogen per year` : `Leave blank if none. Typical N content: ${f.n_pct_default}%.`)); break; }
      case "manure": {
        const cur = eff.value || f.default; const S = window.ICL_SCHEMA; const g = h("div", { class: "radios" });
        for (const o of S.manureOptions) { const r = h("input", { type: "radio", name: inputId, value: o.value }); r.checked = cur.handling === o.value; r.addEventListener("change", () => setVal(Object.assign({}, cur, { handling: o.value, followups: {} }))); g.append(h("label", { class: "radio" }, r, h("span", null, o.label, h("span", { class: "def" }, o.definition)))); }
        control.append(g); wrap.append(control); controlAppended = true;
        const opt = S.manureOptions.find((o) => o.value === cur.handling);
        if (opt && opt.followups) for (const fu of opt.followups) {
          const cv = (cur.followups || {})[fu.id];
          if (fu.type === "select") { const sel = h("select", { "aria-label": fu.label }); sel.append(h("option", { value: "" }, "Choose…")); fu.options.forEach((o) => sel.append(h("option", { value: o.value, selected: cv === o.value }, o.label))); sel.addEventListener("change", () => setVal(Object.assign({}, cur, { followups: Object.assign({}, cur.followups, { [fu.id]: sel.value || undefined }) }))); wrap.append(h("div", { class: "field" }, h("div", { class: "field-label" }, h("label", null, fu.label)), sel)); }
          else { const gg = h("div", { class: "radios inline" }); for (const [v, l] of [[true, "Yes"], [false, "No"]]) { const r = h("input", { type: "radio", name: inputId + fu.id }); r.checked = cv === v; r.addEventListener("change", () => setVal(Object.assign({}, cur, { followups: Object.assign({}, cur.followups, { [fu.id]: v }) }))); gg.append(h("label", { class: "radio" }, r, h("span", null, l))); } wrap.append(h("div", { class: "field" }, h("div", { class: "field-label" }, h("label", null, fu.label)), gg)); }
        }
        if (!f.noCollect) {
          const rng = h("input", { type: "range", min: 0, max: 100, step: 5, value: cur.collected ?? 0, "aria-label": "Share collected" }); const outp = h("output", null, `${cur.collected ?? 0}%`);
          rng.addEventListener("input", () => (outp.value = rng.value + "%")); rng.addEventListener("change", () => setVal(Object.assign({}, cur, { collected: Number(rng.value) })));
          wrap.append(h("div", { class: "field" }, h("div", { class: "field-label" }, h("label", null, "How much of it is collected?")), h("div", { class: "slider-row" }, h("span", { class: "small" }, "None"), rng, h("span", { class: "small" }, "All"), outp)));
        }
        wrap.append(h("div", { class: "tech" }, "→ " + ICL.ipccManure(cur)));
        break; }
      case "fert_rates": {
        const cur = raw || {}; const names = D.vocab().fertilizer_names; const tbl = h("table", { class: "grid" }, h("thead", null, h("tr", null, h("th", null, "Product"), h("th", null, "Amount"), h("th", null, "Per"))));
        const tb = h("tbody"); const plot = state.plots.find((p) => p.id === entity.feed_plot); const area = plot ? Number(plot.plot_area_ha) || null : null;
        for (const n of names) { const c = cur[n] || {}; const inp = h("input", { type: "text", inputmode: "decimal", value: c.value ?? "", "aria-label": n + " amount" }); const mode = h("select", { "aria-label": n + " unit" }, h("option", { value: "kg_ha", selected: (c.mode || "kg_ha") === "kg_ha" }, "kg per ha"), h("option", { value: "kg_plot", selected: c.mode === "kg_plot" }, area ? `kg on this plot (${area} ha)` : "kg on this plot"), h("option", { value: "bags_plot", selected: c.mode === "bags_plot" }, "50-kg bags on this plot"));
          const upd = () => { const v = ICL.parseNumber(inp.value).value; const next = Object.assign({}, cur); if (v == null || Number.isNaN(v)) delete next[n]; else next[n] = { mode: mode.value, value: v }; setVal(Object.keys(next).length ? next : null); };
          inp.addEventListener("change", upd); mode.addEventListener("change", upd); tb.append(h("tr", null, h("td", null, n), h("td", null, inp), h("td", null, mode))); }
        tbl.append(tb); control.append(h("div", { class: "tablewrap" }, tbl)); break; }
      case "rice": {
        const cur = raw || {}; const T = D.tables().riceOptions;
        for (const [k, label] of [["ecosystem_type", "Rice ecosystem"], ["water_regime", "Water before the season"], ["organic_amendment", "Organic material added"]]) {
          const sel = h("select", { "aria-label": label }); sel.append(h("option", { value: "" }, "Choose…")); T[k].forEach((o) => sel.append(h("option", { value: o, selected: cur[k] === o }, o))); sel.addEventListener("change", () => setVal(Object.assign({}, cur, { [k]: sel.value || undefined })));
          wrap.append(h("div", { class: "field" }, h("div", { class: "field-label" }, h("label", null, label)), sel));
        }
        const cp = h("input", { type: "text", inputmode: "numeric", value: cur.cultivation_period ?? "", "aria-label": "Days the field is flooded" }); cp.addEventListener("change", () => setVal(Object.assign({}, cur, { cultivation_period: ICL.parseNumber(cp.value).value })));
        wrap.append(h("div", { class: "field" }, h("div", { class: "field-label" }, h("label", null, "Days the field is under cultivation"), h("span", { class: "unit" }, "(days)")), cp)); break; }
      case "livetype": {
        const lt = D.livetypeOf(entity && entity.livetype); const lab = lt ? (D.tables().livetypeLabels[lt.desc] || { label: lt.desc.split(" - ")[1] }) : null;
        control.append(h("div", { class: "callout", style: "margin:0;flex:1" }, lt ? [h("strong", null, lab.label), h("div", { class: "small" }, lab.definition || "", ` Typical weight ${lt.body_weight} kg.`), h("div", { class: "tech" }, lt.desc)] : "No group chosen"), h("a", { class: "btn-sm", href: ICL.router.hashFor("animals", "new") }, "Change group"));
        break; }
      case "feed": {
        const fi = entity && entity._feedItem;
        control.append(h("div", { class: "callout", style: "margin:0;flex:1" }, fi ? [h("strong", null, D.displayFeedName(fi.feed_item_name)), h("div", { class: "small" }, `Dry matter ${fi.dm_content}% · energy ${fi.me_content} MJ/kg DM · protein ${fi.cp_content}% DM`)] : "No feed chosen"), h("a", { class: "btn-sm", href: ICL.router.hashFor("feeds", "new") }, "Change feed"));
        break; }
      case "location": break;
      default: control.append(h("span", { class: "muted" }, `[${f.type}]`));
    }
    if (control.childNodes.length && !controlAppended) wrap.append(control);
    if (!["manure", "rice", "fert_rates", "triple_pct", "quantity_n", "text", "month_set", "livetype", "feed", "location"].includes(f.type) || (f.type === "month_set" && f.default_source)) {
      if (!(f.type === "text")) wrap.append(provChip(eff.prov, f, reset, { onKeep: eff.prov === "default" && eff.value != null ? () => setVal(eff.value, "user") : null, hasDefault: !!(f.default !== undefined || f.default_source) }));
    }
    if (err) { msgSlot.textContent = err.msg; msgSlot.className = "msg err"; } else if (warn) { msgSlot.textContent = warn.msg; msgSlot.className = "msg warn"; }
    wrap.append(msgSlot);
    return wrap;
  }

  /** Render all fields of a section for an entity, grouped by `group`, advanced ones inside <details>. */
  function renderFields(sectionId, ctx, filter) {
    const fields = D.fieldsFor(sectionId).filter((f) => !filter || filter(f));
    const groups = new Map();
    for (const f of fields) { const k = (f.advanced ? "adv:" : "") + (f.group || ""); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(f); }
    const out = document.createDocumentFragment();
    for (const [k, fs] of groups) {
      const rendered = fs.map((f) => renderField(f, ctx)).filter(Boolean);
      if (!rendered.length) continue;
      if (k.startsWith("adv:")) { out.append(h("details", { class: "advanced" }, h("summary", null, `${k.slice(4) || "More details"} — usually fine as filled`), ...rendered)); }
      else if (k) { out.append(h("fieldset", null, h("legend", null, ICL.t(k)), ...rendered)); }
      else rendered.forEach((r) => out.append(r));
    }
    return out;
  }
  ICL.fields = { renderField, renderFields, provChip };
})(window.ICL);
