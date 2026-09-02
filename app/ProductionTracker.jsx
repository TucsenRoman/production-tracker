"use client";

import React, { useCallback, useContext, useEffect, useId, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  Factory,
  ListTodo,
  Package,
  UsersRound,
} from "lucide-react";

import { Badge, SlotProvider, SlotTarget, ToastProvider, useToast } from "./components/ui";
import AppShell from "./components/AppShell";
import RoleSwitcher from "./components/RoleSwitcher";
import { TabletFrameContext } from "./components/TabletFrame";
import SignInScreen from "./screens/SignInScreen";
import BoardScreen from "./screens/BoardScreen";
import TasksScreen from "./screens/TasksScreen";
import InventoryScreen from "./screens/InventoryScreen";
import InsightsScreen from "./screens/InsightsScreen";
import TeamScreen from "./screens/TeamScreen";
import { usePersistentState, useSession } from "./lib/store";
import { StaffProvider } from "./lib/staff";
import {
  DEFAULT_TASK_CATEGORIES,
  SEED,
  STAGES,
  STATIONS,
  categoryInUse,
  defaultThreshold,
  isManager,
  moveStock,
  newId,
  nextStageIndex,
  normalizeItem,
  productType,
  putOnFloor,
  stateLabel,
  todayKey,
  visibleTasks,
  yieldPct,
} from "./lib/domain";

/**
 * Insights' own icon: a magnifying glass with an AI sparkle tucked into its
 * top-right corner — one glyph, not two icons floating next to each other.
 * A knockout circle clears its own patch out of the glass's stroke so the
 * sparkle reads as sitting ON the glass. That knockout fills with --row-bg,
 * a custom property the nav row itself sets (see AppShell's renderNavItem)
 * to the row's *actual* current background — canvas at rest, the
 * pre-composited hover/selected tint otherwise — so the patch never shows
 * up as a mismatched halo the way a fixed canvas/surface fill did. Falls
 * back to canvas when nothing sets --row-bg (e.g. the mobile tab bar,
 * whose background never changes on selection). Everything else is
 * monochrome currentColor except the sparkle, which carries its own
 * blue-to-violet gradient — the rail's one deliberate spot of color, fixed
 * regardless of hover/selected state.
 */
function InsightsIcon({ size = 16, className }) {
  const gradientId = useId();
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#2383e2" />
          <stop offset="100%" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>
      <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="15.2" y1="15.2" x2="20.5" y2="20.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle
        cx="16.5"
        cy="6"
        r="5.5"
        style={{ fill: "var(--row-bg, var(--color-canvas))", transition: "fill 100ms" }}
      />
      <g transform="translate(11 1) scale(0.42)">
        <path
          d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.582a.5.5 0 0 1 0 .963L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"
          fill={`url(#${gradientId})`}
        />
      </g>
    </svg>
  );
}

const NAV = [
  { id: "board", label: "Production board", short: "Board", icon: Factory },
  { id: "tasks", label: "Tasks", short: "Tasks", icon: ListTodo },
  { id: "inventory", label: "Inventory", short: "Inventory", icon: Package },
  { id: "team", label: "Team & PINs", short: "Team", icon: UsersRound },
  // Pinned to the rail's bottom, after a divider — see AppShell's
  // `pinned: "bottom"` handling. Manager-only, so crew never see a bare
  // divider with nothing below it.
  { id: "insights", label: "Insights", short: "Insights", icon: InsightsIcon, managerOnly: true, pinned: "bottom" },
];

/* --------------------------------------------------------------- App shell */

function Shell({ user, nav, view, onNavigate, onSignOut, onViewAsRole, children }) {
  // Inside a TabletFrame, RoleSwitcher portals straight to document.body
  // instead of going through AppShell's overlay slot — the bezel's own
  // `transform: scale()` becomes a new containing block for anything
  // `position: fixed` inside it, which would otherwise trap the chip's
  // drag-and-clamp positioning against the mock device instead of the real
  // viewport. Outside a TabletFrame (framed === false) nothing changes.
  const framed = useContext(TabletFrameContext);
  const roleSwitcher = <RoleSwitcher user={user} onChange={onViewAsRole} />;

  return (
    <>
      {framed && typeof document !== "undefined" ? createPortal(roleSwitcher, document.body) : null}
      <AppShell
        brand="Protrack - Milaca Meats"
        nav={nav}
        view={view}
        onNavigate={onNavigate}
        onSignOut={onSignOut}
        initials={user.initials}
        userName={user.name}
        userBadge={
          isManager(user) ? (
            <Badge className="shrink-0">{user.role === "owner" ? "Owner" : "Floor manager"}</Badge>
          ) : null
        }
        userMeta={
          !isManager(user) ? (
            <p className="text-xs text-ink-3 capitalize truncate">{user.station || "Crew"}</p>
          ) : null
        }
        pageActions={<SlotTarget name="page-actions" className="flex items-center gap-2" />}
        pageSubtitle={
          <SlotTarget
            name="page-subtitle"
            className="empty:hidden mt-1 text-sm text-ink-2 leading-normal"
          />
        }
        overlay={framed ? null : roleSwitcher}
      >
        {children}
      </AppShell>
    </>
  );
}

