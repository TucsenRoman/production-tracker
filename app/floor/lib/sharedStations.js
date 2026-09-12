"use client";

/**
 * The floor's window onto the console's station list. Stations are
 * company-level config, edited on the console's Stations screen.
 *
 * Reads through the console's OWN hook rather than a hand-written localStorage
 * key: a key here can silently drift from the console's namespace, and the
 * hook brings the cross-tab `storage` sync with it.
 */

import { usePersistentState as useCompanyState } from "../../company/lib/companyStore";
import { COMPANY_SEED } from "../../company/lib/companyDomain";
import { STATIONS as DEFAULT_STATIONS } from "../../lib/domain";

/** The live station list; falls back to the shipped default if the console
 *  has stored an empty one. */
export function useSharedStations() {
  const [stations] = useCompanyState("stations", COMPANY_SEED.stations);
  return Array.isArray(stations) && stations.length > 0 ? stations : DEFAULT_STATIONS;
}

/** Per-station extras set on the console's Stations screen (a custom icon),
 *  keyed by station name. */
export function useSharedStationConfig() {
  const [config] = useCompanyState("stationConfig", {});
  return config && typeof config === "object" ? config : {};
}
