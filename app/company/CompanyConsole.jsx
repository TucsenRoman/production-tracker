"use client";

import React, { useMemo, useState } from "react";

import { Input, ToastProvider, useToast } from "../components/ui";
import ConsoleShell from "./components/ConsoleShell";
import BrandModals from "./components/BrandModals";
import { newId } from "../lib/domain";
import { StaffProvider } from "../lib/staff";
import CompanyAuthScreen from "./screens/CompanyAuthScreen";
import InsightsScreen from "./screens/InsightsScreen";
import LocationsScreen from "./screens/LocationsScreen";
import TeamScreen from "./screens/TeamScreen";
import StationsScreen from "./screens/StationsScreen";
import IntegrationsScreen from "./screens/IntegrationsScreen";
import PermissionsScreen from "./screens/PermissionsScreen";
import ProductionScreen from "./screens/ProductionScreen";
import InventoryScreen from "./screens/InventoryScreen";
import FloorTasksScreen from "../screens/TasksScreen";
import { usePersistentState, useCompanySession } from "./lib/companyStore";
import { usePersistentState as useFloorPersistentState } from "../lib/store";
import { useBrandModals } from "./lib/useBrandModals";
import { COMPANY_SEED, DEFAULT_STATIONS, defaultPermissions, isValidStationName } from "./lib/companyDomain";
import { PRODUCTION_SEED } from "./lib/companyProduction";
import { SEED, DEFAULT_TASK_CATEGORIES, todayKey, categoryInUse } from "../lib/domain";
import { answerCompanyQuestion, buildCompanyInsights } from "./lib/insights";
import { navFor } from "./lib/nav";

// NAV now lives in ./lib/nav.js, shared with the standalone Help page
// that reuses this same rail — see that file's doc comment
// for why Settings isn't in it anymore.


/**
 * Slim, always-available search-bar version of "Ask about your business" —
 * same deterministic responder (answerCompanyQuestion), living inline in
 * the sidebar just under the collapse toggle instead of taking up a
 * whole section, so it's reachable from every screen without much chrome.
 * Enter submits; the latest answer shows as a compact caption underneath.
 * Desktop-only for now, same as the rest of this sidebar.
 *
 * The expand icon is a placeholder for a future dedicated full-page chat —
 * not wired up yet, just staking out where it'll live.
 */
// function AskBar({ bundle }) {
//   const [question, setQuestion] = useState("");
//   const [lastAnswer, setLastAnswer] = useState(null);

//   const ask = () => {
//     const q = question.trim();
//     if (!q) return;
//     setLastAnswer({ q, a: answerCompanyQuestion(bundle, q) });
//     setQuestion("");
//   };

//   return (
//     <div className="min-w-0 flex-1 flex flex-col gap-1">
//       <div className="flex items-center gap-1.5">
//         <Input
//           value={question}
//           placeholder="Ask about your business…" onChange={(e) => setQuestion(e.target.value)}
//           onKeyDown={(e) => e.key === "Enter" && ask()}
//           className="flex-1 min-w-0 h-[var(--ctl-h)] rounded-md text-xs focus-visible:outline-none"
//         />
//         {/* SquareArrowOutUpRight "open full chat" button hidden for now — coming with the dedicated chat page. */}
//       </div>
//       {lastAnswer && <p className="px-0.5 text-xs text-ink-3 leading-snug line-clamp-2">{lastAnswer.a}</p>}
//     </div>
//   );
// }

// AccountSwitcherMenu, BrandMenu, and the AppShell-wiring Shell component
// all moved to ./components/ConsoleShell.jsx (Sept 2026) so the standalone
// Settings and Feedback pages could reuse them too, instead of each
// duplicating the same AppShell wiring — see that file for the full
// doc comments preserved from here.

