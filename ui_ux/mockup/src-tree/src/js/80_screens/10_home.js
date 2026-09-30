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
      h("strong", null, "An assessment"), " is one description of a livestock enterprise: dated, when it records what was there that year, or marked ",
      h("em", null, "what-if"), " when it describes a change you are considering. It is the thing you open, run, compare and share. ",
      "Assessments are grouped by the ", h("strong", null, "enterprise"), " they describe \u2014 the herd and the land that feeds it \u2014 so assessing the same one next year puts the two side by side instead of leaving two unrelated files. ",
      h("a", { href: "#welcome" }, "More about iCLEANED"), " · ", h("a", { href: "#why" }, "Why iCLEANED and how it compares")));

    const tab = state.ui.homeTab || "mine";
    const ents = state.library.enterprises || [];
    const isTemplate = (e) => rowsOf(state, e.id).some((r) => r.template);
    const bucket = (e) => isTemplate(e) ? "templates" : e.owner !== "you" ? "shared" : "mine";
    const counts = { mine: 0, shared: 0, templates: 0 };
    for (const e of ents) counts[bucket(e)]++;
    const tabs = h("div", { class: "tabs", role: "tablist" });
    for (const [k, l] of [["mine", "My assessments"], ["shared", "Shared with me"], ["templates", "Templates"]])
      tabs.append(h("button", { type: "button", role: "tab", "aria-selected": String(tab === k), onclick: () => ICL.store.set((s) => { s.ui.homeTab = k; s.ui.projectFilter = "all"; return s; }) }, `${l} (${counts[k]})`));
    root.append(tabs);

    // Project was named in the chip and the glossary but had no control anywhere.
    const projects = state.library.projects || [];
    const inTab = ents.filter((e) => bucket(e) === tab);
    const pFilter = state.ui.projectFilter || "all";
    const chips = h("div", { class: "chips" });
    const countIn = (name) => inTab.filter((e) => (name === "__none" ? !e.project : e.project === name)).length;
    chips.append(h("button", { type: "button", class: "filterchip", "aria-pressed": String(pFilter === "all"), onclick: () => ICL.store.update("ui.projectFilter", "all") }, "All projects", h("span", { class: "cnt" }, String(inTab.length))));
    for (const p of projects) if (countIn(p.name)) chips.append(h("button", { type: "button", class: "filterchip", "aria-pressed": String(pFilter === p.name), onclick: () => ICL.store.update("ui.projectFilter", p.name) }, p.name, h("span", { class: "cnt" }, String(countIn(p.name)))));
    if (countIn("__none")) chips.append(h("button", { type: "button", class: "filterchip", "aria-pressed": String(pFilter === "__none"), onclick: () => ICL.store.update("ui.projectFilter", "__none") }, "No project", h("span", { class: "cnt" }, String(countIn("__none")))));
    if (projects.length || countIn("__none")) root.append(h("div", { class: "listfilter", dataset: { fb: "home:projectfilter", fbLabel: "Project filter" } }, chips));

    const shown = inTab.filter((e) => pFilter === "all" || (pFilter === "__none" ? !e.project : e.project === pFilter));
    const grid = h("div", { class: "scen-grid", dataset: { fb: "home:list", fbLabel: "Enterprise list" } });
    if (tab === "mine") grid.append(newCard(state));
    for (const e of shown) grid.append(enterpriseCard(e, state));
    if (!shown.length && tab !== "mine") grid.append(h("div", { class: "empty" }, "Nothing here yet."));
    root.append(grid);

    root.append(h("div", { class: "card", dataset: { fb: "home:batch", fbLabel: "Batch card" } },
      h("div", { class: "card-head" }, h("h2", null, "Many assessments at once"), h("a", { class: "btn", href: "#batch" }, "Open batch processing →")),
      h("p", { class: "small" }, "If the descriptions already exist — a household survey, a monitoring sheet, a district inventory — upload the spreadsheet instead of typing each one. Every enterprise is checked the same way as a typed assessment, and you get a QAQC report naming the sheet, the column and the row of anything the model would reject, plus the compiled model input to download.")));

    root.append(projectsCard(state));

    root.append(ICL.common.disclaimer({ where: "home", short: true }));

    root.append(h("p", { class: "small", style: "margin-top:14px" }, "Mockup controls: ",
      h("button", { type: "button", class: "btn-sm", onclick: () => { ICL.store.reset(); ICL.toast("Example data restored."); } }, "Reset all example data"), " ",
      h("button", { type: "button", class: "btn-sm", onclick: () => startBlank() }, "Start an empty assessment")));
  };

  function moveToProject(e, value) {
    ICL.store.set((s) => {
      const ent = s.library.enterprises.find((x) => x.id === e.id); if (ent) ent.project = value || null;
      for (const r of s.library.assessments) if (r.enterprise === e.id) r.project = value || null;
      if (s.meta.enterprise === e.id) s.meta.project = value || null;
      return s;
    });
    ICL.toast(value ? `${e.name} moved to ${value}.` : `${e.name} removed from its project.`);
  }

  /** Projects: what exists, what is in each, and how to make one. */
  function projectsCard(state) {
    const projects = state.library.projects || [];
    const ents = state.library.enterprises || [];
    const rows = state.library.assessments || [];
    const card = h("div", { class: "card", dataset: { fb: "home:projects", fbLabel: "Projects" } },
      h("h2", null, "Projects"),
      h("p", { class: "small" }, h("strong", null, "A project groups related enterprises"), " — one study, one district, one piece of work — and the people who may see them. Assessments inside a project can be compared with each other, and a parameter set shared with the project is available to all of them. An enterprise can sit in one project or none."));
    if (projects.length) {
      const t = h("table", { class: "grid" }, h("thead", null, h("tr", null, h("th", null, "Project"), h("th", null, "Enterprises"), h("th", null, "Assessments"), h("th", null, "People"), h("th", null, ""))));
      const tb = h("tbody");
      for (const p of projects) {
        const inP = ents.filter((e) => e.project === p.name);
        const asmt = rows.filter((r) => inP.some((e) => e.id === r.enterprise)).length;
        tb.append(h("tr", null,
          h("td", null, h("strong", null, p.name)),
          h("td", null, String(inP.length)),
          h("td", null, String(asmt)),
          h("td", { class: "small" }, (p.members || []).join(", ")),
          h("td", null,
            h("button", { type: "button", class: "btn-sm", onclick: () => { ICL.store.update("ui.projectFilter", p.name); ICL.toast(`Showing ${p.name}.`); } }, "Show"), " ",
            h("button", { type: "button", class: "btn-sm", onclick: () => ICL.toast("Mocked: invite a colleague to " + p.name + " by email.") }, "Invite"))));
      }
      t.append(tb);
      card.append(h("div", { class: "tablewrap" }, t));
    } else card.append(h("div", { class: "empty" }, "No projects yet. Work can sit outside a project; make one when more than one person needs the same set of enterprises."));
    const np = h("input", { type: "text", placeholder: "e.g. Njombe dairy 2027", "aria-label": "Name for a new project" });
    card.append(h("div", { class: "control" }, np,
      h("button", { type: "button", class: "btn-sm", onclick: () => {
        const name = np.value.trim();
        if (!name) { ICL.toast("Give the project a name."); np.focus(); return; }
        if ((state.library.projects || []).some((p) => p.name === name)) { ICL.toast("There is already a project with that name."); return; }
        ICL.store.set((s) => { s.library.projects.push({ id: ICL.uid("prj"), name, members: ["you"] }); return s; });
        np.value = ""; ICL.toast(`Project "${name}" created. Put an enterprise in it from its card.`);
      } }, "Create a project")));
    return card;
  }

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
      h("div", { class: "meta" }, `by ${e.owner}`));
    const projSel = h("select", { "aria-label": "Project for " + e.name, onchange: (ev) => moveToProject(e, ev.target.value) },
      h("option", { value: "", selected: !e.project }, "No project"),
      ...(state.library.projects || []).map((p) => h("option", { value: p.name, selected: e.project === p.name }, p.name)));
    card.append(h("div", { class: "control", style: "margin:2px 0 8px" }, h("span", { class: "small" }, "Project"), projSel));

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
    const proj = h("select", { id: "new_ent_project", "aria-label": "Project" },
      h("option", { value: "" }, "No project"),
      ...(state.library.projects || []).map((p) => h("option", { value: p.name, selected: state.meta.project === p.name }, p.name)),
      h("option", { value: "__new" }, "+ New project…"));
    const newProjName = h("input", { type: "text", placeholder: "Name of the new project", "aria-label": "Name of the new project for this assessment", hidden: true });
    proj.addEventListener("change", () => { newProjName.hidden = proj.value !== "__new"; if (!newProjName.hidden) newProjName.focus(); });
    const ps = h("select", { id: "new_ent_param", "aria-label": "Parameter set" }, ...D.options(D.field("param_set"), state).map((o) => h("option", { value: o.value, selected: o.value === state.meta.param_set }, o.label)));
    const from = h("select", { id: "new_ent_from", "aria-label": "Start from" }, h("option", { value: "" }, "Empty description"),
      ...(state.library.assessments || []).map((s) => h("option", { value: s.id }, `Copy of ${s.name}`)));
    const start = h("button", { type: "button", class: "btn", onclick: () => {
      if (!name.value.trim()) { ICL.toast("Name the enterprise this assessment describes."); name.focus(); return; }
      const entId = ICL.uid("ent");
      const year = new Date().getFullYear();
      const projectName = proj.value === "__new" ? newProjName.value.trim() : (proj.value || null);
      if (proj.value === "__new" && !projectName) { ICL.toast("Name the new project, or choose No project."); newProjName.focus(); return; }
      ICL.store.set((s) => {
        if (projectName && !(s.library.projects || []).some((p) => p.name === projectName)) s.library.projects.push({ id: ICL.uid("prj"), name: projectName, members: ["you"] });
        s.meta.project = projectName;
        s.library.enterprises.unshift({ id: entId, name: name.value.trim(), place: place.value.trim() || null, owner: "you", project: projectName, scale: "farm" });
        return s;
      });
      if (from.value) { ICL.store.load(from.value); const id = ICL.store.duplicateOpen(`${name.value.trim()} — Assessment ${year}`, { enterprise: entId, as_of: year, kind: "observed", label: `Assessment ${year}` }); ICL.store.load(id); }
      else startBlank(false, entId, name.value.trim());
      ICL.store.set((s) => { s.meta.param_set = ps.value; const row = s.library.assessments.find((x) => x.id === s.meta.id); if (row) row.param_set = ps.value; return s; });
      ICL.router.go("about");
    } }, "Start →");
    return h("div", { class: "card scen-card scen-new", dataset: { fb: "home:new", fbLabel: "New assessment card" } }, h("h3", null, "New assessment"),
      h("div", { class: "field" }, h("label", { class: "field-label", for: "new_ent_name" }, "Enterprise this describes"), name),
      h("div", { class: "field" }, h("label", { class: "field-label", for: "new_ent_place" }, "Where it is"), place),
      h("div", { class: "field" }, h("label", { class: "field-label", for: "new_ent_project" }, "Project"), proj, newProjName, h("div", { class: "small" }, "A project groups related enterprises and the people who may see them. Optional.")),
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
