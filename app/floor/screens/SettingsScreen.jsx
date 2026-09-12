"use client";

/**
 * Everything about how THIS TERMINAL is wired up: which shop it is standing
 * in, whether Clover is answering, and who has approved what on it. On a
 * floor with no sign-in the approval log IS the audit trail.
 *
 * Styled to the floor task-list DNA: ruled sections, indented rows,
 * hairlines not cards, one primary action.
 */

import React, { useRef, useState } from "react";
import { CheckCircle2, CloudOff, MapPin, RefreshCw, ShieldCheck, Store } from "lucide-react";

import { Badge, Button, EmptyState, SectionHeading } from "../../components/ui";
import { relativeTime } from "../../lib/domain";

/** So a double-tap on the floor doesn't hammer Clover. */
const REFRESH_COOLDOWN_MS = 5000;

function CloverRow({ status, syncedAt, onRefresh }) {
  const [cooling, setCooling] = useState(false);
  const timerRef = useRef(null);

  const loading = status === "loading";
  const error = status === "error";
  const blocked = loading || cooling;

  const handleClick = () => {
    if (blocked) return;
    onRefresh();
    setCooling(true);
    timerRef.current = setTimeout(() => setCooling(false), REFRESH_COOLDOWN_MS);
  };

  React.useEffect(() => () => clearTimeout(timerRef.current), []);

  /* Status carries a colour because it is checked from a step away. Grey
   * while syncing: the spinner already says "working". */
  const tone = error ? "danger" : loading ? "neutral" : "ok";
  const statusText = error ? "Unreachable" : loading ? "Syncing…" : "Connected";

  return (
    <div className="flex items-start gap-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-sm text-ink leading-snug">
          Clover
          <Badge tone={tone} icon={error ? CloudOff : loading ? RefreshCw : CheckCircle2}>
            {statusText}
          </Badge>
        </p>
        <p className="mt-0.5 text-xs text-ink-3 leading-relaxed">
          {error
            ? "Stock counts on the Inventory screen are the last ones that arrived."
            : syncedAt
              ? `Last synced ${relativeTime(syncedAt)}. Clover only ever knows the floor count.`
              : "Clover only ever knows the floor count — made and freezer stock live here."}
        </p>
      </div>
      {/* The screen's one primary action. */}
      <Button
        variant="primary"
        icon={error ? CloudOff : RefreshCw}
        loading={loading}
        disabled={blocked}
        onClick={handleClick}
        className="shrink-0"
      >
        {error ? "Retry" : "Refresh"}
      </Button>
    </div>
  );
}

function ApprovalRow({ entry }) {
  return (
    <div className="py-2.5">
      <p className="text-sm text-ink leading-snug">
        {entry.actionLabel || entry.actionId}
        {entry.detail && <span className="text-ink-3"> · {entry.detail}</span>}
      </p>
      <p className="mt-0.5 flex items-center flex-wrap gap-x-3 gap-y-0.5 text-xs text-ink-3">
        <span className="font-medium text-ink-2">{entry.personName}</span>
        <span>{relativeTime(entry.at)}</span>
        {entry.locationName && <span className="text-ink-4">{entry.locationName}</span>}
      </p>
    </div>
  );
}

export default function SettingsScreen({
  place,
  locations = [],
  log = [],
  cloverStatus,
  syncedAt,
  onRefresh,
  onChangeShop,
}) {
  /* Capped at the most recent 40; the store keeps 200. */
  const recent = log.slice(0, 40);

  return (
    <div className="space-y-6">
      <section>
        <SectionHeading icon={Store} label="This shop" />
        <div className="pl-6">
          <div className="flex items-start gap-3 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="text-sm text-ink leading-snug">{place?.name || "No shop set"}</p>
              <p className="mt-0.5 text-xs text-ink-3 leading-relaxed">
                {place?.address ||
                  "This tablet has not been told which shop it is in."}
              </p>
            </div>
            {onChangeShop && (
              <Button variant="secondary" icon={MapPin} onClick={onChangeShop} className="shrink-0">
                Change
              </Button>
            )}
          </div>
          {/* Said plainly rather than hidden, because "why is there no button"
            * is otherwise a support call. */}
          {!onChangeShop && locations.length <= 1 && (
            <p className="pb-2.5 text-xs text-ink-4 leading-relaxed">
              There is only one shop on this account, so there is nothing to switch to.
            </p>
          )}
        </div>
      </section>

      <section>
        <SectionHeading icon={RefreshCw} label="Clover" />
        <div className="pl-6">
          <CloverRow status={cloverStatus} syncedAt={syncedAt} onRefresh={onRefresh} />
        </div>
      </section>

      <section>
        <SectionHeading icon={ShieldCheck} label="Approvals" count={log.length || undefined} />
        <div className="pl-6">
          {recent.length === 0 ? (
            <EmptyState
              icon={ShieldCheck}
              title="Nothing approved yet"
              description="When somebody puts a PIN in to close a batch or move stock, it is recorded here — who, what, and when."
            />
          ) : (
            <div className="divide-y divide-line">
              {recent.map((entry) => (
                <ApprovalRow key={entry.id} entry={entry} />
              ))}
            </div>
          )}
          {log.length > recent.length && (
            <p className="pt-2.5 text-xs text-ink-4">
              Showing the most recent {recent.length} of {log.length}.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
