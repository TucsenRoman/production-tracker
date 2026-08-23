"use client";

import React, { useState } from "react";
import { CheckCircle2, KeyRound, Lock, PlugZap, RefreshCw, Unplug } from "lucide-react";

import { Badge, Button, Card, EmptyState, Field, Input, Modal, cx } from "../../components/ui";
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
            variant="primary"
            icon={PlugZap}
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
            type="password"
            value={apiKey}
            placeholder={existing?.apiKey ? "Enter a new key to replace the current one" : "clv_live_…"}
            onChange={(e) => setApiKey(e.target.value)}
          />
        </Field>
      </div>
    </Modal>
  );
}

function ProviderRow({ location, provider, record, onConnect, onDisconnect, onTest }) {
  const connected = record?.status === "connected";
  const [dialogOpen, setDialogOpen] = useState(false);

  if (!provider.available) {
    return (
      <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-sunken text-ink-4 shrink-0">
            <provider.icon size={15} />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-ink-3">{provider.name}</p>
            <p className="text-xs text-ink-4">{provider.blurb}</p>
          </div>
        </div>
        <Badge tone="neutral" icon={Lock}>
          Coming soon
        </Badge>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-5 py-3.5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5 min-w-0">
          <span
            className={cx(
              "flex items-center justify-center w-8 h-8 rounded-lg shrink-0",
              connected ? "bg-ok-soft text-ok" : "bg-sunken text-ink-3"
            )}
          >
            <provider.icon size={15} />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-ink">{provider.name}</p>
            {connected ? (
              <p className="text-xs text-ink-3">
                Merchant {record.merchantId} · key {maskKey(record.apiKey)}
              </p>
            ) : (
              <p className="text-xs text-ink-4">{provider.blurb}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {connected ? (
            <>
              <Badge tone="ok" icon={CheckCircle2}>
                Connected
              </Badge>
              <Button size="sm" icon={RefreshCw} onClick={() => onTest(record.id)}>
                Test
              </Button>
              <Button size="sm" variant="ghost" icon={Unplug} onClick={() => onDisconnect(record.id)} className="hover:text-danger">
                Disconnect
              </Button>
            </>
          ) : (
            <Button size="sm" variant="primary" icon={PlugZap} onClick={() => setDialogOpen(true)}>
              Connect
            </Button>
          )}
        </div>
      </div>

      {connected && record.lastSynced && (
        <p className="mt-1.5 pl-[42px] text-xs text-ink-4">Last synced {relativeTime(record.lastSynced)}</p>
      )}

      {dialogOpen && (
        <ConnectDialog
          location={location}
          provider={provider}
          existing={record}
          onCancel={() => setDialogOpen(false)}
          onConnect={(fields) => {
            onConnect(location.id, provider.id, fields);
            setDialogOpen(false);
          }}
        />
      )}
    </div>
  );
}

export default function IntegrationsScreen({ locations, integrations, onConnect, onDisconnect, onTest }) {
  if (locations.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={KeyRound}
          title="Add a location first"
          description="Integrations connect per location — add one from the Locations tab, then come back here."
        />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {locations.map((loc) => (
        <Card key={loc.id} className="overflow-hidden">
          <div className="px-4 sm:px-5 py-3.5 border-b border-line">
            <h3 className="text-sm font-semibold text-ink">{loc.name}</h3>
            <p className="text-xs text-ink-3">{loc.address}</p>
          </div>
          <div className="divide-y divide-line">
            {PROVIDERS.map((p) => (
              <ProviderRow
                key={p.id}
                location={loc}
                provider={p}
                record={integrations.find((i) => i.locationId === loc.id && i.provider === p.id)}
                onConnect={onConnect}
                onDisconnect={onDisconnect}
                onTest={onTest}
              />
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}
