/* Enterprises and their assessments.
   An enterprise is the thing that persists — a herd, a household, a national flock.
   An assessment is one description of it: dated when it is what was observed, or marked
   as a what-if when it describes a change. Tracking over time is therefore ordinary:
   another dated assessment of the same enterprise. */
(function (ICL) {
  const { h, fmt } = ICL; const D = ICL.dict; const { screenHead, confirmButton } = ICL.common;
  const SCALE_LABEL = { farm: "One enterprise", group: "Group of enterprises", region: "Region", national: "National herd" };
  const KIND = { observed: ["observed", "c-user", "what was there in that year"], what_if: ["what-if", "c-derived", "a described change, not observed"] };

  const rowsOf = (state, entId) => (state.library.assessments || []).filter((r) => r.enterprise === entId)
    .sort((a, b) => (a.as_of || 0) - (b.as_of || 0) || (a.kind === "observed" ? -1 : 1));

  ICL.screens.home = function (root, { state }) {
    root.append(screenHead(D.section("home")));
    root.append(h("div", { class: "callout", dataset: { fb: "home:what", fbLabel: "Enterprise and assessment", noNumber: "" } },
      h("strong", null, "An enterprise"), " is the thing you keep coming back to — a herd and the land that feeds it. ",
      h("strong", null, "An assessment"), " is one description of that enterprise: dated, when it records what was there that year, or marked ",
      h("em", null, "what-if"), " when it describes a change you are considering. Assess the same enterprise again next year and the two sit side by side; copy an assessment and change one thing to test it. ",
      h("a", { href: "#welcome" }, "More about iCLEANED"), " · ", h("a", { href: "#why" }, "Why iCLEANED and how it compares")));

    const tab = state.ui.homeTab || "mine";
    const ents = state.library.enterprises || [];
    const isTemplate = (e) => rowsOf(state, e.id).some((r) => r.template);
    const bucket = (e) => isTemplate(e) ? "templates" : e.owner !== "you" ? "shared" : "mine";
    const counts = { mine: 0, shared: 0, templates: 0 };
    for (const e of ents) counts[bucket(e)]++;
    const tabs = h("div", { class: "tabs", role: "tablist" });
    for (const [k, l] of [["mine", "My enterprises"], ["shared", "Shared with me"], ["templates", "Templates"]])
      tabs.append(h("button", { type: "button", role: "tab", "aria-selected": String(tab === k), onclick: () => ICL.store.update("ui.homeTab", k) }, `${l} (${counts[k]})`));
    root.append(tabs);

    const shown = ents.filter((e) => bucket(e) === tab);
    const grid = h("div", { class: "scen-grid", dataset: { fb: "home:list", fbLabel: "Enterprise list" } });
    if (tab === "mine") grid.append(newCard(state));
    for (const e of shown) grid.append(enterpriseCard(e, state));
    if (!shown.length && tab !== "mine") grid.append(h("div", { class: "empty" }, "Nothing here yet."));
    root.append(grid);

    root.append(h("div", { class: "card", dataset: { fb: "home:batch", fbLabel: "Batch card" } },
      h("div", { class: "card-head" }, h("h2", null, "Many enterprises at once"), h("a", { class: "btn", href: "#batch" }, "Open batch processing →")),
      h("p", { class: "small" }, "If the descriptions already exist — a household survey, a monitoring sheet, a district inventory — upload the spreadsheet instead of typing each one. Every enterprise is checked the same way as a typed assessment, and you get a QAQC report naming the sheet, the column and the row of anything the model would reject, plus the compiled model input to download.")));

    root.append(h("div", { class: "card soft", style: "margin-top:18px" },
      h("h2", null, "Projects"),
      h("p", { class: "small" }, h("strong", null, "A project groups related enterprises"), " — one study, one district, one piece of work — and the people who may see them. Enterprises in a project can be compared with each other."),
      ...(state.library.projects || []).map((p) => h("p", { class: "small", style: "margin:2px 0" }, h("strong", null, p.name), " · ", p.members.join(", "))),
      h("button", { type: "button", class: "btn-sm", onclick: () => ICL.toast("Mocked: invite a colleague by email.") }, "Invite a colleague")));

    root.append(ICL.common.disclaimer({ where: "home", short: true }));

    root.append(h("p", { class: "small", style: "margin-top:14px" }, "Mockup controls: ",
      h("button", { type: "button", class: "btn-sm", onclick: () => { ICL.store.reset(); ICL.toast("Example data restored."); } }, "Reset all example data"), " ",
      h("button", { type: "button", class: "btn-sm", onclick: () => startBlank() }, "Start an empty assessment")));
  };

  function enterpriseCard(e, state) {
    const rows = rowsOf(state, e.id);
    const openId = state.meta.id;
    const observed = rows.filter((r) => r.kind === "observed");
    const card = h("div", { class: "card scen-card", dataset: { fb: "home:ent:" + e.id, fbLabel: "Enterprise: " + e.name } },
      h("h3", null, e.name),
      h("div", { class: "scen-badges" },
        h("span", { class: "chip" }, e.place || "—"),
        e.scale && e.scale !== "farm" ? h("span", { class: "chip c-derived" }, SCALE_LABEL[e.scale]) : null,
        observed.length > 1 ? h("span", { class: "chip c-user" }, `${observed.length} years`) : null),
      h("div", { class: "meta" }, `by ${e.owner}${e.project ? " · " + e.project : ""}`));

    // the timeline: one line per assessment, oldest first
    const t = h("table", { class: "grid" }, h("thead", null, h("tr", null, h("th", null, "Year"), h("th", null, "Assessment"), h("th", null, "Size"), h("th", null, ""))));
    const tb = h("tbody");
    for (const r of rows) {
      const k = KIND[r.kind] || KIND.observed;
      const isOpen = r.id === openId;
      tb.append(h("tr", { class: isOpen ? "row-sel" : "" },
        h("td", null, String(r.as_of || "—")),
        h("td", null, r.label || r.name, " ", h("span", { class: "chip " + k[1], title: k[2] }, k[0]), isOpen ? h("span", { class: "chip c-user" }, "open") : null),
        h("td", { class: "small" }, r.headline || "—"),
        h("td", null, h("button", { type: "button", class: "btn-sm", onclick: () => open(r) }, isOpen ? "Continue" : "Open"))));
    }
    t.append(tb);
    card.append(h("div", { class: "tablewrap" }, t));

    card.append(h("div", { class: "actions" },
      h("button", { type: "button", class: "btn-sm", onclick: () => addAssessment(e, rows, "observed") }, "+ Assess again this year"),
      h("button", { type: "button", class: "btn-sm", onclick: () => addAssessment(e, rows, "what_if") }, "+ Test a change"),
      observed.length > 1 ? h("button", { type: "button", class: "btn-sm", onclick: () => { ICL.store.set((s) => { s.ui.resultsTab = "compare"; s.ui.compareMode = "time"; return s; }); open(rows[rows.length - 1]); setTimeout(() => ICL.router.go("results"), 60); } }, "See the change over time") : null,
      e.owner === "you" ? h("button", { type: "button", class: "btn-sm", onclick: () => ICL.toast("Mocked: choose people or a project to share with.") }, "Share") : null));
    return card;
  }

  function open(row) {
    if (!ICL.store.load(row.id)) { ICL.toast("That assessment has no saved description in this mockup."); return; }
    if (row.template) { const id = ICL.store.duplicateOpen(row.name.replace(/^Template:\s*/, "") + " (my copy)", { enterprise: null, kind: "observed" }); ICL.store.load(id); ICL.toast("Template copied into a new assessment — edit freely."); }
    else ICL.toast(`Opened "${row.label || row.name}": ${row.headline || "saved description loaded"}.`);
    ICL.router.go("about");
  }

  /** A follow-up or a what-if starts from the most recent assessment of that enterprise. */
  function addAssessment(e, rows, kind) {
    const from = rows.filter((r) => r.kind === "observed").slice(-1)[0] || rows[rows.length - 1];
    if (!from || !ICL.store.load(from.id)) { ICL.toast("Nothing to copy from yet."); return; }
    const year = new Date().getFullYear();
    const label = kind === "observed" ? `Assessment ${year}` : `What-if ${year}`;
    const id = ICL.store.duplicateOpen(`${e.name} — ${label}`, { enterprise: e.id, as_of: year, kind, label });
    ICL.store.load(id);
    ICL.toast(kind === "observed"
      ? `Started ${label}, copied from ${from.label || from.name}. Change what has changed on the ground.`
      : `Started ${label}, copied from ${from.label || from.name}. Change one thing to see what it does.`);
    ICL.router.go("about");
  }

  function newCard(state) {
    const name = h("input", { type: "text", id: "new_ent_name", placeholder: "e.g. Njombe smallholder dairy", "aria-label": "Enterprise name" });
    const place = h("input", { type: "text", id: "new_ent_place", placeholder: "e.g. Njombe, Tanzania", "aria-label": "Where it is" });
    const ps = h("select", { id: "new_ent_param", "aria-label": "Parameter set" }, ...D.options(D.field("param_set"), state).map((o) => h("option", { value: o.value, selected: o.value === state.meta.param_set }, o.label)));
    const from = h("select", { id: "new_ent_from", "aria-label": "Start from" }, h("option", { value: "" }, "Empty description"),
      ...(state.library.assessments || []).map((s) => h("option", { value: s.id }, `Copy of ${s.name}`)));
    const start = h("button", { type: "button", class: "btn", onclick: () => {
      if (!name.value.trim()) { ICL.toast("Give the enterprise a name first."); name.focus(); return; }
      const entId = ICL.uid("ent");
      const year = new Date().getFullYear();
      ICL.store.set((s) => { s.library.enterprises.unshift({ id: entId, name: name.value.trim(), place: place.value.trim() || null, owner: "you", project: s.meta.project, scale: "farm" }); return s; });
      if (from.value) { ICL.store.load(from.value); const id = ICL.store.duplicateOpen(`${name.value.trim()} — Assessment ${year}`, { enterprise: entId, as_of: year, kind: "observed", label: `Assessment ${year}` }); ICL.store.load(id); }
      else startBlank(false, entId, name.value.trim());
      ICL.store.set((s) => { s.meta.param_set = ps.value; const row = s.library.assessments.find((x) => x.id === s.meta.id); if (row) row.param_set = ps.value; return s; });
      ICL.router.go("about");
    } }, "Start →");
    return h("div", { class: "card scen-card scen-new", dataset: { fb: "home:new", fbLabel: "New enterprise card" } }, h("h3", null, "New enterprise"),
      h("div", { class: "field" }, h("label", { class: "field-label", for: "new_ent_name" }, "Name"), name),
      h("div", { class: "field" }, h("label", { class: "field-label", for: "new_ent_place" }, "Where it is"), place),
      h("div", { class: "field" }, h("label", { class: "field-label", for: "new_ent_from" }, "Start from"), from, h("div", { class: "small" }, "Copying a similar enterprise is usually faster than starting empty.")),
      h("div", { class: "field" }, h("label", { class: "field-label", for: "new_ent_param" }, "Defaults from ", h("span", { class: "unit" }, "(parameter set)")), ps),
      h("div", { class: "actions" }, start));
  }

  function startBlank(navigate = true, entId, entName) {
    ICL.store.set((s) => {
      const id = ICL.uid("as");
      const year = new Date().getFullYear();
      const enterprise = entId || null;
      Object.assign(s, { plots: [], seasons: [], herds: [], animals: [], feeds: [], allocation: {}, fertilizer: {}, provenance: {} });
      s.meta = { id, scenario_name: (entName ? entName + " — " : "") + `Assessment ${year}`, scenario_purpose: null, param_set: s.meta.param_set, owner: "you", project: s.meta.project, enterprise, as_of: year, kind: "observed", label: `Assessment ${year}` };
      s.farm = Object.fromEntries(Object.keys(s.farm).map((k) => [k, null]));
      s.system = { scale: null, species: [], aim: null, growsFeed: null, buysFeed: null, buysInputs: null, fertiliser: null, nSeasons: null, rice: null, trees: null };
      if (!enterprise) { const e = ICL.uid("ent"); s.library.enterprises.unshift({ id: e, name: "Untitled enterprise", place: null, owner: "you", project: s.meta.project, scale: "farm" }); s.meta.enterprise = e; }
      s.library.assessments.unshift({ id, name: s.meta.scenario_name, enterprise: s.meta.enterprise, as_of: year, kind: "observed", label: `Assessment ${year}`, owner: "you", project: s.meta.project, param_set: s.meta.param_set, updated: new Date().toISOString().slice(0, 10), purpose: null, shared: [], scale: "farm", headline: "nothing described yet" });
      return s;
    });
    if (navigate) ICL.router.go("about");
  }
})(window.ICL);
