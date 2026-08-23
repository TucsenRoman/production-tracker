"use client";

import React from "react";
import {
  ArrowRight,
  CheckCircle2,
  KeyRound,
  MapPin,
  Sparkles,
  Store,
  UserPlus,
  Users,
} from "lucide-react";

import { Badge, Button, Card, StatCard, StatGrid } from "../../components/ui";
import { PROVIDERS, ROLE_LABEL } from "../lib/companyDomain";

function ChecklistItem({ done, title, detail, action }) {
  return (
    <div className="flex items-start gap-3 px-4 sm:px-5 py-3.5 border-b border-line last:border-b-0">
      <span
        className={
          done
            ? "flex items-center justify-center w-6 h-6 rounded-full bg-ok-soft text-ok shrink-0 mt-0.5"
            : "flex items-center justify-center w-6 h-6 rounded-full border-2 border-line-strong text-transparent shrink-0 mt-0.5"
        }
      >
        <CheckCircle2 size={14} />
      </span>
      <div className="min-w-0 flex-1">
        <p className={done ? "text-sm font-medium text-ink-3 line-through" : "text-sm font-medium text-ink"}>
          {title}
        </p>
        <p className="mt-0.5 text-xs text-ink-3">{detail}</p>
      </div>
      {!done && action}
    </div>
  );
}

export default function OverviewScreen({ company, locations, users, integrations, onNavigate }) {
  const activeUsers = users.filter((u) => u.status === "active");
  const invitedUsers = users.filter((u) => u.status === "invited");
  const connected = integrations.filter((i) => i.status === "connected");

  const hasLocation = locations.length > 0;
  const hasTeammate = activeUsers.length > 1 || invitedUsers.length > 0;
  const hasIntegration = connected.length > 0;
  const allDone = hasLocation && hasTeammate && hasIntegration;

  return (
    <div className="space-y-5">
      <StatGrid>
        <StatCard icon={Store} label="Locations" value={locations.length} />
        <StatCard icon={Users} label="Team members" value={activeUsers.length} hint={invitedUsers.length ? `${invitedUsers.length} invited` : undefined} />
        <StatCard
          icon={KeyRound}
          label="Integrations"
          value={`${connected.length}/${locations.length || 0}`}
          tone={connected.length === locations.length && locations.length > 0 ? "ok" : "neutral"}
          hint="locations connected"
        />
        <StatCard icon={Sparkles} label="Plan" value={company.plan} tone="primary" />
      </StatGrid>

      {!allDone && (
        <Card>
          <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5 border-b border-line">
            <div>
              <h3 className="text-sm font-semibold text-ink">Get your account set up</h3>
              <p className="mt-0.5 text-xs text-ink-3">A few steps to get {company.name} fully running.</p>
            </div>
          </div>
          <ChecklistItem
            done={hasLocation}
            title="Add your first location"
            detail={hasLocation ? `${locations.length} location${locations.length === 1 ? "" : "s"} added` : "Every location gets its own staff and inventory."}
            action={
              <Button size="sm" icon={MapPin} onClick={() => onNavigate("locations")}>
                Add
              </Button>
            }
          />
          <ChecklistItem
            done={hasTeammate}
            title="Invite your team"
            detail={hasTeammate ? "Teammates invited" : "Bring in managers and admins to help run things."}
            action={
              <Button size="sm" icon={UserPlus} onClick={() => onNavigate("team")}>
                Invite
              </Button>
            }
          />
          <ChecklistItem
            done={hasIntegration}
            title="Connect a POS"
            detail={hasIntegration ? "Clover connected" : "Sync inventory automatically from Clover."}
            action={
              <Button size="sm" icon={KeyRound} onClick={() => onNavigate("integrations")}>
                Connect
              </Button>
            }
          />
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5 border-b border-line">
            <h3 className="text-sm font-semibold text-ink">Locations</h3>
            <button
              onClick={() => onNavigate("locations")}
              className="inline-flex items-center gap-1 text-xs font-medium text-primary-ink hover:underline"
            >
              View all <ArrowRight size={12} />
            </button>
          </div>
          {locations.length === 0 ? (
            <p className="px-4 sm:px-5 py-6 text-center text-xs text-ink-4">No locations yet.</p>
          ) : (
            <div className="divide-y divide-line">
              {locations.slice(0, 4).map((loc) => {
                const staffHere = users.filter((u) => u.locationIds.includes(loc.id) && u.status === "active").length;
                return (
                  <div key={loc.id} className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink truncate">{loc.name}</p>
                      <p className="text-xs text-ink-3 truncate">{loc.address}</p>
                    </div>
                    <Badge tone="neutral">{staffHere} on team</Badge>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card>
          <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5 border-b border-line">
            <h3 className="text-sm font-semibold text-ink">Integrations</h3>
            <button
              onClick={() => onNavigate("integrations")}
              className="inline-flex items-center gap-1 text-xs font-medium text-primary-ink hover:underline"
            >
              Manage <ArrowRight size={12} />
            </button>
          </div>
          <div className="divide-y divide-line">
            {PROVIDERS.map((p) => {
              const count = integrations.filter((i) => i.provider === p.id && i.status === "connected").length;
              return (
                <div key={p.id} className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <p.icon size={15} className="text-ink-3 shrink-0" />
                    <span className="text-sm text-ink truncate">{p.name}</span>
                    {!p.available && (
                      <Badge tone="neutral" className="shrink-0">
                        Coming soon
                      </Badge>
                    )}
                  </div>
                  {p.available && (
                    <Badge tone={count > 0 ? "ok" : "neutral"} className="shrink-0">
                      {count > 0 ? `${count} connected` : "Not connected"}
                    </Badge>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <Card>
        <div className="px-4 sm:px-5 py-3.5 border-b border-line">
          <h3 className="text-sm font-semibold text-ink">Team</h3>
        </div>
        <div className="divide-y divide-line">
          {users.slice(0, 5).map((u) => (
            <div key={u.id} className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="flex items-center justify-center w-7 h-7 rounded-full bg-primary-soft text-primary-ink text-[11px] font-semibold shrink-0">
                  {u.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                </span>
                <div className="min-w-0">
                  <p className="text-sm text-ink truncate">{u.name}</p>
                  <p className="text-xs text-ink-3 truncate">{u.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {u.status === "invited" && <Badge tone="warn">Invited</Badge>}
                <Badge tone="neutral">{ROLE_LABEL[u.role]}</Badge>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
