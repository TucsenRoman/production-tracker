"use client";

import React, { useState } from "react";
import { ChevronDown, ChevronUp, Factory, Pencil, Plus, Trash2 } from "lucide-react";

import {
  Badge,
  Button,
  Card,
  cx,
  EmptyState,
  Field,
  IconButton,
  Input,
  RowActions,
  SearchInput,
  StickyFadeHeader,
} from "../../components/ui";
import { isValidStationName } from "../lib/companyDomain";
import { STATION_ICON_CHOICES, useStations } from "../../lib/stations";

/* The add/rename form is a thing you fill in, not a thing you read, so it
 * keeps its own Card — as does the list around it. `Card` is two rules and
 * the page between them, not a box, so neither one wraps a group in one. */
function StationForm({ initial, initialConfig, existingNames, onCancel, onSave }) {
  const [name, setName] = useState(initial || "");
  const [icon, setIcon] = useState(initialConfig?.icon || "");
  const [targetMinutes, setTargetMinutes] = useState(
    initialConfig?.targetMinutes != null ? String(initialConfig.targetMinutes) : ""
  );
  const trimmed = name.trim();
  const duplicate = existingNames.some((n) => n.toLowerCase() === trimmed.toLowerCase() && n !== initial);
  const valid = isValidStationName(trimmed) && !duplicate;

  const commit = () => {
    if (!valid) return;
    const parsed = Math.round(Number(targetMinutes));
    const minutes = targetMinutes.trim() !== "" && Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    onSave(trimmed, { icon: icon || null, targetMinutes: minutes });
  };

  return (
    <Card inset className="space-y-4">
      <Field label="Station name" error={duplicate ? "A station with that name already exists." : null}>
        <Input
          autoFocus
          value={name}
          placeholder='e.g. "Grinding" or "Loading Dock"'
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && commit()}
        />
      </Field>

      {/* Purely cosmetic beyond the default guesses in app/lib/stations.jsx
       *  (Smokehouse gets a flame, Packaging a box, everything else a plain
       *  factory) — but "purely cosmetic" is still the difference between a
       *  glance at the board telling you what's backed up and a wall of
       *  identical icons. Kept to a short, meat-processing-relevant set
       *  rather than the whole icon library, so picking one stays quick. */}
      <Field label="Icon" hint="Shown here and on the floor's Production board.">
        <div className="flex flex-wrap gap-1.5">
          {STATION_ICON_CHOICES.map(({ key, label, Icon }) => {
            const selected = icon === key;
            return (
              <button
                key={key}
                type="button"
                title={label}
                aria-label={label}
                aria-pressed={selected}
                onClick={() => setIcon(selected ? "" : key)}
                className={cx(
                  "flex items-center justify-center w-8 h-8 rounded-md border shrink-0",
                  "transition-colors duration-100",
                  selected
                    ? "border-primary text-primary bg-hover"
                    : "border-line text-icon-2 hover:text-icon hover:bg-hover"
                )}
              >
                <Icon size={15} />
              </button>
            );
          })}
        </div>
      </Field>

      {/* Optional — a station with no target just never gets flagged, same
       *  as before this existed. Feeds isOverTarget() (app/lib/domain.js)
       *  everywhere a cycle time gets checked, including console Insights. */}
      <Field
        label="Target cycle time (minutes)"
        hint="Optional. Flags a batch here and in Insights once it runs 15% past this."
      >
        <Input
          type="number"
          min={1}
          inputMode="numeric"
          value={targetMinutes}
          placeholder="e.g. 90"
          onChange={(e) => setTargetMinutes(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && commit()}
          className="max-w-[8rem]"
        />
      </Field>

      <div className="flex items-center justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="primary" icon={Plus} disabled={!valid} onClick={commit}>
          {initial ? "Save changes" : "Add station"}
        </Button>
      </div>
    </Card>
  );
}

