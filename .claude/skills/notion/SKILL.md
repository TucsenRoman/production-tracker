---
name: notion
description: Apply the Notion design DNA — warm paper, a grey margin rail, hairline rules, near-black type at one size, and colour only where the user put it. Use when building or restyling any interface, page, or document that should read as a quiet working surface rather than a designed product.
---

# Notion DNA

A style captured from the live Notion app (app.notion.com, 2026-08-31) by measuring
computed styles, not by eye. Reusable on any content, in any medium.

## Use it

1. Attach `example/notion-shell.png`. It carries more of the style than any wording can.
2. Paste `PROMPT.md` (2,039 bytes — fits any context window intact).
3. Build.
4. Run `python3 tools/check.py <your.css> <your.html>`. It exits non-zero on failure.
5. Run `node tools/audit-consistency.js <url>` against the running app. It catches what
   source text cannot: two controls on one row at different heights.
6. Check the MANUAL tests `check.py` prints against a screenshot.

## Files

| File | What it is |
|---|---|
| `PROMPT.md` | The model-facing payload. Hard-capped at 2KB. Never grow it — to add a rule, delete one. |
| `dna.json` | The exhaustive record: measured palette with coverage %, type scale, space as percentages, 9 signatures, the weird move, 6 archetypes, 15 bans, 16 tests, the reconstruction log, and a confidence list. Never paste this into a prompt. |
| `reference/` | The measured evidence and where it came from. |
| `example/` | The canonical worked output and its render. |
| `tools/check.py` | The automatable tests that read source text. |
| `tools/audit-consistency.js` | The rendered-page audit: mixed control heights, radii and font sizes on a shared row. |

## The one thing to get right

**The weird move: borrowed colour.** The system stays grey so the user's colour reads.
Measured accent coverage is 0.2% of the canvas; measured emoji coverage is 0.47%. The
loudest thing on a Notion screen is the one thing Notion did not choose. Strip the emoji
out of a rebuild and it collapses into a generic grey admin panel — that happened in
reconstruction pass 1 and is the sharpest evidence in this spec.

## The three that get missed

- **Hierarchy by weight and ink, never size.** Title:body is 2.29:1 and everything below
  the title is 14px. The instinct to make the important thing bigger is the fastest way
  to stop looking like this.
- **No resting shadow, no cards.** Five elements on the whole captured page had a
  box-shadow, all of them floating layers. Structure is 1px `#e6e5e3` rules.
- **No webfont.** Notion ships none for its UI. The interface is the reader's OS font,
  and that is why it reads as a working surface rather than a product.
- **One control height.** Not in the original measurements, and the omission cost six
  distinct control heights on one page the first time this spec met a real app. A 36px
  search field beside a 28px button is wrong only in the render, never in the source.

## Build discipline, not just look

The DNA covers the resting frame. A rebuild that nails the palette but jitters,
mis-centers, or snaps when a panel collapses still reads as sloppy — the standard this
skill holds itself to covers the transition too, not just the still frame. Learned from
rebuilding a live sidebar to this spec (2026-09-01), now `implementation_discipline` in
`dna.json`:

- **Animate numbers, never `auto`.** `margin-left: auto` / a `justify-content` flip can't
  be interpolated — it snaps mid-transition instead of easing. Animate width, max-width,
  margin, and opacity as plain values instead.
- **Collapse content, don't unmount it.** A label that disappears via `{show && <X/>}` or
  `display:none` can't transition. Animate its own width/opacity to zero so the row is
  seen narrowing.
- **Never let a conditional swap a wrapper's element type mid-transition** (a `Tooltip` in
  one branch, a bare `Fragment` in the other). React remounts the subtree on a type
  change and any running transition is silently cancelled — the content just snaps to its
  final state. Keep the wrapper constant; toggle a prop on it instead.
- **One alignment axis across every state.** An icon centered in a 32px collapsed rail
  sits on the exact same axis as that icon in the 240px expanded state — work out the
  padding-plus-half-width math, don't eyeball each state separately.
- **Reuse the app's own hover primitive**, not the browser's native `title` — a native
  tooltip breaks the DNA's own timing and radius the moment it appears.
- **Hotkeys match platform convention** (Ctrl/Cmd+B for a sidebar, as VS Code, Slack,
  Linear, and Notion all use) and are **discoverable** — named in the same tooltip as the
  action, not left as tribal knowledge.
- **Verify by toggling back and forth several times**, not once. A remount bug or an
  auto-margin snap is often invisible on the first pass.

## Don't

Merge this with another style. The average of two good designs is a bad design.
