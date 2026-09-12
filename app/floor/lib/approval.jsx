"use client";

/**
 * Manager approval for a gated action. The floor has no sign-in or session,
 * so a PIN is never a way IN: it appears only at the moments an admin decided
 * somebody should stand behind a decision.
 *
 * Usage: `const approve = useApproval()`, then
 *
 *   const by = await approve("close-batch", { detail: "B-1049 Snack Sticks" });
 *   if (!by) return;            // cancelled — do nothing
 *   commit({ approvedBy: by });  // ungated actions resolve to a sentinel, not a person
 *
 * Ungated actions resolve immediately without a dialog, so a caller can wrap
 * every action the same way and let the Permissions screen decide which stop.
 */

import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import { Check, ShieldCheck } from "lucide-react";

import { Button, Modal, PinInput, cx } from "../../components/ui";
import { usePersistentState as useCompanyState } from "../../company/lib/companyStore";
import { GATED_ACTIONS, defaultPermissions } from "../../company/lib/companyDomain";
import { useActionAccess } from "../../company/lib/actionAccess";
import { useCompanyRoster } from "./companyRoster";
import { usePersistentState } from "./store";

const ApprovalContext = createContext(null);

export function useApproval() {
  const ctx = useContext(ApprovalContext);
  if (!ctx) throw new Error("useApproval must be used inside <ApprovalProvider>");
  return ctx;
}

/** Every approval ever given on this tablet. */
export function useApprovalLog() {
  return usePersistentState("approvalLog", []);
}

/** Resolved for an action nobody had to approve. */
const NO_APPROVAL_NEEDED = { id: null, name: null, ungated: true };

export function ApprovalProvider({ location, children }) {
  const [permissions] = useCompanyState("permissions", defaultPermissions());
  const { allows, idsFor } = useActionAccess();
  const roster = useCompanyRoster();
  const [, setLog] = useApprovalLog();

  const [request, setRequest] = useState(null); // { action, detail }
  const resolveRef = useRef(null);

  const approve = useCallback(
    (actionId, { detail } = {}) => {
      const action = GATED_ACTIONS.find((a) => a.id === actionId);
      /* A targeted action is gated by definition — its whole point is a named
       * list. Everything else asks only when an admin turned it on. */
      const gated = action?.targeted || permissions[actionId] === true;
      if (!action || !gated) return Promise.resolve(NO_APPROVAL_NEEDED);

      return new Promise((resolve) => {
        resolveRef.current = resolve;
        setRequest({ action, detail });
      });
    },
    [permissions],
  );

  const finish = (person) => {
    setRequest(null);
    const done = resolveRef.current;
    resolveRef.current = null;
    if (person) {
      /* With no crew accounts or shift sign-in, this log IS the audit trail:
       * who, what, when, which shop. Newest first, capped. */
      setLog((prev) =>
        [
          {
            id: `AP-${Date.now().toString(36)}`,
            at: new Date().toISOString(),
            actionId: request?.action?.id,
            actionLabel: request?.action?.label,
            detail: request?.detail ?? null,
            personId: person.id,
            personName: person.name,
            locationId: location?.id ?? null,
            locationName: location?.name ?? null,
          },
          ...prev,
        ].slice(0, 200),
      );
    }
    done?.(person);
  };

  return (
    <ApprovalContext.Provider value={approve}>
      {children}
      {request && (
        <ApprovalDialog
          action={request.action}
          detail={request.detail}
          roster={roster}
          allows={allows}
          namedCount={request.action.targeted ? idsFor(request.action.id).length : null}
          onCancel={() => finish(null)}
          onApprove={finish}
        />
      )}
    </ApprovalContext.Provider>
  );
}

/* ------------------------------------------------------------------ Dialog */

function ApprovalDialog({ action, detail, roster, allows, namedCount, onCancel, onApprove }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(null);

  const submit = () => {
    const person = roster.findByPin(pin);
    if (!person) {
      /* The tablet cannot mint an approver; PINs are issued by an admin on
       * the console, so the miss says where one comes from. */
      setError("PIN not recognised — an admin issues these from the console.");
      setPin("");
      return;
    }
    if (action.targeted && !allows(action.id, person.id)) {
      setError(`${person.name.split(" ")[0]} isn't on the list for this.`);
      setPin("");
      return;
    }
    onApprove(person);
  };

  return (
    <Modal
      open
      onClose={onCancel}
      title={action.label}
      icon={ShieldCheck}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="primary" icon={Check} disabled={pin.length !== 4} onClick={submit}>
            Approve
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* What is being approved, in the words of the thing that asked;
            never just "enter your PIN". */}
        <p className="text-sm text-ink-2 leading-relaxed">
          {detail ? (
            <>
              <span className="font-medium text-ink">{detail}</span> — {action.detail}
            </>
          ) : (
            action.detail
          )}
        </p>
        {action.targeted && (
          <p className="text-xs text-ink-4 leading-relaxed">
            {namedCount === 0
              ? "Nobody is named for this yet — an admin sets that on the Permissions screen."
              : `${namedCount} ${namedCount === 1 ? "person is" : "people are"} named for this on the Permissions screen.`}
          </p>
        )}
        <div>
          <p className="text-xs text-ink-3 mb-1.5">Manager PIN</p>
          <PinInput
            value={pin}
            invalid={!!error}
            autoFocus
            onChange={(e) => {
              setError(null);
              setPin(e.target.value.replace(/\D/g, "").slice(0, 4));
            }}
            onKeyDown={(e) => e.key === "Enter" && pin.length === 4 && submit()}
          />
        </div>

        <p className={cx("text-xs h-4 -mt-1", error ? "text-danger" : "text-transparent")}>
          {error || "placeholder"}
        </p>
      </div>
    </Modal>
  );
}
