/* Feature requests: the queue, in priority order, plus a form to add one.
   Requests live in the local draft; the real app would keep them with the project. */
(function (ICL) {
  const { h, fmt } = ICL; const D = ICL.dict; const { screenHead, confirmButton } = ICL.common;

  // Seeded from the review, the workshop plan and the sessions so far. Rank is the
  // working priority; it is visible and arguable, which is the point of showing a queue.
  const SEED = [
    { id: "ft_exante", rank: 1, title: "Scenario planning for ex-ante assessment",
      body: "Plan and compare a set of scenarios before anything is implemented: define an intervention once (a feed, a manure store, a herd change), apply it to one or many baselines, and see the effect side by side with the uncertainty of the inputs made visible. Includes adoption assumptions — what share of a population takes it up — so a district or national effect can be estimated from an enterprise-level description.",
      why: "Requested by the team. It is the question the tool is actually asked: not what this herd emits today, but what would change if we did something.",
      status: "queued", size: "L", source: "team", votes: 3, tags: ["scenarios", "comparison", "scaling"] },
    { id: "ft_run", rank: 2, title: "Run the model from the redesigned form",
      body: "Wire the compiled study object to the cleaned package and show the real results on the Results screen, replacing the sketch numbers.",
      why: "The redesign compiles a valid study object already; until it runs, every result on screen is illustrative.",
      status: "queued", size: "M", source: "review", votes: 2, tags: ["results"] },
    { id: "ft_draft_sync", rank: 3, title: "Draft that syncs to the account, not just the browser",
      body: "Local-first saving on every change plus background sync, a visible saved / saving / offline state, the newer of local and server offered on reopening, and a short version history per scenario.",
      why: "A first pass takes 15–30 minutes and people lose work to grey screens today (UX-01, UX-39).",
      status: "queued", size: "M", source: "team", votes: 2, tags: ["reliability"] },
    { id: "ft_custom_livetype", rank: 4, title: "User-defined animal categories",
      body: "Let a user add an animal category the parameter set does not have, mapped to the nearest model category, using the CLEANED-flexible mapping the form already emits. Also the only way to keep two herds of the same category apart in the results.",
      why: "The model keeps one row per animal category and stops if two are the same, so herds merge today whether the user wants it or not.",
      status: "queued", size: "M", source: "review", votes: 1, tags: ["parameters", "herds"] },
    { id: "ft_batch_run", rank: 5, title: "Run a whole batch and join the results back",
      body: "Queue a run for every enterprise in an uploaded batch, then return one row per enterprise so the results can be joined onto the survey they came from.",
      why: "Batch checking is built; without a run it stops at the QAQC report.",
      status: "queued", size: "M", source: "team", votes: 1, tags: ["batch", "results"] },
    { id: "ft_depth", rank: 6, title: "Quick and detailed modes",
      body: "A quick pass that asks only what changes the answer, with everything else on regional defaults, and a detailed mode for people who have measurements.",
      why: "Deferred from the mockup review; the wizard currently asks everyone everything.",
      status: "queued", size: "M", source: "review", votes: 1, tags: ["form"] },
    { id: "ft_capacity", rank: 7, title: "Capacity sharing: a training request route, a short course you can re-context, and videos",
      body: "Three parts. A structured <em>request training</em> route that records who is asking, which segment they are, how many people, which interface they would use and what data they already hold, so a request can be answered with the right course instead of a conversation starting from nothing. A modular short course whose worked examples run on the requester's own country and data: fixed core modules (concepts and scope, the input contract, running the model, reading the output, limitations) plus a context module they supply, so a new country is a config file and a dataset rather than a fork of the materials, with a credit-bearing version a university could adopt. And short task-shaped videos \u2014 \u201cbuild a feed basket\u201d, \u201cread the nitrogen balance\u201d \u2014 indexed by task and segment rather than recorded lectures.",
      why: "Training is already listed under what we offer, but there is no way to ask for it and nothing to hand over. Every workshop is rebuilt from scratch, capacity leaves when a project ends, universities cannot adopt what does not exist as a course, and the four segments need materially different training.",
      status: "queued", size: "L", source: "team", votes: 2, tags: ["training", "use cases", "access"] },
    { id: "ft_print", rank: 8, title: "Printable collection form",
      body: "A one-page sheet matching the wizard, for collecting the same description on paper where there is no connection, and an entry mode that follows the same order.",
      why: "Raised in the benchmarking: several field tools lead with paper.",
      status: "queued", size: "S", source: "review", votes: 0, tags: ["field"] },
    { id: "ft_multilingual", rank: 9, title: "Multiple languages from the data dictionary",
      body: "Every label, definition and option lives in one dictionary already; translate that rather than the code, starting with Swahili and French.",
      why: "Raised in the first review: English varies among the intended users.",
      status: "queued", size: "M", source: "review", votes: 2, tags: ["access"] },
    { id: "ft_maps", rank: 10, title: "Real map picker with SoilGrids and climate lookups",
      body: "Replace the mock map with a real one, and fill rainfall, evapotranspiration, soil type and carbon from services instead of a table of demo places.",
      why: "The form already treats those values as “from maps” and flags them as assumptions.",
      status: "in_progress", size: "M", source: "review", votes: 2, tags: ["location"] },
    { id: "ft_numbering", rank: 11, title: "Numbered sections and headings", body: "Automatic numbering that renumbers when a step is inserted, shown in the sidebar and stored with every comment.",
      why: "Asked for so that workshop feedback can point at one field.",
      status: "shipped", size: "S", source: "team", votes: 0, tags: ["form"] },
    { id: "ft_batch", rank: 12, title: "Batch upload with QAQC", body: "A spreadsheet of many enterprises, checked enterprise by enterprise, with a report naming the sheet, column and row.",
      why: "Asked for: most descriptions already exist in survey data.", status: "shipped", size: "L", source: "team", votes: 0, tags: ["batch"] },
  ];

  const STATUS = {
    queued: { label: "Queued", cls: "c-blank" },
    in_progress: { label: "Being built", cls: "c-derived" },
    shipped: { label: "In the mockup", cls: "c-user" },
    declined: { label: "Not planned", cls: "c-fixed" },
  };
  const SIZE = { S: "days", M: "weeks", L: "months" };

  const list = (state) => (state.features && state.features.length ? state.features : SEED).slice()
    .sort((a, b) => (a.status === "shipped") - (b.status === "shipped") || a.rank - b.rank);
  const ensure = () => ICL.store.set((s) => { if (!s.features || !s.features.length) s.features = JSON.parse(JSON.stringify(SEED)); return s; });

  ICL.screens.features = function (root, { state }) {
    root.append(screenHead(D.section("features")));
    const items = list(state);
    const flt = state.ui.featureFilter || "open";
    const counts = { open: items.filter((f) => f.status !== "shipped").length, shipped: items.filter((f) => f.status === "shipped").length, all: items.length };

    root.append(h("div", { class: "callout", dataset: { fb: "features:what", fbLabel: "What this queue is", noNumber: "" } },
      h("strong", null, "What is coming, in the order we mean to do it. "),
      "The rank is a working priority, not a promise, and it is shown so it can be argued with. Anything asked for in a workshop lands here with its reason attached, so nobody has to remember who wanted what. ",
      h("a", { href: "#feedback" }, "Comments"), " are about what exists; this is about what does not."));

    const chips = h("div", { class: "chips" });
    for (const [k, l] of [["open", "Open"], ["shipped", "Already in the mockup"], ["all", "Everything"]])
      chips.append(h("button", { type: "button", class: "filterchip", "aria-pressed": String(flt === k), onclick: () => ICL.store.update("ui.featureFilter", k) }, l, h("span", { class: "cnt" }, String(counts[k]))));
    root.append(h("div", { class: "listfilter" }, chips));

    const shown = items.filter((f) => flt === "all" || (flt === "shipped" ? f.status === "shipped" : f.status !== "shipped"));
    for (const f of shown) {
      const st = STATUS[f.status] || STATUS.queued;
      const card = h("div", { class: "card feat", dataset: { fb: "feature:" + f.id, fbLabel: "Feature: " + f.title } },
        h("div", { class: "card-head" },
          h("h2", null, f.status === "shipped" ? null : h("span", { class: "rank" }, "#" + f.rank), " ", f.title),
          h("div", { class: "actions" },
            h("span", { class: "chip " + st.cls }, st.label),
            h("span", { class: "chip", title: "Rough size: S is days, M is weeks, L is months" }, SIZE[f.size] || f.size),
            h("span", { class: "chip", title: "Where the request came from" }, f.source === "team" ? "asked for by the team" : f.source === "review" ? "from the review" : f.source))),
        h("p", { html: f.body }),
        h("p", { class: "small" }, h("strong", null, "Why: "), f.why),
        h("div", { class: "control" },
          h("button", { type: "button", class: "btn-sm", onclick: () => { ensure(); ICL.store.set((s) => { const x = s.features.find((y) => y.id === f.id); if (x) x.votes = (x.votes || 0) + 1; return s; }); ICL.toast("Noted. Votes are local to this browser in the mockup."); } },
            `▲ This one matters (${f.votes || 0})`),
          ...(f.tags || []).map((t) => h("span", { class: "chip" }, t))));
      root.append(card);
    }

    // add a request
    const title = h("input", { type: "text", placeholder: "One line: what should it do?", "aria-label": "Feature title" });
    const body = h("textarea", { placeholder: "What would it let you do that you cannot do now?", rows: 3, "aria-label": "Feature description" });
    const why = h("input", { type: "text", placeholder: "Why it matters — the decision or task it unblocks", "aria-label": "Why it matters" });
    root.append(h("div", { class: "card", dataset: { fb: "features:new", fbLabel: "New feature request" } },
      h("h2", null, "Ask for something"),
      h("div", { class: "field" }, h("div", { class: "field-label" }, "What"), title),
      h("div", { class: "field" }, h("div", { class: "field-label" }, "Detail"), body),
      h("div", { class: "field" }, h("div", { class: "field-label" }, "Why it matters"), why),
      h("div", { class: "control" }, h("button", { type: "button", class: "btn", onclick: () => {
        if (!title.value.trim()) { ICL.toast("Give it a one-line title first."); title.focus(); return; }
        ensure();
        ICL.store.set((s) => {
          const rank = Math.max(...s.features.map((x) => x.rank)) + 1;
          s.features.push({ id: ICL.uid("ft"), rank, title: title.value.trim(), body: body.value.trim() || "(no detail given)", why: why.value.trim() || "(not stated)", status: "queued", size: "M", source: "you", votes: 1, tags: ["from the workshop"] });
          return s;
        });
        title.value = ""; body.value = ""; why.value = "";
        ICL.toast("Added at the bottom of the queue. In the real app this opens an issue with your name on it.");
      } }, "Add to the queue"),
        h("span", { class: "small" }, "Mockup: requests stay in this browser and are included in the feedback export."))));

    if (state.features && state.features.length) root.append(h("p", { class: "small" }, confirmButton("Reset the queue to the shipped list", () => ICL.store.set((s) => { s.features = JSON.parse(JSON.stringify(SEED)); return s; }), "btn-sm")));
  };
})(window.ICL);