function Application() {
  const toast = useToast();
  const { session, signIn, signOut } = useCompanySession();

  const [company, setCompany] = usePersistentState("company", COMPANY_SEED.company);
  const [locations, setLocations] = usePersistentState("locations", COMPANY_SEED.locations);
  const [users, setUsers] = usePersistentState("users", COMPANY_SEED.users);
  const [integrations, setIntegrations] = usePersistentState("integrations", COMPANY_SEED.integrations);
  const [stations, setStations] = usePersistentState("stations", COMPANY_SEED.stations);
  const [crewPins, setCrewPins] = usePersistentState("crewPins", COMPANY_SEED.crewPins);
  const [production, setProduction] = usePersistentState("production", PRODUCTION_SEED);
  const [permissions, setPermissions] = usePersistentState("permissions", defaultPermissions());
  const [customActions, setCustomActions] = usePersistentState("customActions", []);

  // Shared with the floor terminal — same localStorage namespace (see
  // ../lib/store) — so a plan or task added from the console is waiting on
  // the shop-floor tablet too, and vice versa. Fast mockup against the
  // existing single-location demo data; not location-scoped yet.
  const [schedule, setSchedule] = useFloorPersistentState("schedule", SEED.schedule);
  const [tasks, setTasks] = useFloorPersistentState("tasks", SEED.tasks);
  const [taskCategories, setTaskCategories] = useFloorPersistentState("taskCategories", DEFAULT_TASK_CATEGORIES);
  const [inventory, setInventory] = useFloorPersistentState("inventory", SEED.inventory);
  /* Read-only here: the console tracks production, it doesn't run batches.
   * Both come from the floor's own persisted state so the goal tracker is
   * measuring the same batches the shop actually made. */
  const [batches] = useFloorPersistentState("batches", SEED.batches);
  const today = todayKey();

  const [view, setView] = useState("insights");
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [brandMenuOpen, setBrandMenuOpen] = useState(false);
  const { open: brandModalsOpen, openModal: openBrandModal, closeModal: closeBrandModal } = useBrandModals(setBrandMenuOpen);

  const currentUser = session ? users.find((u) => u.id === session.userId) : null;

  // Insights is scoped by role, not one fixed view: an admin sees every
  // location, a floor manager only the location(s) on their own account —
  // same restriction Locations/Team/etc. already apply, just carried into
  // the numbers here instead of gating a whole screen on/off.
  const visibleLocations = useMemo(() => {
    if (!currentUser) return [];
    if (currentUser.role === "admin") return locations;
    return locations.filter((l) => currentUser.locationIds?.includes(l.id));
  }, [locations, currentUser]);

  // A genuinely single-location business has nothing to be "company-wide
  // across" — every role just sees the one location's name. Multi-location
  // companies keep the role-based phrasing below.
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

  const insights = useMemo(
    () => buildCompanyInsights({ locations: visibleLocations, stations, production }),
    [visibleLocations, stations, production]
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
    setStations(DEFAULT_STATIONS);
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

  /* ---- Stations ---- */

  const handleAddStation = (name) => {
    if (!isValidStationName(name)) return;
    setStations((prev) => [...prev, name]);
    toast(`${name} added`, { detail: "It's ready to wire up from a location's detail view." });
  };

  const handleRenameStation = (oldName, newName) => {
    if (!isValidStationName(newName)) return;
    setStations((prev) => prev.map((s) => (s === oldName ? newName : s)));
    setCrewPins((prev) => prev.map((p) => (p.station === oldName ? { ...p, station: newName } : p)));
    toast("Station renamed");
  };

  const handleRemoveStation = (name) => {
    const inUse = crewPins.some((p) => p.station === name);
    if (inUse) {
      toast("Can't remove this station", { tone: "error", detail: "Reassign or remove its device codes first." });
      return;
    }
    setStations((prev) => prev.filter((s) => s !== name));
    toast("Station removed", { tone: "info" });
  };

  /* ---- Floor PINs (station device codes + lead PINs) ---- */

  const handleAddPin = (pin) => {
    setCrewPins((prev) => [...prev, pin]);
    if (pin.role === "lead") {
      const person = users.find((u) => u.id === pin.userId);
      toast(`Lead PIN issued to ${person ? person.name : "teammate"}`, {
        detail: `${pin.pin} — theirs to use for gated actions.`,
      });
    } else {
      toast(`Device code issued for ${pin.station}`, { detail: `${pin.pin} — hand it off and the tablet's ready.` });
    }
  };

  const handleUpdatePin = (id, patch) => {
    setCrewPins((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    toast("PIN updated");
  };

  const handleRemovePin = (id) => {
    setCrewPins((prev) => prev.filter((p) => p.id !== id));
    toast("PIN revoked", { tone: "info" });
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

  const handleManageAccess = (action) => {
    toast(`Editing who can ${action.label.toLowerCase()} — sort of`, {
      detail: "This is a mock of a per-person permissions control; the real picker comes with the full build.",
    });
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

  const handleConnectIntegration = (locationId, provider, fields) => {
    setIntegrations((prev) => {
      const existing = prev.find((i) => i.locationId === locationId && i.provider === provider);
      const record = {
        id: existing?.id || newId("INT"),
        locationId,
        provider,
        status: "connected",
        lastSynced: new Date().toISOString(),
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
      prev.map((i) => (i.id === id ? { ...i, status: "disconnected", apiKey: "", merchantId: "" } : i))
    );
    toast("Disconnected", { tone: "info" });
  };

  const handleTestIntegration = (id) => {
    setIntegrations((prev) => prev.map((i) => (i.id === id ? { ...i, lastSynced: new Date().toISOString() } : i)));
    toast("Connection verified", { detail: "Test sync completed successfully." });
  };

  /* ---- Production planning & tasks (shared with the floor terminal) ---- */

  /* Editing the band writes to the real inventory record, not to a private
   * overrides map — "the min for this product is 50" is a fact about the
   * product, and the floor app reads the same field. */
  const handleSetStockRange = (product, { threshold, max }) => {
    setInventory((prev) =>
      prev.map((i) =>
        i.product === product
          ? { ...i, threshold, max: Math.max(max, threshold) }
          : i,
      ),
    );
    toast(`${product} set to min ${Math.round(threshold)} · max ${Math.round(max)}`);
  };

  const handleAddScheduleTask = (day, station, product, qty) => {
    setSchedule((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        [station]: [...((prev[day] && prev[day][station]) || []), { id: newId("T"), text: product, qty, unit: "lb" }],
      },
    }));
    toast(`${product} planned`, { detail: `${station} · ${qty} lb` });
    // Deliberately never touches `batches` — unlike the floor terminal's own
    // handleAddTask, planning from the console never spawns a live batch,
    // even when today happens to be the selected day.
  };

  const handleRemoveScheduleTask = (day, station, id) => {
    setSchedule((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        [station]: ((prev[day] && prev[day][station]) || []).filter((t) => t.id !== id),
      },
    }));
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
  const isManagerTier = isAdmin || currentUser.role === "manager";
  const nav = navFor({ isAdmin, isManagerTier });
  const current = nav.some((n) => n.id === view) ? view : "insights";

  return (
    <>
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
          history={visibleLocations.flatMap((l) =>
            (production[l.id] || []).map((h) => ({ ...h, locationId: l.id, locationName: l.name }))
          )}
        />
      )}

      {current === "locations" && isAdmin && (
        <LocationsScreen
          locations={locations}
          users={users}
          stations={stations}
          crewPins={crewPins}
          canManage={isAdmin}
          canManagePins={isManagerTier}
          onAdd={handleAddLocation}
          onUpdate={handleUpdateLocation}
          onRemove={handleRemoveLocation}
          onAddPin={handleAddPin}
          onUpdatePin={handleUpdatePin}
          onRemovePin={handleRemovePin}
        />
      )}

      {current === "production" && isManagerTier && (
        <ProductionScreen
          schedule={schedule}
          inventory={inventory}
          batches={batches}
          today={today}
          onSetRange={handleSetStockRange}
          onAddTask={handleAddScheduleTask}
        />
      )}

      {current === "inventory" && isManagerTier && (
        <InventoryScreen scopeLabel={insightsScopeLabel} inventory={inventory} />
      )}

      {current === "tasks" && isManagerTier && (
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
          crewPins={crewPins}
          onInvite={handleInviteUser}
          onUpdate={handleUpdateUser}
          onRemove={handleRemoveUser}
          onAddPin={handleAddPin}
          onUpdatePin={handleUpdatePin}
          onRemovePin={handleRemovePin}
        />
      )}

      {current === "stations" && isAdmin && (
        <StationsScreen
          stations={stations}
          crewPins={crewPins}
          onAdd={handleAddStation}
          onUpdate={handleRenameStation}
          onRemove={handleRemoveStation}
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
          onManageAccess={handleManageAccess}
        />
      )}

      {current === "integrations" && isAdmin && (
        <IntegrationsScreen
          locations={locations}
          integrations={integrations}
          onConnect={handleConnectIntegration}
          onDisconnect={handleDisconnectIntegration}
          onTest={handleTestIntegration}
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
    </>
  );
}

export default function CompanyConsole() {
  return (
    <ToastProvider>
      <StaffProvider>
        <Application />
      </StaffProvider>
    </ToastProvider>
  );
}
