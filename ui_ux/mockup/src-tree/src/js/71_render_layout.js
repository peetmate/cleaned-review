/* Layout: topbar scenario chip, sidebar tree with status, wizard bar, preview panel, rating strip. */
(function (ICL) {
  const { h, fmt } = ICL; const D = ICL.dict, C = ICL.cond;
  const REFERENCE = ["boundary", "help"]; // reading, not steps: listed at the bottom

  function statusFor(sectionId, state, val, entityId) {
    const sec = D.section(sectionId);
    if (!C.sectionVisible(sec, state)) return "off";
    const errs = val.errors.filter((e) => e.screen === sectionId && (entityId == null || e.entityId === entityId || e.entityId == null));
    if (errs.length) return "block";
    if (sec.optional) return "opt";
    if (sectionId === "boundary") return state.ui.boundarySeen ? "done" : "none";
    if (sec.entity) { const list = state[sectionId] || []; if (!list.length) return "none"; }
    if (sectionId === "check") return val.errors.length ? "block" : "done";
    if (sectionId === "results" || sectionId === "home" || sectionId === "parameters" || sectionId === "batch") return "opt";
    if (sectionId === "fertiliser") return Object.values(state.fertilizer || {}).some((v) => v != null && v !== "") ? "done" : "none";
    // The feeding plan lives in `allocation`, which is not provenance-tracked.
    if (sectionId === "feeding") return Object.values(state.allocation || {}).some((byAnimal) => Object.values(byAnimal || {}).some((row) => Object.keys(row || {}).length)) ? "done" : "none";
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

  const groups = () => window.ICL_SCHEMA.navGroups || [];
  // Tabs that live inside a single-screen section, surfaced in the sidebar.
  const SUBNAV = {
    why: (state) => ({ path: "ui.whyTab", current: state.ui.whyTab || "question", route: "why",
      items: [["question", "The question it answers"], ["offer", "What we offer"], ["partners", "Working with partners"], ["cases", "Use cases"], ["compare", "How it compares"]] }),
    results: (state) => ({ path: "ui.resultsTab", current: state.ui.resultsTab || "summary", route: "results",
      items: [["summary", "Summary"], ["ghg", "Greenhouse gases"], ["land", "Land & feed"], ["water", "Water"], ["nitrogen", "Nitrogen"], ["compare", "Compare"]] }),
    batch: (state) => (state.batch && state.batch.rows && state.batch.rows.length
      ? { path: "batch.tab", current: (state.batch || {}).tab || "check", route: "batch",
          items: [["check", "QAQC check", state.batch.rows.length], ["viz", "Visualise the batch"], ["export", "Download"]] }
      : null),
    scenarios: (state) => ({ path: "ui.homeTab", current: state.ui.homeTab || "mine", route: "home",
      items: [["mine", "My scenarios", (state.library.scenarios || []).filter((x) => x.owner === "you" && !x.template).length],
              ["shared", "Shared with me", (state.library.scenarios || []).filter((x) => x.owner !== "you" && !x.template).length],
              ["templates", "Templates", (state.library.scenarios || []).filter((x) => x.template).length]] }),
    parameters: (state) => ({ path: "ui.paramTab", current: state.ui.paramTab || "Animal types", route: "parameters",
      items: [["Animal types", "Animal types"], ["Feeds & crops", "Feeds & crops"], ["Soils & slopes", "Soils & slopes"], ["Land cover", "Land cover"], ["Fertilisers", "Fertilisers"], ["Manure systems", "Manure systems"], ["Land-use factors", "Land-use factors"], ["Fixed constants", "Fixed constants"], ["Propose a change", "Propose a change"]] }),
    features: (state) => ({ path: "ui.featureFilter", current: state.ui.featureFilter || "open", route: "features",
      items: [["open", "Open requests"], ["shipped", "Already in the mockup"], ["all", "Everything"]] }),
  };
  const groupOf = (screenId) => { const sec = D.section(screenId); return (sec && sec.group) || (screenId === "feedback" ? "help" : "describe"); };

  /** Major sections across the top; the sidebar is then only the sub-sections of one. */
  function renderTopnav(state, val, fbCounts) {
    const nav = document.getElementById("topnav"); if (!nav) return;
    nav.innerHTML = "";
    const cur = groupOf(state.route.screen);
    for (const g of groups()) {
      const secs = D.sections().filter((x) => x.group === g.id);
      const errs = val.errors.filter((e) => secs.some((x) => x.id === e.screen)).length;
      const a = h("a", { class: "topnav-tab" + (g.id === cur ? " on" : ""), href: "#" + g.home, title: g.hint,
        "aria-current": g.id === cur ? "page" : null, dataset: { fb: "nav:group:" + g.id, fbLabel: "Section: " + g.label } },
        h("span", null, g.label));
      if (g.id === "describe") {
        const done = D.sections().filter((x) => x.wizard && C.sectionVisible(x, state) && statusFor(x.id, state, val) === "done").length;
        a.append(h("span", { class: "cnt" }, `${done}/${ICL.num.totalSteps()}`));
      }
      if (errs) a.append(h("span", { class: "badge" }, String(errs)));
      if (g.id === "features") { const n = (state.features || []).filter((f) => f.status !== "shipped").length; if (n) a.append(h("span", { class: "cnt" }, String(n))); }
      nav.append(a);
    }
    const fbN = (state.fb.docs || []).length;
    nav.append(h("a", { class: "topnav-tab side" + (state.route.screen === "feedback" ? " on" : ""), href: "#feedback", title: "Everything reported in this session" },
      h("span", null, "\u270e Feedback"), fbN ? h("span", { class: "cnt" }, String(fbN)) : null));
  }

  function renderSidebar(state, val, fbCounts) {
    const nav = document.getElementById("sidebar-nav"); nav.innerHTML = "";
    const ul = h("ul");
    const route = state.route;
    const assumedBy = {}; for (const a of val.assumptions) assumedBy[a.screen] = (assumedBy[a.screen] || 0) + 1;
    const CHILDREN = {}; for (const sec of D.sections()) if (sec.parent) (CHILDREN[sec.parent] = CHILDREN[sec.parent] || []).push(sec);
    const cur = groupOf(state.route.screen);
    const g = groups().find((x) => x.id === cur);
    const inGroup = D.sections().filter((x) => x.group === cur && !x.parent);
    ul.append(h("li", { class: "grp" }, g ? g.label : "Steps"));
    if (g && g.hint) ul.append(h("li", { class: "grp-hint" }, g.hint));
    const hideSelf = inGroup.length === 1 && !!SUBNAV[cur];
    for (const sec of inGroup) {
      if (sec.parent || hideSelf) continue;
      const st = statusFor(sec.id, state, val);
      const num = ICL.num.prefix(sec.id);
      const li = h("li", null, h("a", { href: ICL.router.hashFor(sec.id), "aria-current": route.screen === sec.id && !route.entity ? "page" : null, title: statusText[st], dataset: { fb: "nav:" + sec.id, fbLabel: "Step: " + ICL.t(sec.title) } }, statusIcon(st), num ? h("span", { class: "num" }, num + ".") : null, h("span", null, ICL.t(sec.short || sec.title)), assumedBy[sec.id] ? h("span", { class: "cnt", title: `${assumedBy[sec.id]} assumed values` }, `≈${assumedBy[sec.id]}`) : null, fbCounts && fbCounts[sec.id] ? h("span", { class: "fbc", title: "feedback items" }, fbCounts[sec.id]) : null));
      ul.append(li);
      if (sec.entity && st !== "off") {
        // The sidebar is a map of the steps, never a list of records. Records are
        // reached through tabs on their own screen, so a hundred feeds cost one line.
        const list = state[sec.id] || [];
        const errCount = list.filter((e) => val.errors.some((x) => x.screen === sec.id && x.entityId === e.id)).length;
        const a = li.querySelector("a");
        if (list.length) a.append(h("span", { class: "cnt", title: `${list.length} ${list.length === 1 ? sec.entity : sec.entity + "s"}${errCount ? `, ${errCount} to fix` : ""}` }, "\u00d7" + list.length));
      }
      // Sections that are part of this step (seasons, land) hang under it rather than
      // taking a step number of their own.
      for (const kid of CHILDREN[sec.id] || []) {
        const kst = statusFor(kid.id, state, val);
        if (kst === "off") continue;
        const list = state[kid.id] || [];
        const kerr = val.errors.filter((e) => e.screen === kid.id).length;
        ul.append(h("li", { class: "child" }, h("a", { href: ICL.router.hashFor(kid.id), "aria-current": route.screen === kid.id ? "page" : null, dataset: { fb: "nav:" + kid.id, fbLabel: "Part of a step: " + ICL.t(kid.title) } },
          statusIcon(kerr ? "block" : kst),
          h("span", null, ICL.t(kid.short || kid.title)),
          list.length ? h("span", { class: "cnt", title: `${list.length} in this step` }, "\u00d7" + list.length) : null)));
      }
    }
    // A group that is one screen has sub-sections inside the page: put its tabs in the
    // sidebar, so the sidebar is always the level below the horizontal nav.
    const sub = SUBNAV[cur] && SUBNAV[cur](state);
    if (sub) {
      for (const [key, label, count] of sub.items) {
        const on = sub.current === key;
        ul.append(h("li", { class: hideSelf ? "" : "child" }, h("a", { href: "#" + (g ? g.home : ""), "aria-current": on ? "true" : null,
          onclick: (ev) => { ev.preventDefault(); ICL.store.update(sub.path, key); if (state.route.screen !== sub.route) ICL.router.go(sub.route); } },
          statusIcon(on ? "done" : "opt"), h("span", null, label), count != null ? h("span", { class: "cnt" }, String(count)) : null)));
      }
    }
    if (cur === "describe") ul.append(h("li", { class: "sep" }), h("li", null, h("a", { href: "#results" }, statusIcon("opt"), h("span", null, "See the results \u2192"))));
    if (cur === "help") ul.append(h("li", { class: "sep" }), h("li", null, h("a", { href: "#feedback" }, statusIcon("opt"), h("span", null, "Feedback dashboard"))));
    nav.append(ul);
  }

  /** "Draft saved · just now" — the visible half of the crash-safety requirement. */
  function renderDraft() {
    const el = document.getElementById("draft-state"); if (!el) return;
    const d = ICL.draft || {};
    el.innerHTML = "";
    if (d.failed) {
      el.append(h("span", { class: "msg err", title: "This browser refused to store the draft (private window, or storage full). Export from Check & run so the work is not lost." }, "Draft not saved"));
      return;
    }
    if (!d.savedAt) { el.append(h("span", { class: "small" }, "Nothing typed yet")); return; }
    const secs = Math.round((Date.now() - d.savedAt) / 1000);
    const when = secs < 10 ? "just now" : secs < 90 ? `${secs}s ago` : `${Math.round(secs / 60)} min ago`;
    el.append(h("span", { class: "small", title: "Every change is kept in this browser as you type, so closing the tab or losing the connection does not lose the form. In the real app this draft also syncs to your account." },
      "\u2713 Draft saved \u00b7 " + when));
  }

  function wizardOrder(state) { return D.sections().filter((s) => s.wizard && C.sectionVisible(s, state)).map((s) => s.id); }
  function renderWizardBar(state, val) {
    renderDraft();
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
    // Build stamp in the header: the only way to tell at a glance whether what you
    // are looking at includes the last change.
    const bb = document.getElementById("brand-build");
    if (bb) {
      const b = ICL.env.build;
      bb.textContent = "";
      bb.append(h("span", { class: "bt-name" }, "Scenario Builder · mockup "), h("span", { class: "bt-ver" }, ICL.buildShort()));
      bb.title = "Build " + ICL.buildLong();
    }
    const el = document.getElementById("topbar-scenario"); el.innerHTML = "";
    if (state.route.screen === "home" || state.route.screen === "feedback") return;
    const row = (state.library.scenarios || []).find((x) => x.id === state.meta.id);
    const SC = { farm: "one enterprise", group: "group of enterprises", region: "region", national: "national herd" };
    // Each chip says what it is, and its tooltip says how the things nest.
    const NEST = "How it nests: project \u2192 scenarios \u2192 the herds, land and feeds described in each. A parameter set sits beside them and supplies the default values.";
    const chip = (kind, label, value, title, cls, extra) => h("span", { class: "chip tb-chip" + (cls ? " " + cls : ""), title },
      h("span", { class: "k" }, label), h("span", { class: "v" }, value), extra || null);
    el.append(
      chip("project", "Project", state.meta.project || "none",
        `A project groups scenarios that belong together \u2014 one study, one district, one piece of work \u2014 and the people who may see them. Scenarios in a project can be compared with each other. ${NEST}`),
      chip("scenario", "Scenario", state.meta.scenario_name || "Untitled",
        `One complete description of one livestock enterprise for one year: the animals, the land that feeds them and their manure. A baseline describes things as they are; an intervention is a copy with something changed. ${NEST}`),
      chip("scale", "Describes", (SC[state.system.scale] || "one enterprise") + (row && row.headline ? " \u00b7 " + row.headline : ""),
        "What this scenario stands for, and its size. The same questions are asked from a household herd to a national one; only the numbers change. Set it on step 1."),
      (() => {
        const copy = D.activeCopy(); const n = copy ? D.changeCount(copy) : 0;
        return chip("params", "Defaults from", (copy ? copy.label + " (my copy" + (n ? `, ${n} change${n === 1 ? "" : "s"}` : "") + ")" : (state.meta.param_set || "\u2014")),
          "The parameter set: reference values this scenario starts from \u2014 animal weights, feed quality, soil factors. Shipped sets are read-only; a copy of one can be edited and shared with a project. Values you type always win over it.",
          "c-db", [" ", h("a", { href: "#parameters" }, copy ? "edit" : "view")]);
      })());
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

  ICL.layout = { renderDraft, renderTopnav, renderSidebar, renderWizardBar, renderTopbar, renderPreview, renderRating, wizardOrder, statusFor, entityLabel };
})(window.ICL);
