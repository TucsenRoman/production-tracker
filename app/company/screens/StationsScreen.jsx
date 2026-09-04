"use client";

import React, { useState } from "react";
import { Factory, Pencil, Plus, Trash2 } from "lucide-react";

import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  IconButton,
  Input,
  RowActions,
  StickyFadeHeader,
} from "../../components/ui";
import { isValidStationName } from "../lib/companyDomain";

/* The add/rename form is a thing you fill in, not a thing you read, so it
 * keeps its own Card — as does the list around it. `Card` is two rules and
 * the page between them, not a box, so neither one wraps a group in one. */
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
    <div>
      {/* The explainer sits above the sticky toolbar, not inside it — it's
       *  read once, so it scrolls away rather than following you down the
       *  list. */}
      <p className="flex items-start gap-1.5 text-xs text-ink-3 leading-relaxed px-3 py-2.5 rounded-md bg-sunken">
        <Factory size={13} className="shrink-0 mt-0.5 text-icon-2" />
        Stations are the posts on your floor — Smokehouse, Packaging, or whatever fits your shop. Every
        location&rsquo;s device codes (under Locations) and Permissions both pull from this list, company-wide.
      </p>

      {/* The same one-row sticky toolbar the Tasks and Team screens use:
       *  count on the left, the single primary action on the right. This is
       *  the screen's only statement of how many stations there are. */}
      <StickyFadeHeader pad={28}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm text-ink-3">
            {stations.length} station{stations.length === 1 ? "" : "s"}
          </p>

          {!adding && (
            <div className="flex items-center gap-1.5 shrink-0">
              <Button variant="primary" icon={Plus} onClick={() => setAdding(true)}>
                Add station
              </Button>
            </div>
          )}
        </div>
      </StickyFadeHeader>

      <div className="space-y-5">
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
          <div className="border-b border-line">
            <EmptyState
              icon={Factory}
              title="No stations yet"
              description="Add at least one station before a location can issue device codes for it."
              action={
                <Button variant="primary" icon={Plus} onClick={() => setAdding(true)}>
                  Add your first station
                </Button>
              }
            />
          </div>
        ) : (
          /* Deliberately no SectionHeading here — don't add one back.
           *
           * The style spec's "always render a section heading, even for one
           * group" rule is about lists whose grouping is real but happens to
           * narrow to one category (Team by role, Permissions by built-in vs
           * custom): the heading still names *which* group you're looking at,
           * so dropping it once a group is solo would read as broken. This
           * list has no grouping dimension at all — there is one flat set of
           * stations and there always will be. A heading here would only
           * restate the page title and the toolbar's count, a third statement
           * of the same number within a screenful. So the list renders
           * directly, and with no heading above it there's nothing to indent
           * under either. */
          <Card>
            <ul className="divide-y divide-line">
              {stations.map((name) => {
                if (editing === name) {
                  return (
                    <li key={name} className="px-4 py-3">
                      <StationForm
                        initial={name}
                        existingNames={stations}
                        onCancel={() => setEditing(null)}
                        onSave={(next) => {
                          onUpdate(name, next);
                          setEditing(null);
                        }}
                      />
                    </li>
                  );
                }
                const count = pinCount(name);
                return (
                  <li
                    key={name}
                    className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-faint"
                  >
                    <span className="flex items-center justify-center w-7 h-7 rounded-full bg-hover text-ink-2 shrink-0">
                      <Factory size={15} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-ink truncate">{name}</p>
                      {/* Plain meta line, no leading icon and no chip styling:
                       *  the device codes it counts live on the Locations
                       *  screen and there's no jump to them from here, so this
                       *  has to read as background context, not as a control
                       *  you can follow. */}
                      <p className="text-xs text-ink-3 truncate">
                        {count} device code{count === 1 ? "" : "s"} across locations
                      </p>
                    </div>
                    {/* Only the exception gets a chip. "In use" on every row
                     *  distinguished nothing; a station no location has issued
                     *  a code for is the thing worth spotting. */}
                    {count === 0 && <Badge tone="neutral">Not in use</Badge>}
                    <RowActions>
                      <IconButton label={`Rename ${name}`} icon={Pencil} size={14} onClick={() => setEditing(name)} />
                      <IconButton
                        label={`Remove ${name}`}
                        icon={Trash2}
                        size={14}
                        onClick={() => onRemove(name)}
                        className="hover:text-danger"
                      />
                    </RowActions>
                  </li>
                );
              })}
            </ul>
          </Card>
        )}
      </div>
    </div>
  );
}
