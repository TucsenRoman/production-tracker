# Floor Task List

Attach reference/tasks-open-desktop.png first.

A ledger-like checklist: ruled category sections, one accent spent on
exactly one action, rows that toggle by tapping anywhere.

**Weird move:** the checkbox is fake — decoration styled like a checkbox,
but the click handler lives on the WHOLE ROW. Never wire the box itself;
never block the row's click near it.

Signatures:
1. Category sections always: icon + UPPERCASE label + count + hairline
   rule to the edge, every tab, even with one category.
2. Whole-row tap-to-toggle; checkbox is decoration only.
3. Row actions reveal on hover/focus, but ALWAYS visible under
   `hover:none` — else unreachable on a floor terminal.
4. Tabs as Segmented + small filled count-badge dot, never a dropdown.
5. One meta line/row (assignee, due, by), 12px, lightest ink.
6. Priority = pill for High/Urgent only; Normal/Low get no marker.
7. The sticky toolbar fades its OWN bottom edge with a mask-image, solid
   to calc(100% - 18px) — not a second gradient element to colour-match.

Bans: no card borders, hairlines only; one accent per screen; never
colour a row for priority/status; never hover-only on touch; never mark
Normal/Low; no shadows but the modal; max 4 type sizes, 28/14/12/10.

Palette: paper white ~78%, near-black ink ~6%, warm grey meta ~4%,
hairline #E6E5E3 ~3%, accent blue <1%, priority tints <0.5%. All
neutrals warm, no slate.

Primitives (ui.jsx): StickyFadeHeader, SectionHeading, RowActions —
use them, don't re-inline.

Archetypes: task-list-tab, task-row, task-form-modal (see dna.json).

Self-check, name each: (1) sections always icon+UPPERCASE+count+rule,
even solo (2) exactly one primary-blue element (3) row actions hidden at
rest but visible under hover:none (4) checkbox has no click handler
(5) pill only High/Urgent (6) meta 12px, lightest ink (7) no rounded
container but pills+modal (8) toolbar carries its own mask fade (9) <=4
type sizes, only headings uppercase. Repair and recheck any failure —
never ship one explained away.
