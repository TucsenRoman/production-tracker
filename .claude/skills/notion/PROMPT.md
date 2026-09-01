Match example/notion-shell.png first.

Warm paper, a grey margin rail, hairline rules, near-black type at one size, and no colour except the emoji the user chose.

THE WEIRD MOVE — borrowed colour. The system stays grey so the user's colour reads. One full-saturation emoji per navigable item at 1.29x its label (18px vs 14px); chrome stays greyscale. Emoji coverage (0.5%) beats accent (0.2%): the loudest thing on screen is the one thing you did not choose.

MOVES
1. Every neutral warm-biased (R>=G>=B). Overlays rgba(33,27,23,a), never rgba(0,0,0,a).
2. Hierarchy by weight and ink, never size. Title:body = 2.3:1; below the title, one size. Rank 400>500>700, #a19e99>#7d7a75>#2c2c2b.
3. Hairline rules, not cards: 1px #e6e5e3 between rows, no four-sided container.
4. The 5% hover. Rows rest transparent, fill rgba(33,27,23,.05) at 6px r; selected = same.
5. Rail at 18.75%, #f9f8f7, no right border — the colour change is the edge.
6. One filled accent per screen, under 1% coverage.
7. Ring-first elevation: overlays only, warm 1px ring + 2.7% blur. Resting page: zero shadow.
8. Tight rows: height 2.1-2.6x text size.

NEVER cool greys. NEVER #000. NEVER a resting shadow. NEVER a card. NEVER centre anything. NEVER a webfont; the OS font is the design. NEVER >4 sizes per frame. NEVER size for emphasis. NEVER outline icons; filled glyphs at 16px. NEVER gradients, glass, glow. NEVER ALL-CAPS or tracked type. NEVER illustrations. NEVER radius >16px outside a pill.

PALETTE #ffffff 79% / rail #f9f8f7 19% / line #e6e5e3 / ink #2c2c2b, #7d7a75, #a19e99 / accent #2383e2 0.2% / emoji 0.5%
TYPE system ui-sans-serif. 12/13/14/16/32px. Leading 1.2 UI, 1.5 prose. Sentence case, normal tracking, tabular numerals.
LAYOUTS shell · document · collection · nav_list · overlay · empty

Tests T1-T14 in dna.json. Before returning any output, run every test in the self-check. Name each test and its result. If any fails, repair the output and run them again. Never return output with a failing test and a note explaining it away.
