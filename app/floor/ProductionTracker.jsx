"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Factory,
  ListTodo,
  Package,
  Store,
} from "lucide-react";

import { SlotProvider, SlotTarget, ToastProvider, useToast, scrollAppToToolbar } from "../components/ui";
import AppShell from "../components/AppShell";
import { LocationPicker, LocationSwitchDialog } from "./components/LocationSetting";
import { useDeviceLocation } from "./lib/deviceLocation";
import { ApprovalProvider, useApproval, useApprovalLog } from "./lib/approval";
import BatchesScreen from "./screens/BatchesScreen";
import TasksScreen from "./screens/TasksScreen";
import InventoryScreen from "./screens/InventoryScreen";
import SettingsScreen from "./screens/SettingsScreen";
import { usePersistentState } from "./lib/store";
import {
  DEFAULT_TASK_CATEGORIES,
  SEED,
  categoryInUse,
  defaultThreshold,
  makeBatch,
  makeScheduleEntry,
  moveStock,
  newId,
  normalizeItem,
  productType,
  putOnFloor,
  setStockRange,
  stateLabel,
  todayKey,
  yieldPct,
} from "../lib/domain";
import { StationsProvider, useStations } from "../lib/stations";
import { useSharedStationConfig, useSharedStations } from "./lib/sharedStations";

const NAV = [
  { id: "batches", label: "Batches", short: "Batches", icon: Factory },
  { id: "inventory", label: "Inventory", short: "Inventory", icon: Package },
  /* Third of four: this tab carries the count badge, and third-of-four sits
   * nearest a thumb on a tablet held two-handed. */
  { id: "tasks", label: "Tasks", short: "Tasks", icon: ListTodo },
  /* Labelled with the shop's name at render (see `nav` below), not
   * "Settings", so a tablet filing work against the wrong building is
   * visible in the one piece of chrome that is always on screen. */
  { id: "settings", label: "Settings", short: "Shop", icon: Store },
];

/**
 * The tablet has no identity. There is no sign-in (the iPad passcode is the
 * lock), so nothing on the floor is hidden behind who you are. Anything that
 * needs a person behind it goes through `useApproval`, where the Permissions
 * screen decides. This is just an id to stamp on work and a name for tasks.
 */
const TABLET = { id: "TABLET", name: "Shop floor" };

/* --------------------------------------------------------------- App shell */

function Shell({ nav, view, onNavigate, children }) {
  return (
      <AppShell
        /* Bottom tab bar at every width, not a sidebar: a left rail is the one
         * nav position a thumb holding the tablet cannot reach, and the `lg`
         * breakpoint falls between an iPad's two orientations. */
        chrome="tabs"
        nav={nav}
        view={view}
        onNavigate={onNavigate}
        /* No `brand` and no `userName`: there is nobody to sign out of, and
         * AppShell omits its footer when no `userName` arrives. */
        pageActions={<SlotTarget name="page-actions" className="flex items-center gap-2" />}
        pageSubtitle={
          <SlotTarget
            name="page-subtitle"
            className="empty:hidden mt-1 text-sm text-ink-2 leading-normal"
          />
        }
      >
        {children}
      </AppShell>
  );
}

/* ------------------------------------------------------------- Application */

