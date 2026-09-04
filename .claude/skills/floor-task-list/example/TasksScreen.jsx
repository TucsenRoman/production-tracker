"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowUp,
  Calendar,
  Check,
  CheckCircle2,
  ClipboardList,
  ClockFading,
  Pencil,
  Plus,
  Undo2,
  Settings,
  Trash2,
  UserRound,
  UsersRound,
} from "lucide-react";

import {
  Badge,
  Button,
  EmptyState,
  Field,
  IconButton,
  Input,
  Label,
  Modal,
  Segmented,
  Tooltip,
  cx,
} from "../components/ui";
import {
  PRIORITY_LABEL,
  PRIORITY_TONE,
  TASK_CATEGORY_ICON_OPTIONS,
  TASK_CATEGORY_ICONS,
  TASK_PRIORITIES,
  categoryIcon,
  daysUntil,
  dueLabel,
  isManager,
  sortTasks,
  todayKey,
  visibleTasks,
} from "../lib/domain";
import { useDoubleTapHotkey } from "../lib/useDoubleTapHotkey";
import { useStaff } from "../lib/staff";

/**
 * The four things worth knowing at a glance. Each tile is also the filter
 * that explains it — same convention as the Inventory overview row.
 */
const TABS = [
  {
    id: "open",
    label: "Open",
    icon: ClipboardList,
    // Unclaimed — anyone on shift can pick these up. Work already on
    // someone's name lives under Yours instead.
    match: (t) => !t.completed && !t.assignedTo,
  },
  {
    id: "yours",
    label: "Yours",
    icon: UserRound,
    match: (t, uid) => !t.completed && t.assignedTo === uid,
  },
  {
    id: "dueToday",
    label: "Due today",
    icon: ClockFading,
    match: (t) =>
      !t.completed && t.dueDate != null && daysUntil(t.dueDate) === 0,
  },
  {
    id: "overdue",
    label: "Overdue",
    icon: AlertTriangle,
    match: (t) => !t.completed && t.dueDate != null && daysUntil(t.dueDate) < 0,
  },
  {
    id: "completed",
    label: "Completed",
    icon: CheckCircle2,
    // The dot counts what's done *today* ("nice work") even though the tab
    // itself lists every completed task, not just today's.
    dotMatch: (t) => t.completed && t.completedAt?.slice(0, 10) === todayKey(),
  },
];

/* ------------------------------------------------------------------ Row -- */

