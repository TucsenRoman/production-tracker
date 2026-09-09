"use client";

/**
 * The floor's window onto the console's station list.
 *
 * Stations are company-level config: a station is a view on the production
 * board, not a property of a device, and the console's Stations screen is
 * where one is added, renamed, reordered or given an icon. A station that
 * only existed in the console would make that screen cosmetic, so the floor
 * reads it here.
 *
 * It reads through the console's OWN hook — exactly the way
 * ./companyRoster.jsx reads the console's users — rather than reaching into
 * localStorage with a key of its own. That is not a style preference. This
 * module used to hold its own hand-written `"milaca.company.v2.stations"`,
 * and when the console's namespace was bumped to v4 the string stayed behind:
 * every station added, renamed or reordered in the console silently stopped
 * reaching the floor, which fell back to the shipped Smokehouse/Packaging
 * default and looked for all the world like it was working. Naming the hook
 * instead of the key makes that failure impossible to reintroduce — and
 * brings the cross-tab `storage` sync in ../lib/persistence.js along with it,
 * so a rename in the office lands on an open tablet without a reload.
 */

import { usePersistentState as useCompanyState } from "../company/lib/companyStore";
import { COMPANY_SEED } from "../company/lib/companyDomain";
import { STATIONS as DEFAULT_STATIONS } from "./domain";

/**
 * The live station list. Falls back to the shipped default if the console has
 * somehow stored an empty one — a board with no stations on it is not a state
 * worth rendering faithfully.
 */
export function useSharedStations() {
  const [stations] = useCompanyState("stations", COMPANY_SEED.stations);
  return Array.isArray(stations) && stations.length > 0 ? stations : DEFAULT_STATIONS;
}

/** Per-station extras set on the console's Stations screen — a custom icon
 *  today, more later — keyed the same way `stations` itself is, so a
 *  station's row here always matches its row there. */
export function useSharedStationConfig() {
  const [config] = useCompanyState("stationConfig", {});
  return config && typeof config === "object" ? config : {};
}
