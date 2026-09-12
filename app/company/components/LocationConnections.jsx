"use client";

import React, { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  KeyRound,
  PlugZap,
  Radio,
  RefreshCw,
  Unplug,
  XCircle,
} from "lucide-react";

import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Modal,
  ProgressBar,
  SectionHeading,
  Switch,
  cx,
} from "../../components/ui";
import { PROVIDERS, maskKey } from "../lib/companyDomain";
import { relativeTime } from "../../lib/domain";

/**
 * A location's POS connection, rendered as a section of that location's
 * detail page (LocationsScreen): `SectionHeading` + `Card`, like the team
 * section above it. The cross-location "which one is failing" scan lives in
 * the Locations list row's status line instead.
 */

/* ---------------------------------------------------------- Connect dialog -- */

/**
 * `existing` is the location's record, live or stale. It pre-fills the
 * merchant ID (which survives a disconnect so reconnecting doesn't require
 * looking it up again), and its `status` — not the presence of an ID —
 * decides whether this is an "Update" or a "Connect".
 */
export function ConnectDialog({ location, provider, existing, onCancel, onConnect }) {
  const [merchantId, setMerchantId] = useState(existing?.merchantId || "");
  const [apiKey, setApiKey] = useState("");
  const valid = merchantId.trim() && apiKey.trim().length >= 8;
  const updating = existing?.status === "connected";

  return (
    <Modal
      open
      onClose={onCancel}
      title={`${updating ? "Update" : "Connect"} ${provider.name} — ${location.name}`}
      icon={provider.icon}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant="primary" icon={PlugZap}
            disabled={!valid}
            onClick={() => onConnect({ merchantId: merchantId.trim(), apiKey: apiKey.trim() })}
          >
            Save &amp; connect
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field
          label="Merchant ID" hint={
            merchantId && !updating
              ? "Carried over from this location's last connection — change it only if you're pointing it at a different Clover account."
              : "Found in Clover Dashboard → Account & Setup → Business Information."
          }
        >
          <Input autoFocus value={merchantId} placeholder="MC3819204471" onChange={(e) => setMerchantId(e.target.value)} />
        </Field>
        {/* Disconnecting wipes the key, so a stale record still asks for a
         *  fresh one — only a live connection is having its key replaced. */}
        <Field label="API key" hint="A private token — kept encrypted and never shown again after saving.">
          <Input
            type="password" value={apiKey}
            placeholder={updating ? "Enter a new key to replace the current one" : "clv_live_…"}
            onChange={(e) => setApiKey(e.target.value)}
          />
        </Field>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------ Shared derivation -- */

/**
 * Resolves a location's integration records to the live pairing (if the
 * provider is one we ship) plus the record worth keeping either way —
 * disconnecting wipes the API key but keeps the row, history and merchant ID.
 * Both the list row and the detail section call this, so they can't disagree
 * about whether a location is connected.
 */
export function connectionFor(integrations, locationId) {
  const here = integrations.filter((i) => i.locationId === locationId);
  const live = here.find((i) => i.status === "connected");
  const provider = live ? PROVIDERS.find((p) => p.id === live.provider) : null;
  return provider
    ? { provider, record: live, connected: true }
    : { provider: null, record: here[0] || null, connected: false };
}

/* ------------------------------------------------------------- Activity log -- */

/* Icon and tone keyed by what happened, not just success/failure. */
const HISTORY_META = {
  connected: { icon: PlugZap, tone: "ok" },
  disconnected: { icon: Unplug, tone: "neutral" },
  "sync-ok": { icon: CheckCircle2, tone: "ok" },
  "sync-error": { icon: XCircle, tone: "danger" },
  "webhook-received": { icon: Radio, tone: "info" },
};

const HISTORY_TONE_CLASS = {
  ok: "bg-ok-soft text-ok",
  danger: "bg-danger-soft text-danger",
  neutral: "bg-sunken text-ink-3",
  info: "bg-hover text-ink-2",
};

function ActivityLog({ history }) {
  if (history.length === 0) return <p className="text-xs text-ink-4">No activity yet.</p>;
  return (
    <ul className="space-y-3">
      {history.map((entry) => {
        const meta = HISTORY_META[entry.type] || HISTORY_META["sync-ok"];
        const Icon = meta.icon;
        return (
          <li key={entry.id} className="flex items-start gap-2.5">
            <span
              className={cx(
                "flex items-center justify-center w-6 h-6 rounded-md shrink-0",
                HISTORY_TONE_CLASS[meta.tone]
              )}
            >
              <Icon size={12} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-ink leading-snug">{entry.message}</p>
              <p className="text-xs text-ink-4 mt-0.5">{relativeTime(entry.at)}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/* ------------------------------------------------------------- The section -- */

/** One ruled row of the Connections card. */
function Row({ className, children }) {
  return <div className={cx("px-4 py-3", className)}>{children}</div>;
}

export default function LocationConnections({
  location,
  integrations,
  canManage,
  onRequestConnect,
  onDisconnect,
  onSync,
  onToggleWebhook,
}) {
  const { provider, record, connected } = connectionFor(integrations, location.id);
  const connectable = PROVIDERS.filter((p) => p.available);
  const upcoming = PROVIDERS.filter((p) => !p.available);

  const failing = connected && record?.lastResult === "error";
  const history = record?.history || [];

  // Clover's own per-account call cap, not something ProTrack imposes; the
  // defaults keep a record without metering fields rendering.
  const callLimit = record?.apiCallLimit ?? 5000;
  const callsUsed = record?.apiCallsUsed ?? 0;
  const usagePct = Math.min(100, (callsUsed / callLimit) * 100);
  const usageNearLimit = usagePct >= 90;
  const usageTone = usageNearLimit ? "danger" : usagePct >= 70 ? "warn" : "muted";

  return (
    <div>
      <SectionHeading icon={PlugZap} label="Connections" />

      <p className="py-1 px-1 text-xs text-ink-3 leading-relaxed">
        A point-of-sale connection is per location — this one&rsquo;s sales and inventory sync into ProTrack on its
        own credentials, separate from any other building&rsquo;s.
        {upcoming.length > 0 && ` ${nameList(upcoming)} support is coming.`}
      </p>

      {!connected ? (
        <div className="border-b border-line">
          <EmptyState
            icon={PlugZap}
            title="No point of sale connected — no POS data flows from this location yet." action={
              canManage ? (
                <div className="flex items-center gap-1.5">
                  {connectable.map((p) => (
                    <Button
                      key={p.id}
                      variant="primary" icon={PlugZap}
                      onClick={() => onRequestConnect(p.id)}
                    >
                      {/* Named per provider so it still reads right once a second ships. */}
                      Connect {p.name}
                    </Button>
                  ))}
                </div>
              ) : null
            }
          />
        </div>
      ) : (
        <Card className="mt-1">
          <div className="divide-y divide-line">
            {/* Sync now / Disconnect stay visible rather than in hover-only
             *  `RowActions`: they're the section's sole affordances. */}
            <Row className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2.5 min-w-0">
                <span
                  className={cx(
                    "flex items-center justify-center w-8 h-8 rounded-md shrink-0",
                    failing ? "bg-danger-soft text-danger" : "bg-ok-soft text-ok"
                  )}
                >
                  <provider.icon size={16} />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink truncate">{provider.name}</p>
                  <p className="text-xs text-ink-3 truncate">{provider.blurb}</p>
                </div>
                <Badge
                  tone={failing ? "danger" : "ok"}
                  icon={failing ? AlertTriangle : CheckCircle2}
                  className="shrink-0"
                >
                  {failing ? "Sync failed" : "Connected"}
                </Badge>
              </div>

              {canManage && (
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button size="sm" icon={RefreshCw} onClick={() => onSync(record.id)}>
                    Sync now
                  </Button>
                  <Button
                    size="sm" variant="ghost" icon={Unplug}
                    onClick={() => onDisconnect(record.id)}
                    className="hover:text-danger"
                  >
                    Disconnect
                  </Button>
                </div>
              )}
            </Row>

            {/* Credentials and last sync. */}
            <Row>
              <dl className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-2">
                <div className="flex items-center justify-between gap-3 text-xs sm:flex-col sm:items-start sm:gap-0.5">
                  <dt className="text-ink-4 shrink-0">Merchant</dt>
                  <dd className="text-ink font-medium tnum truncate">{record.merchantId}</dd>
                </div>
                <div className="flex items-center justify-between gap-3 text-xs sm:flex-col sm:items-start sm:gap-0.5">
                  <dt className="text-ink-4 shrink-0">API key</dt>
                  <dd className="text-ink font-medium tnum truncate">{maskKey(record.apiKey)}</dd>
                </div>
                <div className="flex items-center justify-between gap-3 text-xs sm:flex-col sm:items-start sm:gap-0.5">
                  <dt className="text-ink-4 shrink-0">Last synced</dt>
                  <dd className="text-ink font-medium truncate">
                    {record.lastSynced ? relativeTime(record.lastSynced) : "Never"}
                  </dd>
                </div>
              </dl>

              {/* Colour only where it discriminates. */}
              {failing && (
                <p className="text-xs text-danger flex items-start gap-1 mt-2.5">
                  <AlertTriangle size={11} className="shrink-0 mt-0.5" /> Last sync failed — {record.lastError}
                </p>
              )}
            </Row>

            {/* Coloured only once it needs attention. */}
            <Row>
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="text-xs text-ink-3">API usage</span>
                <span className={cx("text-xs tnum", usageNearLimit ? "text-danger font-medium" : "text-ink-4")}>
                  {callsUsed.toLocaleString()} / {callLimit.toLocaleString()}
                </span>
              </div>
              <ProgressBar value={usagePct} tone={usageTone} size="sm" />
            </Row>

            {canManage && (
              <Row className="flex items-center justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">Real-time sync</p>
                  <p className="text-xs text-ink-3 mt-0.5">
                    {record.webhookActive
                      ? `${provider.name} pushes inventory changes here as they happen.`
                      : "Off — this location only updates when someone presses Sync now."}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <Button
                    size="sm" variant="ghost" icon={KeyRound}
                    onClick={() => onRequestConnect(record.provider)}
                  >
                    Update credentials
                  </Button>
                  <Switch
                    checked={Boolean(record.webhookActive)}
                    onChange={(checked) => onToggleWebhook(record.id, checked)}
                    label="Real-time sync via webhook"
                  />
                </div>
              </Row>
            )}

            {/* One location, one log — always open. */}
            <Row>
              <p className="text-xs font-medium text-ink-3 mb-2.5">Recent activity</p>
              <ActivityLog history={history} />
            </Row>
          </div>
        </Card>
      )}
    </div>
  );
}

/** "Square and Toast", "Square, Toast and Lightspeed" — never a bare comma list. */
function nameList(providers) {
  const names = providers.map((p) => p.name);
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}
