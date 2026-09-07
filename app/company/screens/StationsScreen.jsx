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

/* The fields, shared by the dialog that adds a station and the one that edits
 * an existing one — same form, two entry points.
 *
 * A station is a PLACE. It has a name, a glyph and a position in the line,
 * and that is the whole of it. How long a batch should spend here is a fact
 * about the batch — bacon and bratwurst can share this smokehouse and want
 * wildly different times — so it belongs to the product, not to the post, and
 * an earlier version of this screen that asked an admin to type one number
 * per station was asking a question with no correct answer. */
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

      {/* Cosmetic beyond the default guesses in app/lib/stations.jsx
       *  (Smokehouse gets a flame, Packaging a box, everything else a plain
       *  factory) — but "cosmetic" is still the difference between a glance at
       *  the board telling you what is backed up and a wall of identical
       *  icons.
       *
       *  Thirty-two icons stay a glance rather than a search because they read
       *  as eight short rows with a named gutter, not one wall. The label sits
       *  in a left column so each group is a single line; stacked labels made
       *  this field taller than the rest of the form put together. */}
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

/**
 * Adding and renaming both happen in a dialog rather than inline, because the
 * icon picker does not fit in a row.
 */
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

/**
 * The station pool: which posts exist, what each is called, and what order a
 * batch moves through them. Nothing about how long anything takes — that is
 * the product's business, and it belongs wherever products get set up.
 */
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
  /* Which row is being dragged, and which gap it is currently over. `overGap`
   * is an insertion point (0..length), not a row index — that is what makes
   * "dropped below the last row" expressible. */
  const [dragFrom, setDragFrom] = useState(null);
  const [overGap, setOverGap] = useState(null);

  /* A batch is only standing somewhere until it is finalised. `destination`
   * is set exactly once, when a batch goes Shelf-Ready (see BoardScreen), so
   * a non-null one means the batch has left the line — and without this
   * filter a finished batch keeps occupying whatever station its old stage
   * index now points at, which is any station added after it closed. */
  const onFloor = (batches || []).filter((b) => !b.destination);

  /* What is standing at this post right this minute. A batch's `stage` is the
   * station's NAME, so this is a plain match — and it stays correct when the
   * admin reorders the list, which the old index-based stage did not.
   *
   * This is the only thing on the screen that moves during a shift, which is
   * what makes the pool worth opening twice instead of once — and it shows a
   * backup without needing a target to compare it against. The console
   * already keeps `batches` for the Production board; it simply was not
   * handed to this screen before. */
  const hereNow = (name) => {
    const at = onFloor.filter((b) => b.stage === name);
    return {
      count: at.length,
      // What the crew would actually lift: the weighed-in figure when there
      // is one, the estimate before that.
      lb: at.reduce((sum, b) => sum + (b.boxWeight ?? b.estWeight ?? 0), 0),
    };
  };

  /* Which products actually run through a post, by family rather than by SKU
   * — "Bacon, Sausage, Sticks" fits in a cell and stays true as the case
   * changes, where six full product names would not.
   *
   * Read-only and derived on purpose: nobody maintains this list. It is the
   * union of what closed batches recorded minutes for here and what is
   * standing here now, so a station earns its products by running them. */
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
      {/* No toolbar. Every fact a meta line could put here — how many
       *  stations, which is first, which is last, which takes the final
       *  weight — is already legible in the rows below it, and a count is the
       *  least useful of them: the stops are numbered 1..n down the rail. So
       *  the only thing left is the action, and the shell already has a place
       *  for a page's own action, next to its title. */}
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
          /* The sequence rail — the wire and its numbered stops — lives in two
           * columns to the LEFT of every rule in the table. The header
           * underline and each row divider start at Station, so the numbers
           * read as an annotation running alongside the list rather than a
           * column inside it, which is the difference between "1, 2, 3, 4"
           * being a datum about each row and being the shape of the list.
           *
           * That is also why the borders are on the CELLS and not the row: a
           * border on <tr> would span the rail too, and there is no way to
           * exempt part of it. Cell borders additionally solve the stacking
           * the row borders caused — every gap between two rows is one line
           * (the upper row's bottom border), never two competing ones. */
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
                  {/* "Here now", not "on the floor now" — the floor is the
                   *  whole building, and the number is about this one post. */}
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

                  /* One divider per gap, drawn by the row above it. The drop
                   * indicator recolours that divider and thickens it with a
                   * 1px shadow rather than adding a second border, so nothing
                   * shifts by a pixel when a drag starts. (box-shadow is
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
                      {/* The grab handle, in its own lane outside the wire. It
                       *  sits BESIDE the stop rather than replacing the number
                       *  in it, so you can still read which position you are
                       *  moving while you move it. */}
                      <td className="h-13 align-middle">
                        {reorderable ? (
                          /* A real control, not a decoration: it drags with a
                           * pointer and moves with the arrow keys, so the
                           * sequence is reorderable without one. */
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

                      {/* The stop, on a wire that runs the height of the list
                       *  and stops at the first and last stop's centre. */}
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

                      {/* "Nothing yet" rather than a dash: an empty list here
                       *  means the post has never run anything, which is the
                       *  one fact about a pool you cannot get from the names. */}
                      <td className={cx(cell, "pr-3 text-sm")}>
                        {products.length ? (
                          <span className="text-ink-1 truncate block" title={products.join(", ")}>
                            {products.join(", ")}
                          </span>
                        ) : (
                          <span className="text-xs text-ink-3">Nothing yet</span>
                        )}
                      </td>

                      {/* Weight first, count last: the count is the number you
                       *  scan down the column, so it sits closest to the edge
                       *  the eye returns to. "Clear" beats a 0 — an empty post
                       *  is a state, not a shortfall. */}
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
