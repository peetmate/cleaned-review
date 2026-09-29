/* Shared helpers for screens. */
(function (ICL) {
  const { h } = ICL; const D = ICL.dict;
  ICL.screens = ICL.screens || {};

  function screenHead(sec, extra) {
    return h("div", { class: "screen-head", dataset: { fb: "screen:" + sec.id, fbLabel: "Screen: " + sec.title } }, h("h1", null, ICL.t(sec.title)), sec.purpose ? h("p", { class: "purpose" }, ICL.t(sec.purpose)) : null, extra || null);
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
      onChange: (fid, v, prov) => ICL.store.update(`${collection}[${entity.id}].${fid}`, v, prov === undefined ? "user" : prov),
    };
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
    ICL.store.set((s) => { s[collection] = s[collection].filter((e) => e.id !== id); if (collection === "feeds" || collection === "animals" || collection === "seasons") for (const sid of Object.keys(s.allocation)) { if (collection === "seasons" && sid === id) delete s.allocation[sid]; else for (const aid of Object.keys(s.allocation[sid] || {})) { if (collection === "animals" && aid === id) delete s.allocation[sid][aid]; else if (collection === "feeds") delete s.allocation[sid][aid][id]; } } return s; });
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
  ICL.common = { screenHead, variantVote, entityCtx, farmCtx, addEntity, removeEntity, confirmButton, errorList };
})(window.ICL);
