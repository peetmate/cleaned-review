/* Tiny store: state object, path updates, subscribers, rAF-batched notify, localStorage persistence. */
(function (ICL) {
  const KEY = "icleaned.mockup.state.v1";
  const PERSIST = ["meta", "system", "farm", "provenance", "plots", "seasons", "herds", "animals", "feeds", "fertilizer", "allocation", "library", "ui", "paramSets"];

  function freshState() {
    const demo = JSON.parse(JSON.stringify(window.ICL_DEMO || {}));
    return {
      route: { screen: "home", entity: null },
      meta: demo.meta, system: demo.system, farm: demo.farm, provenance: demo.provenance || {},
      plots: demo.plots || [], seasons: demo.seasons || [], herds: demo.herds || [], animals: demo.animals || [], feeds: demo.feeds || [],
      fertilizer: demo.fertilizer || {}, allocation: demo.allocation || {}, library: demo.library || { scenarios: [], projects: [] }, paramSets: { copies: [] },
      ui: { theme: "auto", showTech: false, previewOpen: window.innerWidth > 1100, variant: {}, feedingSeason: null, feedingHerd: null, dmMode: false, sidebarOpen: false, boundarySeen: false },
      fb: { mode: "off", adapterName: "none", canWrite: null, viewerId: null, viewerLabel: "", group: "", session: "workshop-2026-10", docs: [], ratings: [], votes: [], focusSnapshot: null },
    };
  }

  function createStore() {
    let state = freshState();
    const saved = ICL.storage.get(KEY, null);
    if (saved && saved.meta) for (const k of PERSIST) if (saved[k] !== undefined) state[k] = saved[k];
    state.ui = Object.assign(freshState().ui, state.ui || {}); state.paramSets = state.paramSets || { copies: [] };
    const subs = new Set();
    let scheduled = false, saveT = null;
    const notify = () => {
      if (scheduled) return; scheduled = true;
      requestAnimationFrame(() => { scheduled = false; for (const fn of subs) { try { fn(state); } catch (e) { console.error(e); } } });
    };
    const persist = () => { clearTimeout(saveT); saveT = setTimeout(() => { const out = {}; for (const k of PERSIST) out[k] = state[k]; ICL.storage.set(KEY, out); }, 300); };
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
      reset() { state = freshState(); ICL.storage.del(KEY); persist(); notify(); },
      notify,
    };
    return api;
  }
  ICL.createStore = createStore;
  ICL.freshState = freshState;
})(window.ICL);
