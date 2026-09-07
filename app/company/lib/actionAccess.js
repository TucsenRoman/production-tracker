"use client";

/**
 * Who is named on a targeted permission.
 *
 * `GATED_ACTIONS` carries a seed list in `accessUserIds`, but a constant can't
 * be edited, so the console's "Change people" control was a toast that
 * explained itself as a mock. This is the state behind it.
 *
 * It's a hook rather than console state threaded through props on purpose:
 * both the Permissions screen and the shop floor need to read it, and the
 * floor is a different React tree. Same trick as ../../lib/companyRoster —
 * one localStorage key under the company namespace, read from either side.
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
   * The question the floor actually asks: may this person do this?
   *
   * An empty list means NOBODY, not everybody. A targeted permission with no
   * one on it is a locked door, which is the safe reading — the alternative
   * turns "we haven't decided yet" into "anyone may".
   */
  const allows = useCallback(
    (actionId, userId) => !!userId && idsFor(actionId).includes(userId),
    [idsFor],
  );

  return { idsFor, setIdsFor, allows };
}
