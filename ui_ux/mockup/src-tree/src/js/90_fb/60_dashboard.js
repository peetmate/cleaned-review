/* Feedback dashboard (#feedback): filters, counts, list with thumbnails, jump, triage, export/import, session. */
(function (ICL) {
  const { h, fmt } = ICL; const D = ICL.dict;
  const TYPE_LABEL = { confusing: "Confusing", missing: "Missing", wrong_unit: "Wrong unit/value", love_it: "Works well", dont_need: "Don't need", bug: "Bug" };
  /** Storage status, and a button that proves it rather than claiming it. */
  function storeCard(state) {
    const st = (ICL.fb.storeStatus && ICL.fb.storeStatus()) || { adapter: state.fb.adapterName, verdict: "" };
    const ok = st.shared === true;
    const card = h("div", { class: "card", dataset: { fb: "fb:store", fbLabel: "Storage status" } },
      h("div", { class: "card-head" },
        h("h2", null, "Where this session is being saved"),
        h("span", { class: "chip " + (ok ? "c-user" : "c-blank"), style: ok ? "" : "color:var(--warn);border-color:var(--warn)" }, ok ? "shared store" : "this device only")),
      h("p", null, st.verdict),
      h("dl", { class: "kv" },
        h("dt", null, "Store"), h("dd", null, String(st.adapter)),
        h("dt", null, "Write access"), h("dd", null, st.canWrite === true ? "yes" : st.canWrite === false ? "no" : "not reported"),
        h("dt", null, "Runtime"), h("dd", null, st.runtime ? (st.hasDb ? "artifact, shared database offered" : "artifact, no shared database offered") : "outside the artifact runtime"),
        ...(st.reason ? [h("dt", null, "Why"), h("dd", null, st.reason)] : []),
        ...(st.lastError ? [h("dt", null, "Last error"), h("dd", null, String(st.lastError))] : []),
        ...(st.viewerId ? [h("dt", null, "You are"), h("dd", { class: "small" }, String(st.viewerId))] : [])));
    const out = h("div", { class: "msg" });
    card.append(h("div", { class: "control" },
      h("button", { type: "button", class: "btn", onclick: async () => {
        out.className = "msg"; out.textContent = "Testing\u2026";
        const r = await ICL.fb.testStore();
        out.className = "msg " + (r.ok && st.shared ? "ok" : r.ok ? "warn" : "err");
        out.textContent = r.ok
          ? `Wrote and read back from "${r.where}" \u2014 ${r.where === "claudeDb" ? "the shared store works." : "but that is local storage, not the shared store."}`
          : `Failed against "${r.where}": ${r.detail}`;
      } }, "Test the store now"),
      h("button", { type: "button", class: "btn-sm", onclick: () => ICL.fb.exportAll("json") }, "Export everything (JSON)"),
      h("button", { type: "button", class: "btn-sm", onclick: () => ICL.fb.exportAll("csv") }, "Export comments (CSV)")), out);
    if (!ok) card.append(h("p", { class: "small" }, "Run this before a session starts. If it does not say the shared store works, the facilitator must export at the end of the session or the notes are lost when the tab closes."));
    return card;
  }

  ICL.screens.feedback = function (root, { state }) {
    const docs = state.fb.docs || []; const f = state.ui.fbFilter || {};
    root.append(h("div", { class: "screen-head" }, h("h1", null, "Feedback dashboard"), h("p", { class: "purpose" }, `Everything captured in session "${state.fb.session}". Store: ${state.fb.adapterName}${state.fb.canWrite === false ? " (read-only for you)" : ""}. Click an item to jump to the element as the participant saw it.`)));
    // Where the data is going, stated permanently rather than in a toast that vanishes.
    root.append(storeCard(state));

    // counts per screen
    const per = {}; for (const d of docs) per[d.screen] = (per[d.screen] || 0) + 1;
    const tiles = h("div", { class: "tile-row" }, h("div", { class: "tile" }, h("b", null, String(docs.length)), h("span", { class: "small" }, "comments")), h("div", { class: "tile" }, h("b", null, String((state.fb.ratings || []).length)), h("span", { class: "small" }, "ratings")), h("div", { class: "tile" }, h("b", null, String((state.fb.votes || []).length)), h("span", { class: "small" }, "votes")), h("div", { class: "tile" }, h("b", null, String(docs.filter((d) => d.severity === 3).length)), h("span", { class: "small" }, "blockers")), h("div", { class: "tile" }, h("b", null, String(docs.filter((d) => d.triaged).length)), h("span", { class: "small" }, "triaged")));
    root.append(tiles);
    // ratings + votes summary
    const rs = state.fb.ratings || []; const byScreen = {}; for (const r of rs) { (byScreen[r.screen] = byScreen[r.screen] || []).push(r); }
    const rsum = h("div", { class: "card" }, h("h2", null, "Screen ratings"), Object.keys(byScreen).length ? h("div", { class: "tablewrap" }, h("table", { class: "grid" }, h("thead", null, h("tr", null, h("th", null, "Screen"), h("th", null, "Clarity (1–5)"), h("th", null, "n"), h("th", null, "Would know what to enter"), h("th", null, "Comments"))), h("tbody", null, ...Object.entries(byScreen).map(([sc, list]) => { const cl = list.filter((r) => r.clarity).map((r) => r.clarity); const kw = list.filter((r) => r.knowWhat != null); return h("tr", null, h("td", null, (D.section(sc) || {}).title || sc), h("td", null, cl.length ? fmt(cl.reduce((a, b) => a + b, 0) / cl.length, 1) : "—"), h("td", null, String(list.length)), h("td", null, kw.length ? `${Math.round(kw.filter((r) => r.knowWhat).length / kw.length * 100)}% yes` : "—"), h("td", null, String(per[sc] || 0))); })))) : h("p", { class: "small" }, "No ratings yet. Each wizard screen has a 'Rate this screen' strip at the bottom."));
    const vs = state.fb.votes || []; const vq = {}; for (const v of vs) { vq[v.questionId] = vq[v.questionId] || {}; vq[v.questionId][v.choice] = (vq[v.questionId][v.choice] || 0) + 1; }
    const vsum = h("div", { class: "card" }, h("h2", null, "Design alternative votes"), ...(window.ICL_VARIANTS || []).map((q) => h("div", { class: "small", style: "margin:4px 0" }, h("strong", null, q.id + ": "), q.label, " → ", q.options.map((o) => `${o.key} (${o.label}): ${(vq[q.id] || {})[o.key] || 0}`).join(" · "))));
    root.append(h("div", { class: "grid2" }, rsum, vsum));
    // filters
    const set = (k, v) => ICL.store.update("ui.fbFilter." + k, v || null);
    const screens = [...new Set(docs.map((d) => d.screen))];
    const filt = h("div", { class: "dash-filters" },
      h("select", { "aria-label": "Screen", onchange: (e) => set("screen", e.target.value) }, h("option", { value: "" }, "All screens"), ...screens.map((s) => h("option", { value: s, selected: f.screen === s }, (D.section(s) || {}).title || s))),
      h("select", { "aria-label": "Type", onchange: (e) => set("type", e.target.value) }, h("option", { value: "" }, "All types"), ...Object.entries(TYPE_LABEL).map(([k, l]) => h("option", { value: k, selected: f.type === k }, l))),
      h("select", { "aria-label": "Severity", onchange: (e) => set("sev", e.target.value) }, h("option", { value: "" }, "Any severity"), h("option", { value: "3", selected: f.sev === "3" }, "Blocker"), h("option", { value: "2", selected: f.sev === "2" }, "High"), h("option", { value: "1", selected: f.sev === "1" }, "Low")),
      h("input", { type: "search", id: "fb-search", placeholder: "Search text or group…", value: f.q || "", "aria-label": "Search", oninput: (e) => { clearTimeout(window.__fbq); const v = e.target.value; window.__fbq = setTimeout(() => set("q", v), 300); } }),
      h("label", { class: "small" }, h("input", { type: "checkbox", checked: !!f.hideTriaged, onchange: (e) => set("hideTriaged", e.target.checked) }), " hide triaged"),
      h("span", { style: "flex:1" }),
      h("button", { type: "button", class: "btn-sm", onclick: () => ICL.fb.exportAll("json") }, "Export JSON"), h("button", { type: "button", class: "btn-sm", onclick: () => ICL.fb.exportAll("csv") }, "Export CSV"),
      h("button", { type: "button", class: "btn-sm", onclick: () => ICL.fb.exportIssues() }, "Export as issues (Markdown)"),
      h("button", { type: "button", class: "btn-sm", onclick: () => { const inp = h("input", { type: "file", accept: ".json,application/json", hidden: true }); inp.addEventListener("change", () => { const fr = new FileReader(); fr.onload = () => ICL.fb.importJson(String(fr.result)); fr.readAsText(inp.files[0]); }); document.body.append(inp); inp.click(); } }, "Import JSON"));
    root.append(filt);
    const sess = h("div", { class: "control small", style: "margin-bottom:10px" }, "Session label: ", h("input", { type: "text", value: state.fb.session, "aria-label": "Session label", onchange: (e) => ICL.store.update("fb.session", e.target.value.trim() || "workshop") }), h("span", { class: "muted" }, "stamped on every new record"));
    root.append(sess);
    const shown = docs.filter((d) => (!f.screen || d.screen === f.screen) && (!f.type || (d.types || []).includes(f.type)) && (!f.sev || String(d.severity) === f.sev) && (!f.hideTriaged || !d.triaged) && (!f.q || `${d.text} ${d.group} ${d.viewerLabel} ${d.fbLabel}`.toLowerCase().includes(f.q.toLowerCase()))).sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
    const list = h("div", { class: "card" }, h("h2", null, `${shown.length} item${shown.length === 1 ? "" : "s"}`));
    if (!shown.length) list.append(h("p", { class: "small" }, "Nothing yet. Turn on Comment mode (bottom right) and click any element."));
    for (const d of shown) {
      const sevChip = d.severity ? h("span", { class: "chip", style: d.severity === 3 ? "color:var(--danger);border-color:var(--danger)" : d.severity === 2 ? "color:var(--warn);border-color:var(--warn)" : "" }, ["", "Low", "High", "Blocker"][d.severity]) : null;
      list.append(h("div", { class: "fb-item" },
        d.screenshot && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(d.screenshot) ? h("img", { src: d.screenshot, alt: "Screenshot for " + d.fbLabel, loading: "lazy" }) : h("div", { class: "small muted" }, d.rect ? "area highlight" : "no screenshot"),
        h("div", null, h("div", null, h("strong", null, (D.section(d.screen) || {}).title || d.screen), " › ", h("span", { class: "mono" }, d.fbLabel), " ", sevChip, d.triaged ? h("span", { class: "chip c-derived" }, "triaged") : null, d.source === "local" ? h("span", { class: "chip c-blank" }, "on this device") : null),
          h("div", { class: "tags" }, ...(d.types || []).map((t) => h("span", { class: "chip" }, TYPE_LABEL[t] || t))),
          h("div", null, d.text || h("em", { class: "muted" }, "(no text)")),
          h("div", { class: "small" }, `${d.viewerLabel || "anonymous"}${d.group ? " · " + d.group : ""} · ${(d.createdAt || "").slice(0, 16).replace("T", " ")} · ${d.appVersion || ""}`),
          h("div", { class: "control", style: "margin-top:6px" }, h("button", { type: "button", class: "btn-sm", onclick: () => ICL.fb.focus(d) }, "Jump to element →"),
          h("a", { class: "btn-sm", href: ICL.fb.issueUrl(d), target: "_blank", rel: "noopener", title: "Opens GitHub with the title, body and labels filled in. You press Create." }, "File as issue ↗"), state.fb.canWrite !== false ? h("button", { type: "button", class: "btn-sm", onclick: () => ICL.fb.triage(d.id, !d.triaged) }, d.triaged ? "Un-triage" : "Mark triaged") : null, state.fb.canWrite !== false ? ICL.common.confirmButton("Delete", () => ICL.fb.remove(d.id), "btn-sm") : null))));
    }
    root.append(list);
    root.append(h("p", { class: "small" }, "Types and severity match the workshop feedback form so exports can be filed as GitHub issues (bug / data / feature / question)."));
  };
})(window.ICL);
