/* Boot: store, router, render loop, toolbar wiring, feedback init. */
(function (ICL) {
  const { h } = ICL;
  ICL.store = ICL.createStore();
  const app = document.getElementById("app");
  // theme
  const applyTheme = (t) => { const root = document.documentElement; if (t === "auto") delete root.dataset.theme; else root.dataset.theme = t; };
  applyTheme(ICL.store.get().ui.theme);

  let lastKey = null;
  // Stable focus key: nearest [data-fb] + control identity + index among controls in that container.
  const CONTROLS = "input, select, textarea, button, a[href], summary";
  function focusKeyOf(el, root) {
    const box = el.closest("[data-fb]") || root; const ctrls = [...box.querySelectorAll(CONTROLS)];
    return { fb: box.dataset ? box.dataset.fb || "" : "", ident: el.getAttribute("aria-label") || el.name || el.id || "", idx: ctrls.indexOf(el), tag: el.tagName };
  }
  function findByFocusKey(k, root) {
    const box = k.fb ? root.querySelector(`[data-fb="${k.fb.replace(/"/g, '\\"')}"]`) : root; if (!box) return null;
    const ctrls = [...box.querySelectorAll(CONTROLS)];
    return (k.ident && ctrls.find((c) => (c.getAttribute("aria-label") || c.name || c.id || "") === k.ident && c.tagName === k.tag)) || ctrls[k.idx] || null;
  }
  function render(state) {
    let compiled, val;
    try { compiled = ICL.compile(state); } catch (e) { console.error(e); compiled = { input: {}, prov: {}, assumed: [], blocked: [{ path: "compile", msg: "Internal: " + e.message }] }; }
    try { val = ICL.validate(state); } catch (e) { console.error(e); val = { errors: [{ fieldId: null, screen: "check", entityId: null, path: "validate", label: "Internal", msg: "Internal: " + e.message }], warnings: [], assumptions: [], fromDb: [] }; }
    app.classList.toggle("show-tech", !!state.ui.showTech);
    app.classList.toggle("preview-hidden", !state.ui.previewOpen);
    document.getElementById("btn-technical").setAttribute("aria-pressed", String(!!state.ui.showTech));
    document.getElementById("btn-preview").setAttribute("aria-pressed", String(!!state.ui.previewOpen));
    const fbCounts = {}; for (const d of state.fb.docs || []) fbCounts[d.screen] = (fbCounts[d.screen] || 0) + 1;
    const cnt = document.getElementById("fb-count"); cnt.textContent = String((state.fb.docs || []).length); cnt.hidden = !(state.fb.docs || []).length;
    ICL.layout.renderTopbar(state); ICL.layout.renderSidebar(state, val, fbCounts); ICL.layout.renderWizardBar(state, val); if (state.ui.previewOpen) ICL.layout.renderPreview(state, compiled); ICL.layout.renderRating(state, state.route.screen);
    const screen = document.getElementById("screen");
    const key = JSON.stringify(state.route);
    const active = document.activeElement; const focusKey = active && screen.contains(active) ? focusKeyOf(active, screen) : null; const scrollY = window.scrollY;
    screen.innerHTML = "";
    const fn = ICL.screens[state.route.screen] || ICL.screens.home;
    const sec = ICL.dict.section(state.route.screen);
    if (sec && !ICL.cond.sectionVisible(sec, state) && state.route.screen !== "home") {
      screen.append(h("div", { class: "screen-head" }, h("h1", null, ICL.num.prefix(sec.id) ? ICL.num.prefix(sec.id) + ". " + ICL.t(sec.title) : ICL.t(sec.title))), h("div", { class: "callout" }, ICL.t("This step is not needed for this {enterprise}, based on your answers under "), h("a", { href: "#about" }, ICL.t("About this {about}")), "."));
    } else fn(screen, { state, val, compiled, store: ICL.store });
    if (state.fb.focusSnapshot && state.fb.focusSnapshot.route && state.fb.focusSnapshot.route !== ICL.router.hashFor(state.route.screen, state.route.entity)) { setTimeout(() => ICL.store.set((s) => { s.fb.focusSnapshot = null; return s; }), 0); }
    if (state.route.screen === "check" && !state.ui.validateAll) setTimeout(() => ICL.store.update("ui.validateAll", true), 0);
    if (state.fb.focusSnapshot) { screen.prepend(h("div", { class: "fb-banner" }, `Showing the page as the participant saw it (${state.fb.focusSnapshot.label}). `, h("button", { type: "button", onclick: () => ICL.store.set((s) => { s.fb.focusSnapshot = null; return s; }) }, "Back to my view"))); }
    if (key === lastKey) { if (focusKey) { const el = findByFocusKey(focusKey, screen); if (el) { el.focus({ preventScroll: true }); if (el.select && el.type === "text") { try { const n = el.value.length; el.setSelectionRange(n, n); } catch {} } } } window.scrollTo(0, scrollY); }
    else { window.scrollTo(0, 0); }
    lastKey = key;
    ICL.num.numberHeadings(screen, state.route.screen);
    if (state.fb.mode === "comment") screen.querySelectorAll("[data-fb]").forEach((el) => { if (!el.matches("a,button,input,select,textarea")) el.setAttribute("tabindex", "0"); });
  }
  ICL.store.subscribe(render);

  // toolbar
  document.getElementById("btn-technical").addEventListener("click", () => ICL.store.update("ui.showTech", !ICL.store.get().ui.showTech));
  document.getElementById("btn-preview").addEventListener("click", () => ICL.store.update("ui.previewOpen", !ICL.store.get().ui.previewOpen));
  const themeBtn = document.getElementById("btn-theme");
  const labelTheme = () => { const cur = ICL.store.get().ui.theme; const isDark = cur === "dark" || (cur === "auto" && matchMedia("(prefers-color-scheme: dark)").matches); themeBtn.textContent = isDark ? "◐ Theme: dark" : "◐ Theme: light"; themeBtn.setAttribute("aria-label", isDark ? "Switch to light theme" : "Switch to dark theme"); };
  themeBtn.addEventListener("click", () => { const cur = ICL.store.get().ui.theme; const isDark = cur === "dark" || (cur === "auto" && matchMedia("(prefers-color-scheme: dark)").matches); const next = isDark ? "light" : "dark"; applyTheme(next); ICL.store.update("ui.theme", next); labelTheme(); }); labelTheme();
  const closePrev = document.getElementById("btn-preview-close"); if (closePrev) closePrev.addEventListener("click", () => ICL.store.update("ui.previewOpen", false));
  document.getElementById("sidebar-toggle").addEventListener("click", (e) => { const b = e.currentTarget; const open = b.getAttribute("aria-expanded") === "true"; b.setAttribute("aria-expanded", String(!open)); });
  document.getElementById("sidebar-nav").addEventListener("click", (e) => { if (e.target.closest("a")) document.getElementById("sidebar-toggle").setAttribute("aria-expanded", "false"); });
  document.getElementById("btn-copy-json").addEventListener("click", () => { const txt = JSON.stringify(ICL.compile(ICL.store.get()).input, null, 2); navigator.clipboard.writeText(txt).then(() => ICL.toast("Copied the model input."), () => ICL.toast("Copy not allowed here; use Download.")); });
  document.getElementById("btn-download-json").addEventListener("click", async () => { const state = ICL.store.get(); const data = JSON.stringify(ICL.compile(state).input, null, 2); const filename = (state.meta.scenario_name || "scenario").replace(/[^\w-]+/g, "_") + ".json"; const dl = ICL.env.caps.downloads; if (dl) { try { await dl.save({ filename, data }); } catch (e) { if (e && e.code !== "declined") ICL.toast("Download not available here."); } return; } if (!ICL.env.hasClaude) { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([data], { type: "application/json" })); a.download = filename; document.body.append(a); a.click(); a.remove(); } else ICL.toast("Download unavailable in this view; use Copy."); });

  if (!location.hash && !ICL.store.get().ui.welcomeSeen) { location.replace("#welcome"); ICL.store.update("ui.welcomeSeen", true); }
  ICL.router.install(ICL.store);
  ICL.fb.installUI();
  ICL.fb.init().catch((e) => console.error("feedback init failed", e));
  console.info("iCLEANED mockup", ICL.env.build, "claude runtime:", ICL.env.hasClaude);
  // the "saved N min ago" label has to age on its own
  setInterval(() => { try { ICL.layout.renderDraft(); } catch {} }, 30000);
})(window.ICL);
