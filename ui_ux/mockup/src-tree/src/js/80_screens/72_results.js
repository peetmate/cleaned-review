/* Results. The mockup cannot run the model, so every number here comes from a
   deliberately simple sketch calculation whose formula is shown next to it. The point
   is to test the layout, the units and the wording of the output — not the science. */
(function (ICL) {
  const { h, fmt } = ICL; const D = ICL.dict; const { screenHead } = ICL.common;

  // Sketch factors, all visible to the user. Order of magnitude only.
  const SK = {
    ch4_ef: { dairy: 117, other: 58, young: 35 },   // kg CH4 per head per year, IPCC 2019 Tier 1-ish
    gwp_ch4: 27, gwp_n2o: 273,                       // AR6 100-year
    n_ex_per_kg_lw: 0.35,                            // kg N excreted per kg live weight per year
    ef_n2o_direct: 0.01, ef_leach: 0.24, ef_n2o_leach: 0.011,
    water_per_kg_dm: 1200,                           // litres of green water per kg feed DM
    dmi_pct_lw: 0.025,                               // dry matter intake as a share of live weight per day
  };

  function sketch(state, compiled) {
    const lv = (compiled.input.livestock || []);
    const rows = lv.map((l) => {
      const n = Number(l.herd_composition) || 0;
      const bw = Number(l.body_weight) || 0;
      const desc = String(l.livetype_desc || "");
      const kind = /Cows/i.test(desc) ? "dairy" : /Calve|Calf/i.test(desc) ? "young" : "other";
      const ch4 = n * SK.ch4_ef[kind];
      const dmi = n * bw * SK.dmi_pct_lw * 365;                       // kg DM per year
      const n_ex = n * bw * SK.n_ex_per_kg_lw;                        // kg N per year
      const n2o_direct = n_ex * SK.ef_n2o_direct * 44 / 28;
      const n2o_leach = n_ex * SK.ef_leach * SK.ef_n2o_leach * 44 / 28;
      const milk = (Number(l.annual_milk) || 0) * n;
      const meat = (Number(l.annual_growth) || 0) * n * (Number(l.carcass_fraction) || 0.5);
      return { desc, n, kind, ch4, dmi, n_ex, n2o: n2o_direct + n2o_leach, milk, meat };
    });
    const tot = (k) => rows.reduce((t, r) => t + r[k], 0);
    const area = state.plots.reduce((t, p) => t + (Number(p.plot_area_ha) || 0), 0);
    const dm = tot("dmi");
    const ghg_ch4 = tot("ch4") * SK.gwp_ch4;
    const ghg_n2o = tot("n2o") * SK.gwp_n2o;
    const ghg = ghg_ch4 + ghg_n2o;                                    // kg CO2e per year
    const milk = tot("milk"), meat = tot("meat");
    // feed nitrogen removed by the crops, against manure N returned
    const n_manure_onfarm = rows.reduce((t, r) => t + r.n_ex, 0) * (Number((compiled.input.livestock[0] || {}).manure_onfarm_fraction) || 0.7);
    const fert_n = (compiled.input.feed_items || []).reduce((t, f) => t + (Number(f.n_fertilizer) || 0), 0);
    const n_removed = dm * 0.015;                                     // 1.5 % N in feed dry matter
    return {
      rows, area, dm, ghg, ghg_ch4, ghg_n2o, milk, meat,
      water: dm * SK.water_per_kg_dm / 1000,                          // m3 per year
      land_per_animal: rows.reduce((t, r) => t + r.n, 0) ? area / rows.reduce((t, r) => t + r.n, 0) : null,
      ghg_per_kg_milk: milk ? ghg / milk : null,
      ghg_per_ha: area ? ghg / area : null,
      n_balance: n_manure_onfarm + fert_n - n_removed,
      n_in: n_manure_onfarm + fert_n, n_out: n_removed,
      soil_loss: area ? area * 12 : null,                             // t per year, placeholder rate
      feed_gap: area && dm ? (dm / 1000) / area : null,               // t DM per ha demanded
    };
  }

  const tile = (v, unit, label, note, color) => h("div", { class: "rtile" },
    h("b", { style: color ? `color:${color}` : "" }, v), h("span", { class: "u" }, unit),
    h("span", { class: "l" }, label), note ? h("span", { class: "small" }, note) : null);

  ICL.screens.results = function (root, { state, val, compiled }) {
    root.append(screenHead(D.section("results")));

    root.append(h("div", { class: "callout disclaimer", dataset: { fb: "results:sketch", fbLabel: "Sketch numbers notice", noNumber: "" } },
      h("strong", null, "These numbers are a sketch, not the model. "),
      "This mockup does not run ", h("em", null, "cleaned"), ". Every figure below is a deliberately crude calculation from your inputs — the formula is printed under each one — so that the layout, the units and the wording can be tested with real-feeling output. ",
      "In the real app this screen shows the model's own results. Do not quote anything here."));

    if (val.errors.length) root.append(h("div", { class: "callout warn" },
      `${val.errors.length} thing${val.errors.length === 1 ? "" : "s"} would stop a real run. `,
      h("a", { href: "#check" }, "Check & run"), " lists them; the sketch below ignores them, the model would not."));

    const s = sketch(state, compiled);
    const tab = state.ui.resultsTab || "summary";
    const TABS = [["summary", "Summary"], ["ghg", "Greenhouse gases"], ["land", "Land & feed"], ["water", "Water"], ["nitrogen", "Nitrogen"], ["compare", "Compare"]];
    const tb = h("div", { class: "tabs", role: "tablist" });
    for (const [k, l] of TABS) tb.append(h("button", { type: "button", role: "tab", "aria-selected": String(tab === k), onclick: () => ICL.store.update("ui.resultsTab", k) }, l));
    root.append(tb);

    if (tab === "summary") {
      root.append(h("div", { class: "rtiles", dataset: { fb: "results:headline", fbLabel: "Headline indicators" } },
        tile(fmt(s.ghg / 1000, 1), "t CO₂e / year", "Greenhouse gases", "enteric methane + manure nitrous oxide"),
        tile(s.ghg_per_kg_milk != null ? fmt(s.ghg_per_kg_milk, 2) : "—", "kg CO₂e / kg milk", "Emission intensity", "the number most often compared"),
        tile(fmt(s.dm / 1000, 1), "t DM / year", "Feed eaten", "dry matter across the herd"),
        tile(s.area ? fmt(s.area, s.area < 100 ? 2 : 0) : "—", "ha", "Land described", s.land_per_animal != null ? `${fmt(s.land_per_animal, 2)} ha per animal` : null),
        tile(fmt(s.water, 0), "m³ / year", "Water in the feed", "green water only"),
        tile(fmt(s.n_balance, 0), "kg N / year", "Nitrogen balance", s.n_balance > 0 ? "more in than taken off" : "more taken off than returned", s.n_balance < 0 ? "var(--danger)" : undefined)));
      root.append(h("div", { class: "card" }, h("h2", null, "Production"),
        h("div", { class: "rtiles" },
          tile(fmt(s.milk, 0), "kg / year", "Milk", "whole herd"),
          tile(fmt(s.meat, 0), "kg carcass / year", "Meat", "from live-weight gain"),
          tile(s.milk ? fmt(s.milk / (s.rows.filter((r) => r.kind === "dairy").reduce((t, r) => t + r.n, 0) || 1), 0) : "—", "kg / cow / year", "Milk per cow", null))));
      root.append(formulaBox());
    }

    if (tab === "ghg") {
      root.append(h("div", { class: "rtiles" },
        tile(fmt(s.ghg_ch4 / 1000, 1), "t CO₂e", "Methane (enteric)", `${fmt(s.ghg_ch4 / s.ghg * 100, 0)}% of the total`),
        tile(fmt(s.ghg_n2o / 1000, 1), "t CO₂e", "Nitrous oxide (manure)", `${fmt(s.ghg_n2o / s.ghg * 100, 0)}% of the total`),
        tile(fmt(s.ghg / 1000, 1), "t CO₂e", "Total", "per year")));
      const card = h("div", { class: "card", dataset: { fb: "results:ghg_by_group", fbLabel: "Emissions by animal group" } }, h("h2", null, "Where the emissions come from"));
      const max = Math.max(...s.rows.map((r) => r.ch4 * SK.gwp_ch4 + r.n2o * SK.gwp_n2o), 1);
      for (const r of s.rows) {
        const v = r.ch4 * SK.gwp_ch4 + r.n2o * SK.gwp_n2o;
        card.append(h("div", { class: "distrow" }, h("span", { class: "dl" }, D.livetypeLabel(r.desc) + ` (${fmt(r.n, 0)})`),
          h("span", { class: "db" }, h("span", { class: "dbf", style: `width:${Math.max(1, v / max * 100)}%` })),
          h("span", { class: "dv" }, fmt(v / 1000, 1) + " t")));
      }
      root.append(card, formulaBox("ghg"));
    }

    if (tab === "land") {
      root.append(h("div", { class: "rtiles" },
        tile(s.area ? fmt(s.area, 2) : "—", "ha", "Land described", null),
        tile(s.feed_gap != null ? fmt(s.feed_gap, 1) : "—", "t DM / ha", "Feed demanded per hectare", "compare with what your plots yield"),
        tile(s.land_per_animal != null ? fmt(s.land_per_animal, 2) : "—", "ha / animal", "Land per animal", null)));
      const card = h("div", { class: "card" }, h("h2", null, ICL.t("Feed by {plot}")));
      const rows = state.plots.map((p) => {
        const feeds = state.feeds.filter((f) => f.feed_plot === p.id);
        const y = feeds.reduce((t, f) => t + (Number(D.effective(D.field("yield_t_dm_ha"), D.decorate(f, "feed", state), state).value) || 0), 0);
        return { name: p.plot_name || ICL.t("{plot}"), area: Number(p.plot_area_ha) || 0, supply: y * (Number(p.plot_area_ha) || 0), feeds: feeds.length };
      });
      const supply = rows.reduce((t, r) => t + r.supply, 0);
      const t = h("table", { class: "grid" }, h("thead", null, h("tr", null, h("th", null, ICL.t("{plot}")), h("th", null, "Area"), h("th", null, "Feeds"), h("th", null, "Sketch supply"))));
      const body = h("tbody");
      for (const r of rows) body.append(h("tr", null, h("td", null, r.name), h("td", null, fmt(r.area, 2) + " ha"), h("td", null, String(r.feeds)), h("td", null, fmt(r.supply, 1) + " t DM")));
      t.append(body);
      card.append(h("div", { class: "tablewrap" }, t));
      card.append(h("p", { class: "small" }, `Sketch supply ${fmt(supply, 1)} t DM against ${fmt(s.dm / 1000, 1)} t DM eaten — `,
        supply >= s.dm / 1000 ? "the land described could feed the herd on these yields." : h("strong", null, "the land described falls short, so feed must be bought, collected or grazed elsewhere."),
        " The real model does this properly, per season and per feed."));
      root.append(card, formulaBox("land"));
    }

    if (tab === "water") {
      root.append(h("div", { class: "rtiles" },
        tile(fmt(s.water, 0), "m³ / year", "Water in the feed", "green water, rain used by the crops"),
        tile(s.milk ? fmt(s.water * 1000 / s.milk, 0) : "—", "litres / kg milk", "Water intensity", null)));
      root.append(h("div", { class: "callout" }, "Drinking water and service water are not in this sketch. The model splits green, blue and grey water; this screen exists to test how that is presented."), formulaBox("water"));
    }

    if (tab === "nitrogen") {
      root.append(h("div", { class: "rtiles" },
        tile(fmt(s.n_in, 0), "kg N", "Returned to the land", "manure kept plus mineral fertiliser"),
        tile(fmt(s.n_out, 0), "kg N", "Taken off in feed", "1.5% of the dry matter eaten"),
        tile(fmt(s.n_balance, 0), "kg N", "Balance", s.n_balance < 0 ? "soil is being mined" : "surplus, watch leaching", s.n_balance < 0 ? "var(--danger)" : "var(--warn)")));
      root.append(h("div", { class: "card" }, h("h2", null, "Why this matters"),
        h("p", { class: "small" }, "A negative balance means the feed is taking more nitrogen off the land than the manure and fertiliser put back, which shows up as falling yields years later rather than in this year's numbers. A large surplus means nitrogen is leaving as nitrate or nitrous oxide. Neither is visible without a calculation like this one.")),
        formulaBox("nitrogen"));
    }

    if (tab === "compare") {
      const mode = state.ui.compareMode || "time";
      const modes = h("div", { class: "chips" });
      for (const [k, l] of [["time", "Over time"], ["other", "Against another assessment"], ["bench", "Against a benchmark"]])
        modes.append(h("button", { type: "button", class: "filterchip", "aria-pressed": String(mode === k), onclick: () => ICL.store.update("ui.compareMode", k) }, l));
      root.append(h("div", { class: "listfilter" }, modes));

      const rows = state.library.assessments || [];
      const here = rows.find((r) => r.id === state.meta.id);
      const siblings = here && here.enterprise ? rows.filter((r) => r.enterprise === here.enterprise) : [];
      const overTime = siblings.filter((r) => r.kind === "observed").sort((a, b) => (a.as_of || 0) - (b.as_of || 0));
      const ent = (state.library.enterprises || []).find((e) => e.id === (here && here.enterprise));

      if (mode === "time") {
        const card = h("div", { class: "card", dataset: { fb: "results:overtime", fbLabel: "Comparison over time" } },
          h("h2", null, "The same enterprise, assessed more than once"));
        if (overTime.length < 2) {
          card.append(h("p", null, ent
            ? `${ent.name} has one dated assessment. Assess it again — from Enterprises, "Assess again this year" copies this description so you only change what has changed on the ground.`
            : "This assessment does not belong to an enterprise yet, so there is nothing to compare it against over time."),
            h("a", { class: "btn", href: "#home" }, "Go to Enterprises"));
        } else {
          const t = h("table", { class: "grid" }, h("thead", null, h("tr", null, h("th", null, "Year"), h("th", null, "Assessment"), h("th", null, "Animals"), h("th", null, "Land"), h("th", null, "Sketch GHG"), h("th", null, "Per kg milk"), h("th", null, ""))));
          const body = h("tbody");
          let prev = null;
          for (const r of overTime) {
            const data = (window.ICL_SCENARIOS.scenarios || {})[r.id];
            let ghg = null, intensity = null, head = null, area = null;
            if (data) {
              const st2 = Object.assign({}, state, data, { ui: Object.assign({}, state.ui, { validateAll: false }) });
              const sk = sketch(st2, ICL.compile(st2));
              ghg = sk.ghg; intensity = sk.ghg_per_kg_milk; head = st2.animals.reduce((t2, a) => t2 + (Number(a.herd_n) || 0), 0);
              area = st2.plots.reduce((t2, p) => t2 + (Number(p.plot_area_ha) || 0), 0);
            }
            const delta = (now, was, digits) => was == null || now == null ? "" : ` (${now >= was ? "+" : ""}${fmt((now - was) / (was || 1) * 100, 0)}%)`;
            body.append(h("tr", { class: r.id === state.meta.id ? "row-sel" : "" },
              h("td", null, String(r.as_of || "\u2014")),
              h("td", null, r.label || r.name),
              h("td", null, head != null ? fmt(head, 0) + (prev ? delta(head, prev.head) : "") : "\u2014"),
              h("td", null, area != null ? fmt(area, 2) + " ha" : "\u2014"),
              h("td", null, ghg != null ? fmt(ghg / 1000, 1) + " t" + (prev ? delta(ghg, prev.ghg) : "") : "\u2014"),
              h("td", null, intensity != null ? fmt(intensity, 2) + (prev ? delta(intensity, prev.intensity) : "") : "\u2014"),
              h("td", null, r.id === state.meta.id ? h("span", { class: "chip c-user" }, "open") : h("button", { type: "button", class: "btn-sm", onclick: () => { ICL.store.load(r.id); ICL.toast(`Opened ${r.label || r.name}.`); } }, "Open"))));
            prev = { head, area, ghg, intensity };
          }
          t.append(body);
          card.append(h("div", { class: "tablewrap" }, t));
          card.append(h("p", { class: "small" }, "Percentages are the change on the previous assessment. Sketch numbers, as everywhere on this screen."));
          card.append(h("div", { class: "callout warn" }, h("strong", null, "What this view cannot yet do. "),
            "It shows that something changed, not why. Separating the effect of an intervention from a different year's rainfall, a changed parameter set or a differently-asked question needs attribution the model does not do yet — it is in ",
            h("a", { href: "#features" }, "the feature queue"), " as tracking an enterprise over time."));
        }
        root.append(card);
      }

      if (mode === "other") {
        const others = rows.filter((r) => r.id !== state.meta.id);
        root.append(h("div", { class: "card", dataset: { fb: "results:compare", fbLabel: "Comparison with another assessment" } },
          h("h2", null, "Against another assessment"),
          h("p", { class: "small" }, "The reason for keeping a what-if beside the observed assessment: absolute numbers carry all the uncertainty of the inputs, while the difference between two descriptions that share their defaults carries far less."),
          others.length
            ? h("div", { class: "control" }, h("select", { "aria-label": "Assessment to compare", onchange: (e2) => ICL.store.update("ui.compareWith", e2.target.value) },
                h("option", { value: "" }, "Choose an assessment\u2026"),
                ...others.map((o) => h("option", { value: o.id, selected: state.ui.compareWith === o.id }, `${o.name}${o.as_of ? " \u00b7 " + o.as_of : ""}`))),
              h("button", { type: "button", class: "btn-sm", onclick: () => ICL.toast("Mocked: the real app runs both and shows the difference per indicator, with the inputs that differ listed beside it.") }, "Compare"))
            : h("p", { class: "small" }, "Nothing else to compare with yet.")));
        if (state.ui.compareWith) {
          const other = others.find((o) => o.id === state.ui.compareWith);
          root.append(h("div", { class: "callout" }, "Mocked comparison against ", h("strong", null, other ? other.name : "?"),
            ". In the real app: one row per indicator, absolute and percentage change, the direction stated in words (\u201c12% lower emissions per kg of milk\u201d), and a list of exactly which inputs differ between the two."));
        }
      }

      if (mode === "bench") {
        root.append(h("div", { class: "card", dataset: { fb: "results:benchmark", fbLabel: "Benchmark placeholder" } },
          h("h2", null, "Against a benchmark"),
          h("div", { class: "callout warn" }, h("strong", null, "Not built. "),
            "A number on its own answers nothing: 4.6 kg CO\u2082e per kg of milk is only meaningful beside what comparable enterprises produce. Today this screen gives you a figure with no context, which is the most common way a result gets misread."),
          h("p", null, "What it would compare against, in rough order of usefulness:"),
          h("ul", null,
            h("li", null, h("strong", null, "Other assessments in the same project or batch"), " \u2014 the honest one, because the method and the parameter set are identical. A distribution with this enterprise marked on it."),
            h("li", null, h("strong", null, "A regional typical value"), " from the parameter set, carrying its own source and date."),
            h("li", null, h("strong", null, "Published reference ranges"), " for the system type, cited, with the caveat that boundaries and methods differ between studies."),
            h("li", null, h("strong", null, "The same enterprise in an earlier year"), " \u2014 already possible under Over time.")),
          h("p", { class: "small" }, "The trap to avoid is a single national average presented as a target: it invites a user to conclude they are doing well or badly on a comparison that was never like for like. Any benchmark shown has to carry what it is, where it came from and who is in it."),
          h("div", { class: "control" }, h("a", { class: "btn", href: "#features" }, "See the benchmark request in the queue"))));
      }
    }

    root.append(h("div", { class: "control", style: "margin-top:14px" },
      h("button", { type: "button", class: "btn-sm", onclick: () => ICL.download(`icleaned-sketch-results-${(state.meta.scenario_name || "scenario").replace(/\W+/g, "_")}.json`,
        JSON.stringify({ disclaimer: "SKETCH NUMBERS FROM A MOCKUP — NOT MODEL OUTPUT. " + ICL.common.DISCLAIMER_SHORT, scenario: state.meta.scenario_name, generatedAt: new Date().toISOString(), factors: SK, indicators: sketch(state, compiled) }, null, 1), "application/json") }, "Download the sketch numbers"),
      h("a", { class: "btn-sm", href: "#check" }, "Back to Check & run"),
      h("a", { class: "btn-sm", href: "#features" }, "Ask for a different indicator")));
  };

  function formulaBox(which) {
    const F = {
      ghg: ["Enteric methane: head × 117 kg CH₄ for cows, 58 for other adults, 35 for calves, × 27 (GWP100).",
            "Manure nitrous oxide: head × live weight × 0.35 kg N excreted, × 1% direct + 24% leached × 1.1%, × 44/28, × 273."],
      land: ["Feed eaten: head × live weight × 2.5% per day × 365.",
             "Sketch supply: each plot's area × the yields entered for the feeds grown on it."],
      water: ["Water in the feed: kilograms of dry matter eaten × 1,200 litres."],
      nitrogen: ["Returned: nitrogen excreted × the share of manure kept, plus mineral fertiliser nitrogen.",
                 "Taken off: 1.5% of the dry matter eaten."],
    };
    const lines = which ? F[which] : [].concat(F.ghg, F.land, F.water, F.nitrogen);
    return h("details", { class: "advanced", dataset: { fb: "results:formula" + (which ? ":" + which : ""), fbLabel: "Sketch formulas" } },
      h("summary", null, "How this sketch got its numbers"),
      h("ul", null, ...lines.map((l) => h("li", { class: "small" }, l))),
      h("p", { class: "small" }, "Every factor above is a round number chosen to be roughly right, not a parameter from the model. The real model uses your parameter set, the IPCC tables, the season lengths and the feed basket. Tell us in a comment if an indicator is missing, badly named, or in the wrong unit — that is what this screen is for."));
  }
})(window.ICL);