function Application() {
  const toast = useToast();
  const user = TABLET;
  const approve = useApproval();
  /* Read-only here; the provider writes it. */
  const [approvalLog] = useApprovalLog();
  const { locations, location, setLocation, needsChoice } = useDeviceLocation();
  const [switching, setSwitching] = useState(false);
  const today = todayKey();
  const { nextStage, finalStage, normalizeStage } = useStations();

  const [view, setView] = useState("batches");
  const [storedBatches, setBatches] = usePersistentState("batches", SEED.batches);
  /* Older stored batches may carry `stage` as a numeric index into the
   * station list; read those as the name that index points at (best effort). */
  const batches = React.useMemo(() => storedBatches.map(normalizeStage), [storedBatches, normalizeStage]);

  /* Also write the normalised stage back, once. Normalising on read alone is
   * not enough: every `setBatches` updater below receives the RAW array, and
   * `nextStage` looks a numeric stage up with `stages.indexOf`, gets -1, and
   * treats it as a deleted station — the move commits and logs but nothing
   * moves. Self-cancelling once no numbers remain. */
  useEffect(() => {
    if (!storedBatches.some((b) => typeof b?.stage === "number")) return;
    setBatches((prev) => prev.map(normalizeStage));
  }, [storedBatches, normalizeStage, setBatches]);
  const [history, setHistory] = usePersistentState("history", SEED.history);
  const [inventory, setInventory] = usePersistentState("inventory", SEED.inventory);
  const [schedule, setSchedule] = usePersistentState("schedule", SEED.schedule);
  const [tasks, setTasks] = usePersistentState("tasks", SEED.tasks);
  const [taskCategories, setTaskCategories] = usePersistentState("taskCategories", DEFAULT_TASK_CATEGORIES);

  /** Records saved before the third state existed get filled in on read. */
  const stock = useMemo(() => inventory.map(normalizeItem), [inventory]);

  // The same count the Tasks screen's own tabs add up to.
  const openTaskCount = useMemo(
    () => tasks.filter((t) => !t.completed).length,
    [tasks]
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

      // Clover lets two items share one display name, and this app treats the
      // name as the product's identity, so collapse same-named items into one
      // row and sum their sellable stock.
      const stockByName = new Map();
      for (const item of items) {
        stockByName.set(item.name, (stockByName.get(item.name) ?? 0) + (item.stockCount ?? 0));
      }

      setInventory((prev) => {
        // Union, not replace: seed from `prev` so a product Clover does not
        // return this sync carries over unchanged instead of vanishing with
        // its floor/freezer split.
        const byName = new Map(prev.map((p) => [p.product, p]));
        for (const [name, stock] of stockByName.entries()) {
          // Clover only knows what is sellable. The made / freezer / floor
          // split lives here and survives every refresh, and a name Clover
          // has no real count for never overwrites a real floor with zero.
          const existing = byName.get(name);
          byName.set(
            name,
            normalizeItem({
              /* Spread the existing record FIRST rather than listing fields
               * to keep, so console-owned values like `max` and `minBatch`
               * outlive a sync. Clover only speaks for what is on the floor. */
              ...(existing || {}),
              product: name,
              type: existing?.type ?? productType(name),
              made: existing?.made ?? 0,
              freezer: existing?.freezer ?? 0,
              floor: existing ? existing.floor : (stock ?? 0),
              threshold: existing?.threshold ?? defaultThreshold(name),
              unit: existing?.unit ?? "lb",
            }),
          );
        }
        return Array.from(byName.values());
      });
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

  const handleMove = async (product, from, to, amount) => {
    const by = await approve("inventory-transfer", { detail: `${amount} ${product}` });
    if (!by) return;
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

  /* Routed through `setStockRange` so the floor and the console's Targets
   * screen enforce the same invariant: a smallest-batch bigger than the whole
   * case is unsatisfiable. */
  const handleUpdateProduct = (product, patch) => {
    const { threshold, max, minBatch, ...rest } = patch;
    setInventory((prev) =>
      prev.map((i) =>
        i.product === product
          ? { ...setStockRange(i, { threshold, max, minBatch }), ...rest }
          : i,
      ),
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

  /* Each of these asks the same way and lets the Permissions screen decide
   * which ones actually stop. `by.ungated` means nobody had to stand behind
   * it, so there is no name to stamp; inventing one would falsify the log. */
  const handleAdvance = async (id) => {
    const batch = batches.find((b) => b.id === id);
    const by = await approve("weigh-in", { detail: batch && `${batch.id} ${batch.product}` });
    if (!by) return;
    setBatches((prev) =>
      prev.map((b) => (b.id === id ? { ...b, stage: nextStage(b), lastActionBy: by.name } : b))
    );
    toast("Batch moved forward", by.name ? { detail: `Approved by ${by.name}` } : undefined);
  };

  const handleWeighIn = async (id, boxWeight) => {
    const batch = batches.find((b) => b.id === id);
    const by = await approve("weigh-in", { detail: batch && `${batch.id} ${batch.product}` });
    if (!by) return;
    setBatches((prev) =>
      prev.map((b) =>
        b.id === id ? { ...b, boxWeight, stage: nextStage(b), lastActionBy: by.name } : b
      )
    );
    toast(`Box weight recorded — ${boxWeight} lb`, by.name ? { detail: `Confirmed by ${by.name}` } : undefined);
  };

  const handleFinalize = async (id, finalWeight, destination) => {
    const batch = batches.find((b) => b.id === id);
    if (!batch) return;

    /* Ships requiring a lead: this locks in the number the shift is measured by. */
    const by = await approve("close-batch", { detail: `${batch.id} ${batch.product}` });
    if (!by) return;

    setBatches((prev) =>
      prev.map((b) =>
        b.id === id
          ? {
              ...b,
              finalWeight,
              stage: finalStage,
              destination,
              lastActionBy: by.name,
            }
          : b
      )
    );

    setHistory((prev) => [
      {
        id: batch.id,
        product: batch.product,
        closedOn: today,
        closedBy: by.name,
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

  /* ---- Today's plan ---- */

  /* The floor only handles TODAY; future days are booked in the console's
   * Targets screen. */

  /** Queue something for today at a station: a plan line and the live batch
   *  it stands for, created together and linked. */
  const handleQueueForToday = (station, product, qty) => {
    const batch = makeBatch({ product, qty, station, startedAt: today });
    const entry = makeScheduleEntry({ product, qty, batchId: batch.id });
    setBatches((prev) => [...prev, batch]);
    setSchedule((prev) => ({
      ...prev,
      [today]: {
        ...prev[today],
        [station]: [...((prev[today] && prev[today][station]) || []), entry],
      },
    }));
    toast(`${product} added to ${station}`, { detail: "Batch card created for today." });
  };

  /**
   * Start a run the console planned. The plan line keeps its identity and
   * gains a batch, linked both ways, so nothing is retyped or counted twice.
   */
  const handleStartPlanned = (station, entryId) => {
    const entry = ((schedule[today] || {})[station] || []).find((t) => t.id === entryId);
    if (!entry || entry.batchId) return;
    const batch = makeBatch({
      product: entry.text,
      qty: entry.qty,
      station,
      startedAt: today,
    });
    setBatches((prev) => [...prev, batch]);
    setSchedule((prev) => ({
      ...prev,
      [today]: {
        ...prev[today],
        [station]: ((prev[today] && prev[today][station]) || []).map((t) =>
          t.id === entryId ? { ...t, batchId: batch.id } : t,
        ),
      },
    }));
    toast(`${entry.text} started at ${station}`, {
      detail: `${entry.qty} ${entry.unit} · batch card created.`,
    });
  };

  /** Drop a planned line nobody started. Plans change; this is not "done". */
  const handleRemovePlanned = (station, entryId) => {
    setSchedule((prev) => ({
      ...prev,
      [today]: {
        ...prev[today],
        [station]: ((prev[today] && prev[today][station]) || []).filter((t) => t.id !== entryId),
      },
    }));
  };

  /* ---- Render ---- */

  /* A tablet that does not know which shop it is in cannot record anything
   * honestly, so this is asked before anything else. With a single location
   * it never appears. */
  if (needsChoice) return <LocationPicker locations={locations} onPick={setLocation} />;

  const nav = NAV.map((n) => {
    if (n.id === "tasks") return { ...n, count: openTaskCount };
    /* The shop's own name, so the bar always says where this tablet thinks it
     * is. Falls back to "Shop" before the roster has hydrated or when no
     * location is set. */
    if (n.id === "settings" && location?.name) {
      return { ...n, label: location.name, short: location.name };
    }
    return n;
  });
  const current = nav.some((n) => n.id === view) ? view : "batches";

  return (
    <Shell
      nav={nav}
      view={current}
      /* Every screen renders into the SAME scroll container, so without this
       * a new screen opens wherever the last one left off. */
      onNavigate={(v) => {
        setView(v);
        scrollAppToToolbar();
      }}
    >
      {current === "batches" && (
        <BatchesScreen
          batches={batches}
          schedule={schedule}
          inventory={stock}
          history={history}
          today={today}
          onAdvance={handleAdvance}
          onWeighIn={handleWeighIn}
          onFinalize={handleFinalize}
          onQueueForToday={handleQueueForToday}
          onStartPlanned={handleStartPlanned}
          onRemovePlanned={handleRemovePlanned}
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
          batches={batches}
          schedule={schedule}
          history={history}
          today={today}
          onMove={handleMove}
          onPutOut={handlePutOut}
          onAddProduct={handleAddProduct}
          onUpdateProduct={handleUpdateProduct}
          onRemoveProduct={handleRemoveProduct}
        />
      )}


      {current === "settings" && (
        <SettingsScreen
          place={location}
          locations={locations}
          log={approvalLog}
          cloverStatus={cloverStatus}
          syncedAt={syncedAt}
          onRefresh={loadClover}
          /* Only offered when there is somewhere else to go. The switch itself
           * is still gated by the `switch-location` approval in the dialog. */
          onChangeShop={locations.length > 1 ? () => setSwitching(true) : undefined}
        />
      )}

      {switching && (
        <LocationSwitchDialog
          current={location}
          locations={locations}
          onCancel={() => setSwitching(false)}
          onSwitch={(id, person) => {
            setLocation(id);
            setSwitching(false);
            const name = locations.find((l) => l.id === id)?.name;
            /* Names who approved it, because with no shift sign-in the
             * approval is the only record that this happened at all. */
            toast(`Tablet set to ${name}`, { detail: `Approved by ${person.name}.` });
          }}
        />
      )}
    </Shell>
  );
}

/* The provider must sit ABOVE the component that calls `useApproval`, and it
 * wants the tablet's shop for the log, so this thin layer reads the setting
 * and wraps. `useDeviceLocation` is a storage read; calling it twice is free. */
function ApplicationWithApprovals() {
  const { location } = useDeviceLocation();
  return (
    <ApprovalProvider location={location}>
      <Application />
    </ApprovalProvider>
  );
}

function ApplicationWithStations() {
  // Sourced from the console's Stations screen (./lib/sharedStations.js), so
  // a station added there shows up here as a stage on the board.
  const liveStations = useSharedStations();
  const liveStationConfig = useSharedStationConfig();
  return (
    <StationsProvider stations={liveStations} config={liveStationConfig}>
      <ApplicationWithApprovals />
    </StationsProvider>
  );
}

export default function ProductionTracker() {
  return (
    <ToastProvider>
      <SlotProvider>
        <ApplicationWithStations />
      </SlotProvider>
    </ToastProvider>
  );
}
