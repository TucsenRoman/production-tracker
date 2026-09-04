---
name: floor-task-list
description: Apply the Floor Task List design DNA — measured off Protrack's TasksScreen.jsx — to any checklist/task-list screen or component. Use when building or restyling a task list, to-do list, or checklist that should read as a ledger, not a to-do app.
---

# Floor Task List

Codifies the design identity of Protrack's floor Tasks screen (category-
sectioned checklist, whole-row-tap toggle, hover-reveal row actions,
segmented tabs with count badges, the fake-checkbox weird move) as a
reusable spec, so any new task/checklist screen can match it without
re-deriving it from scratch.

This sits ON TOP of `.claude/skills/notion/` (the app's base design
system — font stack, control height, accent budget, warm neutrals). Load
`.claude/skills/notion/PROMPT.md` first for the base rules, then this
skill for what's specific to task-list-shaped UI.

## Scope — read before applying this to another screen

This DNA was measured off ONE dense, grouped working list. Its most
destructive rule out of context is "no card borders, hairlines only".

That rule is only safe because the Tasks screen has section headings, and
**those headings are the containing device** — a ruled heading opens each
group and the `pl-6` indent closes it. Take the container off a list that
has no grouping dimension and you remove the only thing giving the rows an
edge: they float on an open white field, which reads as unfinished rather
than clean. It is worst on the short lists (two stations, two locations)
where a few rows sit stranded in an acre of white.

The working rule:

> **Rule a grouped list. Box a flat one.**

- Real grouping (Tasks by category, Team by role, Inventory by family) →
  `SectionHeading` + `pl-6` list, no container. Apply this spec as written.
- Flat list of peers (Permissions, Stations, Locations, Integrations) →
  wrap in `Card` + `divide-y divide-line`, rows at `px-4 py-3`, no section
  heading. `Card` is `border-y` only — a rule above and below, page showing
  through — so this is not a box and does not break the ban.

This was learned the hard way: the flat console screens were converted to
the container-less treatment, and it made them visibly worse. Confirmed by
rendering the pre-change commit side by side.

## How to apply

1. Attach `reference/tasks-open-desktop.png` — the picture carries the
   style better than the words do.
2. Read `PROMPT.md` (capped at 2KB) — the working spec: the weird move,
   the 7 signature ratios, the bans, palette coverage, and the self-check.
3. For deep detail (full palette, every signature's "never", the
   reconstruction notes, all 10 tests) read `dna.json`.
4. Look at `reference/row-hover.png` for the hover-reveal row-action
   state and `reference/new-task-modal.png` for the form-modal archetype
   when building create/edit flows; `reference/tasks-tablet.png` and
   `reference/tasks-completed.png` for the touch-density and
   empty-priority-pill states.
5. Before returning any output, run every test named in PROMPT.md's
   self-check. If one fails, repair the output and recheck — never hand
   back output with a failing test and an excuse.

## Automated checks

`tools/check.py <file-or-dir>` scans source text for the mechanical bans
(card borders on list rows, a second accent color, permanent — not
hover-gated — edit/delete controls, more than 4 type-size utility
classes in one component). Exits non-zero on any violation. It cannot
check the things that need a running page (hover-reveal opacity,
toolbar-skirt fade timing, whole-row click wiring) — verify those live,
the way the original screen's dev notes did (Playwright against
`next dev`, not a build — see the project's own `project_todo_screen.md`
for the specific gotchas hit doing that on this app).
