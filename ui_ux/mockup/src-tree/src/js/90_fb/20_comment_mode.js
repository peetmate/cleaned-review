/* Comment mode: hover outline on [data-fb], click → panel; highlight tool; screengrab. */
(function (ICL) {
  const { h } = ICL; const fb = ICL.fb;
  const TYPES = [["confusing", "Confusing"], ["missing", "Missing something"], ["wrong_unit", "Wrong unit or value"], ["love_it", "Works well"], ["dont_need", "Don't need this"], ["bug", "Bug"]];
  let mode = "off", panel = null, overlay = null, rectEl = null, dragging = null;

  function setMode(m) {
    mode = mode === m ? "off" : m;
    const app = document.getElementById("app");
    app.classList.toggle("fb-comment", mode === "comment");
    document.getElementById("fab-comment").setAttribute("aria-pressed", String(mode === "comment"));
    document.getElementById("fab-highlight").setAttribute("aria-pressed", String(mode === "highlight"));
    document.querySelectorAll("[data-fb]").forEach((el) => { if (mode === "comment") el.setAttribute("tabindex", el.getAttribute("tabindex") || "0"); else if (el.getAttribute("tabindex") === "0" && !el.matches("a,button,input,select,textarea")) el.removeAttribute("tabindex"); });
    if (mode === "highlight") startHighlight(); else stopHighlight();
    if (mode === "off") closePanel();
    ICL.store.set((s) => { s.fb.mode = mode; return s; });
    ICL.toast(mode === "comment" ? "Comment mode: click any field, button or section." : mode === "highlight" ? "Drag a rectangle over the area you want to talk about." : "Comment mode off.");
  }

  function onClick(ev) {
    if (mode !== "comment") return;
    const target = ev.target.closest("[data-fb]"); if (!target || ev.target.closest(".fb-panel") || ev.target.closest(".fb-fab")) return;
    ev.preventDefault(); ev.stopPropagation();
    openPanel(target, null);
  }
  function onKey(ev) { if (mode === "comment" && (ev.key === "Enter" || ev.key === " ") && ev.target.matches("[data-fb]") && !ev.target.matches("input,select,textarea,button,a")) { ev.preventDefault(); openPanel(ev.target, null); } if (ev.key === "Escape") { if (panel) closePanel(); else if (mode !== "off") setMode("off"); } }

  function openPanel(target, rect) {
    closePanel();
    const desc = fb.describe(target || document.getElementById("screen")); if (rect) desc.rect = rect;
    const state = ICL.store.get();
    const text = h("textarea", { placeholder: "What happened, what did you expect, or what would you change?", "aria-label": "Comment" });
    const chips = h("div", { class: "chips" }); const chosen = new Set();
    for (const [v, l] of TYPES) { const c = h("input", { type: "checkbox" }); c.addEventListener("change", () => (c.checked ? chosen.add(v) : chosen.delete(v))); chips.append(h("label", null, c, l)); }
    const sev = h("select", { "aria-label": "How serious" }, h("option", { value: "" }, "How serious?"), h("option", { value: "3" }, "Blocker: can't continue / wrong result"), h("option", { value: "2" }, "High"), h("option", { value: "1" }, "Low / cosmetic"));
    const who = h("input", { type: "text", placeholder: "Your name or table (optional)", value: state.fb.viewerLabel || "", "aria-label": "Your name or table" });
    const grp = h("input", { type: "text", placeholder: "Group, e.g. P03", value: state.fb.group || "", "aria-label": "Group", style: "max-width:110px" });
    const status = h("div", { class: "small", role: "status" });
    const save = async (withShot) => {
      if (!text.value.trim() && !chosen.size) { status.textContent = "Add a note or pick a tag first."; return; }
      ICL.store.set((s) => { s.fb.viewerLabel = who.value.trim(); s.fb.group = grp.value.trim(); return s; });
      status.textContent = withShot ? "Capturing screen…" : "Saving…";
      let shot = null; if (withShot) { closePanelVisualOnly(); ICL.toast("Capturing the screen…", 8000); shot = await fb.screengrab(document.getElementById("screen"), rect); }
      await fb.submit(Object.assign({}, desc, { text: text.value.trim(), types: [...chosen], severity: sev.value ? Number(sev.value) : null, screenshot: shot, viewerLabel: who.value.trim() || null, group: grp.value.trim() || null }));
      closePanel(); if (rectEl) { rectEl.remove(); rectEl = null; }
    };
    const nativeBtn = h("button", { type: "button", class: "btn-sm", onclick: async () => { const c = ICL.env.caps.comments; if (!c) { status.textContent = "Native comments are not available in this view."; return; } try { const r = await c.openComposer({ element: target || document.getElementById("screen") }); if (!r.opened) status.textContent = "Could not open the comment box right now."; } catch (e) { status.textContent = "Native commenting is off here."; } } }, "Open native comment");
    if (!ICL.env.caps.comments) nativeBtn.hidden = true;
    panel = h("div", { class: "fb-panel", role: "dialog", "aria-modal": "false", "aria-label": "Leave feedback", "data-html2canvas-ignore": "" },
      h("h3", null, "Feedback on: ", h("span", { class: "mono" }, desc.fbLabel)),
      h("div", { class: "ctx" }, `Screen: ${desc.screen}${desc.entityId ? " · " + desc.entityId : ""}${rect ? " · highlighted area" : ""}`),
      text, h("div", { class: "row" }, chips), h("div", { class: "row" }, sev, who, grp),
      h("div", { class: "row" }, h("button", { type: "button", class: "btn", onclick: () => save(false) }, "Save"), h("button", { type: "button", class: "btn secondary", onclick: () => save(true) }, "Save + screengrab"), nativeBtn, h("button", { type: "button", class: "btn ghost", onclick: closePanel }, "Cancel")),
      status);
    document.getElementById("fb-layer").append(panel);
    // position near target
    const r = (target || document.getElementById("screen")).getBoundingClientRect(); const pw = Math.min(380, innerWidth - 32);
    let left = Math.min(innerWidth - pw - 16, Math.max(16, r.left)); let top = r.bottom + 8; if (top + 320 > innerHeight) top = Math.max(16, r.top - 330);
    if (innerWidth < 600) { panel.style.left = "16px"; panel.style.right = "16px"; panel.style.bottom = "16px"; panel.style.width = "auto"; } else { panel.style.left = left + "px"; panel.style.top = top + "px"; }
    panel._returnFocus = document.activeElement; text.focus();
    panel.addEventListener("keydown", (e) => { if (e.key === "Tab") { const f = [...panel.querySelectorAll("textarea,input,select,button")].filter((x) => !x.hidden); const i = f.indexOf(document.activeElement); if (e.shiftKey && i === 0) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); } } });
  }
  function closePanelVisualOnly() { if (panel) panel.style.visibility = "hidden"; }
  function closePanel() { if (panel) { const rf = panel._returnFocus; panel.remove(); panel = null; if (rf && rf.focus) try { rf.focus(); } catch {} } }

  // ---- highlight tool ---------------------------------------------------------------
  function startHighlight() {
    const screen = document.getElementById("screen");
    overlay = h("div", { class: "fb-overlay", "data-html2canvas-ignore": "" }); screen.append(overlay);
    const pos = (e) => { const b = screen.getBoundingClientRect(); const p = e.touches ? e.touches[0] : e; return { x: p.clientX - b.left, y: p.clientY - b.top, W: b.width, H: b.height }; };
    overlay.addEventListener("pointerdown", (e) => { const p = pos(e); dragging = { x0: p.x, y0: p.y, W: p.W, H: p.H }; if (rectEl) rectEl.remove(); rectEl = h("div", { class: "fb-rect" }); screen.append(rectEl); overlay.setPointerCapture(e.pointerId); });
    overlay.addEventListener("pointermove", (e) => { if (!dragging) return; const p = pos(e); const x = Math.min(p.x, dragging.x0), y = Math.min(p.y, dragging.y0), w = Math.abs(p.x - dragging.x0), hh = Math.abs(p.y - dragging.y0); Object.assign(rectEl.style, { left: x + "px", top: y + "px", width: w + "px", height: hh + "px" }); dragging.cur = { x, y, w, h: hh }; });
    overlay.addEventListener("pointercancel", () => { dragging = null; if (rectEl) { rectEl.remove(); rectEl = null; } });
    overlay.addEventListener("pointerup", () => { if (!dragging || !dragging.cur || dragging.cur.w < 8) { dragging = null; return; } const c = dragging.cur; const rect = { x: c.x / dragging.W * 100, y: c.y / dragging.H * 100, w: c.w / dragging.W * 100, h: c.h / dragging.H * 100 }; dragging = null; stopHighlight(true); const under = document.elementFromPoint(c.x + screen.getBoundingClientRect().left + c.w / 2, c.y + screen.getBoundingClientRect().top + c.h / 2); openPanel(under && under.closest("[data-fb]") || screen, rect); });
  }
  function stopHighlight(keepRect) { if (overlay) { overlay.remove(); overlay = null; } if (!keepRect && rectEl) { rectEl.remove(); rectEl = null; } if (mode === "highlight") { mode = "off"; document.getElementById("fab-highlight").setAttribute("aria-pressed", "false"); } }
  fb.showRect = function (rect, n) { const screen = document.getElementById("screen"); const el = h("div", { class: "fb-rect", style: `left:${rect.x}%;top:${rect.y}%;width:${rect.w}%;height:${rect.h}%` }, n ? h("span", { class: "n" }, String(n)) : null); screen.append(el); setTimeout(() => el.remove(), 6000); };

  // ---- screengrab ------------------------------------------------------------------
  fb.screengrab = async function (container, rect) {
    if (typeof window.html2canvas !== "function") { ICL.toast("Screenshot library not loaded; saved without screenshot."); return null; }
    try {
      const bg = getComputedStyle(document.body).backgroundColor;
      const canvas = await Promise.race([window.html2canvas(container, { useCORS: true, scale: 1, backgroundColor: bg, logging: false, ignoreElements: (el) => el.hasAttribute && el.hasAttribute("data-html2canvas-ignore") }), new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 8000))]);
      const ctx = canvas.getContext("2d");
      if (rect) { ctx.strokeStyle = "#e35230"; ctx.lineWidth = 4; ctx.strokeRect(rect.x / 100 * canvas.width, rect.y / 100 * canvas.height, rect.w / 100 * canvas.width, rect.h / 100 * canvas.height); }
      return await fb.rescale(canvas.toDataURL("image/jpeg", 0.8), 1000, 0.7);
    } catch (e) { console.warn("screengrab failed", e); ICL.toast("Comment saved without screenshot (capture failed)."); return null; }
  };
  fb.rescale = (dataUrl, maxW, q) => new Promise((res) => { const img = new Image(); img.onload = () => { const s = Math.min(1, maxW / img.width); const c = document.createElement("canvas"); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s); c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); res(c.toDataURL("image/jpeg", q)); }; img.onerror = () => res(dataUrl); img.src = dataUrl; });

  fb.installUI = function () {
    document.getElementById("fab-comment").addEventListener("click", () => setMode("comment"));
    document.getElementById("fab-highlight").addEventListener("click", () => setMode("highlight"));
    document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onKey);
    document.addEventListener("mouseover", (e) => { if (mode !== "comment") return; document.querySelectorAll(".fb-hover").forEach((x) => x.classList.remove("fb-hover")); const t = e.target.closest && e.target.closest("[data-fb]"); if (t) t.classList.add("fb-hover"); });
  };
  fb.setMode = setMode;
})(window.ICL);
