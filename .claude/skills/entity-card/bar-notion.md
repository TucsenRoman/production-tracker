# bar.md — round 2 bar: Notion's own cards

Reference: app.notion.com Home, signed-in app, light theme, measured
2026-09-07 with computed-style probes. Full teardown in
`.claude/skills/notion/CARDS.md`.

Round 1's bar was GitHub's profile sidebar and it gave the card its ANATOMY.
This bar replaces its FINISH. Where the two disagree, this one wins — the app
is a Notion app, not a GitHub one.

Mechanisms a critic can check by looking:

1. **No card title above 16px.** Notion's is 14px/500 at 240px wide. The name
   is the only line above body size and it is at most 16px/600. A 24px title
   on a card is a GitHub move; Notion buys hierarchy with weight and ink.
2. **Three sizes, all on the scale: 16 / 14 / 12.** Nothing off it. 24 does
   not exist anywhere in Notion.
3. **The card has no border, no outline and no shadow** — a white shape at
   radius 12. Its edge is the cover image and the corner, nothing else.
4. **Radius by object size, not one value:** 12 for the card, 6 for every row,
   control and hover target inside it. A card and a button at the same radius
   is the tell that the ladder is missing.
5. **The cover is present even with no image** — a 4% warm tint band, never a
   bordered glyph tile. Cover ratio 1.9:1.
6. **Four greys, and the workhorse is #5f5e59 (6.4:1)** — not the lightest
   one. Icons sit one to two steps LIGHTER than the label beside them
   (#a19e99 icon against a #5f5e59 label), never the same tone.
7. **Section labels are 12px/500 sentence case with a muted icon and no rule.**
   Not uppercase, not tracked, not ruled — but not absent either.
