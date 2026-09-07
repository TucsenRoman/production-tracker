# Notion — card surfaces

A second measured layer over `PROMPT.md`. That one was torn from Notion's
shell, document and collection. This one is torn from the surfaces Notion
uses when it has to summarise ONE thing in a tile: app.notion.com Home,
re-measured 2026-09-07 with computed-style probes, signed-in app, light.

It exists because ProTrack's location card is that shape, and PROMPT.md's
"NEVER a card" turned out to be an incomplete reading: Notion does use cards.
It just doesn't draw them the way most apps do.

## Measured

**"Learn" card** (cover + title + meta), the closest analogue to an entity card
- container 240 x 216, `#ffffff`, **radius 12px**
- **no border. no outline. no shadow.** Verified on the element, its ancestors
  and its `::after`. The card is a shape, not a box.
- cover 240 x 126 = **1.90:1**, `object-fit: cover`, own radius 0, full bleed
  to the card's edges, clipped by the container's `overflow: hidden`
- content padding **12px 12px 10px**
- title **14px / 500 / #2c2c2b**, line-height 18 (1.29), clamped to 2 lines
- meta **12px / 400 / #a19e99**

**"Recently visited" tile** (glyph + title + meta), no image available
- container 144 x 144, `#ffffff`, **radius 16px**, again no border/shadow
- the cover slot is still there: 144 x 44 (**30.5% of the tile**) filled with
  **`rgba(84, 72, 49, 0.04)`** — a 4% warm tint holding the emoji. A missing
  image is a tinted band, never a bordered glyph box.
- content padding 10px 16px 12px
- title 14px / 400 / #5f5e59 · meta 12px / 400 / #a19e99

**Section label above a row of cards** — "Recently visited", "Learn"
- **12px / 500 / #7d7a75, sentence case**, paired with a ~16px muted icon
- no rule, no uppercase, no tracking

**Chrome measured in the same pass**
- sidebar row: 30px tall, radius 6, padding 5px 8px, 14px/400 `#5f5e59`
- search field: 1px `rgba(28,19,1,0.11)`, **radius 8**, no fill
- selected row fill `rgba(33,27,23,.05)` @6 · active nav `rgba(33,27,23,.076)` @8
- hairline `rgba(28,19,1,0.11)` / `rgba(42,28,0,0.07)` — a warm ALPHA, not a hex
- page title 40/700 (document) · 30/600 (Home) · page icon 78px @ radius 4

## What this corrects in PROMPT.md

1. **"NEVER a card" is too absolute.** Notion cards exist. They carry no
   border, no shadow and no outline — a white shape at radius 12-16 whose
   edge is its cover image and its corner. The ban should read: never a
   BORDERED card.
2. **There is no single radius.** Notion runs a ladder by object size:
   **4** page icon · **6** rows, tooltips, menu items · **8** fields, active
   nav · **12** cards · **16** tiles. Rows are 6, cards are 12.
3. **The grey ramp has four steps, not three.** `#2c2c2b` ink, **`#5f5e59`**
   (6.4:1), `#7d7a75`, `#a19e99`. `#5f5e59` is the workhorse — it is the most
   frequent text colour in the whole app and it is missing from PROMPT.md.
4. **Icons sit one to two steps LIGHTER than the label beside them**:
   `#a19e99` icon against a `#5f5e59` label. Not the same tone.
5. **500 is a real weight tier.** 400 body, **500 card titles and section
   labels**, 600-700 page titles only. Nothing on a card is 600.
6. **A card title is 14px.** Notion never sets a tile's title above 14px, and
   at no width does it reach for 24. Hierarchy inside a card is bought with
   weight and ink — exactly move 2 — which means the cover, not the title,
   is where a card spends size.
7. **The cover is 30-58% of the card** and is present even when there is no
   image, as a 4% warm tint.
