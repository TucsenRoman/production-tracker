"use client";

/**
 * The floor's window onto the COMPANY roster.
 *
 * Floor managers are the only shop workers in the system — crew have no
 * records and never sign in; they work under whoever signed the tablet in for
 * the shift. So the people this terminal cares about are not the floor's own
 * `staff` list, they are the people an admin added in the console, and there
 * is no point maintaining two copies of the same human.
 *
 * Both stores are localStorage on one origin under different namespaces
 * (`milaca.production.v1` vs `milaca.company.v4`), so the floor can read and
 * write the company roster directly through the console's own hook. That is
 * the whole bridge. It is deliberately a READ of the place a name actually
 * gets added, rather than a sync between two rosters that would immediately
 * start to drift.
 *
 * Read-only. PINs are issued and cleared on the console's Team screen now, so
 * the floor never writes to this roster — it asks whether a punched code
 * belongs to somebody, and hands the list to the Tasks screen's assign
 * picker.
 *
 * The two trees still don't share React state — each has its own copy backed
 * by the same key — but they are no longer a page load apart: `usePersistentState`
 * subscribes to `storage` (see ../lib/persistence.js), so a PIN issued or a
 * teammate added in the console lands on an already-open tablet. That was the
 * standing caveat here and it is retired.
 */

import { useCallback } from "react";

import { usePersistentState } from "../company/lib/companyStore";
import { COMPANY_SEED } from "../company/lib/companyDomain";
import { initialsOf } from "./domain";

/** A console person, in the shape the floor's screens expect a user to have. */
export const asFloorUser = (person) =>
  person && {
    id: person.id,
    name: person.name,
    initials: initialsOf(person.name),
    // Kept in the floor's old vocabulary ("owner" rather than "admin") for
    // any consumer that still reads a role off one of these. Nothing on the
    // floor branches on it any more — the terminal's role checks are gone —
    // so this is a label, not a permission.
    role: person.role === "admin" ? "owner" : person.role,
    station: null,
    pin: person.pin ?? null,
    avatarUrl: person.avatarUrl ?? null,
    locationIds: person.locationIds ?? [],
  };

export function useCompanyRoster() {
  /* Seeded, not empty: a browser that has opened the floor but never the
   * console has nothing in the company namespace yet, and a tablet that
   * recognises nobody's PIN is a dead end rather than an empty state. */
  const [people] = usePersistentState("users", COMPANY_SEED.users);

  const findByPin = useCallback(
    (pin) => people.find((p) => p.pin && p.pin === pin) || null,
    [people],
  );

  return { people, findByPin };
}
