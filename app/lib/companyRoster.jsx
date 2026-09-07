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
 * Note this does not share React state with an open console tab — each tree
 * has its own copy backed by the same key — so a claim made here shows up
 * there on its next load, not live. Fine for a shared tablet; worth knowing
 * before anything starts depending on the opposite.
 */

import { useCallback } from "react";

import { usePersistentState } from "../company/lib/companyStore";
import { COMPANY_SEED } from "../company/lib/companyDomain";
import { initialsOf, validatePin } from "./domain";

/** A console person, in the shape the floor's screens expect a user to have. */
export const asFloorUser = (person) =>
  person && {
    id: person.id,
    name: person.name,
    initials: initialsOf(person.name),
    // The console and the floor happen to spell this role the same way, which
    // is what lets `isManager` work unchanged on a person from either side.
    role: person.role === "admin" ? "owner" : person.role,
    station: null,
    pin: person.pin ?? null,
    avatarUrl: person.avatarUrl ?? null,
    locationIds: person.locationIds ?? [],
  };

export function useCompanyRoster() {
  /* Seeded, not empty: a browser that has opened the floor but never the
   * console has nothing in the company namespace yet, and a sign-in screen
   * with nobody to sign in is a dead end rather than an empty state. */
  const [people, setPeople] = usePersistentState("users", COMPANY_SEED.users);

  /** A floor manager an admin has added who has not chosen a PIN yet. */
  const unclaimed = people.filter((p) => p.role === "manager" && !p.pin);

  const findByPin = useCallback(
    (pin) => people.find((p) => p.pin && p.pin === pin) || null,
    [people],
  );

  /** Every PIN already spoken for, so a new one can't collide with it. */
  const pinsInUse = useCallback(
    (exceptId) => people.filter((p) => p.id !== exceptId && p.pin).map((p) => p.pin),
    [people],
  );

  /**
   * Set someone's PIN for the first time. Returns an error string, or null
   * once written — same contract as the floor's own `setPin`.
   *
   * Nobody but the person themselves ever sees this: an admin adds a name and
   * can later CLEAR a PIN, but never read one, so there is no moment where a
   * code has to be said out loud across a counter.
   */
  const claim = useCallback(
    (personId, pin) => {
      const person = people.find((p) => p.id === personId);
      if (!person) return "That name is no longer on the roster.";
      if (person.pin) return "Someone has already set a PIN for that name.";
      const error = validatePin(pin, { existing: pinsInUse(personId) });
      if (error) return error;
      setPeople((prev) =>
        prev.map((p) => (p.id === personId ? { ...p, pin, status: "active" } : p)),
      );
      return null;
    },
    [people, pinsInUse, setPeople],
  );

  return { people, unclaimed, findByPin, claim };
}
