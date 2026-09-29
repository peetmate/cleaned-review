/* Home: My scenarios / Shared / Templates; new scenario dialog (name, purpose, parameter set). */
(function (ICL) {
  const { h } = ICL; const D = ICL.dict; const { screenHead } = ICL.common;
  ICL.screens.home = function (root, { state, val }) {
    const sec = D.section("home");
    root.append(screenHead(sec));
    const tab = state.ui.homeTab || "mine";
    const tabs = h("div", { class: "tabs", role: "tablist" });
    for (const [k, l] of [["mine", "My scenarios"], ["shared", "Shared with me"], ["templates", "Templates"]]) tabs.append(h("button", { type: "button", role: "tab", "aria-selected": String(tab === k), onclick: () => ICL.store.update("ui.homeTab", k) }, l));
    root.append(tabs);
    const list = state.library.scenarios.filter((s) => tab === "templates" ? s.template : tab === "shared" ? s.owner !== "you" && !s.template : s.owner === "you");
    const grid = h("div", { class: "scen-grid", dataset: { fb: "home:list", fbLabel: "Scenario list" } });
    if (tab === "mine") grid.append(newCard(state));
    for (const s of list) {
      const isOpen = s.id === state.meta.id;
      grid.append(h("div", { class: "card scen-card", dataset: { fb: "home:card:" + s.id, fbLabel: "Scenario card" } },
        h("h3", null, s.name, isOpen ? h("span", { class: "chip c-user", style: "margin-left:6px" }, "open") : null),
        h("div", { class: "meta" }, `${s.purpose === "baseline" ? "Baseline" : s.purpose === "intervention" ? "Intervention" : "Example"} · by ${s.owner}${s.project ? " · " + s.project : ""}`),
        h("div", { class: "meta" }, "Defaults from ", h("a", { href: "#parameters" }, s.param_set), ` · edited ${s.updated}`),
        s.shared && s.shared.length ? h("div", { class: "meta" }, "Shared with " + s.shared.join(", ")) : null,
        h("div", { class: "actions" },
          h("button", { type: "button", class: "btn-sm", onclick: () => openScenario(s) }, isOpen ? "Continue" : s.template ? "Use as a start" : "Open"),
          h("button", { type: "button", class: "btn-sm", onclick: () => duplicate(s) }, "Duplicate"),
          !s.template ? h("button", { type: "button", class: "btn-sm", onclick: () => ICL.toast("Sharing is mocked: in the real app this opens a dialog to add people or a project.") }, "Share") : null,
          !s.template ? h("button", { type: "button", class: "btn-sm", onclick: () => ICL.toast("Compare is mocked: pick 2+ scenarios then open the Results screen.") }, "Compare") : null)));
    }
    root.append(grid);
    root.append(h("div", { class: "card soft", style: "margin-top:18px" }, h("h3", null, "Project: " + state.library.projects[0].name), h("p", { class: "small" }, "Members: " + state.library.projects[0].members.join(", ") + ". Everyone in a project sees its scenarios and shared parameter sets. "), h("button", { type: "button", class: "btn-sm", onclick: () => ICL.toast("Mocked: invite by email.") }, "Invite a colleague")));
    root.append(h("p", { class: "small", style: "margin-top:14px" }, "Mockup controls: ", h("button", { type: "button", class: "btn-sm", onclick: () => { ICL.store.reset(); ICL.toast("Example scenario restored."); } }, "Reset example data"), " ", h("button", { type: "button", class: "btn-sm", onclick: () => { ICL.store.set((s) => { Object.assign(s, { plots: [], seasons: [], herds: [], animals: [], feeds: [], allocation: {}, fertilizer: {}, provenance: {} }); s.meta = { id: ICL.uid("sc"), scenario_name: null, scenario_purpose: null, param_set: s.meta.param_set, owner: "you", project: s.meta.project }; s.farm = Object.fromEntries(Object.keys(s.farm).map((k) => [k, null])); s.system = { scale: null, species: [], aim: null, growsFeed: null, buysFeed: null, buysInputs: null, fertiliser: null, nSeasons: null, rice: null, trees: null }; return s; }); ICL.router.go("about"); } }, "Start a blank scenario")));
  };

  function newCard(state) {
    const name = h("input", { type: "text", placeholder: "Scenario name, e.g. Njombe baseline 2026", "aria-label": "Scenario name" });
    const purpose = h("select", { "aria-label": "Purpose" }, ...D.field("scenario_purpose").options.map((o) => h("option", { value: o.value }, o.label)));
    const ps = h("select", { "aria-label": "Parameter set" }, ...D.options(D.field("param_set"), state).map((o) => h("option", { value: o.value, selected: o.value === state.meta.param_set }, o.label)));
    const start = h("button", { type: "button", class: "btn", onclick: () => {
      if (!name.value.trim()) { ICL.toast("Give the scenario a name first."); name.focus(); return; }
      ICL.store.set((s) => { s.meta = { id: ICL.uid("sc"), scenario_name: name.value.trim(), scenario_purpose: purpose.value, param_set: ps.value, owner: "you", project: s.library.projects[0].name, updated: new Date().toISOString() }; s.library.scenarios.unshift({ id: s.meta.id, name: s.meta.scenario_name, owner: "you", project: s.meta.project, param_set: ps.value, updated: new Date().toISOString().slice(0, 10), purpose: purpose.value, shared: [] }); return s; });
      ICL.router.go("about");
    } }, "Start →");
    return h("div", { class: "card scen-card", style: "border-style:dashed", dataset: { fb: "home:new", fbLabel: "New scenario card" } }, h("h3", null, "New scenario"),
      h("div", { class: "field" }, h("label", { class: "field-label" }, "Name"), name),
      h("div", { class: "field" }, h("label", { class: "field-label" }, "What are you testing?"), purpose),
      h("div", { class: "field" }, h("label", { class: "field-label" }, "Defaults from ", h("span", { class: "unit" }, "(parameter set, recommended from the location)")), ps, h("div", { class: "small" }, "You can change this later. ", h("a", { href: "#parameters" }, "What is in a parameter set?"))),
      h("div", { class: "actions" }, start));
  }
  function openScenario(s) {
    ICL.store.set((st) => { st.meta = Object.assign({}, st.meta, { id: s.id, scenario_name: s.name, scenario_purpose: s.purpose, param_set: s.param_set, owner: s.owner, project: s.project }); return st; });
    ICL.toast(s.template ? "Template copied into a new scenario (mocked: same example data)." : "Opened (mocked: same example data).");
    ICL.router.go("about");
  }
  function duplicate(s) {
    ICL.store.set((st) => { st.library.scenarios.unshift(Object.assign({}, s, { id: ICL.uid("sc"), name: s.name + " (copy)", owner: "you", template: false, updated: new Date().toISOString().slice(0, 10), shared: [] })); return st; });
    ICL.toast("Duplicated.");
  }
})(window.ICL);
