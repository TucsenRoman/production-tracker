"use client";

import React, { useMemo, useState } from "react";
import {
  CalendarDays,
  ClipboardList,
  Factory,
  KeyRound,
  LayoutGrid,
  MapPin,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";

import { Badge, Input, ToastProvider, cx, useToast } from "../components/ui";
import AppShell from "../components/AppShell";
import { newId } from "../lib/domain";
import { StaffProvider } from "../lib/staff";
import CompanyAuthScreen from "./screens/CompanyAuthScreen";
import OverviewScreen from "./screens/OverviewScreen";
import LocationsScreen from "./screens/LocationsScreen";
import TeamScreen from "./screens/TeamScreen";
import StationsScreen from "./screens/StationsScreen";
import IntegrationsScreen from "./screens/IntegrationsScreen";
import PermissionsScreen from "./screens/PermissionsScreen";
import SettingsScreen from "./screens/SettingsScreen";
import ProductionScreen from "./screens/ProductionScreen";
import FloorTasksScreen from "../screens/TasksScreen";
import { usePersistentState, useCompanySession } from "./lib/companyStore";
import { usePersistentState as useFloorPersistentState } from "../lib/store";
import { COMPANY_SEED, ROLE_LABEL, DEFAULT_STATIONS, defaultPermissions, isValidStationName } from "./lib/companyDomain";
import { PRODUCTION_SEED } from "./lib/companyProduction";
import { SEED, DEFAULT_TASK_CATEGORIES, todayKey, categoryInUse } from "../lib/domain";
import { answerCompanyQuestion, buildCompanyInsights } from "./lib/insights";

const NAV = [
  { id: "overview", label: "Overview", short: "Overview", icon: LayoutGrid },
  { id: "locations", label: "Locations", short: "Locations", icon: MapPin },
  { id: "production", label: "Production planning", short: "Production", icon: CalendarDays, managerOnly: true },
  { id: "tasks", label: "Tasks", short: "Tasks", icon: ClipboardList, managerOnly: true },
  { id: "team", label: "Team", short: "Team", icon: Users, adminOnly: true },
  { id: "stations", label: "Stations", short: "Stations", icon: Factory, adminOnly: true },
  { id: "permissions", label: "Permissions", short: "Access", icon: ShieldCheck, adminOnly: true },
  { id: "integrations", label: "Integrations", short: "Keys", icon: KeyRound, adminOnly: true },
  { id: "settings", label: "Settings", short: "Settings", icon: Settings, adminOnly: true },
];


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

/**
 * The console's "view as" — Dana signing in doesn't mean Dana is who cares
 * about today's task list or the smokehouse queue; a floor manager does.
 * Clicking the account block in the sidebar footer opens this instead of
 * making anyone remember a second password: pick a teammate, the session
 * (real, persisted — see useCompanySession) switches to them, same as if
 * they'd signed in themselves. A refresh keeps whoever you switched to,
 * exactly like actually signing in as them would.
 *
 * Pending invites (Jordan Reyes, "invited") aren't offered — there's no one
 * to "become" yet.
 */
function AccountSwitcherMenu({ users, locations, currentUser, onSwitch }) {
  const locationName = (id) => locations.find((l) => l.id === id)?.name;
  const scopeFor = (u) =>
    u.locationIds?.length === 1 ? locationName(u.locationIds[0]) : "All locations";

  return (
    <div className="w-64 bg-surface border border-line rounded-xl shadow-pop overflow-hidden animate-pop-in">
      <div className="px-3 py-2 border-b border-line">
        <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-ink-4">Switch account</p>
        <p className="mt-0.5 text-xs text-ink-3 truncate">See the console the way they do.</p>
      </div>

      <div className="p-1 max-h-72 overflow-y-auto">
        {users.filter((u) => u.status === "active").map((u) => {
          const active = u.id === currentUser.id;
          return (
            <button
              key={u.id}
              type="button"
              onClick={() => onSwitch(u)}
              className={cx(
                "w-full flex items-center gap-2.5 text-left px-2.5 py-2 rounded-md transition-colors duration-100",
                active ? "bg-primary-soft" : "hover:bg-sunken"
              )}
            >
              <span className="flex items-center justify-center w-7 h-7 rounded-full bg-ink text-white text-[11px] font-semibold shrink-0">
                {u.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
              </span>
              <span className="min-w-0 flex-1">
                <span className={cx("block text-sm font-medium truncate", active ? "text-primary-ink" : "text-ink")}>
                  {u.name}
                  {active && <span className="ml-1.5 text-[11px] font-normal">· current</span>}
                </span>
                <span className="block mt-0.5 text-[11px] leading-snug text-ink-3 truncate">
                  {ROLE_LABEL[u.role]} · {scopeFor(u)}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <p className="px-3 py-2 border-t border-line text-[11px] leading-snug text-ink-4">
        Demo mode — switches your signed-in account, no password needed.
      </p>
    </div>
  );
}

function Shell({
  company,
  currentUser,
  nav,
  view,
  onNavigate,
  onSignOut,
  bundle,
  userMenuOpen,
  onUserMenuOpenChange,
  onSwitchUser,
  children,
}) {
  return (
    <AppShell
      brand={company.name}
      nav={nav}
      view={view}
      onNavigate={onNavigate}
      onSignOut={onSignOut}
      initials={currentUser.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
      userName={currentUser.name}
      userMeta={<p className="text-xs text-ink-3 truncate">{ROLE_LABEL[currentUser.role]}</p>}
      // sidebarExtra={<AskBar bundle={bundle} />}
      pageActions={<Badge tone="info">{ROLE_LABEL[currentUser.role]}</Badge>}
      userMenuOpen={userMenuOpen}
      onUserMenuOpenChange={onUserMenuOpenChange}
      userMenu={
        <AccountSwitcherMenu
          users={bundle.users}
          locations={bundle.locations}
          currentUser={currentUser}
          onSwitch={onSwitchUser}
        />
      }
    >
      {children}
    </AppShell>
  );
}

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
  const [inventory] = useFloorPersistentState("inventory", SEED.inventory);
  const today = todayKey();

  const [view, setView] = useState("overview");
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const currentUser = session ? users.find((u) => u.id === session.userId) : null;

  const insights = useMemo(
    () => buildCompanyInsights({ locations, stations, production }),
    [locations, stations, production]
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
    const owner = {
      id: newId("U"),
      name,
      email,
      role: "owner",
      locationIds: [],
      status: "active",
      invitedAt: new Date().toISOString(),
    };
    setCompany({ name: companyName, plan: "Enterprise", ownerEmail: email, createdAt: new Date().toISOString() });
    setLocations([]);
    setUsers([owner]);
    setIntegrations([]);
    setStations(DEFAULT_STATIONS);
    setCrewPins([]);
    setProduction({});
    signIn(owner);
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

  const handleRemoveCustomAction = (id) => {
    setCustomActions((prev) => prev.filter((a) => a.id !== id));
    setPermissions((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    toast("Custom permission removed", { tone: "info" });
  };

  /* ---- Settings ---- */

  const handleUpdateCompany = (patch) => {
    setCompany((prev) => ({ ...prev, ...patch }));
    toast("Business details updated");
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

  const isAdmin = currentUser.role === "owner" || currentUser.role === "admin";
  const isManagerTier = isAdmin || currentUser.role === "manager";
  const nav = NAV.filter((n) => (isAdmin || !n.adminOnly) && (isManagerTier || !n.managerOnly));
  const current = nav.some((n) => n.id === view) ? view : "overview";

  return (
    <Shell
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
    >
      {current === "overview" && (
        <OverviewScreen
          company={company}
          locations={locations}
          users={users}
          crewPins={crewPins}
          integrations={integrations}
          insights={insights}
          onNavigate={setView}
        />
      )}

      {current === "locations" && (
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
          today={today}
          onAddTask={handleAddScheduleTask}
          onRemoveTask={handleRemoveScheduleTask}
        />
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

      {current === "settings" && isAdmin && (
        <SettingsScreen company={company} canManage={isAdmin} onUpdate={handleUpdateCompany} />
      )}
    </Shell>
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
