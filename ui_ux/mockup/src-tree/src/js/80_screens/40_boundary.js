/* What we count: system boundary explainer. */
(function (ICL) {
  const { h } = ICL; const D = ICL.dict; const { screenHead } = ICL.common;
  ICL.screens.boundary = function (root, { state }) {
    root.append(screenHead(D.section("boundary")));
    if (!state.ui.boundarySeen) setTimeout(() => ICL.store.update("ui.boundarySeen", true), 800);
    const svg = `<svg viewBox="0 0 640 260" width="100%" style="max-width:640px" role="img" aria-label="Diagram: what comes into the enterprise and what leaves it">
      <defs><marker id="ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M0 0L10 5L0 10z" fill="currentColor"/></marker></defs>
      <rect x="200" y="40" width="240" height="180" rx="12" fill="var(--tint)" stroke="var(--primary)" stroke-width="2"/>
      <text x="320" y="70" text-anchor="middle" font-weight="700" fill="var(--primary)" font-family="Merriweather, serif">This livestock enterprise, one year</text>
      <text x="320" y="100" text-anchor="middle" fill="var(--text)" font-size="13">Animals · feed plots · manure</text>
      <text x="320" y="122" text-anchor="middle" fill="var(--text)" font-size="13">Land, water, soil, nitrogen, emissions</text>
      <g stroke="var(--muted)" stroke-width="2" fill="none" marker-end="url(#ar)" color="var(--muted)"><path d="M40 80 H195"/><path d="M40 130 H195"/><path d="M40 180 H195"/><path d="M445 80 H600"/><path d="M445 130 H600"/><path d="M445 180 H600"/></g>
      <g fill="var(--text)" font-size="12"><text x="40" y="70">Bought feed</text><text x="40" y="120">Fertiliser</text><text x="40" y="170">Manure &amp; bedding bought in</text>
      <text x="455" y="70">Milk</text><text x="455" y="120">Meat, live animals</text><text x="455" y="170">Manure sold · losses</text></g></svg>`;
    root.append(h("div", { class: "card", dataset: { fb: "boundary:text", fbLabel: "Boundary explanation" } },
      h("p", null, "CLEANED is a livestock enterprise model, not a farm model. Describe the herd, the land that grows its feed (including land elsewhere if feed is bought), and the manure it produces. The same structure describes one household's cows, a cooperative's herd, a district or the national herd; the numbers scale, the questions do not."),
      h("p", null, "Do not include crops sold for people to eat unless their residues are fed. Anything that happens after milk or meat leave the producer is optional (see Losses)."),
      h("div", { html: svg })));
    root.append(h("div", { class: "callout" }, "Examples: a dairy farm that also grows maize for sale → include the maize only if the stover is fed. A family with cows at home and goats at a relative's farm → make two herds. A national dairy herd → one animal group per category with national head counts, land types instead of plots, and defaults from the dominant climate."));
  };
})(window.ICL);
