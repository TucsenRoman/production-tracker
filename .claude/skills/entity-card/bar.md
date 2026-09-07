# bar.md — Entity summary card

Reference: GitHub profile sidebar (github.com/rauchg), light theme, measured
via computed-style probes 2026-09-07. Stripe's dashboard was the first choice
and is login-walled; GitHub's sidebar has the identical information model
(identity → one action → icon+label meta rows → counts) and is public.

Mechanisms a critic can check by looking:

1. TWO type sizes in the whole card. Name 24px/600 ink; everything else 14px.
   Measured ratio 24:14 = 1.71:1. A third size only for a 12px eyebrow label.
2. ZERO boxes inside the outer container. No inner panels, no pills, no
   tinted badges. Grouping is done with 1px hairline rules and vertical space.
3. Counts are a sentence, not tiles. `17.1k followers · 882 following` —
   number at 600 in ink, unit at 400 in muted, `·` between. One line.
4. Meta rows are 16px muted icon + 8px gap + 14px ink text, row height 25px,
   left edges of all icons aligned in one column.
5. The card's own action is NEUTRAL, full width, one control height. GitHub's
   "Follow" is grey, not blue — the accent is spent on links inside content,
   never on the card's own button.
6. Identity carries by MASS, not by type. The avatar is the largest object on
   the card by an order of magnitude; below it everything is flat and uniform.
7. No section headings. Content that needs a label carries a 12px eyebrow on
   the row itself; nothing gets a ruled uppercase header.
