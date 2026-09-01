# Reference

The original is the live product: **app.notion.com**, a logged-in workspace showing a
database page beside the navigation rail, Chrome at 1440×619, captured 2026-08-31.

It is not checked in as a JPEG, for two reasons: the capture frames a private workspace,
and a screenshot is a weaker reference than the numbers beside it. `measurements.json`
holds every value read out of the running app via computed-style probes — colours,
coverage percentages, type steps, radii frequencies, shadow stacks, hover alphas,
geometry. Everything in `../dna.json` marked MEASURED traces to this file.

To re-capture: open the app, run the probes in `measurements.json → probes`, and diff.

`../example/notion-shell.png` is a **reconstruction** built from `dna.json` alone
(the Step 5 rebuild). It is a proof that the spec works, not the original.
