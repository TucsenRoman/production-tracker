"use client";

import React, { useMemo, useState } from "react";
import { KeyRound, PlugZap, RefreshCw, Unplug } from "lucide-react";

import {
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Modal,
  StickyFadeHeader,
  cx,
} from "../../components/ui";
import { PROVIDERS, maskKey } from "../lib/companyDomain";
import { relativeTime } from "../../lib/domain";

function ConnectDialog({ location, provider, existing, onCancel, onConnect }) {
  const [merchantId, setMerchantId] = useState(existing?.merchantId || "");
  const [apiKey, setApiKey] = useState("");
  const valid = merchantId.trim() && apiKey.trim().length >= 8;

  return (
    <Modal
      open
      onClose={onCancel}
      title={`Connect ${provider.name} — ${location.name}`}
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
        <Field label="Merchant ID" hint="Found in Clover Dashboard → Account & Setup → Business Information.">
          <Input autoFocus value={merchantId} placeholder="MC3819204471" onChange={(e) => setMerchantId(e.target.value)} />
        </Field>
        <Field label="API key" hint="A private token — kept encrypted and never shown again after saving.">
          <Input
            type="password" value={apiKey}
            placeholder={existing?.apiKey ? "Enter a new key to replace the current one" : "clv_live_…"}
            onChange={(e) => setApiKey(e.target.value)}
          />
        </Field>
      </div>
    </Modal>
  );
}

