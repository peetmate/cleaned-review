/* Why iCLEANED: the question it answers, what a partner gets, use cases, and an
   honest comparison with the tools people already use. Facts about other tools come
   from their own manuals, read in September 2026; anything inferred is marked. */
(function (ICL) {
  const { h } = ICL; const D = ICL.dict; const { screenHead } = ICL.common;

  const INDICATORS = [
    ["Greenhouse gases", "Enteric methane, manure methane and nitrous oxide, and the emissions of the feed, following IPCC 2019 Tier 2 where the data allow it."],
    ["Land", "How much land the herd's feed actually occupies, including land elsewhere when feed is bought in, and the productivity of that land."],
    ["Water", "The water used to grow the feed, which in rainfed systems is most of the water a herd is responsible for."],
    ["Soil", "Erosion from the land that grows the feed, from slope, cover and practice."],
    ["Nitrogen", "What the feed takes off the land against what the manure and fertiliser put back — the balance that decides whether the system is being mined."],
  ];

  const OFFER = [
    ["The model, open", "The <em>cleaned</em> R package is open source: the equations, the IPCC tables and the regional data can be read, cited, forked and run without us. A partner is never locked to a hosted service or a licence."],
    ["A hosted entry point", "This app, for people who will not use R: describe an enterprise, check it, run it, compare scenarios, export the numbers."],
    ["Regional parameter sets", "The defaults that make a tool usable somewhere new — animal weights, feed quality, yields, soil factors. We build one with a partner from their own survey or station data, and it is shipped as a named, versioned, citable set that anyone in that region can then use."],
    ["Batch assessment of existing data", "Survey and monitoring data usually already describe hundreds of enterprises. The batch route checks and runs them from a spreadsheet, with a QAQC report that names the sheet, column and row of every problem, so the effort goes into fixing data rather than re-keying it."],
    ["Training and facilitation", "Workshops for enumerators, advisers and analysts, with materials: the run sheet, the field form, the glossary, and the feedback route back into this queue."],
    ["Co-developed analysis", "Joint work on a specific question — an inventory, a project baseline, an intervention comparison — rather than handing over a tool and leaving."],
  ];

  const PARTNERS = [
    ["A national ministry or statistics office", "Needs a defensible inventory number and a method that survives review.", "A national or sub-national herd described once, with the IPCC labels and the assumptions listed; batch runs from existing survey rounds; a parameter set that becomes the country's reference."],
    ["A research programme or university", "Needs transparency, repeatability and something to cite.", "The open package, the versioned parameter set, the compiled study object for every scenario, and per-cell provenance for every value that went into it."],
    ["An NGO or development project", "Needs before-and-after numbers for a defined intervention, with limited data.", "Baseline and intervention scenarios that share their defaults, so the comparison is sound even when the absolute numbers are uncertain; the quick route for sites with little data."],
    ["A dairy hub, cooperative or processor", "Needs the footprint of what it sources and where to act first.", "One scenario per supplier group or a batch from the collection records, ranked, with the largest contributors identified."],
    ["An extension or advisory service", "Needs a conversation with a farmer, not a form.", "A short description in plain questions, results a farmer can see the sense of, and a printable form for where there is no connection (queued)."],
  ];

  const CASES = [
    ["Placeholder · National dairy herd inventory", "Tanzania", "Describe the national herd in two production systems and compare a feed-improvement pathway against business as usual.", "What the tool would produce, and what data the partner would need to supply. To be written with the partner."],
    ["Placeholder · Project baseline and ex-ante appraisal", "East Africa", "Appraise a forage intervention across a project's sites before it starts, with adoption assumptions, and set the baseline the project is later measured against.", "Waiting on the scenario-planning feature (#1 in the queue) to be built before this can be written honestly."],
    ["Placeholder · Sourcing footprint for a dairy hub", "Kenya", "Run every supplier group from the hub's own collection records and rank them by emission intensity per kilogram of milk.", "Needs the batch run (#5 in the queue)."],
    ["Placeholder · Comparing intensification pathways", "Vietnam", "One enterprise, several described futures: more animals, better feed, better manure storage — and what each does to land, water, nitrogen and emissions rather than emissions alone.", "The multi-indicator comparison is the point; the write-up needs real data."],
    ["Placeholder · Teaching the livestock–environment link", "Anywhere", "A class describes their own systems and watches which choices move which indicator.", "Needs the quick mode and a worked teaching scenario."],
  ];

  // From each tool's own documentation, September 2026. "GHG" means greenhouse gases only.
  const COMPARE = [
    { tool: "iCLEANED / cleaned", who: "Researchers, ministries, NGOs, advisers — mixed crop–livestock systems, mostly tropical",
      indicators: "GHG, land, water, soil erosion, nitrogen balance", geo: "Regional parameter sets (Tanzania, Kenya, Uganda, Vietnam and others)",
      scale: "One household to a national herd, same questions", access: "Open-source R package plus this app",
      strength: "Several indicators at once, for systems where feed comes from crop residues and communal grazing as much as from a bought ration",
      weak: "Young, thin documentation, and the interface is what this mockup exists to fix" },
    { tool: "Cool Farm Tool (Beef & Dairy)", who: "Producers, agronomists and supply-chain users, globally",
      indicators: "GHG; water and biodiversity in separate modules", geo: "Global, with supply-chain use in mind",
      scale: "One farm per assessment", access: "Web, Cool Farm Alliance membership for organisations",
      strength: "Mature, widely trusted in corporate reporting; strong per-field help and a duplicate-and-compare workflow",
      weak: "Feed crops have to be assessed in a separate crop module first, which trips up first-time users; no offline" },
    { tool: "GLEAM-i 2.0 (FAO)", who: "Policy planners, project designers, NGOs",
      indicators: "GHG", geo: "Every country, from FAO defaults",
      scale: "National and sub-national", access: "Excel workbook with macros; a Shiny version exists",
      strength: "Country defaults for every variable and a clean Baseline-vs-Scenario structure; the reference for national livestock GHG",
      weak: "GHG only, country-average defaults, and an Excel-with-macros delivery that suits few field settings" },
    { tool: "Agrecalc Cloud (SRUC)", who: "Farmers and consultants in the UK",
      indicators: "GHG, with enterprise and product footprints", geo: "UK",
      scale: "Whole farm and enterprise", access: "Web, paid tiers",
      strength: "Per-enterprise allocation, benchmarking against similar farms, and a consultant validation step",
      weak: "UK-specific; about 2.5 hours for a first assessment" },
    { tool: "CAP'2ER (Idele)", who: "Trained advisers with the farmer, France",
      indicators: "GHG, energy, water, air, carbon storage, biodiversity, economics", geo: "France",
      scale: "One ruminant workshop", access: "Licence plus 1–2 day training",
      strength: "Two published depth levels (27 data points in 30 minutes, or 150 in 3 hours) and certified data collection — the best answer anywhere to “how much detail is enough”",
      weak: "No self-service path, French-only documentation, licence and training required" },
    { tool: "COMET-Farm (USDA)", who: "US producers and conservation planners",
      indicators: "GHG and soil carbon, including cropland, agroforestry and forestry", geo: "United States",
      scale: "Fields and animal groups", access: "Free web",
      strength: "Soil and weather derived from the map, a progress roadmap that will not let you run an incomplete project, and monthly detail",
      weak: "US-only locations and imperial units; deep nesting is heavy for smallholder systems" },
    { tool: "FEAST (ILRI)", who: "Researchers and extension staff in the tropics",
      indicators: "None — it diagnoses the feed situation rather than the environment", geo: "Sub-Saharan Africa, South and South-East Asia",
      scale: "Site, with focus groups and interviews", access: "Free Windows desktop, fully offline",
      strength: "Built for exactly the systems iCLEANED targets: seasons as months, feed availability scored per month, offline by design",
      weak: "Not an environmental model, and Windows-only" },
  ];

  ICL.screens.why = function (root, { state }) {
    root.append(screenHead(D.section("why")));
    const tab = state.ui.whyTab || "question";
    const TABS = [["question", "The question it answers"], ["offer", "What we offer"], ["partners", "Working with partners"], ["cases", "Use cases"], ["compare", "How it compares"]];
    const tb = h("div", { class: "tabs", role: "tablist" });
    for (const [k, l] of TABS) tb.append(h("button", { type: "button", role: "tab", "aria-selected": String(tab === k), onclick: () => ICL.store.update("ui.whyTab", k) }, l));
    root.append(tb);

    if (tab === "question") {
      root.append(h("div", { class: "hero", dataset: { fb: "why:hero", fbLabel: "Why hero", noNumber: "" } },
        h("p", { class: "eyebrow" }, "Why iCLEANED"),
        h("h1", null, "Most tools tell you the carbon. Livestock decisions are rarely only about carbon."),
        h("p", { class: "lede" }, "A herd sits on land, drinks water, moves nitrogen around and wears out soil. Change the feed and every one of those moves at once, often in opposite directions — a bought concentrate can cut emissions per litre of milk while shifting the land use somewhere you cannot see. iCLEANED estimates five things from one description of the enterprise, so the trade-off is visible instead of assumed.")));
      const grid = h("div", { class: "steps-grid", dataset: { fb: "why:indicators", fbLabel: "Indicators" } });
      for (const [t, d] of INDICATORS) grid.append(h("div", { class: "step-card" }, h("b", null, t), h("span", { class: "small" }, d)));
      root.append(grid);
      root.append(h("div", { class: "card" }, h("h2", null, "Three things that follow from that"),
        h("dl", { class: "glossary" },
          h("dt", null, "One description, any scale"), h("dd", null, "The same questions describe a household with three cows and a national herd of four million. Only the numbers change, so a district estimate and the enterprises inside it are built the same way and can be compared."),
          h("dt", null, "Built for systems where feed is not a bought ration"), h("dd", null, "Crop residues, communal grazing, cut-and-carry, a few kilos of dairy meal — the feed basket is described per season and per animal group, which is how smallholder feeding actually works and where most global tools assume a formulated diet."),
          h("dt", null, "Comparison before absolutes"), h("dd", null, "Absolute numbers carry all the uncertainty of the inputs. Two scenarios that share their defaults and differ in one thing carry far less, so the tool is built around baseline-against-intervention rather than a single certified figure."))));
      root.append(ICL.common.disclaimer({ where: "why", short: true }));
    }

    if (tab === "offer") {
      root.append(h("p", { class: "purpose" }, "What a partner actually gets, beyond a link to a web page."));
      for (const [t, d] of OFFER) root.append(h("div", { class: "card", dataset: { fb: "why:offer:" + t, fbLabel: "Offer: " + t } }, h("h2", null, t), h("p", { html: d })));
      root.append(h("div", { class: "callout" }, h("strong", null, "What we do not offer. "),
        "Certification or an audited footprint; a farm-management system; anything that runs without someone who knows the enterprise being described. Where a partner needs an audited number for a standard, a tool like Cool Farm or Agrecalc is the better route — see ",
        h("a", { href: "#why", onclick: () => ICL.store.update("ui.whyTab", "compare") }, "how it compares"), "."));
    }

    if (tab === "partners") {
      root.append(h("p", { class: "purpose" }, "Different partners need different things from the same model. These are the five we have met so far; tell us which one you are, or that you are none of them."));
      const t = h("table", { class: "grid" }, h("thead", null, h("tr", null, h("th", null, "Partner"), h("th", null, "What they need"), h("th", null, "What we would set up"))));
      const tb2 = h("tbody");
      for (const [who, need, offer] of PARTNERS) tb2.append(h("tr", null, h("td", null, h("strong", null, who)), h("td", null, need), h("td", null, offer)));
      t.append(tb2);
      root.append(h("div", { class: "tablewrap card", dataset: { fb: "why:partners", fbLabel: "Partner table" } }, t));
      root.append(h("div", { class: "card soft" }, h("h2", null, "How an engagement usually goes"),
        h("ol", null,
          h("li", null, "A question worth answering, written down in one sentence."),
          h("li", null, "A look at what data already exists — usually more than the partner thinks, in survey rounds and monitoring sheets."),
          h("li", null, "A parameter set for the region, from that data plus the published sources, reviewed by someone who knows the systems."),
          h("li", null, "A handful of scenarios described together, so the assumptions are argued about while they are still cheap to change."),
          h("li", null, "Batch runs over the real data, with the QAQC report going back to whoever collected it."),
          h("li", null, "Results, the assumptions behind them, and the parameter set published so the work can be repeated.")),
        h("p", { class: "small" }, "Steps 3 and 5 are where the time goes, and both are mostly data work rather than modelling.")));
    }

    if (tab === "cases") {
      root.append(h("div", { class: "callout warn", dataset: { fb: "why:cases_note", fbLabel: "Use cases are placeholders" } },
        h("strong", null, "These are placeholders. "),
        "Each needs a real partner, real data and a real result before it can be written. They are here so the shape of a use case can be argued about, and so the workshop can say which ones matter. Nothing below has been done yet."));
      for (const [title, where, what, missing] of CASES)
        root.append(h("div", { class: "card", dataset: { fb: "why:case:" + title, fbLabel: "Use case: " + title } },
          h("div", { class: "card-head" }, h("h2", null, title), h("span", { class: "chip c-blank" }, where)),
          h("p", null, what), h("p", { class: "small" }, h("strong", null, "Before this can be written: "), missing)));
      root.append(h("div", { class: "control" },
        h("a", { class: "btn", href: "#features" }, "Propose a use case in the queue"),
        h("span", { class: "small" }, "Or leave a comment on the one closest to your work.")));
    }

    if (tab === "compare") {
      root.append(h("div", { class: "callout", dataset: { fb: "why:compare_note", fbLabel: "Comparison basis" } },
        h("strong", null, "Read from each tool's own documentation in September 2026. "),
        "Every entry has a column for where that tool is stronger, because most of these are more mature than iCLEANED and a comparison that hid it would not be worth reading. Correct anything that is out of date with a comment."));
      for (const c of COMPARE) {
        const mine = /iCLEANED/.test(c.tool);
        const card = h("div", { class: "card" + (mine ? " scen-open" : ""), dataset: { fb: "why:compare:" + c.tool, fbLabel: "Comparison: " + c.tool } },
          h("div", { class: "card-head" }, h("h2", null, c.tool), mine ? h("span", { class: "chip c-user" }, "this tool") : null),
          h("dl", { class: "kv" },
            h("dt", null, "For whom"), h("dd", null, c.who),
            h("dt", null, "What it reports"), h("dd", null, c.indicators),
            h("dt", null, "Where"), h("dd", null, c.geo),
            h("dt", null, "Scale"), h("dd", null, c.scale),
            h("dt", null, "Access"), h("dd", null, c.access)),
          h("p", { class: "small" }, h("strong", null, "Strongest at: "), c.strength),
          h("p", { class: "small" }, h("strong", null, mine ? "Weakest at: " : "Better than us at: "), c.weak));
        root.append(card);
      }
      root.append(h("div", { class: "card soft" }, h("h2", null, "The short version"),
        h("p", null, "If you need an audited carbon figure for a supply chain, use Cool Farm or Agrecalc. If you need a national GHG estimate from country defaults and nothing else, GLEAM-i already does it. If you are in France or the United States, CAP'2ER and COMET-Farm are better fitted than anything we would build."),
        h("p", null, h("strong", null, "iCLEANED is for the case none of those covers: "), "a mixed crop–livestock system in the tropics, where the feed comes from residues and communal land, where the question is land and water and nitrogen as well as carbon, and where the same description has to work from one household up to a national herd."),
        h("p", { class: "small" }, "See the full benchmarking of 22 tools, and the ten design patterns taken from them, in the review that accompanies this mockup.")));
    }
  };
})(window.ICL);
