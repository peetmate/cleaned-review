/* About this farm: system questions. */
(function (ICL) {
  const { h } = ICL; const D = ICL.dict, C = ICL.cond; const { screenHead } = ICL.common;
  ICL.screens.about = function (root, { state }) {
    root.append(screenHead(D.section("about")));
    const qs = window.ICL_SCHEMA.systemQuestions;
    const ctx = { system: state.system, farm: state.farm, ui: state.ui };
    for (const q of qs) {
      if (!C.visible(q, ctx)) continue;
      const cur = state.system[q.id];
      const set = (v) => ICL.store.update("system." + q.id, v, "user");
      const wrap = h("div", { class: "field card", dataset: { fb: "sysq:" + q.id, fbLabel: q.label } }, h("div", { class: "field-label" }, h("span", null, ICL.t(q.label))), q.help ? h("div", { class: "help-line" }, ICL.t(q.help)) : null);
      if (q.type === "multichip") {
        const g = h("div", { class: "chips" }); const arr = Array.isArray(cur) ? cur : [];
        for (const o of q.options) { const c = h("input", { type: "checkbox", disabled: o.disabled }); c.checked = arr.includes(o.value); c.addEventListener("change", () => set(c.checked ? [...arr, o.value] : arr.filter((x) => x !== o.value))); g.append(h("label", { class: o.disabled ? "disabled" : "" }, c, o.label, o.note ? h("small", null, " · " + o.note) : null)); }
        wrap.append(g);
      } else if (q.type === "yesno") {
        const g = h("div", { class: "radios inline" });
        for (const [v, l] of [[true, "Yes"], [false, "No"]]) { const r = h("input", { type: "radio", name: "sq_" + q.id }); r.checked = cur === v; r.addEventListener("change", () => set(v)); g.append(h("label", { class: "radio" }, r, h("span", null, l))); }
        wrap.append(g);
      } else {
        const g = h("div", { class: "radios" });
        for (const o of q.options) { const r = h("input", { type: "radio", name: "sq_" + q.id }); r.checked = cur === o.value; r.addEventListener("change", () => set(o.value)); g.append(h("label", { class: "radio" }, r, h("span", null, ICL.t(o.label), o.definition ? h("span", { class: "def" }, ICL.t(o.definition)) : null))); }
        wrap.append(g);
      }
      root.append(wrap);
    }
    const hidden = D.sections().filter((s) => s.wizard && !C.sectionVisible(s, state)).map((s) => s.title);
    root.append(h("div", { class: "callout" }, hidden.length ? `Based on these answers we will skip: ${hidden.join(", ")}.` : "All steps apply to this farm.", " You can change any answer later from the sidebar."));
  };
})(window.ICL);
