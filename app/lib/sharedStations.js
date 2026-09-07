"use client";

/**
 * Bridges the one piece of state the shop-floor terminal (this app, `/`)
 * and the admin console (`/company`) actually mean the same thing by:
 * the station list. The two apps are deliberately separate — see
 * ../company/lib/companyDomain.js's module doc — with their own persistence
 * namespaces (./store.js's `milaca.production.v1` vs
 * ../company/lib/companyStore.js's `milaca.company.v2`), because most of
 * their state has no reason to be shared. Stations are the exception: this
 * demo is single-location, and the console's LOC-1 *is* the floor this app
 * renders, so a station added on the console's Stations screen has to show
 * up here or the whole point of that screen is cosmetic.
 *
 * Reads the console's own storage key directly rather than forking a
 * second editable copy — whatever the Stations screen writes is exactly
 * what this reads, no separate "sync" step to keep correct. If the
 * console's NS constant in companyStore.js ever changes, this key has to
 * move with it.
 */

import { useEffect, useState } from "react";

import { STATIONS as DEFAULT_STATIONS } from "./domain";

const COMPANY_STATIONS_KEY = "milaca.company.v2.stations";
const COMPANY_STATION_CONFIG_KEY = "milaca.company.v2.stationConfig";

/* Same dev switch as store.js — with persistence off, the console never
 * writes these keys, so anything still sitting under them is stale and
 * must be ignored rather than quietly overriding the seeded stations. */
const PERSIST = process.env.NEXT_PUBLIC_PERSIST !== "off";

function readCompanyStations() {
  if (!PERSIST) return null;
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(COMPANY_STATIONS_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
  } catch {
    return null;
  }
}

function readCompanyStationConfig() {
  if (!PERSIST) return null;
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(COMPANY_STATION_CONFIG_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * The live station list, sourced from the console. Falls back to the
 * shipped default until the console has ever been opened (nothing stored
 * yet), and updates live if the console changes it in another tab —
 * a real scenario here: the office runs the console, the floor tablet runs
 * this app, at the same time.
 */
export function useSharedStations() {
  const [stations, setStations] = useState(() => readCompanyStations() || DEFAULT_STATIONS);

  useEffect(() => {
    // Pick up whatever's already there once mounted client-side (the
    // initial useState runs before hydration can see localStorage on some
    // paths, so this re-checks rather than trusting the lazy initializer).
    const stored = readCompanyStations();
    if (stored) setStations(stored);

    const onStorage = (e) => {
      if (e.key && e.key !== COMPANY_STATIONS_KEY) return;
      const next = readCompanyStations();
      if (next) setStations(next);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return stations;
}

/** Per-station extras set on the console's Stations screen — a custom icon
 *  today, more later — keyed the same way `stations` itself is, so a
 *  station's row here always matches its row there. */
export function useSharedStationConfig() {
  const [config, setConfig] = useState(() => readCompanyStationConfig() || {});

  useEffect(() => {
    const stored = readCompanyStationConfig();
    if (stored) setConfig(stored);

    const onStorage = (e) => {
      if (e.key && e.key !== COMPANY_STATION_CONFIG_KEY) return;
      const next = readCompanyStationConfig();
      if (next) setConfig(next);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return config;
}
