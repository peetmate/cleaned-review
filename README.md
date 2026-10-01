# cleaned-review

**Working here?** Read [`STATE.md`](STATE.md) first (where things stand), then [`CLAUDE.md`](CLAUDE.md) (rules and how to ship), [`BACKLOG.md`](BACKLOG.md) (what is open) and [`md/ui_ux/DECISIONS.md`](md/ui_ux/DECISIONS.md) (why the mockup is shaped as it is).

**▶ Try the Assessment Builder mockup:** https://peetmate.github.io/cleaned-review/ui_ux/mockup/ · [source](ui_ux/mockup/src-tree) · [review of the mockup](md/ui_ux/05_mockup_review.md)

**UI/UX review of the iCLEANED app:** https://peetmate.github.io/cleaned-review/ui_ux/

Adversarial review of the `cleaned` R package v0.7.0 (CIAT/cleaned @ 800d53a) and the iCLEANED app.

Site: https://peetmate.github.io/cleaned-review/

Built from Markdown by `fixes/build_site.R`. Comments on the site are GitHub Discussions in this repository.

Reproduce the findings: `Rscript reproduce/reproduce_critical_issues.R`.

## App UI/UX

- `ui_ux/index.html`: UI/UX review of the iCLEANED web app, workshop run sheet, feedback form (Markdown in `md/ui_ux/`).
- `ui_ux/mockup/index.html`: Assessment Builder mockup (single static file). Source in `ui_ux/mockup/src-tree/`; build with `node build.mjs` there.
- `md/ui_ux/04_design_benchmarks.md`: design patterns from 22 farm/livestock tools.
- `md/ui_ux/05_mockup_review.md`: adversarial review of the mockup and the fixes made.
