/* Shared helpers for screens. */
(function (ICL) {
  const { h } = ICL; const D = ICL.dict;
  ICL.screens = ICL.screens || {};

  function screenHead(sec, extra) {
    const n = ICL.num.prefix(sec.id); const total = ICL.num.totalSteps();
    return h("div", { class: "screen-head", dataset: { fb: "screen:" + sec.id, fbLabel: "Screen: " + ICL.t(sec.title), noNumber: "" } },
      n ? h("p", { class: "eyebrow" }, `Step ${n} of ${total}`) : null,
      h("h1", null, n ? h("span", { class: "num" }, n + ".") : null, n ? " " : "", ICL.t(sec.title)),
      sec.purpose ? h("p", { class: "purpose" }, ICL.t(sec.purpose)) : null, extra || null);
  }

  /** A/B variant toggle + vote widget for a screen. Returns element or null. */
  function variantVote(qid, state) {
    const q = (window.ICL_VARIANTS || []).find((v) => v.id === qid); if (!q) return null;
    const cur = state.ui.variant[qid] || "A";
    const myVote = (state.fb.votes || []).find((v) => v.questionId === qid && v.viewerId === state.fb.viewerId);
    const opts = h("div", { class: "opts" });
    for (const o of q.options) {
      const b = h("button", { type: "button", class: "btn-sm", "aria-pressed": String(cur === o.key), title: o.why, onclick: () => ICL.store.update("ui.variant." + qid, o.key) }, `Show ${o.key}: ${o.label}`);
      opts.append(b);
    }
    const vote = h("div", { class: "opts" }, h("span", { class: "small" }, "Which do you prefer?"),
      ...q.options.map((o) => h("button", { type: "button", class: "btn-sm", "aria-pressed": String(myVote && myVote.choice === o.key), onclick: () => ICL.fb.vote(qid, o.key, q.screen) }, `${o.key} 👍`)),
      myVote ? h("span", { class: "small" }, `You chose ${myVote.choice}.`) : null);
    return h("div", { class: "variant-vote", dataset: { fb: "variant:" + qid, fbLabel: "Design alternative " + qid } }, h("strong", null, "Design alternative · "), q.label, opts, vote);
  }

  function entityCtx(state, val, collection, entity, entityType) {
    const dec = D.decorate(entity, entityType, state);
    return {
      state, entity: dec, entityId: entity.id, collection, errors: val.errors, warnings: val.warnings,
      onChange: (fid, v, prov) => {
        ICL.store.update(`${collection}[${entity.id}].${fid}`, v, prov === undefined ? "user" : prov);
        // a herd's time pattern re-derives the day for groups whose hours were not typed by hand (F-15)
        if (collection === "herds" && fid === "herd_pattern") {
          let n = 0; ICL.store.set((s) => { for (const a of s.animals) if (a.herd_ref === entity.id && !["hours_stable", "hours_pen", "hours_onfarm", "hours_offfarm"].some((k) => s.provenance[`animals[${a.id}].${k}`] === "user")) { for (const k of ["hours_stable", "hours_pen", "hours_onfarm", "hours_offfarm"]) { a[k] = null; delete s.provenance[`animals[${a.id}].${k}`]; } n++; } return s; });
          if (n) ICL.toast(`Updated the daily hours of ${n} group${n === 1 ? "" : "s"} in this herd (groups with hand-entered hours were left alone).`);
        }
      },
    };
  }
  const NOUN = { plots: null, seasons: "season", herds: "herd", animals: "animal group", feeds: "feed" };
  const entityNoun = (collection) => NOUN[collection] || (collection === "plots" ? D.words().plot : collection);
  /** Collapsed box holding the design-alternative widgets for a screen (F-11). */
  function variantsBox(ids, state) {
    const boxes = ids.map((id) => variantVote(id, state)).filter(Boolean); if (!boxes.length) return null;
    return h("details", { class: "variants-box", dataset: { fb: "variants:" + ids.join("+"), fbLabel: "Design alternatives" } }, h("summary", null, `Design alternatives on this screen (${boxes.length}) · show and vote`), ...boxes);
  }
  function farmCtx(state, val, target = "farm") {
    return { state, entity: state[target], entityId: null, collection: null, errors: val.errors, warnings: val.warnings, onChange: (fid, v, prov) => ICL.store.update(`${target}.${fid}`, v, prov === undefined ? "user" : prov) };
  }
  function addEntity(collection, seed) {
    const id = ICL.uid(collection.slice(0, 1));
    ICL.store.set((s) => { s[collection] = [...(s[collection] || []), Object.assign({ id }, seed || {})]; return s; });
    return id;
  }
  function removeEntity(collection, id) {
    ICL.store.set((s) => { s[collection] = s[collection].filter((e) => e.id !== id);
      if (collection === "plots") { for (const f of s.feeds) if (f.feed_plot === id) f.feed_plot = null; for (const hd of s.herds) if (Array.isArray(hd.herd_plots)) hd.herd_plots = hd.herd_plots.filter((p) => p !== id); }
      if (collection === "herds") { for (const a of s.animals) if (a.herd_ref === id) a.herd_ref = null; }
      if (collection === "feeds" || collection === "animals" || collection === "seasons") for (const sid of Object.keys(s.allocation)) { if (collection === "seasons" && sid === id) delete s.allocation[sid]; else for (const aid of Object.keys(s.allocation[sid] || {})) { if (collection === "animals" && aid === id) delete s.allocation[sid][aid]; else if (collection === "feeds") delete s.allocation[sid][aid][id]; } } return s; });
  }
  function confirmButton(label, onConfirm, cls = "btn danger") {
    // two-step inline confirmation (no confirm() in the artifact viewer)
    const b = h("button", { type: "button", class: cls }, label);
    let armed = false, t;
    b.addEventListener("click", () => { if (!armed) { armed = true; b.textContent = "Click again to confirm"; t = setTimeout(() => { armed = false; b.textContent = label; }, 3000); } else { clearTimeout(t); onConfirm(); } });
    return b;
  }
  function errorList(items, cls) {
    if (!items.length) return null;
    return h("ul", { class: "alert-list" }, ...items.map((e) => h("li", null, h("span", { class: "msg " + cls }, e.msg), e.screen ? h("a", { href: ICL.router.hashFor(e.screen, e.entityId && e.entityId !== "NPK" ? e.entityId : null), onclick: () => setTimeout(() => ICL.fb.flashField(e.fieldId, e.entityId), 250) }, "Go to field →") : null)));
  }
  ICL.common = { screenHead, variantVote, variantsBox, entityNoun, entityCtx, farmCtx, addEntity, removeEntity, confirmButton, errorList };
})(window.ICL);
