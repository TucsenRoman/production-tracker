"use client";

/**
 * The staff roster, its PINs, and who is allowed to change them.
 *
 * PINs used to be a hard-coded constant. They are now editable state, so every
 * screen that checks a PIN has to read the *current* roster rather than a
 * module-level copy — hence a context instead of a bare import.
 */

import React, { createContext, useCallback, useContext, useMemo } from "react";

import {
  SEED_STAFF,
  canManageStaff,
  initialsOf,
  newId,
  roleRank,
  validatePin,
} from "./domain";
import { usePersistentState } from "./store";

const StaffContext = createContext(null);

export function useStaff() {
  const ctx = useContext(StaffContext);
  if (!ctx) throw new Error("useStaff must be used inside <StaffProvider>");
  return ctx;
}

export function StaffProvider({ children }) {
  const [staff, setStaff] = usePersistentState("staff", SEED_STAFF);

  const findByPin = useCallback(
    (pin) => staff.find((s) => s.pin === pin) || null,
    [staff]
  );

  /** PINs in use by everyone except `exceptId` — the uniqueness check. */
  const pinsInUse = useCallback(
    (exceptId) => staff.filter((s) => s.id !== exceptId).map((s) => s.pin),
    [staff]
  );

  const checkPin = useCallback(
    (pin, exceptId) => validatePin(pin, { existing: pinsInUse(exceptId) }),
    [pinsInUse]
  );

  /** Returns an error string, or null once the change is written. */
  const setPin = useCallback(
    (actor, targetId, pin) => {
      const target = staff.find((s) => s.id === targetId);
      if (!canManageStaff(actor, target)) return "You can't change that PIN.";
      const error = checkPin(pin, targetId);
      if (error) return error;
      setStaff((prev) => prev.map((s) => (s.id === targetId ? { ...s, pin } : s)));
      return null;
    },
    [staff, checkPin, setStaff]
  );

  const addStaff = useCallback(
    (actor, { name, role, station, pin }) => {
      if (roleRank(actor?.role) <= roleRank(role)) return "You can't create that role.";
      const error = checkPin(pin);
      if (error) return error;
      setStaff((prev) => [
        ...prev,
        {
          id: newId("S"),
          name: name.trim(),
          initials: initialsOf(name),
          role,
          station: station || null,
          pin,
        },
      ]);
      return null;
    },
    [checkPin, setStaff]
  );

  const updateStaff = useCallback(
    (actor, targetId, patch) => {
      const target = staff.find((s) => s.id === targetId);
      if (!canManageStaff(actor, target)) return "You can't edit that person.";
      // Nobody hands out a role at or above their own, themselves included.
      if (patch.role && roleRank(actor.role) <= roleRank(patch.role)) {
        return "You can't assign that role.";
      }
      setStaff((prev) =>
        prev.map((s) =>
          s.id === targetId
            ? { ...s, ...patch, initials: patch.name ? initialsOf(patch.name) : s.initials }
            : s
        )
      );
      return null;
    },
    [staff, setStaff]
  );

  const removeStaff = useCallback(
    (actor, targetId) => {
      const target = staff.find((s) => s.id === targetId);
      if (actor?.id === targetId) return "You can't remove yourself.";
      if (!canManageStaff(actor, target)) return "You can't remove that person.";
      setStaff((prev) => prev.filter((s) => s.id !== targetId));
      return null;
    },
    [staff, setStaff]
  );

  const value = useMemo(
    () => ({ staff, findByPin, checkPin, setPin, addStaff, updateStaff, removeStaff }),
    [staff, findByPin, checkPin, setPin, addStaff, updateStaff, removeStaff]
  );

  return <StaffContext.Provider value={value}>{children}</StaffContext.Provider>;
}
