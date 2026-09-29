/* Automatic numbering.
   Step numbers come from the position of a section among the wizard sections in schema.json,
   so inserting or reordering a section renumbers everything after it with no hand-editing.
   Numbers are stable across participants: a step hidden by their answers keeps its number. */
(function (ICL) {
  const D = ICL.dict;
  let cache = null;

  function stepNumbers() {
    if (cache) return cache;
    const map = {}; let n = 0;
    for (const sec of D.sections()) if (sec.wizard) map[sec.id] = ++n;
    cache = { map, total: n };
    return cache;
  }
  const stepOf = (sectionId) => stepNumbers().map[sectionId] || null;
  const totalSteps = () => stepNumbers().total;
  /** "3" for a wizard step, "" for reference screens (Home, Parameters, Results, Feedback). */
  const prefix = (sectionId) => { const n = stepOf(sectionId); return n ? String(n) : ""; };

  /** Number the headings inside a rendered screen in DOM order: h2 → N.1, h3/legend → N.1.1.
      Runs after every render, so adding or removing a heading renumbers the rest. */
  function numberHeadings(root, sectionId) {
    const step = stepOf(sectionId); if (!step) return;
    let h2 = 0, h3 = 0;
    const nodes = root.querySelectorAll("h2, h3, legend");
    for (const el of nodes) {
      if (el.closest("[data-no-number]")) continue;
      const tag = el.tagName.toLowerCase();
      let num;
      if (tag === "h2") { h2++; h3 = 0; num = `${step}.${h2}`; }
      else { if (!h2) { h2++; } h3++; num = `${step}.${h2}.${h3}`; }
      if (el.querySelector(".num")) { el.querySelector(".num").textContent = num; continue; }
      el.prepend(ICL.h("span", { class: "num", "aria-hidden": "true" }, num), " ");
      el.dataset.num = num;
      const box = el.closest("[data-fb]"); if (box && !box.dataset.fbNum) box.dataset.fbNum = num;
    }
  }

  /** The number a feedback comment should quote: the nearest numbered heading above the element. */
  function numberFor(el) {
    const withNum = el.closest("[data-num], [data-fb-num]");
    if (withNum) return withNum.dataset.num || withNum.dataset.fbNum;
    const screen = document.getElementById("screen");
    if (!screen || !screen.contains(el)) return "";
    // walk backwards through numbered headings
    const heads = [...screen.querySelectorAll("[data-num]")];
    let last = "";
    for (const hEl of heads) { if (hEl.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) last = hEl.dataset.num; }
    return last || prefix(ICL.store.get().route.screen);
  }

  ICL.num = { stepOf, totalSteps, prefix, numberHeadings, numberFor, invalidate: () => (cache = null) };
})(window.ICL);
