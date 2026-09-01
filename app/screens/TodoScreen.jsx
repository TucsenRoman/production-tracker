"use client";

import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Circle,
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
    match: (t) => !t.completed && t.dueDate != null && daysUntil(t.dueDate) === 0,
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

function TaskRow({ task, staff, categories, canManage, onToggle, onRemove, completedView = false }) {
  const categoryMeta = categories.find((c) => c.id === task.category);
  const Icon = TASK_CATEGORY_ICONS[categoryMeta?.iconId] || ClipboardList;
  const overdue = !task.completed && task.dueDate != null && daysUntil(task.dueDate) < 0;
  const dueToday = !task.completed && task.dueDate != null && daysUntil(task.dueDate) === 0;
  const assignee = task.assignedTo ? staff.find((s) => s.id === task.assignedTo) : null;
  // The Completed tab is a record to browse, not a done task fading out —
  // no dimming or strikethrough there, and the toggle becomes an undo.
  const struck = task.completed && !completedView;

  return (
    <li
      className={cx(
        "flex items-start gap-3 py-3 px-1 -mx-1 rounded-md transition-colors",
        struck ? "opacity-60" : "hover:bg-faint"
      )}
    >
      <button
        type="button"
        aria-label={
          completedView
            ? `Restore "${task.title}"`
            : task.completed
              ? `Mark "${task.title}" not done`
              : `Mark "${task.title}" done`
        }
        onClick={onToggle}
        className={cx(
          "mt-0.5 shrink-0 transition-colors",
          !completedView && task.completed ? "text-ok" : "text-ink-4 hover:text-ink-2"
        )}
      >
        {completedView ? (
          <Undo2 size={17} />
        ) : task.completed ? (
          <CheckCircle2 size={19} />
        ) : (
          <Circle size={19} />
        )}
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <Icon size={13} className="text-icon-2 shrink-0" />
          <p className={cx("text-sm font-medium text-ink", struck && "line-through text-ink-3")}>
            {task.title}
          </p>
          {!task.completed && task.priority !== "normal" && (
            <Badge tone={PRIORITY_TONE[task.priority]}>{PRIORITY_LABEL[task.priority]}</Badge>
          )}
        </div>

        {task.note && <p className="mt-0.5 text-xs text-ink-3 leading-relaxed">{task.note}</p>}

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
                overdue ? "text-danger" : dueToday ? "text-warn" : "text-ink-3"
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
        <IconButton
          label={`Remove "${task.title}"`}
          icon={Trash2}
          onClick={onRemove}
          className="shrink-0"
        />
      )}
    </li>
  );
}

/* --------------------------------------------------------------- Add form -- */

function AddTaskModal({ staff, categories, onCancel, onSave }) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState(categories[0]?.id);
  const [priority, setPriority] = useState("normal");
  const [assignedTo, setAssignedTo] = useState("anyone");
  const [dueDate, setDueDate] = useState("");
  const [note, setNote] = useState("");

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
      title="New task"
      icon={ClipboardList}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="primary" icon={Plus} disabled={!ready} onClick={save}>
            Add task
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
            size="sm" scroll value={category} onChange={setCategory}
            options={categories.map((c) => ({ value: c.id, label: c.label, icon: categoryIcon(categories, c.id) }))}
          />
        </Field>

        <Field label="Priority">
          <Segmented
            size="sm" value={priority} onChange={setPriority}
            options={TASK_PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABEL[p] }))}
          />
        </Field>

        <Field label="Assign to" hint="Leave on Anyone to let whoever's free pick it up.">
          <Segmented
            size="sm" scroll value={assignedTo} onChange={setAssignedTo}
            options={[
              { value: "anyone", label: "Anyone", icon: UsersRound },
              ...staff.map((s) => ({ value: s.id, label: s.name.split(" ")[0] })),
            ]}
          />
        </Field>

        <Field label="Due date" hint="Optional.">
          <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </Field>

        <Field label="Note" hint="Optional — quantities, where to find something.">
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
        <span className="flex-1 min-w-0 text-sm text-ink truncate">{category.label}</span>
      )}
      <span className="text-xs text-ink-4 shrink-0 tnum">
        {count} task{count === 1 ? "" : "s"}
      </span>
      <IconButton label={`Rename ${category.label}`} icon={Pencil} onClick={() => setEditing(true)} className="shrink-0" />
      <IconButton
        label={count ? `Recategorize its tasks before removing ${category.label}` : `Remove ${category.label}`}
        icon={Trash2}
        disabled={count > 0}
        onClick={() => onRemove()}
        className={cx("shrink-0", count > 0 && "opacity-30 pointer-events-none")}
      />
    </li>
  );
}

function ManageCategoriesModal({ categories, counts, onCancel, onAdd, onRename, onRemove }) {
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
            <Button variant="primary" icon={Plus} disabled={!ready} onClick={submit}>
              Add
            </Button>
          </div>
          <Segmented
            size="sm" scroll value={iconId} onChange={setIconId}
            options={TASK_CATEGORY_ICON_OPTIONS.map((o) => ({ value: o.id, label: "", icon: o.icon }))}
          />
        </div>
      </div>
    </Modal>
  );
}

