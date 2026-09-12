"use client";

import React, { useEffect, useMemo, useState } from "react";

import { ToastProvider, useToast } from "../components/ui";
import ConsoleShell from "./components/ConsoleShell";
import BrandModals from "./components/BrandModals";
import { newId } from "../lib/domain";
import { StationsProvider, migrateStage } from "../lib/stations";
import CompanyAuthScreen from "./screens/CompanyAuthScreen";
import InsightsScreen from "./screens/InsightsScreen";
import LocationsScreen from "./screens/LocationsScreen";
import TeamScreen from "./screens/TeamScreen";
import StationsScreen from "./screens/StationsScreen";
import PermissionsScreen from "./screens/PermissionsScreen";
import ProductionScreen from "./screens/ProductionScreen";
import InventoryScreen from "./screens/InventoryScreen";
import FloorTasksScreen from "../floor/screens/TasksScreen";
import { usePersistentState, useCompanySession } from "./lib/companyStore";
import { usePersistentState as useFloorPersistentState } from "../floor/lib/store";
import { useBrandModals } from "./lib/useBrandModals";
import { COMPANY_SEED, DEMO_SECOND_LOCATION, PROVIDERS, defaultPermissions, isValidStationName, simulateSync } from "./lib/companyDomain";
import { PRODUCTION_SEED } from "./lib/companyProduction";
import { SEED, DEFAULT_TASK_CATEGORIES, makeScheduleEntry, setStockRange, todayKey, categoryInUse } from "../lib/domain";
import { buildCompanyInsights } from "./lib/insights";
import { navFor } from "./lib/nav";

