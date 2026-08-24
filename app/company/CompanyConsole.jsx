"use client";

import React, { useState } from "react";
import { Building2, Factory, KeyRound, LayoutGrid, LogOut, MapPin, ShieldCheck, Users } from "lucide-react";

import { Badge, ToastProvider, cx, useToast } from "../components/ui";
import { newId } from "../lib/domain";
import CompanyAuthScreen from "./screens/CompanyAuthScreen";
import OverviewScreen from "./screens/OverviewScreen";
import LocationsScreen from "./screens/LocationsScreen";
import TeamScreen from "./screens/TeamScreen";
import StationsScreen from "./screens/StationsScreen";
import IntegrationsScreen from "./screens/IntegrationsScreen";
import PermissionsScreen from "./screens/PermissionsScreen";
import { usePersistentState, useCompanySession } from "./lib/companyStore";
import { COMPANY_SEED, ROLE_LABEL, DEFAULT_STATIONS, defaultPermissions, isValidStationName } from "./lib/companyDomain";

const NAV = [
  { id: "overview", label: "Overview", short: "Overview", icon: LayoutGrid },
  { id: "locations", label: "Locations", short: "Locations", icon: MapPin },
  { id: "team", label: "Team", short: "Team", icon: Users, adminOnly: true },
  { id: "stations", label: "Stations", short: "Stations", icon: Factory, adminOnly: true },
  { id: "permissions", label: "Permissions", short: "Access", icon: ShieldCheck, adminOnly: true },
  { id: "integrations", label: "Integrations", short: "Keys", icon: KeyRound, adminOnly: true },
];

const GRID_COLS = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
  5: "grid-cols-5",
  6: "grid-cols-6",
  7: "grid-cols-7",
};

function Shell({ company, currentUser, nav, view, onNavigate, onSignOut, children }) {
  const active = nav.find((n) => n.id === view) || nav[0];

  return (
    <div className="min-h-screen bg-canvas">
      <aside className="hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:left-0 lg:w-60 lg:z-20 bg-surface border-r border-line">
        <div className="px-5 py-5 flex items-center gap-2">
          <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary-soft text-primary-ink shrink-0">
            <Building2 size={16} />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-ink font-display truncate leading-tight">{company.name}</p>
            <p className="text-[10px] uppercase tracking-wide text-brand">{company.plan}</p>
          </div>
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
              {currentUser.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink truncate leading-tight">{currentUser.name}</p>
              <p className="text-xs text-ink-3 truncate">{ROLE_LABEL[currentUser.role]}</p>
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

      <header className="lg:hidden sticky top-0 z-30 bg-canvas/90 backdrop-blur-sm border-b border-line pt-safe">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-brand leading-none mb-1.5">
              {company.name}
            </p>
            <h1 className="text-lg font-bold text-ink font-display leading-none truncate">{active.label}</h1>
          </div>
          <button
            onClick={onSignOut}
            className="flex items-center gap-2 pl-2 pr-2.5 py-1.5 rounded-full bg-surface border border-line shrink-0"
          >
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-white text-[10px] font-semibold">
              {currentUser.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
            </span>
            <LogOut size={13} className="text-ink-3" />
          </button>
        </div>
      </header>

      <main className="lg:pl-60">
        <div className="mx-auto w-full max-w-5xl px-4 pt-5 pb-28 sm:px-6 lg:px-10 lg:pt-8 lg:pb-14">
          <div className="hidden lg:flex items-center justify-between gap-4 mb-6">
            <h2 className="text-2xl font-bold text-ink font-display">{active.label}</h2>
            <Badge tone="info">{ROLE_LABEL[currentUser.role]}</Badge>
          </div>
          {children}
        </div>
      </main>

      <nav className="lg:hidden fixed inset-x-0 bottom-0 z-30 bg-surface border-t border-line pb-safe">
        <div className={cx("grid", GRID_COLS[nav.length] || "grid-cols-2")}>
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

function Application() {
  const toast = useToast();
  const { session, signIn, signOut } = useCompanySession();

  const [company, setCompany] = usePersistentState("company", COMPANY_SEED.company);
  const [locations, setLocations] = usePersistentState("locations", COMPANY_SEED.locations);
  const [users, setUsers] = usePersistentState("users", COMPANY_SEED.users);
  const [integrations, setIntegrations] = usePersistentState("integrations", COMPANY_SEED.integrations);
  const [stations, setStations] = usePersistentState("stations", COMPANY_SEED.stations);
  const [crewPins, setCrewPins] = usePersistentState("crewPins", COMPANY_SEED.crewPins);
  const [permissions, setPermissions] = usePersistentState("permissions", defaultPermissions());
  const [customActions, setCustomActions] = usePersistentState("customActions", []);

  const [view, setView] = useState("overview");

  const currentUser = session ? users.find((u) => u.id === session.userId) : null;

  /* ---- Auth ---- */

  const handleSignIn = (user) => {
    signIn(user);
    toast(`Welcome back, ${user.name.split(" ")[0]}`);
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

  /* ---- Render ---- */

  if (!session || !currentUser) {
    return <CompanyAuthScreen users={users} onSignIn={handleSignIn} onCreateCompany={handleCreateCompany} />;
  }

  const isAdmin = currentUser.role === "owner" || currentUser.role === "admin";
  const isManagerTier = isAdmin || currentUser.role === "manager";
  const nav = NAV.filter((n) => (isAdmin || !n.adminOnly) && (isManagerTier || !n.managerOnly));
  const current = nav.some((n) => n.id === view) ? view : "overview";

  return (
    <Shell company={company} currentUser={currentUser} nav={nav} view={current} onNavigate={setView} onSignOut={signOut}>
      {current === "overview" && (
        <OverviewScreen
          company={company}
          locations={locations}
          users={users}
          crewPins={crewPins}
          integrations={integrations}
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
    </Shell>
  );
}

export default function CompanyConsole() {
  return (
    <ToastProvider>
      <Application />
    </ToastProvider>
  );
}