function TaskRow({
  task,
  staff,
  categories,
  canManage,
  onToggle,
  onEdit,
  onRemove,
  completedView = false,
  // Off inside a category section, where the section header already
  // carries the icon — repeating it on every row under it said nothing new.
  showCategoryIcon = true,
}) {
  const categoryMeta = categories.find((c) => c.id === task.category);
  const Icon = TASK_CATEGORY_ICONS[categoryMeta?.iconId] || ClipboardList;
  const overdue =
    !task.completed && task.dueDate != null && daysUntil(task.dueDate) < 0;
  const dueToday =
    !task.completed && task.dueDate != null && daysUntil(task.dueDate) === 0;
  const assignee = task.assignedTo
    ? staff.find((s) => s.id === task.assignedTo)
    : null;
  // The Completed tab is a record to browse, not a done task fading out —
  // no dimming or strikethrough there, and the toggle becomes an undo.
  const struck = task.completed && !completedView;

  const toggleLabel = completedView
    ? `Restore "${task.title}"`
    : task.completed
      ? `Mark "${task.title}" not done`
      : `Mark "${task.title}" done`;

  return (
    <li
      role="button"
      tabIndex={0}
      aria-label={toggleLabel}
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        onToggle();
      }}
      // px-1 here is plain padding, not the old -mx-1/px-1 bleed trick
      // (that one pulled the row's box a few px past the container on a
      // negative margin, which is what caused the sticky-toolbar hangover
      // fixed above — this box's outer edges still land exactly on the
      // container, same as the toolbar). It's here so the checkbox and
      // the row actions get a hair of breathing room from that shared
      // edge instead of sitting flush against it — the actions already
      // read that way at rest since they're invisible until hover, the
      // checkbox is the one that needs the actual padding to match.
      className={cx(
        "group flex items-start gap-3 py-3 px-1 rounded-md transition-colors cursor-pointer",
        struck ? "opacity-60" : "hover:bg-faint",
      )}
    >
      {/* Purely visual now that the whole row toggles — a second focusable
       *  control here would just be a same-action duplicate of the row
       *  itself, tabbed to twice for no reason. */}
      <span
        aria-hidden="true"
        className={cx(
          "mt-0.5 shrink-0 flex items-center justify-center w-4 h-4 rounded border transition-colors duration-100",
          completedView
            ? "border-line text-ink-3"
            : task.completed
              ? "border-ok bg-ok text-white"
              : "border-line-strong text-transparent",
        )}
      >
        {completedView ? (
          <Undo2 size={10} />
        ) : task.completed ? (
          <Check size={10} strokeWidth={3} />
        ) : null}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          {showCategoryIcon && (
            <Icon size={13} className="text-icon-2 shrink-0" />
          )}
          <p
            className={cx(
              "text-sm font-medium text-ink",
              struck && "line-through text-ink-3",
            )}
          >
            {task.title}
          </p>
          {!task.completed && task.priority !== "normal" && (
            <Badge tone={PRIORITY_TONE[task.priority]}>
              {PRIORITY_LABEL[task.priority]}
            </Badge>
          )}
        </div>

        {task.note && (
          <p className="mt-0.5 text-xs text-ink-3 leading-relaxed">
            <span className="font-medium text-ink-4">Note:</span> {task.note}
          </p>
        )}

        <div className="mt-1.5 flex items-center flex-wrap gap-x-3 gap-y-1 text-xs text-ink-3">
          <span className="inline-flex items-center gap-1.5">
            {assignee ? (
              <>
                <span className="flex items-center justify-center w-4 h-4 rounded-full bg-inset text-[9px] font-semibold text-ink-2 shrink-0">
                  {assignee.initials}
                </span>
                {assignee.name.split(" ")[0]}
              </>
            ) : (
              <>
                <UsersRound size={11} className="shrink-0" /> Anyone on shift
              </>
            )}
          </span>

          {task.dueDate && (
            <span
              className={cx(
                "inline-flex items-center gap-1 font-medium",
                overdue ? "text-danger" : dueToday ? "text-warn" : "text-ink-3",
              )}
            >
              <Calendar size={11} /> {dueLabel(task.dueDate)}
            </span>
          )}

          <span className="text-ink-4">
            {task.completed
              ? task.completedBy
                ? `Done by ${task.completedBy.split(" ")[0]}`
                : "Done"
              : `Assigned by ${task.createdBy.split(" ")[0]}`}
          </span>
        </div>
      </div>

      {canManage && (
        // Hidden until the row is actually being looked at — hover or
        // keyboard focus — so a completed list doesn't read as a wall of
        // controls when all you're doing is scanning it.
        <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-within:opacity-100 transition-opacity duration-100">
          <IconButton
            label={`Edit "${task.title}"`}
            icon={Pencil}
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
          />
          <IconButton
            label={`Remove "${task.title}"`}
            icon={Trash2}
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
          />
        </div>
      )}
    </li>
  );
}

/* --------------------------------------------------------------- Add form -- */

