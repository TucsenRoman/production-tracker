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
import { initialsOf } from "../../lib/domain";

/** A console person, in the shape the floor's screens expect a user to have. */
export const asFloorUser = (person) =>
  person && {
    id: person.id,
    name: person.name,
    initials: initialsOf(person.name),
    // The floor's vocabulary is "owner", not "admin". A label, not a permission.
    role: person.role === "admin" ? "owner" : person.role,
    station: null,
    pin: person.pin ?? null,
    avatarUrl: person.avatarUrl ?? null,
    locationIds: person.locationIds ?? [],
  };

export function useCompanyRoster() {
  /* Seeded, not empty: a browser that has never opened the console has
   * nothing in the company namespace, and a tablet that recognises nobody's
   * PIN is a dead end. */
  const [people] = usePersistentState("users", COMPANY_SEED.users);

  const findByPin = useCallback(
    (pin) => people.find((p) => p.pin && p.pin === pin) || null,
    [people],
  );

  return { people, findByPin };
}
