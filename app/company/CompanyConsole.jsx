"use client";

import React, { useState } from "react";
import { Building2, KeyRound, LayoutGrid, LogOut, MapPin, Users } from "lucide-react";

import { Badge, ToastProvider, cx, useToast } from "../components/ui";
import { newId } from "../lib/domain";
import CompanyAuthScreen from "./screens/CompanyAuthScreen";
import OverviewScreen from "./screens/OverviewScreen";
import LocationsScreen from "./screens/LocationsScreen";
import TeamScreen from "./screens/TeamScreen";
import IntegrationsScreen from "./screens/IntegrationsScreen";
import { usePersistentState, useCompanySession } from "./lib/companyStore";
import { COMPANY_SEED, ROLE_LABEL } from "./lib/companyDomain";

const NAV = [
  { id: "overview", label: "Overview", short: "Overview", icon: LayoutGrid },
  { id: "locations", label: "Locations", short: "Locations", icon: MapPin },
  { id: "team", label: "Team", short: "Team", icon: Users, adminOnly: true },
  { id: "integrations", label: "Integrations", short: "Keys", icon: KeyRound, adminOnly: true },
];

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
        <div className={cx("grid", nav.length === 4 ? "grid-cols-4" : "grid-cols-2")}>
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
  const nav = NAV.filter((n) => isAdmin || !n.adminOnly);
  const current = nav.some((n) => n.id === view) ? view : "overview";

  return (
    <Shell company={company} currentUser={currentUser} nav={nav} view={current} onNavigate={setView} onSignOut={signOut}>
      {current === "overview" && (
        <OverviewScreen company={company} locations={locations} users={users} integrations={integrations} onNavigate={setView} />
      )}

      {current === "locations" && (
        <LocationsScreen
          locations={locations}
          users={users}
          canManage={isAdmin}
          onAdd={handleAddLocation}
          onUpdate={handleUpdateLocation}
          onRemove={handleRemoveLocation}
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