function AddTaskModal({ staff, categories, task = null, onCancel, onSave }) {
  const editing = Boolean(task);
  const [title, setTitle] = useState(task?.title ?? "");
  const [category, setCategory] = useState(task?.category ?? categories[0]?.id);
  const [priority, setPriority] = useState(task?.priority ?? "normal");
  const [assignedTo, setAssignedTo] = useState(task?.assignedTo ?? "anyone");
  const [dueDate, setDueDate] = useState(task?.dueDate ?? "");
  const [note, setNote] = useState(task?.note ?? "");

  const ready = title.trim().length > 1 && Boolean(category);

  const save = () => {
    if (!ready) return;
    onSave({
      title: title.trim(),
      category,
      priority,
      assignedTo: assignedTo === "anyone" ? null : assignedTo,
      dueDate: dueDate || null,
      note: note.trim() || null,
    });
  };

  return (
    <Modal
      open
      onClose={onCancel}
      title={editing ? "Edit task" : "New task"}
      icon={editing ? Pencil : ClipboardList}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant="primary"
            icon={editing ? Check : Plus}
            disabled={!ready}
            onClick={save}
          >
            {editing ? "Save changes" : "Add task"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="What needs doing">
          <Input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && save()}
            placeholder="e.g. Restock bacon on the floor"
          />
        </Field>

        <Field label="Category">
          <Segmented
            size="sm"
            scroll
            value={category}
            onChange={setCategory}
            options={categories.map((c) => ({
              value: c.id,
              label: c.label,
              icon: categoryIcon(categories, c.id),
            }))}
          />
        </Field>

        <Field label="Priority">
          <Segmented
            size="sm"
            value={priority}
            onChange={setPriority}
            options={TASK_PRIORITIES.map((p) => ({
              value: p,
              label: PRIORITY_LABEL[p],
            }))}
          />
        </Field>

        <Field
          label="Assign to"
          hint="Leave on Anyone to let whoever's free pick it up."
        >
          <Segmented
            size="sm"
            scroll
            value={assignedTo}
            onChange={setAssignedTo}
            options={[
              { value: "anyone", label: "Anyone", icon: UsersRound },
              ...staff.map((s) => ({
                value: s.id,
                label: s.name.split(" ")[0],
              })),
            ]}
          />
        </Field>

        <Field label="Due date" hint="Optional.">
          <Input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </Field>

        <Field
          label="Note"
          hint="Optional — quantities, where to find something."
        >
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. 18 lb in the freezer, ready to bag"
          />
        </Field>
      </div>
    </Modal>
  );
}

/* --------------------------------------------------------- Category admin -- */

function CategoryRow({ category, count, onRename, onRemove }) {
  const Icon = TASK_CATEGORY_ICONS[category.iconId] || ClipboardList;
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(category.label);

  const commit = () => {
    const label = value.trim();
    if (label.length > 1) onRename(label);
    else setValue(category.label);
    setEditing(false);
  };

  return (
    <li className="flex items-center gap-2.5 py-2 px-1">
      <Icon size={15} className="text-icon-2 shrink-0" />
      {editing ? (
        <Input
          autoFocus
          size="sm"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") {
              setValue(category.label);
              setEditing(false);
            }
          }}
          onBlur={commit}
          className="flex-1 min-w-0"
        />
      ) : (
        <span className="flex-1 min-w-0 text-sm text-ink truncate">
          {category.label}
        </span>
      )}
      <span className="text-xs text-ink-4 shrink-0 tnum">
        {count} task{count === 1 ? "" : "s"}
      </span>
      <IconButton
        label={`Rename ${category.label}`}
        icon={Pencil}
        onClick={() => setEditing(true)}
        className="shrink-0"
      />
      <IconButton
        label={
          count
            ? `Recategorize its tasks before removing ${category.label}`
            : `Remove ${category.label}`
        }
        icon={Trash2}
        disabled={count > 0}
        onClick={() => onRemove()}
        className={cx(
          "shrink-0",
          count > 0 && "opacity-30 pointer-events-none",
        )}
      />
    </li>
  );
}

