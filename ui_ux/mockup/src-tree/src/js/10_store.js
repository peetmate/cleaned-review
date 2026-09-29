/* Tiny store: state object, path updates, subscribers, rAF-batched notify, localStorage persistence. */
(function (ICL) {
  const SCHEMA_VERSION = (window.ICL_SCHEMA && window.ICL_SCHEMA.version) || "0";
  const KEY = "icleaned.mockup.state.v1";
  const PREFS_KEY = "icleaned.mockup.prefs.v1";
  const PERSIST = ["meta", "system", "farm", "provenance", "plots", "seasons", "herds", "animals", "feeds", "fertilizer", "allocation", "library", "ui", "paramSets"];

  const LIB = () => window.ICL_SCENARIOS || { scenarios: {}, library: [], projects: [], default: null };
  /** The saved dataset of one example scenario, deep-copied. */
  function dataset(id) {
    const all = LIB().scenarios || {};
    const sc = all[id] || all[LIB().default] || {};
    return JSON.parse(JSON.stringify(sc));
  }
  const DATA_KEYS = ["meta", "system", "farm", "provenance", "plots", "seasons", "herds", "animals", "feeds", "fertilizer", "allocation"];

  function freshState() {
    const d = dataset(LIB().default);
    return {
      route: { screen: "home", entity: null },
      meta: d.meta || {}, system: d.system || {}, farm: d.farm || {}, provenance: d.provenance || {},
      plots: d.plots || [], seasons: d.seasons || [], herds: d.herds || [], animals: d.animals || [], feeds: d.feeds || [],
      fertilizer: d.fertilizer || {}, allocation: d.allocation || {}, library: { scenarios: (LIB().library || []).slice(), projects: (LIB().projects || []).slice() }, paramSets: { copies: [] },
      ui: { theme: "auto", showTech: false, previewOpen: window.innerWidth > 1100, variant: {}, feedingSeason: null, feedingHerd: null, dmMode: false, sidebarOpen: false, boundarySeen: false, addGroupTo: null, paramRow: null, paramUnlocked: false, unlockFeed: null },
      fb: { mode: "off", adapterName: "none", canWrite: null, viewerId: null, viewerLabel: "", group: "", session: "workshop-2026-10", docs: [], ratings: [], votes: [], focusSnapshot: null },
    };
  }

  function createStore() {
    let state = freshState();
    const saved = ICL.storage.get(KEY, null);
    if (saved && saved.meta) {
      for (const k of PERSIST) if (saved[k] !== undefined) state[k] = saved[k];
      // merge shape changes from a newer dictionary onto persisted objects
      const fresh = freshState();
      state.system = Object.assign({}, fresh.system, state.system || {});
      state.meta = Object.assign({}, fresh.meta, state.meta || {});
      if (saved._schema !== SCHEMA_VERSION) setTimeout(() => ICL.toast && ICL.toast("The questions were updated since your last visit; saved answers were kept where they still apply."), 800);
    }
    state.ui = Object.assign(freshState().ui, state.ui || {}); state.paramSets = state.paramSets || { copies: [] };
    const prefs = ICL.storage.get(PREFS_KEY, null); if (prefs) Object.assign(state.fb, { session: prefs.session || state.fb.session, viewerLabel: prefs.viewerLabel || "", group: prefs.group || "" });
    const subs = new Set();
    let scheduled = false, saveT = null;
    const notify = () => {
      if (scheduled) return; scheduled = true;
      // rAF does not fire while the page is hidden or not painted; race it with a short timeout so updates never stall
      let done = false; const run = () => { if (done) return; done = true; scheduled = false; for (const fn of subs) { try { fn(state); } catch (e) { console.error(e); } } };
      const t = setTimeout(run, 40); requestAnimationFrame(() => { clearTimeout(t); run(); });
    };
    const persist = () => { clearTimeout(saveT); saveT = setTimeout(() => { const out = { _schema: SCHEMA_VERSION, _build: ICL.env.build.version }; for (const k of PERSIST) out[k] = state[k]; ICL.storage.set(KEY, out); ICL.storage.set(PREFS_KEY, { session: state.fb.session, viewerLabel: state.fb.viewerLabel, group: state.fb.group }); }, 300); };
    const api = {
      get: () => state,
      set(patch) { state = typeof patch === "function" ? patch(state) : Object.assign(state, patch); persist(); notify(); },
      // path like "farm.annual_prec" or "animals[a1].herd_n" or "allocation.s1.a1.f1"
      update(path, value, prov) {
        const segs = path.split(".");
        let obj = state;
        for (let i = 0; i < segs.length - 1; i++) {
          const m = segs[i].match(/^(\w+)\[(.+)\]$/);
          if (m) { const arr = obj[m[1]]; let it = arr.find((x) => x.id === m[2]); if (!it) { it = { id: m[2] }; arr.push(it); } obj = it; }
          else { if (obj[segs[i]] == null || typeof obj[segs[i]] !== "object") obj[segs[i]] = {}; obj = obj[segs[i]]; }
        }
        obj[segs[segs.length - 1]] = value;
        if (prov !== undefined) { if (prov) state.provenance[path] = prov; else delete state.provenance[path]; }
        persist(); notify();
      },
      subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
      reset() { const fb = state.fb, route = state.route, copies = state.paramSets; state = freshState(); state.fb = fb; state.route = route; state.paramSets = copies; ICL.storage.del(KEY); persist(); notify(); },
      /** Load one of the example scenarios, keeping feedback, parameter-set copies and the library. */
      load(id) {
        const d = dataset(id); if (!d.meta) return false;
        const lib = state.library; const known = lib.scenarios.find((x) => x.id === id);
        for (const k of DATA_KEYS) state[k] = d[k] !== undefined ? d[k] : (Array.isArray(state[k]) ? [] : {});
        if (known && known.owner) state.meta.owner = known.owner;
        state.library = lib;
        state.ui = Object.assign(state.ui, { feedingSeason: null, feedingHerd: null, paramTab: null, paramRow: null, paramUnlocked: false, unlockFeed: null, addGroupTo: null, validateAll: false, homeTab: state.ui.homeTab });
        persist(); notify(); return true;
      },
      /** Copy the scenario that is open into a new library entry. */
      duplicateOpen(newName) {
        const id = ICL.uid("sc");
        const copy = {}; for (const k of DATA_KEYS) copy[k] = JSON.parse(JSON.stringify(state[k]));
        copy.meta = Object.assign({}, copy.meta, { id, scenario_name: newName, owner: "you" });
        (window.ICL_SCENARIOS = window.ICL_SCENARIOS || { scenarios: {} }).scenarios[id] = copy;
        const head = state.animals.reduce((t, a) => t + (Number(a.herd_n) || 0), 0);
        const ha = state.plots.reduce((t, p) => t + (Number(p.plot_area_ha) || 0), 0);
        state.library.scenarios.unshift({ id, name: newName, owner: "you", project: state.meta.project, param_set: state.meta.param_set, updated: new Date().toISOString().slice(0, 10), purpose: state.meta.scenario_purpose, shared: [], scale: state.system.scale || "farm", headline: `${Math.round(head)} animals · ${Math.round(ha * 10) / 10} ha · ${state.seasons.length} season${state.seasons.length > 1 ? "s" : ""}` });
        persist(); notify(); return id;
      },
      notify,
    };
    return api;
  }
  ICL.createStore = createStore;
  ICL.freshState = freshState;
})(window.ICL);
