"use client";

/**
 * Who is named on a targeted permission. `GATED_ACTIONS` only carries a seed
 * list in `accessUserIds`; this is the editable state behind it.
 *
 * A hook over one localStorage key rather than console state threaded through
 * props, because the Permissions screen and the shop floor both read it and
 * the floor is a different React tree.
 */

import { useCallback } from "react";

import { usePersistentState } from "./companyStore";
import { GATED_ACTIONS } from "./companyDomain";

/** Seeded from whatever the action constants ship with. */
const seed = () =>
  Object.fromEntries(
    GATED_ACTIONS.filter((a) => a.targeted).map((a) => [a.id, a.accessUserIds || []]),
  );

export function useActionAccess() {
  const [access, setAccess] = usePersistentState("actionAccess", seed());

  /** Ids named on an action, falling back to the constant's own seed. */
  const idsFor = useCallback(
    (actionId) =>
      access[actionId] ??
      GATED_ACTIONS.find((a) => a.id === actionId)?.accessUserIds ??
      [],
    [access],
  );

  const setIdsFor = useCallback(
    (actionId, ids) => setAccess((prev) => ({ ...prev, [actionId]: ids })),
    [setAccess],
  );

  /**
   * May this person do this? An empty list means NOBODY, not everybody —
   * the safe reading of a targeted permission with no one on it.
   */
  const allows = useCallback(
    (actionId, userId) => !!userId && idsFor(actionId).includes(userId),
    [idsFor],
  );

  return { idsFor, setIdsFor, allows };
}