function ManageCategoriesModal({
  categories,
  counts,
  onCancel,
  onAdd,
  onRename,
  onRemove,
}) {
  const [label, setLabel] = useState("");
  const [iconId, setIconId] = useState(TASK_CATEGORY_ICON_OPTIONS[0].id);

  const ready = label.trim().length > 1;

  const submit = () => {
    if (!ready) return;
    onAdd({ label: label.trim(), iconId });
    setLabel("");
  };

  return (
    <Modal
      open
      onClose={onCancel}
      title="Manage categories"
      icon={Settings}
      footer={
        <Button variant="ghost" onClick={onCancel}>
          Done
        </Button>
      }
    >
      <div className="space-y-4">
        <ul className="divide-y divide-line border-y border-line">
          {categories.map((c) => (
            <CategoryRow
              key={c.id}
              category={c}
              count={counts[c.id] || 0}
              onRename={(newLabel) => onRename(c.id, newLabel)}
              onRemove={() => onRemove(c.id)}
            />
          ))}
        </ul>

        <div className="space-y-2">
          <Label>Add a category</Label>
          <div className="flex gap-2">
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="e.g. Deliveries"
              className="flex-1 min-w-0"
            />
            <Button
              variant="primary"
              icon={Plus}
              disabled={!ready}
              onClick={submit}
            >
              Add
            </Button>
          </div>
          <Segmented
            size="sm"
            scroll
            value={iconId}
            onChange={setIconId}
            options={TASK_CATEGORY_ICON_OPTIONS.map((o) => ({
              value: o.id,
              label: "",
              icon: o.icon,
            }))}
          />
        </div>
      </div>
    </Modal>
  );
}

/* ----------------------------------------------------------------- Screen -- */

