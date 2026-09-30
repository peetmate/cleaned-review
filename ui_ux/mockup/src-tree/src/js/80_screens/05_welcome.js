/* Welcome: what iCLEANED is, what you are about to do, what a scenario is. */
(function (ICL) {
  const { h } = ICL; const D = ICL.dict;
  ICL.screens.welcome = function (root, { state }) {
    root.append(h("div", { class: "hero", dataset: { fb: "welcome:hero", fbLabel: "Welcome hero", noNumber: "" } },
      h("p", { class: "eyebrow" }, "iCLEANED · Scenario Builder"),
      h("h1", null, "What would this change do to the land, water, soil and climate?"),
      h("p", { class: "lede" }, "iCLEANED estimates the environmental effects of keeping livestock: the land needed to feed the animals, the water they use, soil loss, the nitrogen balance, and greenhouse gas emissions. You describe a livestock enterprise once; the model turns that description into numbers you can compare."),
      h("div", { class: "hero-actions" },
        h("a", { class: "btn", href: "#about" }, "Start describing an enterprise"),
        h("a", { class: "btn secondary", href: "#home" }, "Open an example or a saved scenario"),
        h("a", { class: "btn secondary", href: "#why" }, "Why this tool, and how it compares"))));

    root.append(h("h2", { "data-no-number": "" }, "What you will be asked"),
      h("div", { class: "steps-grid", dataset: { fb: "welcome:steps", fbLabel: "Steps overview" } },
        ...D.sections().filter((s) => s.wizard).map((s) => h("div", { class: "step-card" },
          h("b", null, ICL.num.stepOf(s.id) + ". " + ICL.t(s.short || s.title)),
          h("span", { class: "small" }, ICL.t(s.purpose || ""))))),
      h("p", { class: "small" }, `${ICL.num.totalSteps()} steps. Nothing is compulsory in this order: the sidebar lets you jump, and we only ask what applies to the enterprise you describe. Expect 15–30 minutes for a first pass, less once the defaults fit your area.`));

    root.append(h("div", { class: "callout", dataset: { fb: "welcome:help", fbLabel: "Pointer to help", noNumber: "" } },
      h("strong", null, "Two pages of background, not data entry: "),
      h("a", { href: "#boundary" }, "what the model counts"), " (where the enterprise starts and stops) and ",
      h("a", { href: "#help" }, "help, FAQ and contact"), " (why results can come out zero, what the units are, who to tell when something is wrong)."));

    root.append(h("h2", { "data-no-number": "" }, "Words used here"),
      h("dl", { class: "glossary", dataset: { fb: "welcome:glossary", fbLabel: "Glossary" } },
        ...[
          ["Livestock enterprise", "The animals, the land that grows their feed, and the manure they produce — treated as one unit for one year. This can be one household's cows, a cooperative's herd, a district, or a national herd. iCLEANED is a herd model, not a farm model: crops that are not fed to the animals stay outside it."],
          ["Scenario", "One complete description of an enterprise, saved under a name. A baseline scenario describes things as they are now. An intervention scenario is a copy with something changed — a new feed, better manure storage, more animals — so the two can be compared. You need at least one; comparing needs two."],
          ["Project", "A folder for scenarios that belong together \u2014 one study, one district, one piece of work \u2014 plus the people who may see them. A project holds many scenarios; a scenario belongs to one project. Sharing a project shares every scenario in it, and any parameter set shared with it, so colleagues compare like with like instead of mailing files around."],
          ["Parameter set", "The reference values a scenario starts from: animal weights, feed quality, soil erodibility for your region. Shipped sets are read-only so results stay comparable; you can copy one and edit it."],
          ["Season", "A feeding period within the year. Animals usually eat differently in the rains and in the dry season, so the diet is described per season."],
          ["Herd and animal group", "A herd is animals kept together and managed the same way. Inside it, an animal group is one category — milking cows, calves — because each eats and produces differently."],
        ].map(([t, dd]) => [h("dt", null, t), h("dd", null, dd)]).flat()));

    root.append(ICL.common.disclaimer({ where: "welcome" }));

    root.append(h("div", { class: "callout", dataset: { fb: "welcome:mockup", fbLabel: "Mockup notice" } },
      h("strong", null, "This is a mockup for testing. "),
      "It does not run the model and it does not save to a server. Everything you type stays in this browser. Numbered headings (",
      h("span", { class: "num-demo" }, "3.2"),
      ") are there so you can point at exactly what you are commenting on — turn on ",
      h("strong", null, "Comment"), " at the bottom right and click anything.",
      h("div", { class: "small", style: "margin-top:6px" }, "Build ", h("strong", null, ICL.buildShort()), " \u2014 the same stamp is in the header, so you can tell whether you are looking at the latest changes. Full: ", ICL.buildLong(), ".")));
  };
})(window.ICL);
