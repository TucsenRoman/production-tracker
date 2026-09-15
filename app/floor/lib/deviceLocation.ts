"use client";

/**
 * Which shop this tablet is standing in. A location is a SETTING, not a
 * credential: nothing is issued or revoked.
 *
 * Three sources, in order:
 *   1. `?at=<id or slug>` in the URL. The home-screen shortcut can carry it,
 *      so the assignment survives a cache clear or Safari data reset.
 *   2. What this browser last stored.
 *   3. Nothing; with one location configured it answers itself.
 *
 * Changing it is quietly destructive (everything files against the wrong
 * shop until somebody notices), so it is gated through `switch-location`
 * and the shop name stays on screen at all times.
 */

import { useCallback, useEffect, useState } from "react";

import { usePersistentState } from "./store";
import { usePersistentState as useCompanyState } from "../../company/lib/companyStore";
import { COMPANY_SEED } from "../../company/lib/companyDomain";
import type { CompanyLocation } from "../../company/lib/types";

export interface DeviceLocation {
  locations: CompanyLocation[];
  /** The shop this tablet is standing in, or null until one is settled. */
  location: CompanyLocation | null;
  setLocation: (id: string) => void;
  /** Only worth asking when there is genuinely a choice to make. */
  needsChoice: boolean;
}

/** "Foley — Highway 23" -> "foley-highway-23", so a URL can be readable. */
const slugify = (name: string | null | undefined): string =>
  String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export function useDeviceLocation(): DeviceLocation {
  /* The cast is the JS seam — see the note in companyRoster.ts. */
  const [locations] = useCompanyState<CompanyLocation[]>(
    "locations",
    COMPANY_SEED.locations as CompanyLocation[],
  );
  const [storedId, setStoredId] = usePersistentState<string | null>(
    "deviceLocationId",
    null,
  );
  const [fromUrl, setFromUrl] = useState<string | null>(null);

  /* Read once on mount rather than during render: the server has no URL, and
   * a value that differs between the two passes is a hydration mismatch. */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const at = new URLSearchParams(window.location.search).get("at");
    if (at) setFromUrl(at);
  }, []);

  const match = (key: string | null | undefined) =>
    locations.find((l) => l.id === key || slugify(l.name) === slugify(key)) || null;

  const location =
    (fromUrl && match(fromUrl)) ||
    (storedId && match(storedId)) ||
    (locations.length === 1 ? locations[0] : null);

  /* A tablet that arrived by URL should not have to arrive by URL again.
   *
   * ONLY the URL is persisted, never the single-location inference: the
   * company list hydrates in an effect, so the first render always sees the
   * one seeded location, and writing that down would pin every tablet to the
   * first shop a frame before the real list arrived. */
  useEffect(() => {
    const urlMatch = fromUrl && match(fromUrl);
    if (urlMatch && urlMatch.id !== storedId) setStoredId(urlMatch.id);
  });

  /* Wait for hydration, or the shop picker flashes on a tablet that has a
   * shop, or hides on one that needs to be asked. */
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  const setLocation = useCallback(
    (id: string) => setStoredId(id),
    [setStoredId],
  );

  return {
    locations,
    location,
    setLocation,
    needsChoice: ready && !location && locations.length > 1,
  };
}
