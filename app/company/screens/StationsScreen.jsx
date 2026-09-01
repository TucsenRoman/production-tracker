"use client";

import React, { useState } from "react";
import { Factory, Fingerprint, Pencil, Plus, Trash2 } from "lucide-react";

import { Badge, Button, Card, EmptyState, Field, IconButton, Input } from "../../components/ui";
import { isValidStationName } from "../lib/companyDomain";

function StationForm({ initial, existingNames, onCancel, onSave }) {
  const [name, setName] = useState(initial || "");
  const trimmed = name.trim();
  const duplicate = existingNames.some((n) => n.toLowerCase() === trimmed.toLowerCase() && n !== initial);
  const valid = isValidStationName(trimmed) && !duplicate;

  return (
    <Card inset className="space-y-4">
      <Field label="Station name" error={duplicate ? "A station with that name already exists." : null}>
        <Input
          autoFocus
          value={name}
          placeholder='e.g. "Grinding" or "Loading Dock"'
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && valid && onSave(trimmed)}
        />
      </Field>
      <div className="flex items-center justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="primary" icon={Plus} disabled={!valid} onClick={() => onSave(trimmed)}>
          {initial ? "Save changes" : "Add station"}
        </Button>
      </div>
    </Card>
  );
}

export default function StationsScreen({ stations, crewPins, onAdd, onUpdate, onRemove }) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);

  const pinCount = (name) => crewPins.filter((p) => p.station === name).length;

  return (
    <div className="space-y-5">
      <p className="flex items-start gap-1.5 text-xs text-ink-3 leading-relaxed px-3 py-2.5 rounded-md bg-sunken">
        <Factory size={13} className="shrink-0 mt-0.5 text-icon-2" />
        Stations are the posts on your floor — Smokehouse, Packaging, or whatever fits your shop. Every
        location&rsquo;s device codes (under Locations) and Permissions both pull from this list, company-wide.
      </p>

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-ink-3">
          {stations.length} station{stations.length === 1 ? "" : "s"}
        </p>
        {!adding && (
          <Button variant="primary" icon={Plus} onClick={() => setAdding(true)}>
            Add station
          </Button>
        )}
      </div>

      {adding && (
        <StationForm
          existingNames={stations}
          onCancel={() => setAdding(false)}
          onSave={(name) => {
            onAdd(name);
            setAdding(false);
          }}
        />
      )}

      {stations.length === 0 && !adding ? (
        <Card>
          <EmptyState
            icon={Factory}
            title="No stations yet" description="Add at least one station before a location can issue device codes for it." action={
              <Button variant="primary" icon={Plus} onClick={() => setAdding(true)}>
                Add your first station
              </Button>
            }
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="divide-y divide-line">
            {stations.map((name) => {
              if (editing === name) {
                return (
                  <div key={name} className="p-4">
                    <StationForm
                      initial={name}
                      existingNames={stations}
                      onCancel={() => setEditing(null)}
                      onSave={(next) => {
                        onUpdate(name, next);
                        setEditing(null);
                      }}
                    />
                  </div>
                );
              }
              const count = pinCount(name);
              return (
                <div key={name} className="flex items-center gap-3 px-4 py-3">
                  <span className="flex items-center justify-center w-7 h-7 rounded-full bg-hover text-ink-2 shrink-0">
                    <Factory size={15} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink truncate">{name}</p>
                    <p className="flex items-center gap-1 text-xs text-ink-3">
                      <Fingerprint size={11} /> {count} device code{count === 1 ? "" : "s"} across locations
                    </p>
                  </div>
                  {count > 0 && <Badge tone="neutral">In use</Badge>}
                  <div className="flex items-center gap-1 shrink-0">
                    <IconButton label={`Rename ${name}`} icon={Pencil} size={14} onClick={() => setEditing(name)} />
                    <IconButton
                      label={`Remove ${name}`}
                      icon={Trash2}
                      size={14}
                      onClick={() => onRemove(name)}
                      className="hover:text-danger"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
