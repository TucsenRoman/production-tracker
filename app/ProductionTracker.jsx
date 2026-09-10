"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Boxes,
  Factory,
  ListTodo,
  Package,
  Store,
} from "lucide-react";

import { SlotProvider, SlotTarget, ToastProvider, useToast, scrollAppToToolbar } from "./components/ui";
import AppShell from "./components/AppShell";
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
} from "./lib/domain";
import { StationsProvider, useStations } from "./lib/stations";
import { useSharedStationConfig, useSharedStations } from "./lib/sharedStations";

const NAV = [
  /* "Batches", not "Production board". A board is a thing the software has;
   * a batch is the thing the shop makes, and it is the word already used
   * everywhere else in this model — `SEED.batches`, `makeBatch`, "close out a
   * batch". The screen is now a ledger of them rather than a wall of cards,
   * which is the other half of the same change. */
  { id: "batches", label: "Batches", short: "Batches", icon: Factory },
  { id: "inventory", label: "Inventory", short: "Inventory", icon: Package },
  /* Third of four, at the user's call. It is the tab that carries a count
   * badge, and third-of-four sits closest to where a thumb rests on a tablet
   * held two-handed — the position the badge is asking you to look at. */
  { id: "tasks", label: "Tasks", short: "Tasks", icon: ListTodo },
  /* The fourth tab is labelled with the SHOP, not "Settings" — see `nav`
   * below, where the label is filled in at render. Naming it after the place
   * is what keeps a mis-set tablet visible now that the top strip that used
   * to carry the shop name is gone: a terminal quietly filing a week of work
   * against the wrong building is the failure this guards, and the tab bar is
   * the one piece of chrome that is always on screen. */
  { id: "settings", label: "Settings", short: "Shop", icon: Store },
  /* "Team & PINs" is gone. It managed a floor staff roster that no longer
   * exists: crew are not in the system, and floor managers are added in the
   * console and claim their own PIN when one is first asked for. A screen for
   * editing people who cannot be edited here is worse than no screen. */
];

/**
 * The tablet has no identity.
 *
 * There is no sign-in — the iPad's passcode is the lock and ProTrack opens
 * straight up — so nothing on the floor is hidden behind who you are. That is
 * safe because nothing here is worth hiding: pounds, batches, thresholds, days
 * of cover. Anything that genuinely needs a person behind it goes through
 * `useApproval`, where the Permissions screen decides.
 *
 * The `role: "manager"` it used to carry is gone, and so are the
 * `isManager(...)` checks it existed to satisfy. Those checks are the ones
 * this comment promised were on their way out: a question asked of a constant
 * always has the same answer, and every screen has been collapsed to the
 * branch it always took.
 *
 * What is left is genuinely all the terminal needs to know about itself: an
 * id to stamp on work, and a name for the tasks it completes.
 */
const TABLET = { id: "TABLET", name: "Shop floor" };

/* --------------------------------------------------------------- App shell */

