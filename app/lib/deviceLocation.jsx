"use client";

/**
 * Which shop this tablet is standing in.
 *
 * A location is NOT a station. Stations are tabs — which part of the work you
 * are looking at, changing minute to minute, bound to nothing (which is why
 * station device codes were deleted). A location is which building the tablet
 * is in: it changes when somebody drives somewhere. Binding that is a SETTING,
 * not a credential, and the difference is the whole reason this can exist
 * without repeating the device-code mistake — nothing is issued, nothing is
 * revoked, nothing is punched in to get through a door.
 *
 * Three sources, in order:
 *   1. `?at=<id or slug>` in the URL. The tablet's home-screen shortcut can
 *      carry it, which means the assignment survives a cache clear, a Safari
 *      data reset, or someone reinstalling the shortcut — the failure mode a
 *      stored-only setting has.
 *   2. What this browser last stored.
 *   3. Nothing — and with one location configured that is not a question worth
 *      asking, so it answers itself.
 *
 * Changing it is destructive in a quiet way: the tablet keeps working, it just
 * files everything against the wrong shop until somebody notices. So it is
 * gated through the `switch-location` permission rather than left as a plain
 * setting, and the shop name stays on screen at all times so a wrong one is
 * visible rather than discovered a week later.
 */

import { useCallback, useEffect, useState } from "react";

import { usePersistentState } from "./store";
import { usePersistentState as useCompanyState } from "../company/lib/companyStore";
import { COMPANY_SEED } from "../company/lib/companyDomain";

/** "Foley — Highway 23" -> "foley-highway-23", so a URL can be readable. */
export const slugify = (name) =>
  String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export function useDeviceLocation() {
  const [locations] = useCompanyState("locations", COMPANY_SEED.locations);
  const [storedId, setStoredId] = usePersistentState("deviceLocationId", null);
  const [fromUrl, setFromUrl] = useState(null);

  /* Read once on mount rather than during render: the server has no URL, and
   * a value that differs between the two passes is a hydration mismatch. */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const at = new URLSearchParams(window.location.search).get("at");
    if (at) setFromUrl(at);
  }, []);

  const match = (key) =>
    locations.find((l) => l.id === key || slugify(l.name) === slugify(key)) || null;

  const location =
    (fromUrl && match(fromUrl)) ||
    (storedId && match(storedId)) ||
    (locations.length === 1 ? locations[0] : null);

  /* A tablet that arrived by URL should not have to arrive by URL again — the
   * shortcut is the belt, this is the braces.
   *
   * ONLY the URL is persisted here, never the single-location inference. The
   * company roster hydrates from localStorage in an effect, so the very first
   * render always sees the one seeded location; writing that down would pin
   * every tablet to the first shop a frame before the real list arrived, and
   * the picker would then never appear because the tablet already "knew"
   * where it was. Learned the hard way. */
  useEffect(() => {
    const urlMatch = fromUrl && match(fromUrl);
    if (urlMatch && urlMatch.id !== storedId) setStoredId(urlMatch.id);
  });

  /* Nothing renders off the roster until it has actually loaded — otherwise
   * the shop picker flashes on a tablet that has a shop, or hides on one that
   * needs to be asked. */
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  const setLocation = useCallback((id) => setStoredId(id), [setStoredId]);

  return {
    locations,
    location,
    setLocation,
    /* Only worth asking when there is genuinely a choice to make. One shop is
     * not a question, and a picker that appears anyway is a setup step
     * invented for its own sake. */
    needsChoice: ready && !location && locations.length > 1,
  };
}
