# Entity card

A name tag, not a dashboard: one big cover, one quiet name, everything
below it flat and unboxed.

## The weird move
All the size goes to the cover — 30-58% of the card, full bleed — and none to
the title. Hierarchy is bought once, in one currency.

## Signatures
1. Three sizes on the host scale: 16 / 14 / 12. The name is 16px/600, the only
   line above body size; a card title never reaches 24px.
2. Below it, rank by WEIGHT AND INK, never size: 500 + ink for a value, 400
   muted for its unit. Counts read as sentences, never as tiles —
   `82.4% avg yield · 6 batches`.
3. A shape, not a box: radius 12, no border, outline or shadow. Its edge is a
   COLOUR CHANGE against the page. Rows and controls inside are radius 6: a
   ladder by object size, never one value.
4. No inner box that isn't a click target; grouping is 1px hairlines.
5. Four greys; the workhorse is the mid-tone (~6:1), not the lightest, and
   14px text never drops below it. Icons sit a step LIGHTER than their label.
6. A band that needs a label gets 12px/500 sentence case and a muted icon —
   never uppercase, never ruled.
7. The action is neutral and full width. Status is a word. Anything to act on
   leaves the fact stack for its own band.

## Bans
- Never a BORDERED card, a resting shadow, a fourth type size, or a pill,
  chip, tint band or filled badge inside it.
- Never a missing cover: with no image it is a 4% warm tint, not a tile.
- Max two coloured elements at rest; brand marks and hover don't count, and
  problems share one band rather than tinting a row in the facts.
- Never a filled accent button on a card that repeats.

## Self-check
FAIL on: a title above 16px · >3 sizes · a border or shadow on the card · one
radius for card and rows · a non-clickable inner box · >2 coloured elements at
rest · an icon as dark as its label · a cover under 25%.

Archetypes: dna.json.

Run every test before returning output, name each and its result, and repair
anything that fails rather than returning it with a note explaining it away.