/** "Square and Toast", "Square, Toast and Lightspeed" — never a bare comma list. */
function nameList(providers) {
  const names = providers.map((p) => p.name);
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/**
 * ONE LOCATION, one row. The location is the thing an admin came here to ask
 * about ("is Foreston set up?"), so it owns the row; whether a provider is
 * wired to it is the row's VALUE, not a second axis to multiply by. The old
 * shape listed every location × every provider, which turned two locations
 * into six rows — four of them permanently inert "Coming soon" entries — and
 * split each location's real state across a Connected and an Available group.
 *
 * The buttons stay visible rather than living in `RowActions`. Test /
 * Disconnect / Connect are the only way to act on a location's integration at
 * all — hiding the single affordance a row has behind hover makes it
 * undiscoverable, which is the opposite of what hover-revealed edit/trash
 * icons buy you elsewhere.
 */
function LocationRow({ location, provider, record, connectable, onConnect, onDisconnect, onTest }) {
  const [dialogProvider, setDialogProvider] = useState(null);
  const connected = Boolean(provider);
  const Icon = connected ? provider.icon : PlugZap;

  return (
    <li className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-faint">
      <span
        className={cx(
          "flex items-center justify-center w-7 h-7 rounded-md shrink-0",
          connected ? "bg-ok-soft text-ok" : "bg-sunken text-ink-3"
        )}
      >
        <Icon size={15} />
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink truncate">{location.name}</p>
        {connected ? (
          /* The provider is named in words, not only by its icon — the icon
           *  says "live", the line says what it is live against. */
          <p className="text-xs text-ink-3 truncate">
            {provider.name} · merchant {record.merchantId} · key {maskKey(record.apiKey)}
            {record.lastSynced ? ` · synced ${relativeTime(record.lastSynced)}` : ""}
          </p>
        ) : (
          <p className="text-xs text-ink-4 truncate">Not connected — no POS data flows from this location.</p>
        )}
      </div>

      {connected ? (
        <div className="flex items-center gap-1.5 shrink-0">
          <Button size="sm" icon={RefreshCw} onClick={() => onTest(record.id)}>
            Test
          </Button>
          <Button size="sm" variant="ghost" icon={Unplug} onClick={() => onDisconnect(record.id)} className="hover:text-danger">
            Disconnect
          </Button>
        </div>
      ) : (
        /* One button while a single provider is connectable — the common case,
         *  and the reason the shelf of "coming soon" rows was never worth its
         *  space. If a second provider ships, each names itself rather than
         *  the row silently offering only the first. */
        <div className="flex items-center gap-1.5 shrink-0">
          {connectable.map((p) => (
            <Button key={p.id} size="sm" variant="primary" icon={PlugZap} onClick={() => setDialogProvider(p)}>
              {connectable.length === 1 ? "Connect" : `Connect ${p.name}`}
            </Button>
          ))}
        </div>
      )}

      {dialogProvider && (
        <ConnectDialog
          location={location}
          provider={dialogProvider}
          existing={record}
          onCancel={() => setDialogProvider(null)}
          onConnect={(fields) => {
            onConnect(location.id, dialogProvider.id, fields);
            setDialogProvider(null);
          }}
        />
      )}
    </li>
  );
}

export default function IntegrationsScreen({ locations, integrations, onConnect, onDisconnect, onTest }) {
  /* One row per location. A location's live pairing, if it has one, resolves
   * to the provider that names it; a stale disconnected record is still worth
   * holding on to, because it pre-fills the merchant ID when reconnecting. */
  const rows = useMemo(
    () =>
      locations.map((location) => {
        const here = integrations.filter((i) => i.locationId === location.id);
        const live = here.find((i) => i.status === "connected");
        const provider = live ? PROVIDERS.find((p) => p.id === live.provider) : null;
        // A live record for a provider we no longer ship reads as unconnected —
        // there is nothing this screen could offer to do with it.
        return provider
          ? { key: location.id, location, provider, record: live }
          : { key: location.id, location, provider: null, record: here[0] || null };
      }),
    [locations, integrations]
  );

  const connectable = PROVIDERS.filter((p) => p.available);
  const upcoming = PROVIDERS.filter((p) => !p.available);
  const connectedCount = rows.filter((r) => r.provider).length;

  if (locations.length === 0) {
    return (
      <EmptyState
        icon={KeyRound}
        title="Add a location first" description="Integrations connect per location — add one from the Locations tab, then come back here."
      />
    );
  }

  return (
    <div>
      {/* The same sticky toolbar Tasks and Team use. Nothing page-level to do
       *  here — connecting is a per-row act — so the bar carries the count
       *  line alone rather than inventing an action to fill it, plus the one
       *  quiet sentence that used to be N inert "Coming soon" rows. Provider
       *  availability is a fact about the product, not about any location, so
       *  it is stated once here instead of repeated down the list. */}
      <StickyFadeHeader pad={28}>
        <div className="flex flex-col gap-0.5">
          <p className="text-sm text-ink-3">
            {connectedCount} of {locations.length} {locations.length === 1 ? "location" : "locations"} connected
          </p>
          {upcoming.length > 0 && (
            <p className="text-xs text-ink-4">
              {connectable.length > 0 ? `${nameList(connectable)} connects today — ` : ""}
              {nameList(upcoming)} support is coming.
            </p>
          )}
        </div>
      </StickyFadeHeader>

      {/* No SectionHeading, deliberately. The house rule is that a list with a
       *  real grouping dimension always labels its groups, even a group of one
       *  — but these rows are peers with no dimension to group on. The
       *  previous Connected / Available split was exactly the failure that
       *  rule guards against in reverse: it invented a grouping that tore each
       *  location's state in half. A heading here would name the list, not a
       *  group; the toolbar line above already does that.
       *
       *  Rule a grouped list; box a flat one. With no heading to act as the
       *  containing device, two rows on an open white field read as unmoored
       *  text rather than a finished panel — so the list gets `Card`, which
       *  is still not a box: `border-y` only, a rule above and a rule below
       *  with the page showing through, and dividers between the rows. */}
      <Card>
        <ul className="divide-y divide-line">
          {rows.map(({ key, location, provider, record }) => (
            <LocationRow
              key={key}
              location={location}
              provider={provider}
              record={record}
              connectable={connectable}
              onConnect={onConnect}
              onDisconnect={onDisconnect}
              onTest={onTest}
            />
          ))}
        </ul>
      </Card>
    </div>
  );
}
