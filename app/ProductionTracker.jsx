"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  CalendarClock,
  CalendarDays,
  History,
  LayoutGrid,
  LogOut,
  Package,
} from "lucide-react";

import { Badge, ToastProvider, cx, useToast } from "./components/ui";
import SignInScreen from "./screens/SignInScreen";
import BoardScreen from "./screens/BoardScreen";
import ScheduleScreen from "./screens/ScheduleScreen";
import OrdersScreen from "./screens/OrdersScreen";
import InventoryScreen from "./screens/InventoryScreen";
import InsightsScreen from "./screens/InsightsScreen";
import { usePersistentState, useSession } from "./lib/store";
import {
  SEED,
  STAGES,
  STATIONS,
  newId,
  nextStageIndex,
  todayKey,
  yieldPct,
} from "./lib/domain";

const NAV = [
  { id: "board", label: "Production board", short: "Board", icon: LayoutGrid },
  { id: "schedule", label: "Schedule", short: "Schedule", icon: CalendarDays, managerOnly: true },
  { id: "orders", label: "Custom orders", short: "Orders", icon: CalendarClock },
  { id: "inventory", label: "Inventory", short: "Inventory", icon: Package },
  { id: "insights", label: "Insights", short: "Insights", icon: History, managerOnly: true },
];

/* --------------------------------------------------------------- App shell */