/* ------------------------------------------------------------- Application */

function Application() {
  const toast = useToast();
  const { user, signIn, signOut } = useSession();
  const today = todayKey();

  const [view, setView] = useState("board");
  const [batches, setBatches] = usePersistentState("batches", SEED.batches);
  const [history, setHistory] = usePersistentState("history", SEED.history);
  const [inventory, setInventory] = usePersistentState("inventory", SEED.inventory);
  const [schedule, setSchedule] = usePersistentState("schedule", SEED.schedule);
  const [tasks, setTasks] = usePersistentState("tasks", SEED.tasks);
  const [taskCategories, setTaskCategories] = usePersistentState("taskCategories", DEFAULT_TASK_CATEGORIES);

  /** Records saved before the third state existed get filled in on read. */
  const stock = useMemo(() => inventory.map(normalizeItem), [inventory]);

  // Same "how much is waiting for me" signal as the Tasks screen's own Open
  // tab dot, scoped the same way (visibleTasks: everyone sees unclaimed
  // work, managers see everything) so the rail badge never disagrees with
  // the screen it's shortcutting to.
  const openTaskCount = useMemo(
    () => (user ? visibleTasks(tasks, user).filter((t) => !t.completed).length : 0),
    [tasks, user]
  );

  const [cloverStatus, setCloverStatus] = useState("loading");
  const [syncedAt, setSyncedAt] = useState(null);
  const [velocity, setVelocity] = useState({});

  /* ---- Clover ---- */

  const loadClover = useCallback(async () => {
    setCloverStatus("loading");
    try {
      const res = await fetch("/api/inventory");
      const data = await res.json();
      const items = (data.items || []).filter((i) => !i.hidden);
      // An empty result is a legitimate Clover state (e.g. every product was
      // deleted) and should render the empty state, not "Clover unreachable".
      if (data.error) throw new Error(data.error);

      // Clover lets two separate items share one display name (a duplicate
      // entry, or two SKUs nobody renamed apart). Every other part of this
      // app treats the name as the product's identity, so collapse
      // same-named items into a single row here, summing their sellable
      // stock, instead of letting the duplicate name reach the list below.
      const stockByName = new Map();
      for (const item of items) {
        stockByName.set(item.name, (stockByName.get(item.name) ?? 0) + (item.stockCount ?? 0));
      }

      setInventory((prev) =>
        Array.from(stockByName.entries()).map(([name, stock]) => {
          // Clover only knows what is sellable. The made / freezer / floor split
          // lives here, so an existing local split survives every refresh.
          const existing = prev.find((p) => p.product === name);
          return normalizeItem({
            product: name,
            type: existing?.type ?? productType(name),
            made: existing?.made ?? 0,
            freezer: existing?.freezer ?? 0,
            floor: existing ? existing.floor : stock,
            threshold: existing?.threshold ?? defaultThreshold(name),
            unit: existing?.unit ?? "lb",
          });
        })
      );
      setCloverStatus("live");
      setSyncedAt(new Date().toISOString());
    } catch {
      setCloverStatus("error");
    }

    // Days-of-cover is a bonus signal — a merchant with no order history simply
    // doesn't get one, and the screen carries on without it.
    try {
      const res = await fetch("/api/sales?days=28");
      const data = await res.json();
      setVelocity(data.perDay || {});
    } catch {
      setVelocity({});
    }
  }, [setInventory]);

  useEffect(() => {
    loadClover();
  }, [loadClover]);

  /* ---- Inventory ---- */

  /**
   * Upsert, not update: a batch can finish for a product Clover hasn't seen yet
   * (a new recipe, a first run). Dropping that weight on the floor would be a
   * silent inventory loss, so the product is created instead.
   */
  const addStock = (product, amount, state) => {
    setInventory((prev) => {
      const known = prev.some((i) => i.product === product);
      if (!known) {
        return [
          ...prev,
          normalizeItem({
            product,
            made: 0,
            freezer: 0,
            floor: 0,
            [state]: amount,
            threshold: defaultThreshold(product),
            unit: prev[0]?.unit ?? "lb",
          }),
        ];
      }
      return prev.map((i) => {
        if (i.product !== product) return i;
        const item = normalizeItem(i);
        return { ...item, [state]: +(item[state] + amount).toFixed(1) };
      });
    });
  };

  const handleMove = (product, from, to, amount) => {
    setInventory((prev) =>
      prev.map((i) => (i.product === product ? moveStock(normalizeItem(i), from, to, amount) : i))
    );
    toast(`Moved ${amount} ${product}`, {
      detail:
        to === "floor"
          ? `${stateLabel(from)} → on floor. Now sellable in Clover.`
          : `${stateLabel(from)} → ${stateLabel(to).toLowerCase()}. Clover's floor count is unchanged.`,
    });
  };

  const handleUpdateProduct = (product, patch) => {
    setInventory((prev) =>
      prev.map((i) => (i.product === product ? { ...normalizeItem(i), ...patch } : i))
    );
    toast(`${product} updated`, {
      detail: `${patch.threshold}–${patch.max} ${patch.unit} · ${patch.type}`,
    });
  };

  const handleRemoveProduct = (product) => {
    setInventory((prev) => prev.filter((i) => i.product !== product));
    toast(`${product} removed`, {
      detail: "It will come back on the next sync if Clover still lists it.",
    });
  };

  const handleAddProduct = (item) => {
    setInventory((prev) => [...prev, normalizeItem(item)]);
    toast(`${item.product} added`, { detail: "Starts at zero in all three states." });
  };

  /** The item modal's one-tap "Put out" — made and freezer both land on the floor. */
  const handlePutOut = (product) => {
    setInventory((prev) =>
      prev.map((i) => (i.product === product ? putOnFloor(normalizeItem(i)) : i))
    );
    toast(`${product} put out`, { detail: "Made and freezer stock moved to the floor." });
  };

  /* ---- Board ---- */

  const handleAdvance = (id, staff) => {
    setBatches((prev) =>
      prev.map((b) => (b.id === id ? { ...b, stage: nextStageIndex(b), lastActionBy: staff.name } : b))
    );
    toast("Batch moved forward");
  };

  const handleWeighIn = (id, boxWeight, staff) => {
    setBatches((prev) =>
      prev.map((b) =>
        b.id === id ? { ...b, boxWeight, stage: nextStageIndex(b), lastActionBy: staff.name } : b
      )
    );
    toast(`Box weight recorded — ${boxWeight} lb`, { detail: `Confirmed by ${staff.name}` });
  };

  const handleFinalize = (id, finalWeight, destination, staff) => {
    const batch = batches.find((b) => b.id === id);
    if (!batch) return;

    setBatches((prev) =>
      prev.map((b) =>
        b.id === id
          ? {
              ...b,
              finalWeight,
              stage: STAGES.length - 1,
              destination,
              lastActionBy: staff.name,
            }
          : b
      )
    );

    setHistory((prev) => [
      {
        id: batch.id,
        product: batch.product,
        closedOn: today,
        closedBy: staff.name,
        boxWeight: batch.boxWeight || batch.estWeight,
        finalWeight,
        minutes: null,
      },
      ...prev,
    ]);

    addStock(batch.product, finalWeight, destination);

    const where =
      destination === "floor" ? "retail floor" : destination === "freezer" ? "freezer" : "made pile";
    const pct = yieldPct(batch.boxWeight || batch.estWeight, finalWeight);
    toast(destination === "floor" ? `${finalWeight} lb synced to Clover` : `${finalWeight} lb recorded`, {
      detail: `${batch.product} → ${where}${pct != null ? ` · ${pct}% yield` : ""}`,
    });
  };

  /* ---- Tasks ---- */

  const handleCreateTask = (task, staff) => {
    setTasks((prev) => [
      {
        id: newId("TD"),
        completed: false,
        createdBy: staff.name,
        createdAt: new Date().toISOString(),
        ...task,
      },
      ...prev,
    ]);
    toast(`"${task.title}" added to the list`, {
      detail: task.assignedTo ? "Assigned to one person." : "Open to anyone on shift.",
    });
  };

  const handleToggleTask = (id, staff) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        const completed = !t.completed;
        return {
          ...t,
          completed,
          completedBy: completed ? staff.name : null,
          completedAt: completed ? new Date().toISOString() : null,
        };
      })
    );
  };

  const handleEditTask = (id, fields) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...fields } : t)));
    toast(`"${fields.title}" updated`);
  };

  const handleDeleteTask = (id) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const handleAddTaskCategory = ({ label, iconId }) => {
    setTaskCategories((prev) => [...prev, { id: newId("CAT"), label, iconId }]);
    toast(`"${label}" added as a category`);
  };

  const handleRenameTaskCategory = (id, label) => {
    setTaskCategories((prev) => prev.map((c) => (c.id === id ? { ...c, label } : c)));
  };

  const handleRemoveTaskCategory = (id) => {
    const category = taskCategories.find((c) => c.id === id);
    if (categoryInUse(tasks, id)) {
      toast(`Can't remove "${category?.label}"`, {
        tone: "error",
        detail: "Recategorize its tasks first.",
      });
      return;
    }
    setTaskCategories((prev) => prev.filter((c) => c.id !== id));
    toast(`"${category?.label}" removed`);
  };

  /* ---- Schedule ---- */

  const handleAddTask = (day, station, product, qty) => {
    setSchedule((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        [station]: [...((prev[day] && prev[day][station]) || []), { id: newId("T"), text: product, qty, unit: "lb" }],
      },
    }));

    // Today's plan becomes real work immediately; a future day stays a plan.
    if (day === today) {
      setBatches((prev) => [
        ...prev,
        {
          id: newId("B"),
          product,
          estWeight: qty,
          boxWeight: null,
          stage: STATIONS.indexOf(station),
          needsSmoke: station === "Smokehouse",
          destination: null,
          startedAt: today,
        },
      ]);
      toast(`${product} added to ${station}`, { detail: "Batch card created for today." });
    } else {
      toast(`${product} planned`, { detail: `${station} · ${qty} lb` });
    }
  };

  const handleRemoveTask = (day, station, id) => {
    setSchedule((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        [station]: ((prev[day] && prev[day][station]) || []).filter((t) => t.id !== id),
      },
    }));
  };

  /* ---- Render ---- */

  if (!user) return <SignInScreen onSignIn={signIn} />;

  const nav = NAV.filter((n) => isManager(user) || !n.managerOnly).map((n) =>
    n.id === "tasks" ? { ...n, count: openTaskCount } : n
  );
  const current = nav.some((n) => n.id === view) ? view : "board";

  return (
    <Shell
      user={user}
      nav={nav}
      view={current}
      onNavigate={setView}
      onSignOut={signOut}
      onViewAsRole={(role) => {
        // Re-signs the same person at a different role: session only, so the
        // stored roster keeps whatever they actually hold.
        signIn({ ...user, role });
        toast(`Viewing as ${role}`, { tone: "info" });
      }}
    >
      {current === "board" && (
        <BoardScreen
          batches={batches}
          schedule={schedule}
          inventory={stock}
          today={today}
          user={user}
          onAdvance={handleAdvance}
          onWeighIn={handleWeighIn}
          onFinalize={handleFinalize}
          onAddTask={handleAddTask}
          onRemoveTask={handleRemoveTask}
        />
      )}

      {current === "tasks" && (
        <TasksScreen
          tasks={tasks}
          categories={taskCategories}
          user={user}
          onAdd={handleCreateTask}
          onToggle={(id) => handleToggleTask(id, user)}
          onEdit={handleEditTask}
          onRemove={handleDeleteTask}
          onAddCategory={handleAddTaskCategory}
          onRenameCategory={handleRenameTaskCategory}
          onRemoveCategory={handleRemoveTaskCategory}
        />
      )}


      {current === "inventory" && (
        <InventoryScreen
          inventory={stock}
          velocity={velocity}
          status={cloverStatus}
          syncedAt={syncedAt}
          canManage={isManager(user)}
          batches={batches}
          schedule={schedule}
          history={history}
          onRefresh={loadClover}
          onMove={handleMove}
          onPutOut={handlePutOut}
          onAddProduct={handleAddProduct}
          onUpdateProduct={handleUpdateProduct}
          onRemoveProduct={handleRemoveProduct}
        />
      )}

      {current === "insights" && <InsightsScreen history={history} />}

      {current === "team" && (
        <TeamScreen
          user={user}
          onNotify={(message, tone = "success") => toast(message, { tone })}
        />
      )}
    </Shell>
  );
}

export default function ProductionTracker() {
  return (
    <ToastProvider>
      <SlotProvider>
        <StaffProvider>
          <Application />
        </StaffProvider>
      </SlotProvider>
    </ToastProvider>
  );
}
