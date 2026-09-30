/* Home: what a scenario is, then My scenarios / Shared with me / Templates, and a new-scenario card. */
(function (ICL) {
  const { h } = ICL; const D = ICL.dict; const { screenHead } = ICL.common;
  const SCALE_LABEL = { farm: "One farm", group: "Group of farms", region: "Region", national: "National herd" };
  const PURPOSE_LABEL = { baseline: "Baseline", intervention: "Intervention", training: "Example" };

  ICL.screens.home = function (root, { state }) {
    root.append(screenHead(D.section("home")));
    root.append(h("div", { class: "callout", dataset: { fb: "home:what", fbLabel: "What is a scenario", noNumber: "" } },
      h("strong", null, "A scenario"), " is one complete description of a livestock enterprise for one year — the animals, the land that feeds them and their manure. Describe it once as it is today (a ", h("em", null, "baseline"), "), then copy it and change something to test an ", h("em", null, "intervention"), ". ",
      h("a", { href: "#welcome" }, "More about iCLEANED"), " \u00b7 ",
      h("a", { href: "#why" }, "Why iCLEANED and how it compares")));

    const tab = state.ui.homeTab || "mine";
    const counts = { mine: 0, shared: 0, templates: 0 };
    for (const s of state.library.scenarios) counts[s.template ? "templates" : s.owner !== "you" ? "shared" : "mine"]++;
    const tabs = h("div", { class: "tabs", role: "tablist" });
    for (const [k, l] of [["mine", "My scenarios"], ["shared", "Shared with me"], ["templates", "Templates"]])
      tabs.append(h("button", { type: "button", role: "tab", "aria-selected": String(tab === k), onclick: () => ICL.store.update("ui.homeTab", k) }, `${l} (${counts[k]})`));
    root.append(tabs);

    const list = state.library.scenarios.filter((s) => tab === "templates" ? s.template : tab === "shared" ? (s.owner !== "you" && !s.template) : (s.owner === "you" && !s.template));
    const grid = h("div", { class: "scen-grid", dataset: { fb: "home:list", fbLabel: "Scenario list" } });
    if (tab === "mine") grid.append(newCard(state));
    for (const s of list) grid.append(scenarioCard(s, state));
    root.append(grid);

    root.append(h("div", { class: "card", dataset: { fb: "home:batch", fbLabel: "Batch card" } },
      h("div", { class: "card-head" }, h("h2", null, "Many enterprises at once"), h("a", { class: "btn", href: "#batch" }, "Open batch processing \u2192")),
      h("p", { class: "small" }, "If the descriptions already exist \u2014 a household survey, a monitoring sheet, a district inventory \u2014 upload the spreadsheet instead of typing each one. Every enterprise is checked the same way as a typed scenario, and you get a QAQC report naming the sheet, the column and the row of anything the model would reject, plus the compiled model input to download.")));

    root.append(h("div", { class: "card soft", style: "margin-top:18px" },
      h("h2", null, "Projects"),
      h("p", { class: "small" }, h("strong", null, "A project groups related scenarios"), " \u2014 one study, one district, one piece of work \u2014 and the people who may see them. A scenario is one description of an enterprise; a project is the folder it sits in. Scenarios in a project can be compared with each other."),
      ...(state.library.projects || []).map((p) => h("p", { class: "small", style: "margin:2px 0" }, h("strong", null, p.name), " · ", p.members.join(", "))),
      h("p", { class: "small" }, "Everyone in a project sees its scenarios and any parameter set shared with it."),
      h("button", { type: "button", class: "btn-sm", onclick: () => ICL.toast("Mocked: invite a colleague by email.") }, "Invite a colleague")));

    root.append(ICL.common.disclaimer({ where: "home", short: true }));

    root.append(h("p", { class: "small", style: "margin-top:14px" }, "Mockup controls: ",
      h("button", { type: "button", class: "btn-sm", onclick: () => { ICL.store.reset(); ICL.toast("Example scenarios restored."); } }, "Reset all example data"), " ",
      h("button", { type: "button", class: "btn-sm", onclick: () => startBlank() }, "Start an empty scenario")));
  };

  function scenarioCard(s, state) {
    const isOpen = s.id === state.meta.id;
    return h("div", { class: "card scen-card" + (isOpen ? " scen-open" : ""), dataset: { fb: "home:card:" + s.id, fbLabel: "Scenario card: " + s.name } },
      h("h3", null, s.name),
      h("div", { class: "scen-badges" },
        h("span", { class: "chip" }, PURPOSE_LABEL[s.purpose] || "Scenario"),
        s.scale && s.scale !== "farm" ? h("span", { class: "chip c-derived" }, SCALE_LABEL[s.scale]) : null,
        isOpen ? h("span", { class: "chip c-user" }, "open now") : null),
      s.headline ? h("div", { class: "scen-headline" }, s.headline) : null,
      h("div", { class: "meta" }, `by ${s.owner}${s.project ? " · " + s.project : ""} · edited ${s.updated}`),
      h("div", { class: "meta" }, "Defaults from ", h("a", { href: "#parameters" }, s.param_set)),
      s.shared && s.shared.length ? h("div", { class: "meta" }, "Shared with " + s.shared.join(", ")) : null,
      h("div", { class: "actions" },
        h("button", { type: "button", class: (isOpen ? "btn" : "btn secondary") + " btn-sm", onclick: () => openScenario(s) }, isOpen ? "Continue" : s.template ? "Use as a start" : "Open"),
        h("button", { type: "button", class: "btn-sm", onclick: () => duplicate(s) }, "Duplicate"),
        !s.template && s.owner === "you" ? h("button", { type: "button", class: "btn-sm", onclick: () => ICL.toast("Mocked: choose people or a project to share with.") }, "Share") : null,
        !s.template ? h("button", { type: "button", class: "btn-sm", onclick: () => ICL.toast(`Mocked: would compare "${s.name}" against the open scenario.`) }, "Compare") : null));
  }

  function newCard(state) {
    const name = h("input", { type: "text", id: "new_scenario_name", placeholder: "e.g. Njombe baseline 2026", "aria-label": "Scenario name" });
    const purpose = h("select", { id: "new_scenario_purpose", "aria-label": "Purpose" }, ...D.field("scenario_purpose").options.map((o) => h("option", { value: o.value }, o.label)));
    const ps = h("select", { id: "new_scenario_param", "aria-label": "Parameter set" }, ...D.options(D.field("param_set"), state).map((o) => h("option", { value: o.value, selected: o.value === state.meta.param_set }, o.label)));
    const from = h("select", { id: "new_scenario_from", "aria-label": "Start from" }, h("option", { value: "" }, "Empty description"),
      ...state.library.scenarios.map((s) => h("option", { value: s.id }, `Copy of ${s.name}`)));
    const start = h("button", { type: "button", class: "btn", onclick: () => {
      if (!name.value.trim()) { ICL.toast("Give the scenario a name first."); name.focus(); return; }
      if (from.value) { ICL.store.load(from.value); const id = ICL.store.duplicateOpen(name.value.trim()); ICL.store.load(id); }
      else startBlank(false);
      ICL.store.set((s) => { s.meta.scenario_name = name.value.trim(); s.meta.scenario_purpose = purpose.value; s.meta.param_set = ps.value; const row = s.library.scenarios.find((x) => x.id === s.meta.id); if (row) { row.name = s.meta.scenario_name; row.purpose = purpose.value; row.param_set = ps.value; } return s; });
      ICL.router.go("about");
    } }, "Start →");
    return h("div", { class: "card scen-card scen-new", dataset: { fb: "home:new", fbLabel: "New scenario card" } }, h("h3", null, "New scenario"),
      h("div", { class: "field" }, h("label", { class: "field-label", for: "new_scenario_name" }, "Name"), name),
      h("div", { class: "field" }, h("label", { class: "field-label", for: "new_scenario_purpose" }, "What are you testing?"), purpose),
      h("div", { class: "field" }, h("label", { class: "field-label", for: "new_scenario_from" }, "Start from"), from, h("div", { class: "small" }, "Copying is the usual way to build an intervention.")),
      h("div", { class: "field" }, h("label", { class: "field-label", for: "new_scenario_param" }, "Defaults from ", h("span", { class: "unit" }, "(parameter set)")), ps),
      h("div", { class: "actions" }, start));
  }

  function openScenario(s) {
    if (!ICL.store.load(s.id)) { ICL.toast("That scenario has no saved description in this mockup."); return; }
    if (s.template) { const id = ICL.store.duplicateOpen(s.name.replace(/^Template:\s*/, "") + " (my copy)"); ICL.store.load(id); ICL.toast("Template copied into a new scenario — edit freely."); }
    else ICL.toast(`Opened "${s.name}": ${s.headline || "saved description loaded"}.`);
    ICL.router.go("about");
  }
  function duplicate(s) {
    ICL.store.load(s.id);
    const id = ICL.store.duplicateOpen(s.name + " (copy)");
    ICL.store.load(id);
    ICL.toast("Duplicated. You are now editing the copy.");
    ICL.router.go("about");
  }
  function startBlank(navigate = true) {
    ICL.store.set((s) => {
      const id = ICL.uid("sc");
      Object.assign(s, { plots: [], seasons: [], herds: [], animals: [], feeds: [], allocation: {}, fertilizer: {}, provenance: {} });
      s.meta = { id, scenario_name: null, scenario_purpose: null, param_set: s.meta.param_set, owner: "you", project: s.meta.project };
      s.farm = Object.fromEntries(Object.keys(s.farm).map((k) => [k, null]));
      s.system = { scale: null, species: [], aim: null, growsFeed: null, buysFeed: null, buysInputs: null, fertiliser: null, nSeasons: null, rice: null, trees: null };
      s.library.scenarios.unshift({ id, name: "Untitled scenario", owner: "you", project: s.meta.project, param_set: s.meta.param_set, updated: new Date().toISOString().slice(0, 10), purpose: null, shared: [], scale: "farm", headline: "nothing described yet" });
      return s;
    });
    if (navigate) ICL.router.go("about");
  }
})(window.ICL);
