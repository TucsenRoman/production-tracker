"use client";

/**
 * The live station list, as a context. The console's Stations screen makes
 * `stations` editable, so screens read the current list here rather than a
 * module-level copy; `STATIONS` in ./domain.js is only the seed.
 *
 * Smokehouse keeps one piece of special-cased logic: it is the only stage a
 * batch can skip (`needsSmoke`), a fact about smoking meat. Everything else
 * about the list comes from `stations`. A station with no known icon gets the
 * generic `Factory` glyph.
 */

import React, { createContext, useContext, useMemo } from "react";
import {
  Activity,
  AirVent,
  Archive,
  Axe,
  BadgeCheck,
  Blend,
  BrushCleaning,
  Bubbles,
  CheckCircle2,
  ClipboardCheck,
  Droplets,
  Factory,
  Flame,
  Forklift,
  Gauge,
  Grid2x2,
  Hammer,
  ListChecks,
  Package,
  PackageOpen,
  Refrigerator,
  Ruler,
  ScanBarcode,
  Scissors,
  Snowflake,
  Split,
  Stamp,
  Thermometer,
  ThermometerSnowflake,
  Truck,
  Warehouse,
  Weight,
  Wind,
} from "lucide-react";

import { STATIONS as DEFAULT_STATIONS } from "./domain";

const KNOWN_ICON = {
  Smokehouse: Flame,
  Packaging: Package,
  "Shelf-Ready": CheckCircle2,
};

/**
 * The pool a station's `config.icon` is picked from, grouped by what a post
 * does so the picker is a glance, not a search.
 *
 * Two rules decide what is in here:
 *
 * 1. It must still read at 15px, the only size a station icon is drawn at.
 *    Strokes that merge at that size (a fan, a spray can's dots) are out, and
 *    so is anything that resolves into a different shape (`vault` is an X in
 *    a box, which reads as an error).
 *
 * 2. The glyph must not already carry another meaning in ProTrack:
 *    `Beef`/`Ham`/`Layers`/`CookingPot` are Inventory categories, `Scale` is
 *    weigh-in, `ShieldCheck` is Permissions, `ClipboardList` is Tasks,
 *    `PackageCheck` is the "made" state, `Route` is Connections, and
 *    `Tag`/`Wrench`/`Truck`/`Thermometer` are task categories in
 *    TASK_CATEGORY_ICONS. Six glyphs are deliberately shared because they
 *    mean the same thing in both places: Flame, Snowflake, Package, Truck,
 *    Thermometer, Factory.
 *
 * Grep the glyph name across app/ before adding one.
 */
export const STATION_ICON_GROUPS = [
  {
    label: "Prep",
    icons: [
      { key: "blend", label: "Grinding", Icon: Blend },
      { key: "scissors", label: "Cutting", Icon: Scissors },
      { key: "axe", label: "Breaking", Icon: Axe },
      { key: "ruler", label: "Portioning", Icon: Ruler },
    ],
  },
  {
    label: "Heat",
    icons: [
      { key: "flame", label: "Smokehouse", Icon: Flame },
      { key: "thermometer", label: "Temp", Icon: Thermometer },
      { key: "gauge", label: "Cook control", Icon: Gauge },
    ],
  },
  {
    label: "Cold",
    icons: [
      { key: "snowflake", label: "Freezer", Icon: Snowflake },
      { key: "refrigerator", label: "Cooler", Icon: Refrigerator },
      { key: "thermometer-snowflake", label: "Chilling", Icon: ThermometerSnowflake },
      { key: "wind", label: "Blast chill", Icon: Wind },
      { key: "air-vent", label: "Ventilation", Icon: AirVent },
    ],
  },
  {
    label: "Pack",
    icons: [
      { key: "package", label: "Packaging", Icon: Package },
      { key: "package-open", label: "Unboxing", Icon: PackageOpen },
      { key: "scan-barcode", label: "Labeling", Icon: ScanBarcode },
      { key: "stamp", label: "Stamping", Icon: Stamp },
      { key: "grid-2x2", label: "Trays", Icon: Grid2x2 },
    ],
  },
  {
    label: "Move",
    icons: [
      { key: "truck", label: "Shipping", Icon: Truck },
      { key: "forklift", label: "Loading", Icon: Forklift },
      { key: "warehouse", label: "Warehouse", Icon: Warehouse },
      { key: "archive", label: "Staging", Icon: Archive },
    ],
  },
  {
    label: "Check",
    icons: [
      { key: "clipboard-check", label: "Inspection", Icon: ClipboardCheck },
      { key: "list-checks", label: "Checklist", Icon: ListChecks },
      { key: "badge-check", label: "QA", Icon: BadgeCheck },
      { key: "weight", label: "Weighing", Icon: Weight },
    ],
  },
  {
    label: "Clean",
    icons: [
      { key: "droplets", label: "Brine", Icon: Droplets },
      { key: "brush-cleaning", label: "Washdown", Icon: BrushCleaning },
      { key: "bubbles", label: "Sanitizing", Icon: Bubbles },
    ],
  },
  {
    label: "Other",
    icons: [
      { key: "factory", label: "Generic", Icon: Factory },
      { key: "hammer", label: "Maintenance", Icon: Hammer },
      { key: "split", label: "Sorting", Icon: Split },
      { key: "activity", label: "Monitoring", Icon: Activity },
    ],
  },
];