export default function StationsScreen({
  stations,
  production,
  stationConfig,
  onAdd,
  onUpdate,
  onRemove,
  onMove,
  onUpdateConfig,
}) {
  const { iconFor } = useStations();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  const [query, setQuery] = useState("");

  /* "In use" used to mean "has device codes issued". Those are gone — nothing
   * authenticated against them — so it now means what a manager would assume
   * it means: has this station actually run anything. */
  const runCount = (name) =>
    Object.values(production || {})
      .flat()
      .filter((h) => h?.minutes && name in h.minutes).length;

  const trimmedQuery = query.trim().toLowerCase();
  // Filtered for display only — reorder still needs each row's position in
  // the *real* list (stations.indexOf below), not wherever it lands once a
  // search narrows things down, or the up/down arrows would swap the wrong
  // neighbors.
  const visibleStations = trimmedQuery
    ? stations.filter((name) => name.toLowerCase().includes(trimmedQuery))
    : stations;

  return (
    <div>
      {/* The explainer sits above the sticky toolbar, not inside it — it's
       *  read once, so it scrolls away rather than following you down the
       *  list. */}
      <p className="flex items-start gap-1.5 text-xs text-ink-3 leading-relaxed px-3 py-2.5 rounded-md bg-sunken">
        <Factory size={13} className="shrink-0 mt-0.5 text-icon-2" />
        Stations are the posts on your floor — Smokehouse, Packaging, or whatever fits your shop. The
        production board reads this list as its stage order, and Permissions pulls from it too, company-wide.
        Order matters too: it&rsquo;s the sequence a batch moves through on the Production board, so whichever
        station is last is where a batch gets its final weight.
      </p>

      {/* The same one-row sticky toolbar the Tasks and Team screens use:
       *  count on the left, the single primary action on the right. This is
       *  the screen's only statement of how many stations there are. */}
      <StickyFadeHeader pad={28}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <p className="text-sm text-ink-3 shrink-0">
              {stations.length} station{stations.length === 1 ? "" : "s"}
            </p>
            {stations.length > 3 && (
              <SearchInput
                value={query}
                onChange={setQuery}
                placeholder="Search stations…"
                className="flex-1 min-w-40 max-w-64"
              />
            )}
          </div>

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
            onSave={(name, config) => {
              onAdd(name);
              if (config.icon || config.targetMinutes != null) onUpdateConfig?.(name, config);
              setAdding(false);
            }}
          />
        )}

        {stations.length === 0 && !adding ? (
          <div className="border-b border-line">
            <EmptyState
              icon={Factory}
              title="No stations yet"
              description="Add at least one station before the production board has a stage to run through."
              action={
                <Button variant="primary" icon={Plus} onClick={() => setAdding(true)}>
                  Add your first station
                </Button>
              }
            />
          </div>
        ) : visibleStations.length === 0 && !adding ? (
          <div className="border-b border-line">
            <EmptyState
              icon={Factory}
              title="No stations match"
              description={`Nothing found for "${query.trim()}".`}
              action={
                <Button variant="ghost" onClick={() => setQuery("")}>
                  Clear search
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
              {visibleStations.map((name) => {
                // Position in the real, unfiltered list — what up/down and
                // "is this the last station" actually mean.
                const index = stations.indexOf(name);
                if (editing === name) {
                  return (
                    <li key={name} className="px-4 py-3">
                      <StationForm
                        initial={name}
                        initialConfig={stationConfig?.[name]}
                        existingNames={stations}
                        onCancel={() => setEditing(null)}
                        onSave={(next, config) => {
                          if (next !== name) onUpdate(name, next);
                          onUpdateConfig?.(next, config);
                          setEditing(null);
                        }}
                      />
                    </li>
                  );
                }
                const count = runCount(name);
                const Icon = iconFor(name);
                const targetMinutes = stationConfig?.[name]?.targetMinutes;
                return (
                  <li
                    key={name}
                    className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-faint"
                  >
                    <span className="flex items-center justify-center w-7 h-7 rounded-full bg-hover text-ink-2 shrink-0">
                      <Icon size={15} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-ink truncate">{name}</p>
                      <p className="text-xs text-ink-3 truncate">
                        {count === 0
                          ? "No batches through it yet"
                          : `${count} closed batch${count === 1 ? "" : "es"}`}
                      </p>
                    </div>
                    {/* Only the exceptions get a chip: a target time, because
                     *  most stations won't have one, and an unused station,
                     *  because "in use" on every row distinguished nothing. */}
                    {targetMinutes != null && <Badge tone="neutral">{targetMinutes} min target</Badge>}
                    {count === 0 && <Badge tone="neutral">Not in use</Badge>}
                    <RowActions>
                      <IconButton
                        label={`Move ${name} up`}
                        icon={ChevronUp}
                        size={14}
                        disabled={index === 0}
                        onClick={() => onMove?.(name, -1)}
                        className="disabled:opacity-30 disabled:pointer-events-none"
                      />
                      <IconButton
                        label={`Move ${name} down`}
                        icon={ChevronDown}
                        size={14}
                        disabled={index === stations.length - 1}
                        onClick={() => onMove?.(name, 1)}
                        className="disabled:opacity-30 disabled:pointer-events-none"
                      />
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
