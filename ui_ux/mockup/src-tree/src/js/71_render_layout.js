/* Layout: topbar scenario chip, sidebar tree with status, wizard bar, preview panel, rating strip. */
(function (ICL) {
  const { h, fmt } = ICL; const D = ICL.dict, C = ICL.cond;

  function statusFor(sectionId, state, val, entityId) {
    const sec = D.section(sectionId);
    if (!C.sectionVisible(sec, state)) return "off";
    const errs = val.errors.filter((e) => e.screen === sectionId && (entityId == null || e.entityId === entityId || e.entityId == null));
    if (errs.length) return "block";
    if (sec.optional) return "opt";
    if (sectionId === "boundary") return state.ui.boundarySeen ? "done" : "none";
    if (sec.entity) { const list = state[sectionId] || []; if (!list.length) return "none"; }
    if (sectionId === "check") return val.errors.length ? "block" : "done";
    if (sectionId === "results" || sectionId === "home" || sectionId === "parameters") return "opt";
    if (sectionId === "fertiliser") return Object.values(state.fertilizer || {}).some((v) => v != null && v !== "") ? "done" : "none";
    // touched?
    const prefix = sec.entity ? sectionId + "[" : sectionId === "location" || sectionId === "inputs" || sectionId === "losses" ? "farm." : sectionId;
    const touched = Object.keys(state.provenance).some((p) => p.startsWith(prefix)) || (sec.entity && (state[sectionId] || []).length) || sectionId === "about";
    return touched ? "done" : "none";
  }
  const statusText = { none: "not started", partial: "in progress", done: "complete", block: "needs attention", opt: "optional", off: "not needed for this enterprise" };
  const statusIcon = (s) => h("span", null, h("span", { class: "status s-" + s, "aria-hidden": "true" }, s === "done" ? "✓" : s === "block" ? "!" : ""), h("span", { class: "vh" }, statusText[s] + ": "));

  function entityLabel(sectionId, e, state) {
    if (sectionId === "plots") return e.plot_name || "New plot";
    if (sectionId === "seasons") return e.season_name || "New season";
    if (sectionId === "herds") return e.herd_name || "New herd";
    if (sectionId === "animals") { const d = D.decorate(e, "animal", state); return (e.group_name || (d._desc ? D.livetypeLabel(d._desc) : "New group")) + (e.herd_n ? ` (${ICL.fmt(e.herd_n, 0)})` : ""); }
    if (sectionId === "feeds") { const d = D.decorate(e, "feed", state); return d._feedItem ? D.displayFeedName(d._feedItem.feed_item_name) : "New feed"; }
    return e.id;
  }

  function renderSidebar(state, val, fbCounts) {
    const nav = document.getElementById("sidebar-nav"); nav.innerHTML = "";
    const ul = h("ul");
    const route = state.route;
    const assumedBy = {}; for (const a of val.assumptions) assumedBy[a.screen] = (assumedBy[a.screen] || 0) + 1;
    for (const sec of D.sections()) {
      if (sec.id === "results") continue;
      if (sec.id === "parameters") ul.append(h("li", { class: "sep" }));
      const st = statusFor(sec.id, state, val);
      const num = ICL.num.prefix(sec.id);
      const li = h("li", null, h("a", { href: ICL.router.hashFor(sec.id), "aria-current": route.screen === sec.id && !route.entity ? "page" : null, title: statusText[st], dataset: { fb: "nav:" + sec.id, fbLabel: "Step: " + ICL.t(sec.title) } }, statusIcon(st), num ? h("span", { class: "num" }, num + ".") : null, h("span", null, ICL.t(sec.short || sec.title)), assumedBy[sec.id] ? h("span", { class: "cnt", title: `${assumedBy[sec.id]} assumed values` }, `≈${assumedBy[sec.id]}`) : null, fbCounts && fbCounts[sec.id] ? h("span", { class: "fbc", title: "feedback items" }, fbCounts[sec.id]) : null));
      ul.append(li);
      if (sec.entity && st !== "off") {
        (state[sec.id] || []).forEach((e, i) => {
          const est = val.errors.some((x) => x.screen === sec.id && x.entityId === e.id) ? "block" : "done";
          ul.append(h("li", { class: "child" }, h("a", { href: ICL.router.hashFor(sec.id, e.id), "aria-current": route.screen === sec.id && route.entity === e.id ? "page" : null }, statusIcon(est), h("span", { class: "num" }, `${num}.${i + 1}`), h("span", null, entityLabel(sec.id, e, state)))));
        });
        ul.append(h("li", { class: "child add" }, h("a", { href: ICL.router.hashFor(sec.id, "new") }, statusIcon("opt"), h("span", null, "+ Add " + (sec.entity === "plot" ? ICL.dict.words().plot : sec.entity)))));
      }
    }
    ul.append(h("li", null, h("a", { href: "#feedback" }, statusIcon("opt"), h("span", null, "Feedback dashboard"))));
    ul.append(h("li", { class: "sep" }), h("li", null, h("a", { href: "#welcome" }, statusIcon("opt"), h("span", null, "What is iCLEANED?"))));
    nav.append(ul);
  }

  function wizardOrder(state) { return D.sections().filter((s) => s.wizard && C.sectionVisible(s, state)).map((s) => s.id); }
  function renderWizardBar(state, val) {
    const bar = document.getElementById("wizard-bar"); bar.innerHTML = "";
    const order = wizardOrder(state); const i = order.indexOf(state.route.screen);
    if (i === -1) { bar.hidden = true; return; } bar.hidden = false;
    const prev = order[i - 1], next = order[i + 1];
    const errs = val.errors.filter((e) => e.screen === state.route.screen).length;
    bar.append(
      h("button", { type: "button", class: "btn ghost", disabled: !prev, onclick: () => ICL.router.go(prev) }, "← Back"),
      h("span", { class: "stepinfo" }, `Step ${ICL.num.stepOf(state.route.screen) || i + 1} of ${ICL.num.totalSteps()}`, errs ? h("span", { class: "msg err" }, ` · ${errs} thing${errs > 1 ? "s" : ""} to fix`) : ""),
      h("button", { type: "button", class: "btn", disabled: !next, onclick: () => ICL.router.go(next) }, next === "check" ? "Check & run →" : "Next →"));
  }

  function renderTopbar(state) {
    const el = document.getElementById("topbar-scenario"); el.innerHTML = "";
    if (state.route.screen === "home" || state.route.screen === "feedback") return;
    const row = (state.library.scenarios || []).find((x) => x.id === state.meta.id);
    const SC = { farm: "one farm", group: "group of farms", region: "region", national: "national herd" };
    el.append(h("strong", { class: "chip", title: "Open scenario" }, state.meta.scenario_name || "Untitled scenario"),
      h("span", { class: "chip", title: "Scale and size of the open scenario" }, SC[state.system.scale] || "one farm", row && row.headline ? " · " + row.headline : ""),
      (() => { const copy = D.activeCopy(); const n = copy ? D.changeCount(copy) : 0; return h("span", { class: "chip c-db" }, copy ? "✎ " : "🔒 ", "Defaults from: ", copy ? copy.label + " (my copy" + (n ? `, ${n} change${n === 1 ? "" : "s"}` : "") + ")" : (state.meta.param_set || "—"), " ", h("a", { href: "#parameters" }, copy ? "edit" : "view")); })(),
      h("span", { class: "chip" }, state.meta.project || "no project"));
    document.getElementById("main").querySelector(".fb-banner") && null;
  }

  // ---- preview panel --------------------------------------------------------
  let lastJson = null;
  function renderPreview(state, compiled) {
    const pre = document.getElementById("preview-json"); if (!pre) return;
    const { input, prov } = compiled;
    const lines = [];
    const cls = (p) => { const v = prov[p]; return v ? "v-" + v : ""; };
    function emit(val, path, indent, keyName, isLast) {
      const pad = "  ".repeat(indent); const key = keyName != null ? `<span class="k">"${keyName}"</span>: ` : "";
      if (Array.isArray(val)) {
        if (!val.length) { lines.push(`${pad}${key}[]${isLast ? "" : ","}`); return; }
        lines.push(`${pad}${key}[`); val.forEach((v, i) => emit(v, `${path}[${i}]`, indent + 1, null, i === val.length - 1)); lines.push(`${pad}]${isLast ? "" : ","}`);
      } else if (val && typeof val === "object") {
        const keys = Object.keys(val); lines.push(`${pad}${key}{`); keys.forEach((k, i) => emit(val[k], path ? `${path}.${k}` : k, indent + 1, k, i === keys.length - 1)); lines.push(`${pad}}${isLast ? "" : ","}`);
      } else {
        const changed = lastJson && JSON.stringify(lastJson[path]) !== JSON.stringify(val) ? " changed" : "";
        const shown = val === null ? "null" : typeof val === "string" ? `"${escapeHtml(val)}"` : String(val);
        lines.push(`${pad}${key}<span class="${cls(path)}${changed}" title="${prov[path] || ""}">${shown}</span>${isLast ? "" : ","}`);
      }
    }
    emit(input, "", 0, null, true);
    pre.innerHTML = lines.join("\n");
    const flat = {}; (function walk(v, p) { if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${p}[${i}]`)); else if (v && typeof v === "object") Object.entries(v).forEach(([k, x]) => walk(x, p ? `${p}.${k}` : k)); else flat[p] = v; })(input, "");
    lastJson = flat;
  }
  const escapeHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  function renderRating(state, screenId) {
    const body = document.getElementById("rating-body"); const strip = document.getElementById("rating-strip"); if (!body) return;
    const sec = D.section(screenId); strip.hidden = !sec || !sec.wizard; if (strip.hidden) return;
    body.innerHTML = "";
    const cur = (state.fb.ratings || []).find((r) => r.screen === screenId && r.viewerId === state.fb.viewerId) || {};
    const scale = h("div", { class: "scale", role: "radiogroup", "aria-label": "Clarity 1 to 5" });
    for (let i = 1; i <= 5; i++) { const r = h("input", { type: "radio", name: "rate_" + screenId, value: i }); r.checked = cur.clarity === i; r.addEventListener("change", () => ICL.fb.rate(screenId, { clarity: i })); scale.append(h("label", null, r, h("span", null, String(i)))); }
    const know = h("div", { class: "scale", role: "radiogroup", "aria-label": "Would you know what to enter?" });
    for (const [v, l] of [[true, "Yes"], [false, "No"]]) { const r = h("input", { type: "radio", name: "know_" + screenId }); r.checked = cur.knowWhat === v; r.addEventListener("change", () => ICL.fb.rate(screenId, { knowWhat: v })); know.append(h("label", null, r, h("span", null, l))); }
    body.append(h("span", null, "How clear is this screen? ", h("small", null, "1 = confusing, 5 = very clear")), scale, h("span", null, "Would you know what to enter here?"), know);
  }

  ICL.layout = { renderSidebar, renderWizardBar, renderTopbar, renderPreview, renderRating, wizardOrder, statusFor, entityLabel };
})(window.ICL);
