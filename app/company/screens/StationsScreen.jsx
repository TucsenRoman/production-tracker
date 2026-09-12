"use client";

import React, { useState } from "react";
import { ChevronDown, ChevronUp, Factory, GripVertical, Pencil, Plus, Trash2 } from "lucide-react";

import {
  Button,
  cx,
  EmptyState,
  Field,
  IconButton,
  Input,
  Modal,
  RowActions,
  Slot,
} from "../../components/ui";
import { productType } from "../../lib/domain";
import { isValidStationName } from "../lib/companyDomain";
import { STATION_ICON_GROUPS, useStations } from "../../lib/stations";

/* Shared by the add and edit dialogs. A station is a PLACE: name, glyph,
 * position in the line. How long a batch spends here is a fact about the
 * product, not the post, so no time field lives here. */
function StationFields({ name, setName, icon, setIcon, duplicate, onEnter }) {
  return (
    <>
      <Field label="Station name" error={duplicate ? "A station with that name already exists." : null}>
        <Input
          autoFocus
          value={name}
          placeholder='e.g. "Grinding" or "Loading Dock"'
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onEnter()}
        />
      </Field>

      {/* Overrides the default guesses in app/lib/stations.jsx. Group labels
       *  sit in a left column so each group is one line; stacked labels made
       *  this field taller than the rest of the form. */}
      <Field label="Icon" hint="Shown here and on the floor's Production board.">
        <div className="space-y-1.5">
          {STATION_ICON_GROUPS.map((group) => (
            <div key={group.label} className="flex items-start gap-2.5">
              <div className="w-11 shrink-0 pt-2 text-xs text-ink-2">{group.label}</div>
              <div className="flex flex-wrap gap-1.5 min-w-0">
                {group.icons.map(({ key, label, Icon }) => {
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
                      <Icon size={15} strokeWidth={1.5} />
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </Field>
    </>
  );
}

/** Add/rename in a dialog rather than inline: the icon picker doesn't fit a row. */
function StationDialog({ initial, initialConfig, existingNames, onCancel, onSave }) {
  const [name, setName] = useState(initial || "");
  const [icon, setIcon] = useState(initialConfig?.icon || "");
  const trimmed = name.trim();
  const duplicate = existingNames.some((n) => n.toLowerCase() === trimmed.toLowerCase() && n !== initial);
  const valid = isValidStationName(trimmed) && !duplicate;

  const commit = () => {
    if (!valid) return;
    onSave(trimmed, { icon: icon || null });
  };

  return (
    <Modal
      open
      onClose={onCancel}
      title={initial ? `Edit ${initial}` : "New station"}
      icon={Factory}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="primary" icon={Plus} disabled={!valid} onClick={commit}>
            {initial ? "Save changes" : "Add station"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <StationFields
          name={name}
          setName={setName}
          icon={icon}
          setIcon={setIcon}
          duplicate={duplicate}
          onEnter={commit}
        />
      </div>
    </Modal>
  );
}

/** The station pool: which posts exist, their names, and the order a batch moves through them. */
export default function StationsScreen({
  stations,
  batches,
  production,
  stationConfig,
  onAdd,
  onUpdate,
  onRemove,
  onMove,
  onReorder,
  onUpdateConfig,
}) {
  const { iconFor } = useStations();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  /* `overGap` is an insertion point (0..length), not a row index, so
   * "dropped below the last row" is expressible. */
  const [dragFrom, setDragFrom] = useState(null);
  const [overGap, setOverGap] = useState(null);

  /* `destination` is set once, when a batch goes Shelf-Ready, so non-null
   * means it has left the line and no longer occupies a station. */
  const onFloor = (batches || []).filter((b) => !b.destination);

  /* What is standing at this post now. A batch's `stage` is the station's
   * NAME, so this stays correct when the admin reorders the list. */
  const hereNow = (name) => {
    const at = onFloor.filter((b) => b.stage === name);
    return {
      count: at.length,
      // The weighed-in figure when there is one, the estimate before that.
      lb: at.reduce((sum, b) => sum + (b.boxWeight ?? b.estWeight ?? 0), 0),
    };
  };

  /* Products that run through a post, by family so it fits a cell. Derived,
   * not maintained: the union of closed batches that recorded minutes here
   * and what is standing here now. */
  const productsAt = (name) => {
    const closed = Object.values(production || {})
      .flat()
      .filter((h) => h?.minutes && name in h.minutes && h.product)
      .map((h) => h.product);
    const live = onFloor.filter((b) => b.stage === name && b.product).map((b) => b.product);
    return [...new Set([...closed, ...live].map(productType))].sort();
  };

  const reorderable = stations.length > 1;

  const drop = () => {
    if (dragFrom != null && overGap != null) onReorder?.(dragFrom, overGap);
    setDragFrom(null);
    setOverGap(null);
  };

  return (
    <div>
      {/* No toolbar: everything a meta line could say is legible in the rows,
       *  so only the action remains, in the shell's own slot for it. */}
      <Slot name="page-actions">
        <Button variant="primary" icon={Plus} onClick={() => setAdding(true)}>
          Add station
        </Button>
      </Slot>

      {adding && (
        <StationDialog
          existingNames={stations}
          onCancel={() => setAdding(false)}
          onSave={(name, config) => {
            onAdd(name);
            if (config.icon) onUpdateConfig?.(name, config);
            setAdding(false);
          }}
        />
      )}

      {editing && (
        <StationDialog
          initial={editing}
          initialConfig={stationConfig?.[editing]}
          existingNames={stations}
          onCancel={() => setEditing(null)}
          onSave={(next, config) => {
            if (next !== editing) onUpdate(editing, next);
            onUpdateConfig?.(next, config);
            setEditing(null);
          }}
        />
      )}

      <div className="space-y-5">
        {stations.length === 0 ? (
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
        ) : (
          /* The sequence rail (wire + numbered stops) sits LEFT of every rule
           * so it reads as an annotation alongside the list, not a column in
           * it. That is why borders are on the CELLS, not the row: a <tr>
           * border would span the rail too. Cell borders also mean each gap
           * is one line (the upper row's bottom border), never two. */
          <div className="overflow-x-auto -mx-1 px-1">
            <table className="w-full border-collapse min-w-[520px]">
              <colgroup>
                <col className="w-[18px]" />
                <col className="w-[26px]" />
                <col className="w-[20px]" />
                <col />
                <col className="w-[188px]" />
                <col className="w-[132px]" />
                <col className="w-[76px]" />
              </colgroup>
              <thead>
                <tr>
                  {/* Outside the rule — the rail's three columns. */}
                  <th />
                  <th />
                  <th />
                  <th className="text-left text-xs font-normal text-ink-2 pb-2.5 pt-3 border-b border-line">
                    Station
                  </th>
                  <th className="text-left text-xs font-normal text-ink-2 pb-2.5 pt-3 border-b border-line">
                    Products
                  </th>
                  {/* "Here now": the number is about this one post, not the whole floor. */}
                  <th className="text-right text-xs font-normal text-ink-2 pb-2.5 pt-3 border-b border-line">
                    Here now
                  </th>
                  <th className="pb-2.5 pt-3 border-b border-line" />
                </tr>
              </thead>
              <tbody>
                {stations.map((name, index) => {
                  const Icon = iconFor(name);
                  const first = index === 0;
                  const last = index === stations.length - 1;
                  const dragging = dragFrom === index;
                  const here = hereNow(name);
                  const products = productsAt(name);

                  /* The drop indicator recolours the existing divider and
                   * thickens it with a 1px shadow rather than adding a border,
                   * so nothing shifts when a drag starts. (box-shadow is
                   * ignored on <tr> under border-collapse; on <td> it paints.) */
                  const rule =
                    overGap === index + 1
                      ? "border-b border-b-primary shadow-[0_1px_0_0_var(--color-primary)]"
                      : last
                        ? ""
                        : "border-b border-b-line-soft";
                  const cell = cx("h-13 align-middle", rule, !dragging && "group-hover:bg-faint");

                  return (
                    <tr
                      key={name}
                      draggable={reorderable}
                      onDragStart={(e) => {
                        setDragFrom(index);
                        e.dataTransfer.effectAllowed = "move";
                        // Firefox refuses to start a drag without payload.
                        e.dataTransfer.setData("text/plain", name);
                      }}
                      onDragOver={(e) => {
                        if (dragFrom == null) return;
                        e.preventDefault();
                        const box = e.currentTarget.getBoundingClientRect();
                        // Above or below the row's midpoint decides which gap.
                        const gap = e.clientY < box.top + box.height / 2 ? index : index + 1;
                        setOverGap(gap);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        drop();
                      }}
                      onDragEnd={drop}
                      className={cx("group transition-colors", dragging && "opacity-40")}
                    >
                      {/* Grab handle BESIDE the stop, not replacing its number,
                       *  so you can still read which position you're moving. */}
                      <td className="h-13 align-middle">
                        {reorderable ? (
                          /* Drags with a pointer and moves with arrow keys. */
                          <button
                            type="button"
                            aria-label={`Reorder ${name}. Use arrow keys to move.`}
                            onKeyDown={(e) => {
                              if (e.key === "ArrowUp") {
                                e.preventDefault();
                                onMove?.(name, -1);
                              } else if (e.key === "ArrowDown") {
                                e.preventDefault();
                                onMove?.(name, 1);
                              }
                            }}
                            className={cx(
                              "flex items-center justify-center w-[18px] h-6 rounded text-ink-4",
                              "cursor-grab active:cursor-grabbing transition-[opacity,color] duration-100",
                              "opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
                              "[@media(hover:none)]:opacity-100",
                              "hover:text-ink-2 focus-visible:text-ink-2"
                            )}
                          >
                            <GripVertical size={15} strokeWidth={1.5} />
                          </button>
                        ) : null}
                      </td>

                      {/* The stop, on a wire that ends at the first and last stop's centre. */}
                      <td className="relative h-13 align-middle">
                        <span
                          aria-hidden
                          className={cx(
                            "absolute left-1/2 -translate-x-1/2 w-px bg-line",
                            first ? "top-1/2" : "top-0",
                            last ? "bottom-1/2" : "bottom-0"
                          )}
                        />
                        <span
                          className={cx(
                            "relative flex items-center justify-center w-[26px] h-[26px] mx-auto",
                            "rounded-full bg-surface border border-line-strong",
                            "text-[11px] tnum text-ink-2 transition-colors duration-100",
                            "group-hover:border-ink-3 group-hover:text-ink-1"
                          )}
                        >
                          {index + 1}
                        </span>
                      </td>

                      {/* The air between the rail and the table's left edge. */}
                      <td className="h-13" />

                      <td className={cx(cell, "pl-0 pr-3")}>
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="flex items-center justify-center w-7 h-7 rounded-full bg-hover text-ink-1 shrink-0">
                            <Icon size={15} strokeWidth={1.5} />
                          </span>
                          <span className="text-sm font-medium text-ink truncate">{name}</span>
                          {last && <span className="text-xs text-ink-2 shrink-0">· final weight</span>}
                        </div>
                      </td>

                      {/* "Nothing yet" rather than a dash: the post has never run anything. */}
                      <td className={cx(cell, "pr-3 text-sm")}>
                        {products.length ? (
                          <span className="text-ink-1 truncate block" title={products.join(", ")}>
                            {products.join(", ")}
                          </span>
                        ) : (
                          <span className="text-xs text-ink-3">Nothing yet</span>
                        )}
                      </td>

                      {/* Count last, nearest the edge the eye scans down.
                       *  "Clear" beats a 0 — an empty post is a state, not a shortfall. */}
                      <td className={cx(cell, "text-right text-sm tnum")}>
                        {here.count ? (
                          <span className="inline-flex items-baseline gap-2">
                            {here.lb > 0 && <span className="text-xs text-ink-3">{here.lb} lb</span>}
                            <span className="text-ink font-medium">{here.count}</span>
                          </span>
                        ) : (
                          <span className="text-xs text-ink-3">Clear</span>
                        )}
                      </td>

                      <td className={cx(cell, "pl-3")}>
                        <RowActions>
                          <IconButton
                            label={`Move ${name} up`}
                            icon={ChevronUp}
                            size={14}
                            disabled={first}
                            onClick={() => onMove?.(name, -1)}
                            className="disabled:opacity-30 disabled:pointer-events-none"
                          />
                          <IconButton
                            label={`Move ${name} down`}
                            icon={ChevronDown}
                            size={14}
                            disabled={last}
                            onClick={() => onMove?.(name, 1)}
                            className="disabled:opacity-30 disabled:pointer-events-none"
                          />
                          <IconButton
                            label={`Edit ${name}`}
                            icon={Pencil}
                            size={14}
                            onClick={() => setEditing(name)}
                          />
                          <IconButton
                            label={`Remove ${name}`}
                            icon={Trash2}
                            size={14}
                            onClick={() => onRemove(name)}
                            className="hover:text-danger"
                          />
                        </RowActions>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
