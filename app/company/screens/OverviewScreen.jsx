"use client";

import React from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Fingerprint,
  KeyRound,
  Mail,
  MapPin,
  Store,
  UserPlus,
  Users,
} from "lucide-react";

import { Badge, Button, Card, StatCard, StatGrid } from "../../components/ui";
import { relativeTime } from "../../lib/domain";

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

function AttentionRow({ icon: Icon, text, action }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3">
      <span className="inline-flex items-center gap-2 min-w-0 text-sm text-ink-2">
        <Icon size={14} className="text-warn shrink-0" />
        <span className="truncate">{text}</span>
      </span>
      {action}
    </div>
  );
}

export default function OverviewScreen({ company, locations, users, crewPins, integrations, onNavigate }) {
  const activeUsers = users.filter((u) => u.status === "active");
  const invitedUsers = users.filter((u) => u.status === "invited");
  const connectedLocationIds = new Set(integrations.filter((i) => i.status === "connected").map((i) => i.locationId));

  const hasLocation = locations.length > 0;
  const hasTeammate = activeUsers.length > 1 || invitedUsers.length > 0;
  const hasIntegration = connectedLocationIds.size > 0;
  const onboarding = !(hasLocation && hasTeammate && hasIntegration);

  // Cross-cutting gaps — the thing an Overview should actually be for, rather
  // than a shorter copy of the Locations/Team/Integrations tabs. Lead PINs
  // don't count toward "floor ready" here — a location with no station codes
  // still can't actually track anything, even if a lead has a PIN.
  const noPosLocations = locations.filter((l) => !connectedLocationIds.has(l.id));
  const noPinLocations = locations.filter(
    (l) => !crewPins.some((p) => p.role === "station" && p.locationId === l.id)
  );
  const uncoveredLocations = locations.filter(
    (l) => !users.some((u) => u.status === "active" && u.locationIds.includes(l.id))
  );
  const staleInvites = invitedUsers.filter(
    (u) => Date.now() - new Date(u.invitedAt).getTime() > 7 * 86400000
  );

  const attentionCount = noPosLocations.length + noPinLocations.length + uncoveredLocations.length + staleInvites.length;

  return (
    <div className="space-y-5">
      <StatGrid>
        <StatCard icon={Store} label="Locations" value={locations.length} />
        <StatCard icon={Users} label="Team members" value={activeUsers.length} hint={invitedUsers.length ? `${invitedUsers.length} invited` : "no pending invites"} />
        <StatCard icon={Fingerprint} label="Floor PINs" value={crewPins.length} hint="issued company-wide" />
        <StatCard
          icon={KeyRound}
          label="POS connected"
          value={`${connectedLocationIds.size}/${locations.length || 0}`}
          tone={locations.length > 0 && connectedLocationIds.size === locations.length ? "ok" : "neutral"}
          hint="locations"
        />
      </StatGrid>

      {onboarding && (
        <Card>
          <div className="px-4 sm:px-5 py-3.5 border-b border-line">
            <h3 className="text-sm font-semibold text-ink">Get your account set up</h3>
            <p className="mt-0.5 text-xs text-ink-3">A few steps to get {company.name} fully running.</p>
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

      {!onboarding && (
        <Card>
          <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5 border-b border-line">
            <h3 className="text-sm font-semibold text-ink">Needs attention</h3>
            {attentionCount > 0 ? (
              <Badge tone="warn">{attentionCount}</Badge>
            ) : (
              <Badge tone="ok" icon={CheckCircle2}>
                All caught up
              </Badge>
            )}
          </div>
          {attentionCount === 0 ? (
            <p className="px-4 sm:px-5 py-6 text-center text-xs text-ink-4">
              Every location has coverage, a POS connection, and issued PINs.
            </p>
          ) : (
            <div className="divide-y divide-line">
              {uncoveredLocations.map((l) => (
                <AttentionRow
                  key={`cov-${l.id}`}
                  icon={Users}
                  text={`${l.name} has no admin or manager assigned`}
                  action={
                    <Button size="sm" onClick={() => onNavigate("team")}>
                      Assign
                    </Button>
                  }
                />
              ))}
              {noPosLocations.map((l) => (
                <AttentionRow
                  key={`pos-${l.id}`}
                  icon={KeyRound}
                  text={`${l.name} isn't connected to a POS`}
                  action={
                    <Button size="sm" onClick={() => onNavigate("integrations")}>
                      Connect
                    </Button>
                  }
                />
              ))}
              {noPinLocations.map((l) => (
                <AttentionRow
                  key={`pin-${l.id}`}
                  icon={Fingerprint}
                  text={`${l.name} has no station codes set up`}
                  action={
                    <Button size="sm" onClick={() => onNavigate("locations")}>
                      Set up
                    </Button>
                  }
                />
              ))}
              {staleInvites.map((u) => (
                <AttentionRow
                  key={`inv-${u.id}`}
                  icon={Mail}
                  text={`${u.name}'s invite has been pending ${relativeTime(u.invitedAt)}`}
                  action={
                    <Button size="sm" onClick={() => onNavigate("team")}>
                      Resend
                    </Button>
                  }
                />
              ))}
            </div>
          )}
        </Card>
      )}

      <Card>
        <div className="px-4 sm:px-5 py-3.5 border-b border-line">
          <h3 className="text-sm font-semibold text-ink">Locations at a glance</h3>
        </div>
        {locations.length === 0 ? (
          <p className="px-4 sm:px-5 py-6 text-center text-xs text-ink-4">No locations yet.</p>
        ) : (
          <div className="divide-y divide-line">
            {locations.map((loc) => {
              const team = users.filter((u) => u.locationIds.includes(loc.id) && u.status === "active").length;
              const pins = crewPins.filter((p) => p.role === "station" && p.locationId === loc.id).length;
              const connected = connectedLocationIds.has(loc.id);
              return (
                <div key={loc.id} className="flex items-center justify-between gap-3 flex-wrap px-4 sm:px-5 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink truncate">{loc.name}</p>
                    <p className="text-xs text-ink-3 truncate">{loc.address}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Badge tone="neutral" icon={Users}>
                      {team}
                    </Badge>
                    <Badge tone="neutral" icon={Fingerprint}>
                      {pins}
                    </Badge>
                    <Badge tone={connected ? "ok" : "warn"} icon={connected ? CheckCircle2 : AlertTriangle}>
                      {connected ? "POS" : "No POS"}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