function Shell({ user, nav, view, onNavigate, onSignOut, children }) {
  const active = nav.find((n) => n.id === view) || nav[0];

  return (
    <div className="min-h-screen bg-canvas">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:left-0 lg:w-60 lg:z-20 bg-surface border-r border-line">
        <div className="px-5 py-5">
          <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-brand">
            Milaca Meats
          </p>
          <p className="mt-1 text-base font-bold text-ink font-display leading-tight">Production</p>
        </div>

        <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto thin-scrollbar">
          {nav.map((n) => {
            const on = n.id === view;
            return (
              <button
                key={n.id}
                onClick={() => onNavigate(n.id)}
                aria-current={on ? "page" : undefined}
                className={cx(
                  "w-full flex items-center gap-2.5 px-3 min-h-10 rounded-md text-sm font-medium",
                  "transition-colors duration-100",
                  on ? "bg-primary-soft text-primary-ink" : "text-ink-2 hover:bg-sunken hover:text-ink"
                )}
              >
                <n.icon size={16} className="shrink-0" />
                <span className="truncate">{n.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-line">
          <div className="flex items-center gap-2.5 px-2 py-2">
            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-white text-xs font-semibold shrink-0">
              {user.initials}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink truncate leading-tight">{user.name}</p>
              <p className="text-xs text-ink-3 capitalize truncate">
                {user.role === "manager" ? "Manager" : user.station || "Crew"}
              </p>
            </div>
            <button
              onClick={onSignOut}
              aria-label="Sign out"
              title="Sign out"
              className="w-8 h-8 flex items-center justify-center rounded-md text-ink-3 hover:text-danger hover:bg-sunken transition-colors"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="lg:hidden sticky top-0 z-30 bg-canvas/90 backdrop-blur-sm border-b border-line pt-safe">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-brand leading-none mb-1.5">
              Milaca Meats
            </p>
            <h1 className="text-lg font-bold text-ink font-display leading-none truncate">
              {active.label}
            </h1>
          </div>
          <button
            onClick={onSignOut}
            className="flex items-center gap-2 pl-2 pr-2.5 py-1.5 rounded-full bg-surface border border-line shrink-0"
          >
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-white text-[10px] font-semibold">
              {user.initials}
            </span>
            <LogOut size={13} className="text-ink-3" />
          </button>
        </div>
      </header>

      <main className="lg:pl-60">
        <div className="mx-auto w-full max-w-5xl px-4 pt-5 pb-28 sm:px-6 lg:px-10 lg:pt-8 lg:pb-14">
          <div className="hidden lg:flex items-center justify-between gap-4 mb-6">
            <h2 className="text-2xl font-bold text-ink font-display">{active.label}</h2>
            {user.role === "manager" && <Badge tone="info">Manager</Badge>}
          </div>
          {children}
        </div>
      </main>

      {/* Mobile tab bar */}
      <nav className="lg:hidden fixed inset-x-0 bottom-0 z-30 bg-surface border-t border-line pb-safe">
        <div className={cx("grid", nav.length === 5 ? "grid-cols-5" : "grid-cols-3")}>
          {nav.map((n) => {
            const on = n.id === view;
            return (
              <button
                key={n.id}
                onClick={() => onNavigate(n.id)}
                aria-current={on ? "page" : undefined}
                className={cx(
                  "flex flex-col items-center justify-center gap-1 min-h-14 px-1 py-2",
                  "text-[10px] font-medium transition-colors duration-100",
                  on ? "text-primary-ink" : "text-ink-3"
                )}
              >
                <n.icon size={19} className="shrink-0" />
                <span className="truncate max-w-full">{n.short}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
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
  const [orders, setOrders] = usePersistentState("orders", SEED.orders);
  const [schedule, setSchedule] = usePersistentState("schedule", SEED.schedule);

  const [cloverStatus, setCloverStatus] = useState("loading");
  const [syncedAt, setSyncedAt] = useState(null);

  /* ---- Clover ---- */

  const loadClover = useCallback(async () => {
    setCloverStatus("loading");
    try {
      const res = await fetch("/api/inventory");
      const data = await res.json();
      const items = (data.items || []).filter((i) => !i.hidden);
      if (data.error || items.length === 0) throw new Error(data.error || "No items");

      setInventory((prev) =>
        items.map((item) => {
          const stock = item.stockCount ?? 0;
          // Clover tracks a single count; the freezer/floor split lives here, so
          // an existing local split is preserved across refreshes.
          const existing = prev.find((p) => p.product === item.name);
          return {
            product: item.name,
            freezer: existing?.freezer ?? 0,
            floor: existing ? existing.floor : stock,
            threshold: existing?.threshold ?? Math.max(3, Math.round(stock * 0.25)),
            unit: existing?.unit ?? "unit",
          };
        })
      );
      setCloverStatus("live");
      setSyncedAt(new Date().toISOString());
    } catch {
      setCloverStatus("error");
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
  const addStock = (product, amount, destination) => {
    setInventory((prev) => {
      const known = prev.some((i) => i.product === product);
      if (!known) {
        return [
          ...prev,
          {
            product,
            freezer: destination === "retail" ? 0 : amount,
            floor: destination === "retail" ? amount : 0,
            threshold: Math.max(3, Math.round(amount * 0.25)),
            unit: prev[0]?.unit ?? "lb",
          },
        ];
      }
      return prev.map((i) =>
        i.product === product
          ? destination === "retail"
            ? { ...i, floor: +(i.floor + amount).toFixed(1) }
            : { ...i, freezer: +(i.freezer + amount).toFixed(1) }
          : i
      );
    });
  };

  const handleTransfer = (product, amount) => {
    setInventory((prev) =>
      prev.map((i) =>
        i.product === product
          ? {
              ...i,
              freezer: +(i.freezer - amount).toFixed(1),
              floor: +(i.floor + amount).toFixed(1),
            }
          : i
      )
    );
    toast(`Moved ${amount} ${product} to the floor`, {
      detail: "Location updated — Clover's total is unchanged.",
    });
  };

  const handleAddProduct = (item) => {
    setInventory((prev) => [...prev, item]);
    toast(`${item.product} added`, { detail: "Starts at zero in both locations." });
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

    if (destination) {
      addStock(batch.product, finalWeight, destination);
      const where = destination === "retail" ? "retail floor" : "freezer";
      const pct = yieldPct(batch.boxWeight || batch.estWeight, finalWeight);
      toast(`${finalWeight} lb synced to Clover`, {
        detail: `${batch.product} → ${where}${pct != null ? ` · ${pct}% yield` : ""}`,
      });
    } else {
      toast(`${batch.product} ready for pickup`, { detail: batch.customer || undefined });
    }
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
          customer: null,
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

  /* ---- Orders ---- */

  const handleMarkReady = (id, location, staff) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === id ? { ...o, status: "ready", location, readyBy: staff.name } : o))
    );
    toast("Marked ready for pickup", { detail: location });
  };

  /* ---- Render ---- */

  if (!user) return <SignInScreen onSignIn={signIn} />;

  const nav = NAV.filter((n) => user.role === "manager" || !n.managerOnly);
  const current = nav.some((n) => n.id === view) ? view : "board";

  return (
    <Shell user={user} nav={nav} view={current} onNavigate={setView} onSignOut={signOut}>
      {current === "board" && (
        <BoardScreen
          batches={batches}
          schedule={schedule}
          today={today}
          user={user}
          onAdvance={handleAdvance}
          onWeighIn={handleWeighIn}
          onFinalize={handleFinalize}
          onCompleteTask={(station, id) => handleRemoveTask(today, station, id)}
        />
      )}

      {current === "schedule" && (
        <ScheduleScreen
          schedule={schedule}
          inventory={inventory}
          today={today}
          onAdd={handleAddTask}
          onRemove={handleRemoveTask}
        />
      )}

      {current === "orders" && (
        <OrdersScreen
          orders={orders}
          canManage={user.role === "manager"}
          onAdd={(o) => {
            setOrders((prev) => [o, ...prev]);
            toast(`Order for ${o.customer} created`);
          }}
          onRemove={(id) => setOrders((prev) => prev.filter((o) => o.id !== id))}
          onMarkReady={handleMarkReady}
          onReopen={(id) =>
            setOrders((prev) =>
              prev.map((o) => (o.id === id ? { ...o, status: "open", location: null, readyBy: null } : o))
            )
          }
        />
      )}

      {current === "inventory" && (
        <InventoryScreen
          inventory={inventory}
          status={cloverStatus}
          syncedAt={syncedAt}
          canManage={user.role === "manager"}
          onRefresh={loadClover}
          onTransfer={handleTransfer}
          onAddProduct={handleAddProduct}
        />
      )}

      {current === "insights" && <InsightsScreen history={history} />}
    </Shell>
  );
}

export default function ProductionTracker() {
  return (
    <ToastProvider>
      <Application />
    </ToastProvider>
  );
}
