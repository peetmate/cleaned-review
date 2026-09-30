/* Help, FAQ and contact. Also the home of the background material (what the model counts). */
(function (ICL) {
  const { h } = ICL; const D = ICL.dict; const { screenHead } = ICL.common;

  const FAQ = [
    ["What does iCLEANED actually calculate?",
     "For one livestock enterprise over one year: the land needed to feed the animals, water use, soil loss, the nitrogen balance, and greenhouse gas emissions — with the emissions following the IPCC 2019 Tier 2 method. It does not calculate profit, labour or animal health.",
     null],
    ["What is the difference between a scenario and a project?",
     "A scenario is one complete description of one enterprise for one year. A project is the folder that groups related scenarios and the people who may see them. You compare scenarios within a project: a baseline against an intervention.",
     "#welcome"],
    ["Which crops and animals belong in the description, and which do not?",
     "Only what feeds the herd, plus the herd itself and its manure. A maize field counts if the stover is fed; if the whole crop is sold for people to eat, it stays outside. There is a diagram of this under “What the model counts”.",
     "#boundary"],
    ["Do I have to fill in every field?",
     "No. Blank means “I do not know”, and the app fills a sensible default and lists it on Check & run so you can see what it assumed. Only a short list of values genuinely stops the model: they are the ones marked “needed”, and Check & run lists them with a link to the field.",
     "#check"],
    ["Why are some of my results zero or empty?",
     "In the current app the usual cause is a default of zero that was never changed — most often the share of the main product that is actually fed. In this redesign those fields cannot silently stay at zero: they are flagged before you can run.",
     null],
    ["Where do the default numbers come from, and can I change them?",
     "From a parameter set for your region (animal weights, feed quality, soil erodibility) plus fixed IPCC constants. Shipped sets are read-only so results stay comparable; you can copy one and edit it, or override a single value on the card that uses it. Every value shows which of the four it is: yours, from the database, assumed, or fixed.",
     "#parameters"],
    ["My feed is not in the list. What now?",
     "Search by local name first — the list knows some synonyms. If it is genuinely missing, pick the closest match, note it in a comment, and ask for it to be added to the parameter set; the real app can request it from the maintainers with a source.",
     "#parameters"],
    ["What units does the app expect?",
     "Whatever the question says, in the brackets after the label. Milk is asked as litres a day and days milked, not kilograms a year — the conversion is done for you. Manure bought in is asked as bags or cartloads with a nitrogen percentage, not as kilograms of nitrogen.",
     null],
    ["Type a point or a comma for decimals?",
     "A point: 1.5. If you type 1,5 the app reads it as 1.5 and tells you it did, rather than silently storing 15.",
     null],
    ["How do I describe many enterprises at once?",
     "Use the Batch tab: a spreadsheet or JSON with one table per thing described, checked enterprise by enterprise, with a QAQC report you can send back to whoever filled the sheet.",
     "#batch"],
    ["Is my data saved, and who can see it?",
     "In this mockup everything stays in your browser and nothing is sent to a server; comments you leave are shared with the facilitators. In the real app scenarios are saved to your account and shared only with the people or projects you choose.",
     null],
    ["How do I report something that is wrong?",
     "Inside the mockup, turn on Comment at the bottom right and click the thing you are commenting on — it records which numbered heading you were on. For the real app, the routing is below.",
     null],
  ];

  ICL.screens.help = function (root, { state }) {
    root.append(screenHead(D.section("help")));
    root.append(ICL.common.disclaimer({ where: "help" }));

    root.append(h("div", { class: "callout", dataset: { fb: "help:stuck", fbLabel: "Stuck right now", noNumber: "" } },
      h("strong", null, "Stuck right now? "),
      "Every field has a ", h("span", { class: "chip" }, "?"), " with a definition and an example. Leave anything you do not know blank — ",
      h("a", { href: "#check" }, "Check & run"), " lists what is missing and what was assumed. In the workshop, ask the facilitator and let us watch where you got stuck: that is the point of the session."));

    // FAQ
    const faq = h("div", { class: "card", dataset: { fb: "help:faq", fbLabel: "FAQ" } }, h("h2", null, "Frequently asked questions"));
    for (const [q, a, link] of FAQ)
      faq.append(h("details", { class: "advanced" }, h("summary", null, q), h("p", null, a), link ? h("p", null, h("a", { href: link }, "Take me there")) : null));
    root.append(faq);

    // background material
    root.append(h("div", { class: "card", dataset: { fb: "help:background", fbLabel: "Background material" } },
      h("h2", null, "Background"),
      h("p", { class: "small" }, "Reading, not data entry. These pages explain what the model does with your answers; nothing on them is required before you run."),
      h("ul", null,
        h("li", null, h("a", { href: "#boundary" }, "What the model counts"), " — where the enterprise starts and stops, with a diagram and worked examples."),
        h("li", null, h("a", { href: "#welcome" }, "What is iCLEANED?"), " — what it estimates, the steps you will be asked, and the words used here."),
        h("li", null, h("a", { href: "#parameters" }, "Parameter set"), " — every default value, where it comes from, and what you may change."))));

    // contact
    root.append(h("div", { class: "card", dataset: { fb: "help:contact", fbLabel: "Contact" } },
      h("h2", null, "Contact and reporting"),
      h("div", { class: "tablewrap" }, h("table", { class: "grid" },
        h("thead", null, h("tr", null, h("th", null, "What it is"), h("th", null, "Where it goes"), h("th", null, "Who files it"))),
        h("tbody", null,
          h("tr", null, h("td", null, "A screen, button, label, chart or download that is wrong or confusing"), h("td", null, "The app repository, ", h("a", { href: "https://github.com/CIAT/icleaned/issues", target: "_blank", rel: "noopener" }, "CIAT/icleaned")), h("td", null, "Facilitator, from your comment")),
          h("tr", null, h("td", null, "A result that looks implausible and stays wrong when the same description is run again"), h("td", null, "The model repository, ", h("a", { href: "https://github.com/CIAT/cleaned/issues", target: "_blank", rel: "noopener" }, "CIAT/cleaned"), " — bug report"), h("td", null, "Facilitator or developer")),
          h("tr", null, h("td", null, "A default, emission factor, feed value or missing list entry"), h("td", null, "CIAT/cleaned — data or parameter issue, or ", h("a", { href: "#parameters" }, "Propose a change"), " from the parameters screen"), h("td", null, "You, with a source")),
          h("tr", null, h("td", null, "Anything you want the team to see during the workshop"), h("td", null, "The ", h("strong", null, "Comment"), " button at the bottom right of any screen"), h("td", null, "You"))))),
      h("p", { class: "small" }, "The team's address and the support channel are filled in by whoever runs your session — this mockup deliberately does not carry an email address. If you are reading this outside a workshop, the two repositories above are the public route."),
      h("div", { class: "control" },
        h("button", { type: "button", class: "btn", onclick: () => { ICL.store.set((s) => { s.fb.mode = "comment"; return s; }); ICL.toast("Comment mode on: click the thing you want to tell us about."); } }, "Leave a comment now"),
        h("a", { class: "btn secondary", href: "#feedback" }, "See what has been reported"))));

    root.append(h("p", { class: "small" }, "Build ", ICL.buildShort(), " · quote this if you report something, so we know which version you saw."));
  };
})(window.ICL);
