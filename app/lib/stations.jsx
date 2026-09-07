"use client";

/**
 * The live station list, as a context — same reason PINs stopped being a
 * bare import (see ./staff.jsx's doc comment): the Stations screen in the
 * admin console makes `stations` editable, so every screen that used to
 * read the `STAGES`/`STATIONS`/`STAGE_ICON` constants from ./domain.js has
 * to read the *current* list instead of a module-level copy of exactly
 * ["Smokehouse", "Packaging"].
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
  Boxes,
  CheckCircle2,
  Factory,
  Flame,
  Package,
  Scissors,
  Snowflake,
  Thermometer,
  Truck,
  Warehouse,
  Wrench,
} from "lucide-react";

import { STATIONS as DEFAULT_STATIONS } from "./domain";

const KNOWN_ICON = {
  Smokehouse: Flame,
  Packaging: Package,
  "Shelf-Ready": CheckCircle2,
};

/** Picked from — a station's `config.icon` is one of these keys. Kept
 *  small and meat-processing-specific rather than the whole lucide set, so
 *  the picker in the Stations screen stays a quick glance, not a search. */
export const STATION_ICON_CHOICES = [
  { key: "factory", label: "Factory", Icon: Factory },
  { key: "flame", label: "Flame", Icon: Flame },
  { key: "boxes", label: "Boxes", Icon: Boxes },
  { key: "snowflake", label: "Cold", Icon: Snowflake },
  { key: "truck", label: "Truck", Icon: Truck },
  { key: "scissors", label: "Cutting", Icon: Scissors },
  { key: "thermometer", label: "Temp", Icon: Thermometer },
  { key: "warehouse", label: "Warehouse", Icon: Warehouse },
  { key: "wrench", label: "Prep", Icon: Wrench },
];

const ICON_BY_KEY = Object.fromEntries(STATION_ICON_CHOICES.map((c) => [c.key, c.Icon]));

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
      /** Batches that skip the smokehouse start life one stage later. */
      nextStageIndex: (batch) => {
        let i = batch.stage + 1;
        if (stages[i] === "Smokehouse" && !batch.needsSmoke) i += 1;
        return Math.min(i, stages.length - 1);
      },
    };
  }, [list, config]);

  return <StationsContext.Provider value={value}>{children}</StationsContext.Provider>;
}
