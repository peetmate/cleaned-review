/* Feedback API + storage adapters (claudeDb / localStorage / memory / composite). */
(function (ICL) {
  const COLLS = ["feedback", "ratings", "votes", "sessions"];
  const emitter = () => { const fns = new Set(); return { on: (f) => (fns.add(f), () => fns.delete(f)), emit: (v) => fns.forEach((f) => { try { f(v); } catch (e) { console.error(e); } }) }; };

  // ---- localStorage adapter ---------------------------------------------------------
  function localAdapter() {
    const key = (c) => "icleaned.fb." + c + ".v1"; const ev = {}; COLLS.forEach((c) => (ev[c] = emitter()));
    const read = (c) => ICL.storage.get(key(c), []); const write = (c, arr) => { ICL.storage.set(key(c), arr); ev[c].emit(arr); };
    window.addEventListener("storage", (e) => { for (const c of COLLS) if (e.key === key(c)) ev[c].emit(read(c)); });
    let anon = ICL.storage.get("icleaned.fb.anonId", null); if (!anon) { anon = "anon_" + Math.random().toString(36).slice(2, 10); ICL.storage.set("icleaned.fb.anonId", anon); }
    return {
      name: "localStorage", async ready() {}, async canWrite() { return true; }, async viewerId() { return anon; },
      async set(c, id, doc) { const arr = read(c).filter((d) => d.id !== id); arr.push(Object.assign({}, doc, { id })); write(c, arr); },
      async update(c, id, patch) { const arr = read(c); const i = arr.findIndex((d) => d.id === id); if (i >= 0) { arr[i] = Object.assign({}, arr[i], patch); write(c, arr); } },
      async remove(c, id) { write(c, read(c).filter((d) => d.id !== id)); },
      async list(c) { return read(c); },
      subscribe(c, cb) { cb(read(c)); return ev[c].on(cb); },
      async dump() { const o = {}; for (const c of COLLS) o[c] = read(c); return o; },
    };
  }
  function memoryAdapter() {
    const data = {}; const ev = {}; COLLS.forEach((c) => { data[c] = []; ev[c] = emitter(); });
    return { name: "memory", async ready() {}, async canWrite() { return true; }, async viewerId() { return "mem_" + Math.random().toString(36).slice(2, 8); },
      async set(c, id, doc) { data[c] = data[c].filter((d) => d.id !== id).concat([Object.assign({}, doc, { id })]); ev[c].emit(data[c]); },
      async update(c, id, patch) { data[c] = data[c].map((d) => (d.id === id ? Object.assign({}, d, patch) : d)); ev[c].emit(data[c]); },
      async remove(c, id) { data[c] = data[c].filter((d) => d.id !== id); ev[c].emit(data[c]); },
      async list(c) { return data[c]; }, subscribe(c, cb) { cb(data[c]); return ev[c].on(cb); }, async dump() { return JSON.parse(JSON.stringify(data)); } };
  }
  // ---- claude db adapter -------------------------------------------------------------
  function claudeAdapter(db, user) {
    const chains = {}; // per-doc write chain
    const chain = (k, fn) => (chains[k] = (chains[k] || Promise.resolve()).then(fn, fn).finally(() => { if (chains[k]) delete chains[k]; }));
    let vid = null, canW = null;
    return {
      name: "claudeDb",
      async ready() { if (user) { try { vid = (await user.me()).id; } catch { vid = null; } try { canW = await user.can("data.write"); } catch { canW = null; } } },
      async canWrite() { return canW; }, async viewerId() { return vid; },
      set: (c, id, doc) => chain(c + id, () => db.collection(c).doc(id).set(Object.assign({}, doc, { id }))),
      update: (c, id, patch) => chain(c + id, () => db.collection(c).doc(id).update(patch)),
      remove: (c, id) => chain(c + id, () => db.collection(c).doc(id).delete()),
      async list(c) { const snap = await db.collection(c).orderBy("createdAt", "desc").limit(1000).get(); return snap.docs.map((d) => d.data()); },
      subscribe(c, cb, onErr) { return db.collection(c).orderBy("createdAt", "desc").limit(1000).onSnapshot((snap) => cb(snap.docs.map((d) => d.data())), (e) => { console.warn("db subscription error", e); onErr && onErr(e); }); },
      async dump() { const o = {}; for (const c of COLLS) o[c] = await this.list(c); return o; },
    };
  }
  // read from db live, write locally (viewer without write rights)
  function compositeAdapter(remote, local) {
    return { name: "composite", async ready() {}, async canWrite() { return false; }, viewerId: () => local.viewerId(),
      set: local.set.bind(local), update: local.update.bind(local), remove: local.remove.bind(local),
      async list(c) { const a = await remote.list(c), b = await local.list(c); return merge(a, b); },
      subscribe(c, cb) { let A = [], B = []; const u1 = remote.subscribe(c, (x) => { A = x; cb(merge(A, B)); }); const u2 = local.subscribe(c, (x) => { B = x; cb(merge(A, B)); }); return () => { u1(); u2(); }; },
      async dump() { return local.dump(); } };
  }
  const merge = (a, b) => { const m = new Map(); for (const d of a) m.set(d.id, d); for (const d of b) m.set(d.id, Object.assign({}, d, { source: "local" })); return [...m.values()]; };

  // ---- API ----------------------------------------------------------------------------------
  const fb = { adapter: null, viewerId: null, canWrite: null, docs: [], ratings: [], votes: [], unsubs: [] };
  fb.init = async function () {
    const state = ICL.store.get();
    let adapter = null; const local = (() => { try { localStorage.setItem("__t", "1"); localStorage.removeItem("__t"); return localAdapter(); } catch { return memoryAdapter(); } })();
    if (ICL.env.hasClaude) {
      await ICL.env.ready;
      const { db, user } = ICL.env.caps;
      if (db) { const remote = claudeAdapter(db, user); await remote.ready(); const cw = await remote.canWrite(); adapter = cw === false ? compositeAdapter(remote, local) : remote; fb.canWrite = cw; if (cw === false) showBanner("You can view everyone's feedback, but your own comments are saved on this device only. Use Export on the Feedback screen and hand the file to a facilitator."); }
    }
    if (!adapter) { adapter = local; fb.canWrite = true; if (ICL.env.hasClaude) showBanner("Shared feedback store unavailable here; comments are saved on this device. Export them from the Feedback screen."); }
    fb.adapter = adapter; fb.viewerId = await adapter.viewerId();
    ICL.store.set((s) => { s.fb.adapterName = adapter.name; s.fb.viewerId = fb.viewerId; s.fb.canWrite = fb.canWrite; return s; });
    for (const c of ["feedback", "ratings", "votes"]) fb.unsubs.push(adapter.subscribe(c, (docs) => { fb[c === "feedback" ? "docs" : c] = docs; ICL.store.set((s) => { s.fb[c === "feedback" ? "docs" : c] = docs; return s; }); }));
    window.addEventListener("pagehide", () => fb.unsubs.forEach((u) => u()));
  };
  function showBanner(text) {
    const main = document.getElementById("main"); if (!main || main.querySelector(".fb-banner")) return;
    const b = ICL.h("div", { class: "fb-banner", role: "status" }, text, ICL.h("button", { type: "button", onclick: () => b.remove() }, "Dismiss"));
    main.prepend(b);
  }
  fb.describe = function (el) {
    const target = el.closest("[data-fb]"); const state = ICL.store.get();
    return { fbId: target ? target.dataset.fb : "page", fbLabel: target ? (target.dataset.fbLabel || target.dataset.fb) : "Page", fieldId: target && target.dataset.fieldId || null, screen: state.route.screen, entityId: state.route.entity || null, wizardState: { system: state.system, variant: state.ui.variant, route: ICL.router.hashFor(state.route.screen, state.route.entity) } };
  };
  fb.submit = async function (partial) {
    const state = ICL.store.get(); const id = "fb_" + ICL.uid("").slice(1);
    const doc = Object.assign({ v: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), session: state.fb.session, viewerId: fb.viewerId, viewerLabel: state.fb.viewerLabel || null, group: state.fb.group || null, types: [], severity: null, rect: null, screenshot: null, triaged: false, appVersion: ICL.env.build.version, viewport: { w: innerWidth, h: innerHeight }, theme: document.documentElement.dataset.theme || "system", text: "" }, partial);
    // size ladder
    let s = JSON.stringify(doc); if (s.length > 240 * 1024 && doc.screenshot) { for (const [w, q] of [[900, 0.6], [700, 0.5], [500, 0.4]]) { doc.screenshot = await ICL.fb.rescale(doc.screenshot, w, q); s = JSON.stringify(doc); if (s.length <= 240 * 1024) break; } if (s.length > 240 * 1024) { doc.screenshot = null; doc.screenshotNote = "too large"; } }
    try { await fb.adapter.set("feedback", id, doc); ICL.toast("Feedback saved" + (fb.adapter.name === "claudeDb" ? " and shared." : " on this device.")); }
    catch (e) { console.error(e); const local = localAdapter(); await local.set("feedback", id, doc); showBanner("Saving to the shared store failed; this comment was kept on your device. Export it later."); }
    return id;
  };
  fb.rate = async function (screen, patch) { const id = `${fb.viewerId}_${screen}`; const cur = (fb.ratings || []).find((r) => r.id === id) || { id, screen, viewerId: fb.viewerId, createdAt: new Date().toISOString(), session: ICL.store.get().fb.session, appVersion: ICL.env.build.version }; try { await fb.adapter.set("ratings", id, Object.assign({}, cur, patch, { updatedAt: new Date().toISOString() })); } catch (e) { ICL.toast("Could not save the rating here."); } };
  fb.vote = async function (questionId, choice, screen) { const id = `${fb.viewerId}_${questionId}`; try { await fb.adapter.set("votes", id, { id, questionId, choice, screen, viewerId: fb.viewerId, session: ICL.store.get().fb.session, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }); ICL.toast(`Vote recorded: ${choice}`); } catch (e) { ICL.toast("Could not save the vote here."); } };
  fb.triage = (id, val) => fb.adapter.update("feedback", id, { triaged: !!val, triagedAt: new Date().toISOString(), triagedBy: fb.viewerId });
  fb.remove = (id) => fb.adapter.remove("feedback", id);
  fb.exportAll = async function (format) {
    const dump = await fb.adapter.dump(); const state = ICL.store.get();
    let data, filename;
    if (format === "csv") { const rows = (dump.feedback || []).map((d) => [d.id, d.createdAt, d.session, d.screen, d.fbId, d.fbLabel, d.fieldId || "", (d.types || []).join(";"), d.severity ?? "", d.group || "", d.viewerLabel || "", d.triaged ? 1 : 0, (d.text || "").replace(/\s+/g, " "), d.rect ? JSON.stringify(d.rect) : "", d.screenshot ? "yes" : "no", d.appVersion]); const head = ["id", "createdAt", "session", "screen", "element", "elementLabel", "fieldId", "types", "severity", "group", "participant", "triaged", "text", "rect", "screenshot", "appVersion"]; data = [head, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n"); filename = `icleaned-feedback-${state.fb.session}.csv`; }
    else { data = JSON.stringify(Object.assign({ exportedAt: new Date().toISOString(), appVersion: ICL.env.build.version, adapter: fb.adapter.name }, dump), null, 1); filename = `icleaned-feedback-${state.fb.session}.json`; }
    const dl = ICL.env.caps.downloads;
    if (dl) { try { await dl.save({ filename, data }); ICL.toast("Saved."); return; } catch (e) { if (e && e.code === "declined") return; } }
    if (!ICL.env.hasClaude) { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([data], { type: format === "csv" ? "text/csv" : "application/json" })); a.download = filename; document.body.append(a); a.click(); a.remove(); return; }
    // fallback: show in a textarea for copy
    const ta = ICL.h("textarea", { style: "width:100%;height:200px", readonly: true }, data); const box = ICL.h("div", { class: "card" }, ICL.h("p", null, "Copy this text and send it to the facilitator:"), ta, ICL.h("button", { type: "button", class: "btn-sm", onclick: () => navigator.clipboard.writeText(data).then(() => ICL.toast("Copied."), () => { ta.select(); }) }, "Copy"));
    document.getElementById("screen").prepend(box);
  };
  fb.importJson = async function (text) {
    let obj; try { obj = JSON.parse(text); } catch { ICL.toast("That is not valid JSON."); return; }
    let n = 0; for (const c of COLLS) for (const d of obj[c] || []) if (d && d.id) { await fb.adapter.set(c, d.id, Object.assign({}, d, { source: "import" })); n++; }
    ICL.toast(`Imported ${n} record${n === 1 ? "" : "s"}.`);
  };
  fb.flashField = function (fieldId, entityId) {
    const sel = fieldId ? `[data-fb="field:${fieldId}${entityId ? ":" + entityId : ""}"]` : null;
    const el = sel && (document.querySelector(sel) || document.querySelector(`[data-fb^="field:${fieldId}"]`)); if (!el) return false;
    el.scrollIntoView({ block: "center", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }); el.classList.add("fb-flash"); setTimeout(() => el.classList.remove("fb-flash"), 1600); return true;
  };
  fb.focus = function (doc) {
    ICL.store.set((s) => { if (doc.wizardState) { s.ui.variant = Object.assign({}, s.ui.variant, doc.wizardState.variant || {}); s.fb.focusSnapshot = { fbId: doc.fbId, label: doc.fbLabel }; } return s; });
    location.hash = doc.wizardState && doc.wizardState.route ? doc.wizardState.route : ICL.router.hashFor(doc.screen, doc.entityId);
    setTimeout(() => { const el = document.querySelector(`[data-fb="${doc.fbId}"]`); if (el) { el.scrollIntoView({ block: "center" }); el.classList.add("fb-flash"); setTimeout(() => el.classList.remove("fb-flash"), 1600); } else ICL.toast("That element is not visible with the current answers."); if (doc.rect) ICL.fb.showRect(doc.rect, 1); }, 400);
  };
  ICL.fb = fb;
})(window.ICL);
