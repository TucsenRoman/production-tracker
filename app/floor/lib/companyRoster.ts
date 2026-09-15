"use client";

/**
 * The floor's read-only window onto the COMPANY roster. Floor managers are
 * the only shop workers with records (crew never sign in), and they are added
 * in the console, so the floor reads that roster directly rather than syncing
 * a second copy that would drift.
 *
 * Both stores are localStorage on one origin under different namespaces, and
 * `usePersistentState` subscribes to `storage`, so a PIN issued in the
 * console lands on an already-open tablet.
 */

import { useCallback } from "react";

import { usePersistentState } from "../../company/lib/companyStore";
import { COMPANY_SEED } from "../../company/lib/companyDomain";
import type { CompanyPerson } from "../../company/lib/types";
import { initialsOf } from "../../lib/domain";

/** A console person in the shape the floor's screens expect. */
export interface FloorUser {
  id: string;
  name: string;
  initials: string;
  /** The floor's vocabulary is "owner", not "admin". A label, not a permission. */
  role: string;
  station: string | null;
  pin: string | null;
  avatarUrl: string | null;
  locationIds: string[];
}

export const asFloorUser = (
  person: CompanyPerson | null | undefined,
): FloorUser | null =>
  (person && {
    id: person.id,
    name: person.name,
    initials: initialsOf(person.name),
    role: person.role === "admin" ? "owner" : person.role,
    station: null,
    pin: person.pin ?? null,
    avatarUrl: person.avatarUrl ?? null,
    locationIds: person.locationIds ?? [],
  }) ||
  null;

export interface CompanyRoster {
  people: CompanyPerson[];
  findByPin: (pin: string) => CompanyPerson | null;
}

export function useCompanyRoster(): CompanyRoster {
  /* Seeded, not empty: a browser that has never opened the console has
   * nothing in the company namespace, and a tablet that recognises nobody's
   * PIN is a dead end. */
  /* The cast is the JS seam: `companyDomain` is still JavaScript, so TS widens
   * the seed's `role` to `string` rather than the `CompanyRole` union. Drop it
   * when that module converts. */
  const [people] = usePersistentState<CompanyPerson[]>(
    "users",
    COMPANY_SEED.users as CompanyPerson[],
  );

  const findByPin = useCallback(
    (pin: string) => people.find((p) => p.pin && p.pin === pin) || null,
    [people],
  );

  return { people, findByPin };
}