/* ----------------------------------------------------------------- Screen -- */

export default function TodoScreen({
  todos,
  categories,
  user,
  onAdd,
  onToggle,
  onRemove,
  onAddCategory,
  onRenameCategory,
  onRemoveCategory,
}) {
  const { staff } = useStaff();
  const canManage = isManager(user);

  const [tab, setTab] = useState("open");
  const [category, setCategory] = useState("all");
  const [adding, setAdding] = useState(false);
  const [managingCategories, setManagingCategories] = useState(false);
  // Tasks checked off in this view stay put — struck through, not removed —
  // until the tab is switched (a stand-in for "refresh"). Otherwise a task
  // vanishing the instant you tap it reads like the click didn't register.
  const [stickyDone, setStickyDone] = useState(() => new Set());

  const changeTab = (v) => {
    setStickyDone(new Set());
    setTab(v);
  };

  const handleToggle = (task) => {
    setStickyDone((prev) => {
      const next = new Set(prev);
      if (task.completed) next.delete(task.id);
      else next.add(task.id);
      return next;
    });
    onToggle(task.id);
  };

  const base = useMemo(() => visibleTasks(todos, user), [todos, user]);

  /** Dot counts: each tab's own filter, except Completed's dot counts today's
   *  completions specifically ("nice work") rather than the whole history
   *  the tab lists when open. */
  const counts = useMemo(
    () => Object.fromEntries(TABS.map((t) => [t.id, base.filter((task) => (t.dotMatch || t.match)(task, user.id)).length])),
    [base, user.id]
  );

  const categoriesPresent = useMemo(
    () => categories.filter((c) => base.some((t) => t.category === c.id)),
    [categories, base]
  );

  /** Counts across every task (not just what this user can see) — the manage
   *  dialog is manager-only and needs the real picture to gate deletion. */
  const categoryTaskCounts = useMemo(() => {
    const tally = {};
    for (const t of todos) tally[t.category] = (tally[t.category] || 0) + 1;
    return tally;
  }, [todos]);

  const filtered = useMemo(() => {
    return base.filter((t) => {
      if (tab === "completed") {
        if (!t.completed) return false;
      } else {
        if (t.completed && !stickyDone.has(t.id)) return false;
        if (tab === "open" && t.assignedTo) return false;
        if (tab === "yours" && t.assignedTo !== user.id) return false;
        if (tab === "dueToday" && !(t.dueDate != null && daysUntil(t.dueDate) === 0)) return false;
        if (tab === "overdue" && !(t.dueDate != null && daysUntil(t.dueDate) < 0)) return false;
      }
      if (category !== "all" && t.category !== category) return false;
      return true;
    });
  }, [base, tab, category, user.id, stickyDone]);

  // Sticky-done tasks keep the sort position they'd have if still open —
  // sortTasks would otherwise drop them to the bottom, which reads as the
  // row jumping the moment you check it off.
  const ordered = useMemo(() => {
    if (tab === "completed" || stickyDone.size === 0) return sortTasks(filtered);
    const forSort = filtered.map((t) => (stickyDone.has(t.id) ? { ...t, completed: false } : t));
    const byId = new Map(filtered.map((t) => [t.id, t]));
    return sortTasks(forSort).map((t) => byId.get(t.id));
  }, [filtered, tab, stickyDone]);

  return (
    <div className="space-y-5">
      <div className="space-y-2.5">
        {/* Its own row, not sharing a flex line with the category filters
         *  below — sharing one made the browser shrink this row to fit
         *  both, which permanently squeezed it into "overflowing" and lit
         *  the scroll fade even on a wide screen with room to spare. */}
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
            <Button variant="primary" icon={Plus} onClick={() => setAdding(true)}>
              New task
            </Button>
          )}
        </div>

        {(categoriesPresent.length > 1 || canManage) && (
          <div className="flex items-center gap-2 flex-wrap">
            {categoriesPresent.length > 1 && (
              <Segmented
                size="sm" scroll value={category} onChange={setCategory}
                options={[
                  { value: "all", label: "All" },
                  ...categoriesPresent.map((c) => ({
                    value: c.id,
                    label: c.label,
                    icon: categoryIcon(categories, c.id),
                  })),
                ]}
              />
            )}

            {canManage && (
              <IconButton
                label="Manage categories"
                icon={Settings}
                onClick={() => setManagingCategories(true)}
                className="shrink-0"
              />
            )}
          </div>
        )}
      </div>

      {ordered.length === 0 ? (
        <div className="border-b border-line">
          <EmptyState
            icon={tab === "completed" ? CheckCircle2 : ClipboardList}
            title={tab === "completed" ? "Nothing completed here yet" : "Nothing on the list"}
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
              onRemove={() => onRemove(task.id)}
            />
          ))}
        </ul>
      )}

      {adding && (
        <AddTaskModal
          staff={staff}
          categories={categories}
          onCancel={() => setAdding(false)}
          onSave={(task) => {
            onAdd(task, user);
            setAdding(false);
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
    </div>
  );
}