/** Flat view of the same pool, for key → component lookups. */
const STATION_ICON_CHOICES = STATION_ICON_GROUPS.flatMap((g) => g.icons);

/** Keys no longer offered in the picker. A station configured with one keeps
 *  a sensible glyph rather than reverting to a generic factory. */
const RETIRED_ICON = {
  boxes: Package,
  container: Package,
  vault: Package,
  "hand-platter": Factory,
  microwave: Flame,
  "cooking-pot": Flame,
  fan: Wind,
  "spray-can": Bubbles,
  layers: Grid2x2,
  beef: Factory,
  ham: Factory,
  scale: Weight,
  "shield-check": BadgeCheck,
  "clipboard-list": ClipboardCheck,
  timer: Gauge,
  wrench: Hammer,
  route: Truck,
  tag: ScanBarcode,
};

const ICON_BY_KEY = {
  ...RETIRED_ICON,
  ...Object.fromEntries(STATION_ICON_CHOICES.map((c) => [c.key, c.Icon])),
};

/**
 * Reads a batch whose `stage` may still be an index from an older build's
 * localStorage. A plain function because the console renders the provider
 * and cannot call the hook above it. Best effort: a name that no longer
 * exists is at least visible, where a stale index silently points elsewhere.
 */
export function migrateStage(batch, stages) {
  if (typeof batch?.stage !== "number") return batch;
  return { ...batch, stage: stages[Math.min(batch.stage, stages.length - 1)] ?? stages[0] };
}

const StationsContext = createContext(null);

export function useStations() {
  const ctx = useContext(StationsContext);
  if (!ctx) throw new Error("useStations must be used inside <StationsProvider>");
  return ctx;
}

export function StationsProvider({ stations, config = {}, children }) {
  // An empty or not-yet-hydrated list falls back to the shipped default
  // rather than a blank board.
  const list = stations && stations.length > 0 ? stations : DEFAULT_STATIONS;

  const value = useMemo(() => {
    const stages = [...list, "Shelf-Ready"];
    const lastProductionStage = list[list.length - 1] || null;

    return {
      /** The admin's live station list. */
      stations: list,
      /** Every stage a batch moves through, list order + the terminal outcome. */
      stages,
      /** A station's own chosen icon wins, then the built-in default for that
       *  name, then a plain factory glyph. */
      iconFor: (name) => ICON_BY_KEY[config[name]?.icon] || KNOWN_ICON[name] || Factory,
      /** The stage a batch finalizes out of, onto the shelf. */
      lastProductionStage,
      isFinalStage: (stage) => stage === lastProductionStage,
      /** The terminal stage every batch ends at. */
      finalStage: "Shelf-Ready",
      /**
       * The next stage a batch moves to, BY NAME. A stage is stored as a name,
       * not an index: an index would tie every live batch to the shape of the
       * admin's list, so reordering it would silently move batches.
       */
      nextStage: (batch) => {
        const at = stages.indexOf(batch.stage);
        /* A stage not in the list belongs to a deleted station. Leave the
         * batch where it is: stuck and visible beats moved and wrong. */
        if (at === -1) return batch.stage;
        let i = at + 1;
        // A batch that skips the smokehouse starts life one stage later.
        if (stages[i] === "Smokehouse" && !batch.needsSmoke) i += 1;
        return stages[Math.min(i, stages.length - 1)];
      },
      /** See `migrateStage`. */
      normalizeStage: (batch) => migrateStage(batch, stages),
    };
  }, [list, config]);

  return <StationsContext.Provider value={value}>{children}</StationsContext.Provider>;
}