function Shell({ nav, view, onNavigate, children }) {
  return (
      <AppShell
        /* A bottom tab bar at every width, not a sidebar. This tablet is
         *  carried around the shop — set down by the freezer, picked up at
         *  the bench — and a left rail is the one nav position the thumb
         *  holding it cannot reach. It also ends the split personality the
         *  floor had: the `lg` breakpoint falls between an iPad's two
         *  orientations, so turning the device used to change the entire
         *  navigation. See AppShell's `chrome` prop. */
        chrome="tabs"
        /* No `brand`, and no brand menu. Both belonged to the top strip, and
         *  the strip is gone — the shop names the fourth tab now, and
         *  "Change shop" is a control on the screen behind it. That is a
         *  better home for a setting that, with one location configured,
         *  never rendered a chevron at all. */
        nav={nav}
        view={view}
        onNavigate={onNavigate}
        /* No user block at all — no initials, no name, no "Shared terminal"
         *  badge, and no sign-out, because there is nothing and nobody to sign
         *  out of. AppShell omits its whole footer when no `userName` arrives. */
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
  /* Read-only here — the provider writes it. This is the first thing that
   * has ever rendered the log. */
  const [approvalLog] = useApprovalLog();
  const { locations, location, setLocation, needsChoice } = useDeviceLocation();
  const [switching, setSwitching] = useState(false);
  const today = todayKey();
  const { nextStage, finalStage, normalizeStage } = useStations();

  const [view, setView] = useState("board");
  const [storedBatches, setBatches] = usePersistentState("batches", SEED.batches);
  /* A build before this one stored `stage` as an index into the station list.
   * Anything still carrying a number gets read as the name that index points
   * at now — best effort, since the list may have changed since it was
   * written, but a wrong name is at least visible where a stale index quietly
   * pointed at whatever moved into that slot. */
  const batches = React.useMemo(() => storedBatches.map(normalizeStage), [storedBatches, normalizeStage]);

  /* ...and written back, once, the first time one is seen.
   *
   * Normalising on READ alone was a trap. `batches` is a derived view, but
   * every `setBatches` updater below receives the RAW array, so a batch still
   * carrying a number went into `nextStage`, which looks its stage up with
   * `stages.indexOf` — a number is never in a list of names, so it answered
   * -1 and did the right thing for the case it was written for: an unknown
   * stage means a deleted station, so leave the batch where it is. The move
   * committed, the approval logged, the toast said "Batch moved forward", and
   * nothing on the floor moved. Every writer would otherwise have to
   * remember to normalise, and the store would never heal.
   *
   * Self-cancelling: once the write lands there are no numbers left to find. */
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

  // The same count the Tasks screen's own tabs add up to. There is no
  // per-person scoping left to mirror — the terminal sees the whole list —
  // so this is simply "how much is still open".
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

      // Clover lets two separate items share one display name (a duplicate
      // entry, or two SKUs nobody renamed apart). Every other part of this
      // app treats the name as the product's identity, so collapse
      // same-named items into a single row here, summing their sellable
      // stock, instead of letting the duplicate name reach the list below.
      const stockByName = new Map();
      for (const item of items) {
        stockByName.set(item.name, (stockByName.get(item.name) ?? 0) + (item.stockCount ?? 0));
      }

      setInventory((prev) => {
        // Union, not replace. This used to be prev.find(...) inside a plain
        // .map() over Clover's own list — correct for a product Clover
        // still lists, but it meant any product Clover DOESN'T return this
        // sync (this sandbox has only ~12 items against a 20+ product
        // demo case) silently disappeared from the floor entirely, taking
        // its real floor/freezer split with it. Seed the map from `prev`
        // first so a product with no match in this sync just carries over
        // unchanged, instead of vanishing.
        const byName = new Map(prev.map((p) => [p.product, p]));
        for (const [name, stock] of stockByName.entries()) {
          // Clover only knows what is sellable. The made / freezer / floor
          // split lives here, so an existing local split survives every
          // refresh — and a name Clover has no real count for (`stock` is
          // null in this sandbox — no quantity app enabled) never overwrites
          // a real floor with a false zero.
          const existing = byName.get(name);
          byName.set(
            name,
            normalizeItem({
              /* Spread the existing record FIRST rather than listing the
               * fields to keep. This used to name them one by one, which
               * meant every field it forgot was silently reset on each
               * sync — and it forgot `max` and `minBatch`, the two numbers
               * the console's Targets screen exists to set. A manager set a
               * case size in the office, the tablet refreshed from Clover,
               * and normalizeItem re-derived both from the family default.
               * Whatever the console knows about a product outlives a sync;
               * Clover only ever gets to speak for what is on the floor. */
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

  /* Routed through `setStockRange` rather than spreading the patch straight
   * on, so the floor and the console's Targets screen enforce the same
   * invariant — a smallest-batch bigger than the whole case is unsatisfiable,
   * and used to be reachable from here by simply lowering the max. */
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

  /* Every one of these asks the same way and lets the Permissions screen
   * decide which ones actually stop. `by.ungated` means nobody had to stand
   * behind it, so there is no name to stamp — the alternative, inventing one,
   * is how an audit trail starts lying. */
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

    /* The flagship gated action, and the one that ships requiring a lead: it
     * locks in the number the whole shift gets measured against. */
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

  /* The floor no longer books future days — that moved to the console's
   * Targets screen, which can see a week of demand and the stock bands
   * behind it. What is left here is everything that happens TODAY, and the
   * two verbs it needs.
   *
   * The split matters because the old single `handleAddTask(day, ...)`
   * branched on `day === today` to decide whether to spawn a batch. The
   * console had the same function without the branch. So the same gesture
   * produced live work from one screen and a dead plan line from the other,
   * and nothing on either side said which had happened. */

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
   * Start a run the console planned — the handshake that was missing.
   *
   * A batch scheduled in the office for a future day used to simply expire:
   * the day arrived, the line sat on the board, and the only control on it
   * deleted it. Now the plan line keeps its identity and gains a batch,
   * stamped both ways, so nothing is retyped and nothing is counted twice.
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

  /* Before anything else: a tablet that does not know which shop it is in
   * cannot record anything honestly, so it is the one question the terminal
   * ever asks. With a single location it never appears. */
  if (needsChoice) return <LocationPicker locations={locations} onPick={setLocation} />;

  /* Nothing is hidden from the terminal — see TABLET above. The filter is
   * gone rather than left always-true, so nobody re-adds a flag to it. */
  const nav = NAV.map((n) => {
    if (n.id === "tasks") return { ...n, count: openTaskCount };
    /* The shop's own name, so the bar always says where this tablet thinks it
     * is. Falls back to "Shop" before the roster has hydrated, or if a tablet
     * genuinely has no location set — in which case the Settings screen says
     * so in as many words. */
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
       * you arrive on a screen already scrolled to wherever the last one
       * left off — or clamped partway, if the new screen is shorter. A
       * screen you just opened starts at its top. */
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
           * is still gated by the `switch-location` approval inside the
           * dialog — moving the control did not make it cheaper. */
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

/* The provider has to sit ABOVE the component that calls `useApproval`, and
 * it wants the tablet's shop for the log, so this thin layer reads the
 * setting and wraps. `useDeviceLocation` is a storage read, so calling it in
 * both places costs nothing. */
function ApplicationWithApprovals() {
  const { location } = useDeviceLocation();
  return (
    <ApprovalProvider location={location}>
      <Application />
    </ApprovalProvider>
  );
}

function ApplicationWithStations() {
  // Sourced from the admin console's own Stations screen (see
  // ./lib/sharedStations.js) rather than a local copy, so a station added
  // there shows up here as a stage on the board, not just in Permissions.
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
