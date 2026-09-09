"use client";

/**
 * The live station list, as a context — same reason PINs stopped being a
 * bare import (see ./staff.jsx's doc comment): the Stations screen in the
 * admin console makes `stations` editable, so every screen that used to
 * read the `STAGES`/`STAGE_ICON` constants from ./domain.js has to read the
 * *current* list instead of a module-level copy of exactly
 * ["Smokehouse", "Packaging"]. Those two constants are now deleted; only
 * `STATIONS` survives there, as the seed this provider falls back to.
 *
 * Smokehouse keeps its one piece of special-cased business logic (it's the
 * only stage a batch can skip, via `needsSmoke`) — that's a real fact about
 * smoking meat, not an artifact of the old hardcoded pair. Everything else
 * about the list — how many stations, what they're called, what order they
 * run in, which one is last before Shelf-Ready — now comes from `stations`.
 *
 * A station added here with no known icon gets the same generic `Factory`
 * glyph the Stations screen itself uses for every row, rather than being
 * silently invisible or crashing on an undefined icon component.
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
 * The pool a station's `config.icon` is picked from.
 *
 * Grouped by what a post on the floor actually DOES — prep, heat, cold,
 * pack, move, check, clean — rather than offered as one undifferentiated
 * wall. That is what lets the pool be thirty-two without turning the picker
 * from a glance into a search: you scan eight short labels, then three to
 * five icons, instead of thirty-two icons at once.
 *
 * Two filters decide what is in here, and the second one is the one that is
 * easy to forget:
 *
 * 1. It has to still read at 15px. That is the only size a station icon is
 *    ever drawn at — in the table here, and in the glyph on the floor's
 *    Production board. Anything whose strokes merge at that size (a fan, a
 *    stack of boxes, a spray can's dots) is out no matter how apt it is,
 *    and so is anything that resolves into a DIFFERENT shape: `vault` is an
 *    X in a box, which on a status board reads as an error.
 *
 * 2. The glyph must not already carry another meaning somewhere in ProTrack.
 *    An icon is only worth anything if it means one thing, and this app
 *    already spends a lot of them: `Beef`/`Ham`/`Layers`/`CookingPot` are
 *    Inventory's product categories, `Scale` is weigh-in and Avg yield on
 *    the floor board, `ShieldCheck` is Permissions, `ClipboardList` is
 *    Tasks, `PackageCheck` is the "made" inventory state, `Route` is
 *    Connections on Locations, and `Tag`/`Wrench`/`Truck`/`Thermometer`
 *    are all task categories in TASK_CATEGORY_ICONS (app/lib/domain.js).
 *
 *    Six glyphs are deliberately shared, because they mean the SAME thing
 *    in both places: Flame is the smokehouse, Snowflake is cold, Package is
 *    packaging, Truck is shipping, Thermometer is temperature, and Factory
 *    is a station with nothing chosen. Sharing those is what makes the rest
 *    of the pool's uniqueness mean something.
 *
 * Adding to this list is cheap; adding to it without checking rule 2 is how
 * an icon quietly stops being a signal. Grep the glyph name across app/
 * before you add one.
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

/** Flat view of the same pool — for anything that just needs "is this a
 *  known key" or to map a key back to a component. */
export const STATION_ICON_CHOICES = STATION_ICON_GROUPS.flatMap((g) => g.icons);

/** Keys that used to be offered and no longer are. A station configured
 *  with one keeps the glyph it was given rather than silently reverting to
 *  a generic factory — retiring a choice from the picker is not the same as
 *  taking it away from the people who already made it. */
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
 * localStorage. Exported as a plain function because the company console
 * renders the provider and so cannot call the hook above it.
 *
 * Best effort: the station list may have changed since the index was written
 * and there is no recovering what it meant then — but a name that no longer
 * exists is at least visible, where a stale index silently pointed at
 * whatever now sits in that slot.
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
  // An empty or not-yet-hydrated list would otherwise mean a board with
  // nothing on it — fall back to the shipped default rather than showing a
  // blank floor.
  const list = stations && stations.length > 0 ? stations : DEFAULT_STATIONS;

  const value = useMemo(() => {
    const stages = [...list, "Shelf-Ready"];
    const lastProductionStage = list[list.length - 1] || null;

    return {
      /** Stations a person can be signed in to — the admin's live list. */
      stations: list,
      /** Every stage a batch moves through, list order + the terminal outcome. */
      stages,
      /** Icon for any stage name — a station's own chosen icon (set on the
       *  Stations screen) wins, then the built-in default for that name,
       *  then a plain factory glyph for anything else. */
      iconFor: (name) => ICON_BY_KEY[config[name]?.icon] || KNOWN_ICON[name] || Factory,
      /** The stage a batch finalizes out of, onto the shelf. */
      lastProductionStage,
      isFinalStage: (stage) => stage === lastProductionStage,
      /** The terminal stage every batch ends at. */
      finalStage: "Shelf-Ready",
      /**
       * The next stage a batch moves to, BY NAME.
       *
       * `batch.stage` used to be an index into `stages`, which quietly tied
       * every batch on the floor to the shape of the admin's station list:
       * reorder the list, or insert a station anywhere but the end, and every
       * live batch silently moved to a different post. Nothing in the app
       * wanted the index — almost every read was `stages[b.stage]`, turning it
       * straight back into a name — so the name is what gets stored.
       */
      nextStage: (batch) => {
        const at = stages.indexOf(batch.stage);
        /* A stage that is not in the list belongs to a station that has been
         * deleted. Leave the batch where it is rather than advancing it: the
         * old index model could not express this at all, and sending it to
         * whatever stage happens to be first would silently re-run it through
         * the whole line. Stuck and visible beats moved and wrong. */
        if (at === -1) return batch.stage;
        let i = at + 1;
        // A batch that skips the smokehouse starts life one stage later.
        if (stages[i] === "Smokehouse" && !batch.needsSmoke) i += 1;
        return stages[Math.min(i, stages.length - 1)];
      },
      /**
       * Reads a batch whose `stage` may still be an index from an older
       * build's localStorage. Best effort: the station list may have changed
       * since it was written, and there is no way to recover what it meant
       * then — but a name that no longer exists is at least visible, where a
       * stale index silently pointed at whatever now sits in that slot.
       */
      normalizeStage: (batch) => migrateStage(batch, stages),
    };
  }, [list, config]);

  return <StationsContext.Provider value={value}>{children}</StationsContext.Provider>;
}
