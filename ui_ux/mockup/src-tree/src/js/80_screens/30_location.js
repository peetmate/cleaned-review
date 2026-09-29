/* Location & climate: map mock or admin picker → prefill; climate, rainfall, months, ET0, soil. */
(function (ICL) {
  const { h } = ICL; const D = ICL.dict; const { screenHead, variantVote, farmCtx } = ICL.common;
  const PLACES = {
    Tanzania: { regions: { Njombe: { districts: ["Njombe DC", "Wanging'ombe", "Makete"], lat: -9.33, lon: 34.77, elev: 1870, climate: "Tropical Montane", prec: 1100, months: [11, 12, 1, 2, 3, 4], et0: 1300, soil: "Nitosol", soilc: 28, soiln: 2.1, clay: 38, bd: 1.25 }, Mbeya: { districts: ["Rungwe", "Mbeya DC", "Kyela"], lat: -9.0, lon: 33.5, elev: 1700, climate: "Tropical Montane", prec: 1300, months: [11, 12, 1, 2, 3, 4, 5], et0: 1350, soil: "Lixisol", soilc: 44, soiln: 3.6, clay: 23, bd: 1.3 }, Arusha: { districts: ["Arumeru", "Monduli"], lat: -3.4, lon: 36.7, elev: 1400, climate: "Tropical Dry", prec: 800, months: [3, 4, 5, 11, 12], et0: 1550, soil: "Andosol", soilc: 22, soiln: 1.8, clay: 30, bd: 1.1 } }, paramSet: "Southern Highland Tanzania Dairy" },
    Kenya: { regions: { Kakamega: { districts: ["Lurambi", "Malava"], lat: 0.28, lon: 34.75, elev: 1550, climate: "Tropical Moist", prec: 1900, months: [3, 4, 5, 6, 7, 8, 9, 10, 11], et0: 1500, soil: "Acrisol", soilc: 25, soiln: 2.0, clay: 35, bd: 1.2 }, Nyandarua: { districts: ["Ol Kalou", "Kinangop"], lat: -0.3, lon: 36.4, elev: 2400, climate: "Tropical Montane", prec: 1000, months: [3, 4, 5, 10, 11], et0: 1300, soil: "Andosol", soilc: 35, soiln: 2.8, clay: 30, bd: 1.0 } }, paramSet: "Western Kenya - Dairy" },
    Uganda: { regions: { Mukono: { districts: ["Mukono", "Nakifuma"], lat: 0.35, lon: 32.75, elev: 1200, climate: "Tropical Moist", prec: 1400, months: [3, 4, 5, 9, 10, 11], et0: 1450, soil: "Acrisol", soilc: 20, soiln: 1.7, clay: 33, bd: 1.3 } }, paramSet: "Central Uganda - Livestock General" },
    Vietnam: { regions: { "Son La": { districts: ["Mai Son", "Moc Chau"], lat: 21.3, lon: 104.0, elev: 900, climate: "Warm Temperate Moist", prec: 1500, months: [4, 5, 6, 7, 8, 9], et0: 1100, soil: "Acrisol", soilc: 18, soiln: 1.6, clay: 30, bd: 1.3 } }, paramSet: "North-west-highlands Vietnam - Multispecies" },
  };
  ICL.screens.location = function (root, { state, val }) {
    const sec = D.section("location");
    root.append(screenHead(sec));
    root.append(variantVote("V4", state));
    const variant = state.ui.variant.V4 || "A";
    const loc = state.farm.location_point || {};
    const W = ICL.dict.words(); const macro = ["region", "national"].includes(state.system.scale); const card = h("div", { class: "card", dataset: { fb: "field:location_point", fbLabel: "Location" } }, h("h2", null, W.location), macro ? h("p", { class: "small" }, "Pick a representative place; climate and soil defaults come from it. Where the area spans several climates, use the one where most animals are.") : null);
    const country = h("select", { "aria-label": "Country" }, h("option", { value: "" }, "Country…"), ...Object.keys(PLACES).map((c) => h("option", { value: c, selected: loc.country === c }, c)));
    const region = h("select", { "aria-label": "Region" }, h("option", { value: "" }, "Region…"));
    const district = h("select", { "aria-label": "District" }, h("option", { value: "" }, "District…"));
    const fill = (keepRegion, keepDistrict) => { const rSel = keepRegion !== undefined ? keepRegion : (region.value || loc.region); region.innerHTML = ""; region.append(h("option", { value: "" }, "Region…")); const c = PLACES[country.value]; if (c) for (const r of Object.keys(c.regions)) region.append(h("option", { value: r, selected: rSel === r }, r)); const dSel = keepDistrict !== undefined ? keepDistrict : (district.value || loc.district); district.innerHTML = ""; district.append(h("option", { value: "" }, "District…")); const r = c && c.regions[region.value]; if (r) for (const d of r.districts) district.append(h("option", { value: d, selected: dSel === d }, d)); };
    fill(loc.region, loc.district);
    const apply = () => {
      const c = PLACES[country.value]; const r = c && c.regions[region.value]; if (!c || !r) return;
      const point = { country: country.value, region: region.value, district: district.value || r.districts[0], lat: r.lat, lon: r.lon, elevation_m: r.elev };
      ICL.store.set((s) => {
        s.farm.location_point = point; s.provenance["farm.location_point"] = "user";
        const setDefault = (k, v) => { if (!s.provenance["farm." + k] || s.provenance["farm." + k] === "default") { s.farm[k] = v; s.provenance["farm." + k] = "default"; } };
        setDefault("climate_zone_2", r.climate); setDefault("annual_prec", r.prec); setDefault("rain_months", r.months); setDefault("et0", r.et0); setDefault("soil_description", r.soil); setDefault("soil_c", r.soilc); setDefault("soil_n", r.soiln); setDefault("soil_clay", r.clay); setDefault("soil_bulk", r.bd); setDefault("soil_depth", 1);
        if (!s.meta.param_set || s.meta.param_set !== c.paramSet) { s.ui.suggestedParamSet = c.paramSet; }
        return s;
      });
      ICL.toast("Climate, rainfall and soil filled from maps for " + point.district + ". Check and correct them below.");
    };
    country.addEventListener("change", () => { fill("", ""); }); region.addEventListener("change", () => { const r = region.value; fill(r, ""); apply(); }); district.addEventListener("change", apply);
    if (variant === "A" && !macro) {
      const map = h("div", { class: "mapmock", role: "img", "aria-label": ICL.t("Map (mock). Click to place the {enterprise}.") }, h("div", { class: "lbl" }, loc.district ? `${loc.district}, ${loc.region}, ${loc.country} · ${loc.lat}, ${loc.lon} · ${loc.elevation_m} m` : ICL.t("Click to place the {enterprise}")));
      if (loc.lat != null) map.append(h("span", { class: "pin", style: `left:${50 + (loc.lon - 34.7) * 6}%;top:${50 + (loc.lat + 9.3) * 6}%` }, "📍"));
      map.addEventListener("click", (ev) => { const rect = map.getBoundingClientRect(); const x = (ev.clientX - rect.left) / rect.width; const keys = Object.keys(PLACES); const c = keys[Math.min(keys.length - 1, Math.floor(x * keys.length))]; country.value = c; const r0 = Object.keys(PLACES[c].regions)[0]; fill(r0, ""); apply(); });
      card.append(map, h("p", { class: "small" }, "In the real app this is a satellite map; here clicking picks a demo place. Or choose from the lists:"));
    }
    card.append(h("div", { class: "control" }, country, region, district));
    if (state.ui.suggestedParamSet && state.ui.suggestedParamSet !== state.meta.param_set) card.append(h("div", { class: "callout warn" }, `For ${loc.country} the recommended parameter set is "${state.ui.suggestedParamSet}". `, h("button", { type: "button", class: "btn-sm", onclick: () => ICL.store.set((s) => { s.meta.param_set = s.ui.suggestedParamSet; s.ui.suggestedParamSet = null; return s; }) }, "Use it"), " ", h("button", { type: "button", class: "btn-sm", onclick: () => ICL.store.update("ui.suggestedParamSet", null) }, "Keep current")));
    root.append(card);
    const ctx = farmCtx(state, val);
    root.append(ICL.fields.renderFields("location", ctx, (f) => f.id !== "location_point" && !["soil_c", "soil_n", "soil_clay", "soil_bulk", "soil_depth"].includes(f.id) && f.group !== "Soil"));
    if (state.system.growsFeed) {
      root.append(h("h2", { style: "margin:12px 0 8px" }, "Soil"), h("p", { class: "small" }, "Filled from SoilGrids for the location. A single plot can override the soil type on its own card."));
      root.append(ICL.fields.renderFields("location", ctx, (f) => f.group === "Soil" || f.group === "Soil details"));
    }
    root.append(seasonsBlock(state, val));
    root.append(landBlock(state, val));
  };

  // ---- seasons, described where the climate is described -----------------------
  const MN = (m) => ICL.MONTHS[m - 1];
  /** Contiguous runs of months, treating December → January as contiguous. */
  function runs(set) {
    const has = (m) => set.includes(m);
    if (!set.length || set.length === 12) return set.length ? [[...Array(12).keys()].map((i) => i + 1)] : [];
    const out = []; let cur = null;
    let start = 1; while (start <= 12 && has(start) && has(start === 1 ? 12 : start - 1)) start++; // begin at a run boundary
    for (let i = 0; i < 12; i++) {
      const m = ((start - 1 + i) % 12) + 1;
      if (has(m)) { if (!cur) { cur = [m]; out.push(cur); } else cur.push(m); }
      else cur = null;
    }
    return out;
  }
  const label = (run) => run.length === 12 ? "all year" : run.length === 1 ? MN(run[0]) : `${MN(run[0])}–${MN(run[run.length - 1])}`;
  /** Seasons proposed from the months the user already ticked as rainy. */
  function proposeSeasons(rain) {
    const wet = runs(rain);
    const dryMonths = [...Array(12).keys()].map((i) => i + 1).filter((m) => !rain.includes(m));
    const dry = runs(dryMonths);
    if (!wet.length || !dry.length) return [["All year", [...Array(12).keys()].map((i) => i + 1)]];
    const wetSorted = wet.slice().sort((a, b) => b.length - a.length);
    const drySorted = dry.slice().sort((a, b) => b.length - a.length);
    const name = (list, i, long, short) => list.length > 1 ? (list[i] === wetSorted[0] || list[i] === drySorted[0] ? long : short) : long;
    const out = [];
    wet.forEach((r) => out.push([wet.length > 1 ? (r === wetSorted[0] ? "Long rains" : "Short rains") : "Rainy season", r]));
    dry.forEach((r) => out.push([dry.length > 1 ? (r === drySorted[0] ? "Dry season" : "Short dry season") : "Dry season", r]));
    // rains first: that is how the year is usually described
    const isWet = (r) => wet.includes(r);
    return out.sort((a, b) => (isWet(b[1]) - isWet(a[1])) || (b[1].length - a[1].length));
  }

  function seasonsBlock(root_state, val) {
    const state = root_state;
    const box = h("div", { class: "card", dataset: { fb: "location:seasons", fbLabel: "Seasons block" } }, h("h2", null, "Seasons"),
      h("p", { class: "small" }, "A season is a feeding period: animals eat differently in the rains and in the dry months, so the diet is described once per season. Most enterprises need two."));
    // year strip
    const strip = h("div", { class: "months", role: "img", "aria-label": "The year" });
    const owner = new Map(); state.seasons.forEach((s, i) => (s.season_months || []).forEach((m) => owner.set(m, i)));
    const rain = state.farm.rain_months || [];
    ICL.MONTHS.forEach((m, i) => strip.append(h("button", { type: "button", class: owner.has(i + 1) ? "s" + (owner.get(i + 1) % 4) : "", disabled: true, title: (owner.has(i + 1) ? (state.seasons[owner.get(i + 1)].season_name || "Season") : "not in a season") + (rain.includes(i + 1) ? " · rain" : "") }, m)));
    const days = state.seasons.reduce((t, s) => t + (s.season_months || []).reduce((d, m) => d + ICL.MONTH_DAYS[m - 1], 0), 0);
    box.append(strip, h("div", { class: "total " + (days === 365 ? "ok" : "bad") }, `${days} of 365 days placed ${days === 365 ? "✓" : ""}`));
    // proposal from the rainy months
    const prop = rain.length ? proposeSeasons(rain) : null;
    // "Same" means the same split of the year, whatever order the seasons are listed in
    // and whatever they are called.
    const asSet = (list) => list.map((m) => JSON.stringify(m.slice().sort((a, b) => a - b))).sort().join("|");
    const same = prop && prop.length === state.seasons.length
      && asSet(prop.map((p) => p[1])) === asSet(state.seasons.map((x) => x.season_months || []));
    if (prop && !same) {
      const hasPlan = Object.keys(state.allocation || {}).length > 0;
      const apply = () => { ICL.store.set((s) => { s.seasons = prop.map((p) => ({ id: ICL.uid("s"), season_name: p[0], season_months: p[1] })); s.allocation = {}; s.system.nSeasons = prop.length; return s; }); ICL.toast(hasPlan ? "Seasons set from your rainy months. The feeding plan was cleared." : "Seasons set from your rainy months. Rename them if you call them something else."); };
      box.append(h("div", { class: "callout", dataset: { fb: "location:season_proposal", fbLabel: "Season proposal" } },
        h("strong", null, "From the months you marked as rainy: "),
        prop.map((p) => `${p[0]} (${label(p[1])})`).join(" · "),
        h("div", { class: "control", style: "margin-top:8px" },
          hasPlan ? ICL.common.confirmButton("Use these seasons", apply, "btn") : h("button", { type: "button", class: "btn", onclick: apply }, "Use these seasons"),
          h("span", { class: "small" }, hasPlan ? "Replacing the seasons clears the feeding plan." : "You can rename them or move a month afterwards."))));
    }
    // one row per season: rename in place, months on the season's own card
    if (state.seasons.length) {
      const t = h("table", { class: "grid" }, h("thead", null, h("tr", null, h("th", null, "Name"), h("th", null, "Months"), h("th", null, "Days"), h("th", null, ""))));
      const tb = h("tbody");
      for (const se of state.seasons) {
        const nameInput = h("input", { type: "text", value: se.season_name || "", "aria-label": "Season name" });
        nameInput.addEventListener("change", () => ICL.store.set((s) => { const x = s.seasons.find((y) => y.id === se.id); x.season_name = nameInput.value.trim() || null; s.provenance[`seasons[${se.id}].season_name`] = "user"; return s; }));
        const ms = se.season_months || [];
        tb.append(h("tr", null, h("td", null, nameInput), h("td", null, ms.length ? ms.map(MN).join(" ") : h("span", { class: "msg err" }, "no months")),
          h("td", null, String(ms.reduce((d, m) => d + ICL.MONTH_DAYS[m - 1], 0))),
          h("td", null, h("a", { class: "btn-sm", href: ICL.router.hashFor("seasons", se.id) }, "Months…"))));
      }
      t.append(tb);
      box.append(h("div", { class: "tablewrap" }, t));
    } else box.append(h("div", { class: "empty" }, "No seasons yet. Mark your rainy months above and use the suggestion, or add them by hand."));
    const errs = val.errors.filter((e) => e.screen === "seasons");
    if (errs.length) box.append(ICL.common.errorList(errs, "err"));
    box.append(h("div", { class: "control" }, h("a", { class: "btn-sm", href: ICL.router.hashFor("seasons", "new") }, "+ Add a season"), h("a", { class: "btn-sm", href: ICL.router.hashFor("seasons") }, "Open the seasons screen")));
    return box;
  }

  // ---- land, in the same step as the place it is in ----------------------------
  function landBlock(state, val) {
    const W = ICL.dict.words();
    const box = h("div", { class: "card", dataset: { fb: "location:land", fbLabel: "Land block" } }, h("h2", null, ICL.t("Land and {plot}s")),
      h("p", { class: "small" }, ICL.t(`Each ${W.plot} is a piece of land that grows feed or is grazed. Slope, cover and practice are asked once per ${W.plot} and reused by every feed grown there.`)));
    if (!state.system.growsFeed) {
      box.append(h("div", { class: "callout" }, ICL.t("You said no feed is grown or grazed on land you manage, so no {plot}s are needed. "), h("a", { href: "#about" }, "Change that answer"), "."));
      return box;
    }
    if (!state.plots.length) box.append(h("div", { class: "empty" }, ICL.t(`Add the first ${W.plot} that grows feed or is grazed.`)));
    else {
      const t = h("table", { class: "grid" }, h("thead", null, h("tr", null, h("th", null, ICL.t("{plot}").replace(/^./, (c) => c.toUpperCase())), h("th", null, "Area"), h("th", null, "Use"), h("th", null, "Slope"), h("th", null, "Grows"), h("th", null, ""))));
      const tb = h("tbody");
      for (const p of state.plots) {
        const errs = val.errors.filter((e) => e.screen === "plots" && e.entityId === p.id).length;
        const grows = state.feeds.filter((f) => f.feed_plot === p.id).map((f) => { const d = D.decorate(f, "feed", state); return d._feedItem ? D.displayFeedName(d._feedItem.feed_item_name) : "?"; });
        tb.append(h("tr", null,
          h("td", null, p.plot_name || ICL.t("New {plot}"), errs ? h("span", { class: "chip", style: "margin-left:6px;color:var(--danger);border-color:var(--danger)" }, `${errs} to fix`) : null),
          h("td", null, p.plot_area_ha != null ? ICL.fmt(p.plot_area_ha, p.plot_area_ha < 100 ? 2 : 0) + " ha" : "—"),
          h("td", null, { crops: "Feed or crops", grazing: "Grazing", both: "Crops and grazing" }[p.plot_use] || "—"),
          h("td", null, p.slope_class ? p.slope_class.split(" (")[0] : "—"),
          h("td", null, grows.length ? grows.join(", ") : h("span", { class: "small" }, "nothing yet")),
          h("td", null, h("a", { class: "btn-sm", href: ICL.router.hashFor("plots", p.id) }, "Edit"))));
      }
      t.append(tb);
      box.append(h("div", { class: "tablewrap" }, t));
      const total = state.plots.reduce((s, p) => s + (Number(p.plot_area_ha) || 0), 0);
      box.append(h("p", { class: "small" }, `${state.plots.length} ${state.plots.length === 1 ? W.plot : W.plot + "s"} · ${ICL.fmt(total, total < 100 ? 2 : 0)} ha in total.`));
    }
    const errs = val.errors.filter((e) => e.screen === "plots" && !e.entityId);
    if (errs.length) box.append(ICL.common.errorList(errs, "err"));
    box.append(h("div", { class: "control" }, h("a", { class: "btn-sm", href: ICL.router.hashFor("plots", "new") }, ICL.t("+ Add a {plot}")), state.plots.length > 6 ? h("a", { class: "btn-sm", href: ICL.router.hashFor("plots") }, ICL.t("Open the {plot}s screen (search and filter)")) : null));
    return box;
  }
})(window.ICL);