function Application() {
  const toast = useToast();
  const { session, signIn, signOut } = useCompanySession();

  const [company, setCompany] = usePersistentState("company", COMPANY_SEED.company);
  const [locations, setLocations] = usePersistentState("locations", COMPANY_SEED.locations);
  const [users, setUsers] = usePersistentState("users", COMPANY_SEED.users);
  const [integrations, setIntegrations] = usePersistentState("integrations", COMPANY_SEED.integrations);
  const [stations, setStations] = usePersistentState("stations", COMPANY_SEED.stations);
  /* Per-station extras, kept separate from the plain name list so nothing
   * that matches stations by name (crewPins, batches, permissions) has to
   * change shape. */
  const [stationConfig, setStationConfig] = usePersistentState("stationConfig", {});
  const [crewPins, setCrewPins] = usePersistentState("crewPins", COMPANY_SEED.crewPins);
  const [production, setProduction] = usePersistentState("production", PRODUCTION_SEED);
  const [permissions, setPermissions] = usePersistentState("permissions", defaultPermissions());
  const [customActions, setCustomActions] = usePersistentState("customActions", []);

  // Shared with the floor terminal (same localStorage namespace, see
  // ../lib/store) so a plan or task added here shows up on the tablet and
  // vice versa. Not location-scoped yet.
  const [schedule, setSchedule] = useFloorPersistentState("schedule", SEED.schedule);
  const [tasks, setTasks] = useFloorPersistentState("tasks", SEED.tasks);
  const [taskCategories, setTaskCategories] = useFloorPersistentState("taskCategories", DEFAULT_TASK_CATEGORIES);
  const [inventory, setInventory] = useFloorPersistentState("inventory", SEED.inventory);
  /* The console tracks production; it does not run batches, so this is
   * read-only with one deliberate exception: renaming a station must follow
   * the live batches standing at it, because a batch's stage is that
   * station's name. */
  const [storedBatches, setBatches] = useFloorPersistentState("batches", SEED.batches);
  /* Same index→name migration the floor does on read. Uses the exported
   * helper rather than the context method because this component renders
   * the provider and so sits above the hook. */
  const batches = useMemo(
    () => storedBatches.map((b) => migrateStage(b, [...stations, "Shelf-Ready"])),
    [storedBatches, stations]
  );
  const today = todayKey();

  /* Dev-only: fold the demo's second location (and its managers) in and out
   * at runtime, since much of the console only shows itself with two.
   * Persisted so a refresh keeps whichever shape you were testing. */
  const [twoLocations, setTwoLocations] = usePersistentState("demoTwoLocations", false);

  const handleToggleLocations = (on) => {
    const { location: extraLoc, users: extraUsers, crewPins: extraPins } = DEMO_SECOND_LOCATION;
    setTwoLocations(on);
    if (on) {
      /* Additive and id-guarded: flipping twice does not duplicate, and
       * toggling does not clobber edits made while it was on. */
      setLocations((prev) => (prev.some((l) => l.id === extraLoc.id) ? prev : [...prev, extraLoc]));
      setUsers((prev) => [...prev, ...extraUsers.filter((e) => !prev.some((u) => u.id === e.id))]);
      setCrewPins((prev) => [...prev, ...extraPins.filter((e) => !prev.some((p) => p.id === e.id))]);
      return;
    }
    /* If viewing as one of the people about to disappear, step back to the
     * seed admin first, or `currentUser` resolves to nothing and the console
     * drops to sign-in mid-toggle. */
    if (extraUsers.some((e) => e.id === session?.userId)) signIn(COMPANY_SEED.users[0]);
    setLocations((prev) => prev.filter((l) => l.id !== extraLoc.id));
    setCrewPins((prev) => prev.filter((p) => p.locationId !== extraLoc.id));
    setUsers((prev) =>
      prev
        .filter((u) => !extraUsers.some((e) => e.id === u.id))
        /* Anyone assigned to the removed location keeps their others;
         * somebody left with none falls back to the first, since a teammate
         * belonging nowhere is worse than a wrong guess. */
        .map((u) => {
          if (!u.locationIds.includes(extraLoc.id)) return u;
          const rest = u.locationIds.filter((id) => id !== extraLoc.id);
          return { ...u, locationIds: rest.length ? rest : [COMPANY_SEED.locations[0].id] };
        })
    );
  };

  const [view, setView] = useState("insights");
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [brandMenuOpen, setBrandMenuOpen] = useState(false);
  const { open: brandModalsOpen, openModal: openBrandModal, closeModal: closeBrandModal } = useBrandModals(setBrandMenuOpen);

  const currentUser = session ? users.find((u) => u.id === session.userId) : null;

  // Insights is scoped by role: an admin sees every location, a manager only
  // the location(s) on their own account.
  const visibleLocations = useMemo(() => {
    if (!currentUser) return [];
    if (currentUser.role === "admin") return locations;
    return locations.filter((l) => currentUser.locationIds?.includes(l.id));
  }, [locations, currentUser]);

  // A single-location business has nothing to be "company-wide across", so
  // every role just sees the one location's name.
  const insightsScopeLabel = !currentUser
    ? ""
    : locations.length === 1
    ? locations[0]?.name || ""
    : currentUser.role === "admin"
    ? `Company-wide across ${visibleLocations.length} location${visibleLocations.length === 1 ? "" : "s"}`
    : visibleLocations.length === 1
    ? visibleLocations[0].name
    : visibleLocations.length > 1
    ? `Across ${visibleLocations.length} of your locations`
    : "No location assigned yet";

  // Only stations with an admin-set target enter this map; the rest fall
  // back to the built-in defaults inside isOverTarget.
  const stationTargets = useMemo(
    () =>
      Object.fromEntries(
        stations
          .map((s) => [s, stationConfig[s]?.targetMinutes])
          .filter(([, v]) => v != null)
      ),
    [stations, stationConfig]
  );

  const insights = useMemo(
    () => buildCompanyInsights({ locations: visibleLocations, stations, production, targets: stationTargets }),
    [visibleLocations, stations, production, stationTargets]
  );
  const bundle = { company, locations, users, crewPins, integrations, insights };

  /* ---- Auth ---- */

  const handleSignIn = (user) => {
    signIn(user);
    toast(`Welcome back, ${user.name.split(" ")[0]}`);
  };

  const handleSwitchUser = (user) => {
    signIn(user);
    setUserMenuOpen(false);
    toast(`Switched to ${user.name.split(" ")[0]}`, { tone: "info" });
  };

  const handleCreateCompany = ({ companyName, name, email }) => {
    const admin = {
      id: newId("U"),
      name,
      email,
      role: "admin",
      locationIds: [],
      status: "active",
      invitedAt: new Date().toISOString(),
    };
    setCompany({ name: companyName, plan: "Enterprise", ownerEmail: email, createdAt: new Date().toISOString() });
    setLocations([]);
    setUsers([admin]);
    setIntegrations([]);
    setStations(COMPANY_SEED.stations);
    setCrewPins([]);
    setProduction({});
    signIn(admin);
    toast(`${companyName} is set up`, { detail: "Add your first location to get started." });
  };

  /* ---- Locations ---- */

  const handleAddLocation = (loc) => {
    setLocations((prev) => [...prev, loc]);
    toast(`${loc.name} added`);
  };

  const handleUpdateLocation = (id, patch) => {
    setLocations((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
    toast("Location updated");
  };

  const handleRemoveLocation = (id) => {
    const assigned = users.some((u) => u.locationIds.includes(id));
    if (assigned) {
      toast("Can't remove this location", { tone: "error", detail: "Reassign or remove teammates from it first." });
      return;
    }
    setLocations((prev) => prev.filter((l) => l.id !== id));
    setIntegrations((prev) => prev.filter((i) => i.locationId !== id));
    setCrewPins((prev) => prev.filter((p) => p.locationId !== id));
    setProduction((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    toast("Location removed", { tone: "info" });
  };

  /* ---- Team ---- */

  const handleInviteUser = (user) => {
    setUsers((prev) => [...prev, user]);
    toast(`Invite sent to ${user.email}`, { detail: "They'll appear as active once they accept — simulated here." });
  };

  const handleUpdateUser = (id, patch) => {
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...patch } : u)));
    toast("Team member updated");
  };

  const handleRemoveUser = (id) => {
    setUsers((prev) => prev.filter((u) => u.id !== id));
    toast("Team member removed", { tone: "info" });
  };

  /* Re-stamping invitedAt keeps the row's "sent 12d ago" line honest. */
  const handleResendInvite = (user) => {
    setUsers((prev) =>
      prev.map((u) => (u.id === user.id ? { ...u, invitedAt: new Date().toISOString() } : u))
    );
    toast(`Invite resent to ${user.email}`, { detail: "Simulated here — no mail actually leaves." });
  };

  /* ---- Stations ---- */

  const handleAddStation = (name) => {
    if (!isValidStationName(name)) return;
    setStations((prev) => [...prev, name]);
    toast(`${name} added`, { detail: "Set a target cycle time to start flagging slow runs." });
  };

  const handleRenameStation = (oldName, newName) => {
    if (!isValidStationName(newName)) return;
    setStations((prev) => prev.map((s) => (s === oldName ? newName : s)));
    setCrewPins((prev) => prev.map((p) => (p.station === oldName ? { ...p, station: newName } : p)));
    /* A batch's stage is the station's name, so a rename must carry the
     * batches standing there with it. This is the console's only write to
     * floor batch state. */
    if (oldName !== newName) {
      setBatches((prev) => prev.map((b) => (b.stage === oldName ? { ...b, stage: newName } : b)));
    }
    setStationConfig((prev) => {
      if (!prev[oldName] || oldName === newName) return prev;
      const { [oldName]: moved, ...rest } = prev;
      return { ...rest, [newName]: moved };
    });
    toast("Station renamed");
  };

  const handleRemoveStation = (name) => {
    /* A station with closed batches behind it is part of the record, and the
     * board reads this list as its stage sequence. */
    const runs = Object.values(production).flat().filter((h) => h?.minutes && name in h.minutes).length;
    if (runs > 0) {
      toast("Can't remove this station", {
        tone: "error",
        detail: `${runs} closed batch${runs === 1 ? "" : "es"} ran through it.`,
      });
      return;
    }
    /* Live half of the same check: a batch's stage is this station's name,
     * so deleting it out from under one strands that batch on the board. */
    const standing = batches.filter((b) => b.stage === name && !b.destination).length;
    if (standing > 0) {
      toast("Can't remove this station", {
        tone: "error",
        detail: `${standing} batch${standing === 1 ? " is" : "es are"} standing here right now.`,
      });
      return;
    }
    setStations((prev) => prev.filter((s) => s !== name));
    setStationConfig((prev) => {
      if (!(name in prev)) return prev;
      const rest = { ...prev };
      delete rest[name];
      return rest;
    });
    toast("Station removed", { tone: "info" });
  };

  const handleUpdateStationConfig = (name, patch) => {
    setStationConfig((prev) => ({ ...prev, [name]: { ...prev[name], ...patch } }));
  };

  /* Order matters: the Production board reads this list as the floor's stage
   * sequence, so the last station is where a batch gets its final weight
   * (see app/lib/stations.jsx). No toast; the reordered list is its own
   * feedback.
   *
   * `to` is the gap the row was dropped into (0..length), corrected by one
   * when moving down because removing the row first shifts later indexes. */
  const handleReorderStations = (from, to) => {
    setStations((prev) => {
      if (from < 0 || from >= prev.length) return prev;
      const target = to > from ? to - 1 : to;
      if (target === from) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(target, 0, moved);
      return next;
    });
  };

  const handleMoveStation = (name, direction) => {
    setStations((prev) => {
      const idx = prev.indexOf(name);
      const target = idx + direction;
      if (idx === -1 || target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  };

  /* ---- PINs — the approval PINs Permissions gates actions behind ---- */

  /**
   * A PIN lives on the person's record; `null` clears it. Separate from
   * handleUpdateUser so the toast can say what actually happened. The toast
   * deliberately does not repeat the digits: the dialog showed them once,
   * and a toast outlives the modal, including on a screenshare.
   */
  const handleSetUserPin = (user, pin) => {
    setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, pin: pin || null } : u)));
    if (pin) toast(`PIN issued to ${user.name}`, { detail: "Hand it over now — it isn't shown again." });
    else toast(`PIN cleared for ${user.name}`, { tone: "info" });
  };

  /* ---- Permissions ---- */

  const handleTogglePermission = (actionId) => {
    setPermissions((prev) => {
      const next = { ...prev, [actionId]: !prev[actionId] };
      toast(next[actionId] ? "Now requires a Lead PIN" : "Now open to any station PIN", { tone: "info" });
      return next;
    });
  };

  const handleRequestPermission = () => {
    toast("Request received — sort of", { detail: "This is a placeholder for now; the real request flow comes with the full build." });
  };

  const handleRemoveCustomAction = (id) => {
    setCustomActions((prev) => prev.filter((a) => a.id !== id));
    setPermissions((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    toast("Custom permission removed", { tone: "info" });
  };

  /* ---- Settings, Feedback & Plan (all modals, opened from the brand-title dropdown) ---- */

  const handleUpdateCompany = (patch) => {
    setCompany((prev) => ({ ...prev, ...patch }));
    toast("Business details updated");
  };

  const handleChangePlan = (planName) => {
    setCompany((prev) => ({ ...prev, plan: planName }));
    toast(`Switched to the ${planName} plan`, { detail: "This is a demo — nothing was actually billed." });
  };

  /* ---- Integrations ---- */

  /* A location with real-time sync on gets an occasional simulated webhook.
   * No toast: a background event is not something the admin asked for. */
  useEffect(() => {
    const interval = setInterval(() => {
      setIntegrations((prev) => {
        let changed = false;
        const next = prev.map((i) => {
          if (i.status !== "connected" || !i.webhookActive || Math.random() > 0.65) return i;
          changed = true;
          const itemCount = 1 + Math.floor(Math.random() * 4);
          const now = new Date().toISOString();
          const entry = {
            id: newId("H"),
            at: now,
            type: "webhook-received",
            message: `Webhook received — ${itemCount} item${itemCount === 1 ? "" : "s"} updated.`,
            itemCount,
          };
          // A trickle of API calls, not a full sync's worth.
          const callLimit = i.apiCallLimit ?? 5000;
          const callsUsed = Math.min(callLimit, (i.apiCallsUsed || 0) + 1 + Math.floor(Math.random() * 3));
          return {
            ...i,
            lastSynced: now,
            lastWebhookAt: now,
            lastResult: "ok",
            lastError: null,
            apiCallsUsed: callsUsed,
            apiCallLimit: callLimit,
            history: [entry, ...(i.history || [])].slice(0, 10),
          };
        });
        return changed ? next : prev;
      });
    }, 25000);
    return () => clearInterval(interval);
  }, [setIntegrations]);

  const handleConnectIntegration = (locationId, provider, fields) => {
    const providerName = PROVIDERS.find((p) => p.id === provider)?.name || provider;
    setIntegrations((prev) => {
      const existing = prev.find((i) => i.locationId === locationId && i.provider === provider);
      const now = new Date().toISOString();
      const entry = { id: newId("H"), at: now, type: "connected", message: `Connected to ${providerName}.`, itemCount: null };
      const record = {
        id: existing?.id || newId("INT"),
        locationId,
        provider,
        status: "connected",
        lastSynced: now,
        lastResult: "ok",
        lastError: null,
        webhookActive: true,
        lastWebhookAt: null,
        // Reconnecting keeps the meter: a new API key doesn't reset what
        // Clover has counted against the account this period.
        apiCallsUsed: existing?.apiCallsUsed ?? 0,
        apiCallLimit: existing?.apiCallLimit ?? 5000,
        history: [entry, ...(existing?.history || [])].slice(0, 10),
        ...fields,
      };
      return existing
        ? prev.map((i) => (i.id === existing.id ? record : i))
        : [...prev, record];
    });
    toast("Connected", { detail: "Inventory will sync automatically from here on." });
  };

  const handleDisconnectIntegration = (id) => {
    setIntegrations((prev) =>
      prev.map((i) => {
        if (i.id !== id) return i;
        const entry = { id: newId("H"), at: new Date().toISOString(), type: "disconnected", message: "Disconnected.", itemCount: null };
        /* The API key goes, the merchant ID stays: the key is a live
         * credential, the merchant ID only names which Clover account this
         * location points at and is a pain to dig up again to reconnect. */
        return {
          ...i,
          status: "disconnected",
          apiKey: "",
          webhookActive: false,
          lastResult: null,
          lastError: null,
          history: [entry, ...(i.history || [])].slice(0, 10),
        };
      })
    );
    toast("Disconnected", { tone: "info" });
  };

  /* Runs a (simulated) real pull and logs the outcome, so the detail view
   * has an actual history to show. */
  const handleSyncIntegration = (id) => {
    const outcome = simulateSync();
    const now = new Date().toISOString();
    const entry = {
      id: newId("H"),
      at: now,
      type: outcome.ok ? "sync-ok" : "sync-error",
      message: outcome.message,
      itemCount: outcome.itemCount,
    };
    setIntegrations((prev) =>
      prev.map((i) => {
        if (i.id !== id) return i;
        const callLimit = i.apiCallLimit ?? 5000;
        return {
          ...i,
          lastSynced: now,
          lastResult: outcome.ok ? "ok" : "error",
          lastError: outcome.ok ? null : outcome.message,
          apiCallsUsed: Math.min(callLimit, (i.apiCallsUsed || 0) + outcome.callsUsed),
          apiCallLimit: callLimit,
          history: [entry, ...(i.history || [])].slice(0, 10),
        };
      })
    );
    toast(outcome.ok ? "Sync complete" : "Sync failed", {
      tone: outcome.ok ? "success" : "error",
      detail: outcome.message,
    });
  };

  const handleToggleWebhook = (id, active) => {
    setIntegrations((prev) => prev.map((i) => (i.id === id ? { ...i, webhookActive: active } : i)));
    toast(active ? "Real-time sync turned on" : "Real-time sync turned off", { tone: active ? "success" : "info" });
  };

  /* ---- Production planning & tasks (shared with the floor terminal) ---- */

  /* Writes to the real inventory record, which the floor app reads too. The
   * min-batch clamp lives in `setStockRange` in the shared domain so both
   * writers enforce the same invariant. */
  const handleSetStockRange = (product, { threshold, max, minBatch }) => {
    setInventory((prev) =>
      prev.map((i) => (i.product === product ? setStockRange(i, { threshold, max, minBatch }) : i)),
    );
    toast(
      `${product} set to min ${Math.round(threshold)} · max ${Math.round(max)}`,
      minBatch != null
        ? { detail: `Smallest batch worth running: ${Math.round(minBatch)} lb` }
        : undefined,
    );
  };

  /* `unit` must be the product's real unit: the floor's board checks units
   * and will not count a plan written in the wrong one toward its target. */
  const handleAddScheduleTask = (day, station, product, qty, unit = "lb") => {
    setSchedule((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        [station]: [...((prev[day] && prev[day][station]) || []), makeScheduleEntry({ product, qty, unit })],
      },
    }));
    toast(`${product} planned`, { detail: `${station} · ${qty} ${unit}` });
    /* Deliberately never touches `batches`: the console decides what should
     * run, the floor decides that it is now running. */
  };

  /* Bulk form of handleAddScheduleTask: one state update and one toast
   * instead of N. */
  const handleAddScheduleTasks = (entries) => {
    if (!entries || entries.length === 0) return;
    setSchedule((prev) => {
      const next = { ...prev };
      for (const { day, station, product, qty, unit } of entries) {
        const dayBucket = { ...(next[day] || {}) };
        dayBucket[station] = [...(dayBucket[station] || []), makeScheduleEntry({ product, qty, unit })];
        next[day] = dayBucket;
      }
      return next;
    });
    const totalQty = entries.reduce((n, e) => n + (Number(e.qty) || 0), 0);
    toast(
      entries.length === 1 ? `${entries[0].product} planned` : `${entries.length} products planned`,
      { detail: `${entries[0].station} · ${Math.round(totalQty)} ${entries[0].unit || "lb"} total` },
    );
  };

  const handleCreateTaskItem = (task, staff) => {
    setTasks((prev) => [
      { id: newId("TD"), completed: false, createdBy: staff.name, createdAt: new Date().toISOString(), ...task },
      ...prev,
    ]);
    toast(`"${task.title}" added to the list`, {
      detail: task.assignedTo ? "Assigned to one person." : "Open to anyone on shift.",
    });
  };

  const handleToggleTaskItem = (id, staff) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        const completed = !t.completed;
        return { ...t, completed, completedBy: completed ? staff.name : null, completedAt: completed ? new Date().toISOString() : null };
      })
    );
  };

  const handleEditTaskItem = (id, fields) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...fields } : t)));
    toast(`"${fields.title}" updated`);
  };

  const handleRemoveTaskItem = (id) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  /* Targets' stocking action. A move from the back is floor work for today
   * with no station or lead time, so it goes to the task list, not the
   * schedule. `pull` names how much comes from the made pile vs the freezer,
   * as both a sentence and structured `parts`. `product` and `qty` are real
   * fields because Targets reads open stocking tasks back through them to
   * avoid re-offering a move somebody already took. */
  const handleAddStockingTask = (product, qty, unit, urgent, pull) => {
    setTasks((prev) => [
      {
        id: newId("TD"),
        title: `Restock ${qty} ${unit} of ${product} on the floor`,
        category: "stocking",
        priority: urgent ? "urgent" : "high",
        assignedTo: null,
        dueDate: today,
        product,
        qty,
        /* A pull part carries a quantity but not its unit; the floor needs
         * this to render the route without guessing "lb". */
        unit,
        pullFrom: pull?.parts || [],
        note: pull?.sentence
          ? `Pull ${pull.sentence} — no run needed, it is already made.`
          : `${qty} ${unit} already in the back — put it out, no run needed.`,
        createdBy: currentUser?.name || "Console",
        createdAt: new Date().toISOString(),
        completed: false,
      },
      ...prev,
    ]);
    toast(`Restock ${product} added to the task list`, {
      detail: pull?.sentence ? `Pull ${pull.sentence}.` : "Open to anyone on shift today.",
    });
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
      toast(`Can't remove "${category?.label}"`, { tone: "error", detail: "Recategorize its tasks first." });
      return;
    }
    setTaskCategories((prev) => prev.filter((c) => c.id !== id));
    toast(`"${category?.label}" removed`);
  };

  /* ---- Render ---- */

  if (!session || !currentUser) {
    return <CompanyAuthScreen users={users} onSignIn={handleSignIn} onCreateCompany={handleCreateCompany} />;
  }

  const isAdmin = currentUser.role === "admin";
  // Exclusive, not a ladder: an admin doesn't get the manager's Operations
  // screens by outranking one. See navFor() in lib/nav.js.
  const isManager = currentUser.role === "manager";
  const nav = navFor({ isAdmin, isManager });
  const current = nav.some((n) => n.id === view) ? view : "insights";

  return (
    <StationsProvider stations={stations} config={stationConfig}>
    <ConsoleShell
      company={company}
      currentUser={currentUser}
      nav={nav}
      view={current}
      onNavigate={setView}
      onSignOut={signOut}
      bundle={bundle}
      userMenuOpen={userMenuOpen}
      onUserMenuOpenChange={setUserMenuOpen}
      onSwitchUser={handleSwitchUser}
      twoLocations={twoLocations}
      onToggleLocations={handleToggleLocations}
      brandMenuOpen={brandMenuOpen}
      onBrandMenuOpenChange={setBrandMenuOpen}
      onOpenSettings={() => openBrandModal("settings")}
      onOpenFeedback={() => openBrandModal("feedback")}
      onOpenPricing={() => openBrandModal("pricing")}
    >
      {current === "insights" && (
        <InsightsScreen
          scopeLabel={insightsScopeLabel}
          insights={insights}
          targets={stationTargets}
          history={visibleLocations.flatMap((l) =>
            (production[l.id] || []).map((h) => ({ ...h, locationId: l.id, locationName: l.name }))
          )}
        />
      )}

      {current === "locations" && isAdmin && (
        <LocationsScreen
          locations={locations}
          users={users}
          production={production}
          stationTargets={stationTargets}
          canManage={isAdmin}
          onAdd={handleAddLocation}
          onUpdate={handleUpdateLocation}
          onRemove={handleRemoveLocation}
          integrations={integrations}
          onConnect={handleConnectIntegration}
          onDisconnect={handleDisconnectIntegration}
          onSync={handleSyncIntegration}
          onToggleWebhook={handleToggleWebhook}
        />
      )}

      {current === "production" && isManager && (
        <ProductionScreen
          schedule={schedule}
          inventory={inventory}
          batches={batches}
          today={today}
          stations={stations}
          onSetRange={handleSetStockRange}
          onAddTask={handleAddScheduleTask}
          onAddTasks={handleAddScheduleTasks}
          tasks={tasks}
          onAddStocking={handleAddStockingTask}
        />
      )}

      {current === "inventory" && isManager && (
        <InventoryScreen scopeLabel={insightsScopeLabel} inventory={inventory} />
      )}

      {current === "tasks" && isManager && (
        <FloorTasksScreen
          tasks={tasks}
          categories={taskCategories}
          user={{ ...currentUser, role: "manager" }}
          onAdd={handleCreateTaskItem}
          onToggle={(id) => handleToggleTaskItem(id, currentUser)}
          onEdit={handleEditTaskItem}
          onRemove={handleRemoveTaskItem}
          onAddCategory={handleAddTaskCategory}
          onRenameCategory={handleRenameTaskCategory}
          onRemoveCategory={handleRemoveTaskCategory}
        />
      )}

      {current === "team" && isAdmin && (
        <TeamScreen
          users={users}
          locations={locations}
          currentUser={currentUser}
          onInvite={handleInviteUser}
          onUpdate={handleUpdateUser}
          onRemove={handleRemoveUser}
          onResend={handleResendInvite}
          onSetPin={handleSetUserPin}
        />
      )}

      {current === "stations" && isAdmin && (
        <StationsScreen
          stations={stations}
          batches={batches}
          production={production}
          stationConfig={stationConfig}
          onAdd={handleAddStation}
          onUpdate={handleRenameStation}
          onRemove={handleRemoveStation}
          onMove={handleMoveStation}
          onReorder={handleReorderStations}
          onUpdateConfig={handleUpdateStationConfig}
        />
      )}

      {current === "permissions" && isAdmin && (
        <PermissionsScreen
          permissions={permissions}
          onToggle={handleTogglePermission}
          customActions={customActions}
          onRemoveCustom={handleRemoveCustomAction}
          onRequest={handleRequestPermission}
          users={users}
        />
      )}

    </ConsoleShell>

    <BrandModals
      open={brandModalsOpen}
      onClose={closeBrandModal}
      company={company}
      canManage={isAdmin}
      onUpdateCompany={handleUpdateCompany}
      onChangePlan={handleChangePlan}
    />
    </StationsProvider>
  );
}

export default function CompanyConsole() {
  return (
    <ToastProvider>
      <Application />
    </ToastProvider>
  );
}