export default function TasksScreen({
  tasks,
  categories,
  user,
  onAdd,
  onToggle,
  onEdit,
  onRemove,
  onAddCategory,
  onRenameCategory,
  onRemoveCategory,
}) {
  const { staff } = useStaff();
  const canManage = isManager(user);

  const [tab, setTab] = useState("open");
  const [adding, setAdding] = useState(false);
  // The task being edited, or null — AddTaskModal doubles as the editor
  // when it's given one to seed from.
  const [editingTask, setEditingTask] = useState(null);
  const [managingCategories, setManagingCategories] = useState(false);
  // Tasks checked off in this view stay put — struck through, not removed —
  // until the tab is switched (a stand-in for "refresh"). Otherwise a task
  // vanishing the instant you tap it reads like the click didn't register.
  const [stickyDone, setStickyDone] = useState(() => new Set());
  // Drives the "back to top" button — on past the point the sticky toolbar
  // has already taken over, so it's only offered once there's somewhere to
  // go back to.
  const [scrolledPast, setScrolledPast] = useState(false);

  const changeTab = (v) => {
    setStickyDone(new Set());
    setTab(v);
  };

  // Desktop scrolls the AppShell's own card (`[data-app-scroll]`); mobile
  // scrolls the page itself. Both listeners are attached — whichever one is
  // actually the scrolling element in a given layout is the one that fires.
  useEffect(() => {
    const container = document.querySelector("[data-app-scroll]");
    const check = () => {
      const y = Math.max(window.scrollY, container?.scrollTop || 0);
      setScrolledPast(y > 240);
    };
    check();
    window.addEventListener("scroll", check, { passive: true });
    container?.addEventListener("scroll", check, { passive: true });
    return () => {
      window.removeEventListener("scroll", check);
      container?.removeEventListener("scroll", check);
    };
  }, []);

  const scrollToTop = () => {
    document
      .querySelector("[data-app-scroll]")
      ?.scrollTo({ top: 0, behavior: "smooth" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  useDoubleTapHotkey({ t: scrollToTop });

  const handleToggle = (task) => {
    setStickyDone((prev) => {
      const next = new Set(prev);
      if (task.completed) next.delete(task.id);
      else next.add(task.id);
      return next;
    });
    onToggle(task.id);
  };

  const base = useMemo(() => visibleTasks(tasks, user), [tasks, user]);

  /** Dot counts: each tab's own filter, except Completed's dot counts today's
   *  completions specifically ("nice work") rather than the whole history
   *  the tab lists when open. */
  const counts = useMemo(
    () =>
      Object.fromEntries(
        TABS.map((t) => [
          t.id,
          base.filter((task) => (t.dotMatch || t.match)(task, user.id)).length,
        ]),
      ),
    [base, user.id],
  );

  /** Counts across every task (not just what this user can see) — the manage
   *  dialog is manager-only and needs the real picture to gate deletion. */
  const categoryTaskCounts = useMemo(() => {
    const tally = {};
    for (const t of tasks) tally[t.category] = (tally[t.category] || 0) + 1;
    return tally;
  }, [tasks]);

  const filtered = useMemo(() => {
    return base.filter((t) => {
      if (tab === "completed") {
        if (!t.completed) return false;
      } else {
        if (t.completed && !stickyDone.has(t.id)) return false;
        if (tab === "open" && t.assignedTo) return false;
        if (tab === "yours" && t.assignedTo !== user.id) return false;
        if (
          tab === "dueToday" &&
          !(t.dueDate != null && daysUntil(t.dueDate) === 0)
        )
          return false;
        if (
          tab === "overdue" &&
          !(t.dueDate != null && daysUntil(t.dueDate) < 0)
        )
          return false;
      }
      return true;
    });
  }, [base, tab, user.id, stickyDone]);

  // Sticky-done tasks keep the sort position they'd have if still open —
  // sortTasks would otherwise drop them to the bottom, which reads as the
  // row jumping the moment you check it off.
  const ordered = useMemo(() => {
    if (tab === "completed" || stickyDone.size === 0)
      return sortTasks(filtered);
    const forSort = filtered.map((t) =>
      stickyDone.has(t.id) ? { ...t, completed: false } : t,
    );
    const byId = new Map(filtered.map((t) => [t.id, t]));
    return sortTasks(forSort).map((t) => byId.get(t.id));
  }, [filtered, tab, stickyDone]);

  // Every tab sections by category instead of leaving one flat list —
  // consistent with Open, where this started, rather than a filter that
  // hides everything but one category at a time. Always sectioned, even
  // down to one category present — a tab that happens to be all "Cleaning"
  // today still says so, rather than silently reverting to an unlabeled
  // list the moment a second category empties out.
  const groups = useMemo(() => {
    const byCategory = new Map();
    for (const task of ordered) {
      const list = byCategory.get(task.category);
      if (list) list.push(task);
      else byCategory.set(task.category, [task]);
    }
    return categories
      .filter((c) => byCategory.has(c.id))
      .map((c) => ({ category: c, tasks: byCategory.get(c.id) }));
  }, [ordered, categories]);

  return (
    <div>
      {/* Its own row: the view tabs on the left, categories admin and add
       *  on the right — no separate category filter row, since every tab
       *  below sections its list by category instead of hiding the rest
       *  behind one. Sticky so it's still there once you've scrolled past
       *  it. `--app-mobile-header-h` (set by AppShell from the mobile
       *  header's own measured height) clears that sticky bar without a
       *  guessed px value — it's already 0 once that header goes
       *  `lg:hidden`, so mobile needs no separate handling here.
       *
       *  Desktop needs one more correction `lg:top-[-1.5rem]`. There, the
       *  actual sticky containing block is [data-app-scroll] itself (its
       *  `lg:overflow-y-auto`, not the page), and that card has its own
       *  `lg:py-6` (24px) top padding — `top-0` sticks this bar *below*
       *  that padding rather than into it, leaving the padding itself as
       *  a band nothing paints into, so whatever's still mid-scroll shows
       *  straight through above the bar. A matching negative-margin/
       *  positive-padding trick on this element does NOT fix it — a
       *  stuck sticky box ignores margin for repositioning — the offset
       *  itself has to move: -1.5rem (== `lg:py-6`) pulls the stuck
       *  position up flush with the card's actual top edge instead.
       *
       *  pb-11 is doing double duty: the old pb-3 "safety margin" buffer
       *  (see below) plus the fade zone that used to be a separate
       *  absolutely-positioned strip anchored to this bar's bottom edge.
       *  Folding it into real padding instead — masked below — means
       *  this box's own in-flow height now includes the whole fade zone,
       *  so [data-app-scroll]'s natural scrollHeight already accounts
       *  for it; the old strip didn't (position: absolute doesn't
       *  contribute to flow height), which is why THAT version needed a
       *  hand-matched pb-8 reserve on the content below purely so a
       *  short list's last section could still scroll clear of it. One
       *  fewer number to keep in sync.
       *
       *  The fade itself is a `mask-image` on this element rather than
       *  a second element painted with a canvas/surface-colored
       *  gradient: a mask only ever controls this box's own alpha, so
       *  it fades whatever this bar's real background already is
       *  (bg-canvas here, bg-surface at lg:) without needing a second,
       *  hand-matched gradient color per breakpoint. It also needs no
       *  `stuck` JS state to gate it: at rest the toolbar sits in normal
       *  flow with nothing scrolled up behind its padding yet, so a
       *  faded edge and a solid one paint identically (there's nothing
       *  there to reveal either way) — it only does anything once
       *  something is actually sliding underneath, which is exactly
       *  when scrolling has made it relevant.
       *
       *  Stops: opaque for everything above the last 18px (this is the
       *  held-solid buffer from the old two-zone fade — a card's title
       *  line is fully hidden rather than ghosting through faint while
       *  mid-transition), then a fade over that final 18px so a row
       *  still eases in rather than snapping to full opacity right at
       *  the edge. calc(100% - 18px) anchors that to the bottom of
       *  THIS box regardless of its total height, same as top-full did
       *  for the old strip. */}
      <div
        className={cx(
          "relative sticky top-[var(--app-mobile-header-h,0px)] lg:top-[-1.5rem] z-10",
          "bg-canvas lg:bg-surface pt-3 pb-11",
          "[mask-image:linear-gradient(to_bottom,black_0,black_calc(100%_-_18px),transparent_100%)]",
          "[-webkit-mask-image:linear-gradient(to_bottom,black_0,black_calc(100%_-_18px),transparent_100%)]",
        )}
      >
        <div className="flex items-center justify-between gap-3 flex-wrap">
          {/* fade only — scroll mode engages itself when the row actually
           *  overflows; forcing it on left the rail 14px scrollable (its
           *  own reserved badge room) even with space to spare. */}
          <Segmented
            fade
            value={tab}
            onChange={changeTab}
            className="min-w-0"
            options={TABS.map((t) => ({
              value: t.id,
              label: t.label,
              icon: t.icon,
              // Completed is a record to browse, not a queue with a count
              // that demands attention, so it gets no badge.
              count: t.id === "completed" ? undefined : counts[t.id],
            }))}
          />

          {canManage && (
            <div className="flex items-center gap-1.5 shrink-0">
              <Button
                variant="primary"
                icon={Plus}
                onClick={() => setAdding(true)}
              >
                New task
              </Button>

              <IconButton
                label="Manage categories"
                icon={Settings}
                onClick={() => setManagingCategories(true)}
                className="shrink-0"
              />
            </div>
          )}
        </div>
      </div>

      <div className="space-y-5">
        {ordered.length === 0 ? (
          <div className="border-b border-line">
            <EmptyState
              icon={tab === "completed" ? CheckCircle2 : ClipboardList}
              title={
                tab === "completed"
                  ? "Nothing completed here yet"
                  : "Nothing on the list"
              }
              description={
                tab === "completed"
                  ? "Finished tasks show up here."
                  : canManage
                    ? "Add a task for the floor to pick up."
                    : "Check back once management assigns something."
              }
              action={
                canManage && tab === "open" ? (
                  <Button icon={Plus} onClick={() => setAdding(true)}>
                    New task
                  </Button>
                ) : null
              }
            />
          </div>
        ) : groups ? (
          <div className="space-y-5">
            {groups.map(({ category: cat, tasks }) => {
              const Icon = TASK_CATEGORY_ICONS[cat.iconId] || ClipboardList;
              return (
                <div key={cat.id}>
                  {/* The rule sits ON the heading's line, not under it — a
                   *  hairline below read as just another row divider, easy to
                   *  mistake for one more line in the list rather than a break
                   *  between sections. */}
                  <div className="flex items-center gap-2 mb-1">
                    <Icon size={14} className="text-icon-2 shrink-0" />
                    <h3 className="text-xs font-semibold text-ink-2 uppercase tracking-wide shrink-0">
                      {cat.label}
                    </h3>
                    <span className="text-xs text-ink-4 tnum shrink-0">
                      {tasks.length}
                    </span>
                    <span className="flex-1 h-px bg-line" aria-hidden="true" />
                  </div>
                  {/* Nested under its heading, not flush with it — the
                   *  indent is what actually reads as "belongs to this
                   *  section" now that there's no box or rule around the
                   *  list itself. */}
                  <ul className="pl-6">
                    {tasks.map((task) => (
                      <TaskRow
                        key={task.id}
                        task={task}
                        staff={staff}
                        categories={categories}
                        canManage={canManage}
                        completedView={tab === "completed"}
                        showCategoryIcon={false}
                        onToggle={() => handleToggle(task)}
                        onEdit={() => setEditingTask(task)}
                        onRemove={() => onRemove(task.id)}
                      />
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        ) : (
          <ul className="divide-y divide-line border-b border-line">
            {ordered.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                staff={staff}
                categories={categories}
                canManage={canManage}
                completedView={tab === "completed"}
                onToggle={() => handleToggle(task)}
                onEdit={() => setEditingTask(task)}
                onRemove={() => onRemove(task.id)}
              />
            ))}
          </ul>
        )}

        {(adding || editingTask) && (
          <AddTaskModal
            staff={staff}
            categories={categories}
            task={editingTask}
            onCancel={() => {
              setAdding(false);
              setEditingTask(null);
            }}
            onSave={(fields) => {
              if (editingTask) onEdit(editingTask.id, fields);
              else onAdd(fields, user);
              setAdding(false);
              setEditingTask(null);
            }}
          />
        )}

        {managingCategories && (
          <ManageCategoriesModal
            categories={categories}
            counts={categoryTaskCounts}
            onCancel={() => setManagingCategories(false)}
            onAdd={onAddCategory}
            onRename={onRenameCategory}
            onRemove={onRemoveCategory}
          />
        )}

        {/* `fixed` lives on THIS wrapper, not the button — Tooltip's own
         *  positioning depends on a normal-flow box to anchor its bubble to,
         *  and a `fixed` child contributes no flow size to its parent, so
         *  putting `fixed` on the button itself left the tooltip anchored to
         *  a collapsed point instead of the button (it rendered off at the
         *  far edge of the page). Desktop's own scroll container doesn't
         *  change any of this, since nothing between here and the viewport
         *  is transformed. Parked above the mobile tab bar, clear of it. */}
        {/* bottom-36 (not bottom-20) on mobile — the draggable role-switcher chip defaults to bottom-20 right-4 too, and the two would render stacked on top of each other, with the chip's higher z-index eating this button's clicks. */}
        <div className="fixed z-20 bottom-36 right-4 lg:bottom-8 lg:right-8">
          {/* Tooltip only supports top/bottom/right — "left" isn't a real
           *  option, and this button sits at the right edge anyway, so above
           *  it (the default) is both correct and all that's available. */}
          <Tooltip label="Scroll to top (T T)">
            <button
              type="button"
              aria-label="Scroll to top"
              onClick={scrollToTop}
              className={cx(
                // Same control height token as every other icon control
                // (`IconButton`, toolbar chips) rather than a bespoke size —
                // "one control height" is load-bearing to this app's whole
                // look, and a bigger bespoke FAB read as a foreign control.
                "flex items-center justify-center w-[var(--ctl-h)] h-[var(--ctl-h)] rounded-full",
                // Elevation here is the same warm 1px ring every other
                // floating surface in this system uses (`shadow-xs`) — no
                // added `border` (would double the ring) and no blur-y
                // `shadow-md`, which reads as heavier than this deserves.
                "bg-surface text-ink-3 shadow-xs hover:text-ink-2 hover:bg-hover",
                "transition-all duration-150",
                scrolledPast
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-2 pointer-events-none",
              )}
            >
              <ArrowUp size={14} />
            </button>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}
