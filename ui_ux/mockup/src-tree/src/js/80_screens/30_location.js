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
    const fill = () => { region.innerHTML = ""; region.append(h("option", { value: "" }, "Region…")); const c = PLACES[country.value]; if (c) for (const r of Object.keys(c.regions)) region.append(h("option", { value: r, selected: loc.region === r }, r)); district.innerHTML = ""; district.append(h("option", { value: "" }, "District…")); const r = c && c.regions[region.value]; if (r) for (const d of r.districts) district.append(h("option", { value: d, selected: loc.district === d }, d)); };
    fill();
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
    country.addEventListener("change", () => { fill(); }); region.addEventListener("change", () => { fill(); apply(); }); district.addEventListener("change", apply);
    if (variant === "A" && !macro) {
      const map = h("div", { class: "mapmock", role: "img", "aria-label": "Map (mock). Click to place the farm." }, h("div", { class: "lbl" }, loc.district ? `${loc.district}, ${loc.region}, ${loc.country} · ${loc.lat}, ${loc.lon} · ${loc.elevation_m} m` : "Click to place the farm"));
      if (loc.lat != null) map.append(h("span", { class: "pin", style: `left:${50 + (loc.lon - 34.7) * 6}%;top:${50 + (loc.lat + 9.3) * 6}%` }, "📍"));
      map.addEventListener("click", (ev) => { const rect = map.getBoundingClientRect(); const x = (ev.clientX - rect.left) / rect.width; const keys = Object.keys(PLACES); const c = keys[Math.min(keys.length - 1, Math.floor(x * keys.length))]; country.value = c; fill(); region.value = Object.keys(PLACES[c].regions)[0]; fill(); apply(); });
      card.append(map, h("p", { class: "small" }, "In the real app this is a satellite map; here clicking picks a demo place. Or choose from the lists:"));
    }
    card.append(h("div", { class: "control" }, country, region, district));
    if (state.ui.suggestedParamSet && state.ui.suggestedParamSet !== state.meta.param_set) card.append(h("div", { class: "callout warn" }, `For ${loc.country} the recommended parameter set is "${state.ui.suggestedParamSet}". `, h("button", { type: "button", class: "btn-sm", onclick: () => ICL.store.set((s) => { s.meta.param_set = s.ui.suggestedParamSet; s.ui.suggestedParamSet = null; return s; }) }, "Use it"), " ", h("button", { type: "button", class: "btn-sm", onclick: () => ICL.store.update("ui.suggestedParamSet", null) }, "Keep current")));
    root.append(card);
    const ctx = farmCtx(state, val);
    root.append(ICL.fields.renderFields("location", ctx, (f) => f.id !== "location_point" && !["soil_c", "soil_n", "soil_clay", "soil_bulk", "soil_depth"].includes(f.id) && f.group !== "Soil"));
    if (state.system.growsFeed) {
      root.append(h("h2", { style: "margin:12px 0 8px" }, "Soil"), h("p", { class: "small" }, "Filled from SoilGrids for the location. Plots can override the soil type under Land & plots."));
      root.append(ICL.fields.renderFields("location", ctx, (f) => f.group === "Soil" || f.group === "Soil details"));
    }
  };
})(window.ICL);
