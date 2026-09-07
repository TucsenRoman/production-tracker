---
name: entity-card
description: Apply the Entity Card design DNA — one oversized identity mark, two type sizes, zero inner boxes, counts as a sentence, a neutral action. Use when building or restyling any card that summarises one entity (a location, a person, a device, an account) inside a larger app.
---

Read `PROMPT.md` (2KB) before changing anything. It is the whole style.

Torn down from the GitHub profile sidebar (see `bar.md` for the measured
mechanisms and `dna.json` for the full record). It is a STRUCTURAL dna —
palette and font come from the host app, not from here. Inside ProTrack that
means the Notion tokens in `.claude/skills/notion/`; this skill never
introduces a colour or a font.

Verify with `python3 tools/check.py <file.jsx>` — it fails on inner panels,
pills, uppercase section headings inside cards, `rounded-xl`, and filled
accent buttons on repeated cards.

## Two bars, in order

`bar.md` — GitHub's profile sidebar. Gave this card its ANATOMY: identity by
mass, counts as sentences, one icon column, rank by position.

`bar-notion.md` — Notion's own card surfaces, measured 2026-09-07. Gave it its
FINISH: 16/14/12 type, a 12px borderless shape whose edge is a colour change,
rows at radius 6 inside it, four greys with the mid-tone doing the work, and
icons a step lighter than their labels. Full teardown in
`../notion/CARDS.md`, which also lists the seven corrections it forced on
`../notion/PROMPT.md`.

Where the two disagree, Notion wins — this is a Notion app.
