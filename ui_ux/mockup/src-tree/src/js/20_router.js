/* Hash router. Tokens only: #home, #about, #animals, #animals-a1, #feedback, #feedback-fb_xxx */
(function (ICL) {
  function parse(hash) {
    const t = (hash || "").replace(/^#/, "").trim();
    if (!t) return { screen: "home", entity: null };
    const i = t.indexOf("-");
    if (i === -1) return { screen: t, entity: null };
    return { screen: t.slice(0, i), entity: t.slice(i + 1) };
  }
  function hashFor(screen, entity) { return "#" + screen + (entity ? "-" + entity : ""); }
  function install(store) {
    const apply = () => {
      const r = parse(location.hash);
      const known = new Set([...(window.ICL_SCHEMA.sections.map((s) => s.id)), "feedback", "about"]);
      if (!known.has(r.screen)) { location.replace(hashFor("home")); return; }
      store.set({ route: r });
      // focus main for screen readers / keyboard after navigation
      requestAnimationFrame(() => { const m = document.getElementById("screen"); if (m) { m.scrollIntoView({ block: "start" }); } });
    };
    window.addEventListener("hashchange", apply);
    apply();
  }
  const go = (screen, entity) => { location.hash = hashFor(screen, entity); };
  ICL.router = { parse, hashFor, install, go };
})(window.ICL);
