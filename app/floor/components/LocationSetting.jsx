"use client";

/**
 * "Which shop is this tablet": the one-time question, and the guarded way to
 * change the answer later. Neither belongs to a screen: the picker gates the
 * whole app, and the switch hangs off the shell.
 */

import React, { useState } from "react";
import { Check, MapPin, ShieldCheck } from "lucide-react";

import { Button, Modal, PinInput, cx } from "../../components/ui";
import { useCompanyRoster } from "../lib/companyRoster";
import { useActionAccess } from "../../company/lib/actionAccess";

/**
 * Asked once, on a tablet that has never been told where it is and has more
 * than one shop to choose from. Deliberately not gated: nothing exists to
 * protect yet.
 */
export function LocationPicker({ locations, onPick }) {
  return (
    <main className="min-h-screen flex items-center justify-center bg-canvas px-5 py-10">
      <div className="w-full max-w-xs">
        <div className="mb-8">
          <p className="text-xs font-medium text-brand mb-2">Protrack</p>
          <h1 className="text-[32px] font-bold text-ink leading-tight">Which shop is this?</h1>
          <p className="mt-2 text-sm text-ink-3">
            Everything this tablet records files against the shop you pick. You can change it later.
          </p>
        </div>

        <div className="bg-surface border border-line rounded-md p-2">
          <ul>
            {locations.map((l) => (
              <li key={l.id}>
                <button
                  type="button"
                  onClick={() => onPick(l.id)}
                  className="w-full flex items-center gap-3 px-3 py-3.5 rounded-md text-left hover:bg-hover transition-colors duration-100"
                >
                  <MapPin size={16} className="text-icon-2 shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-ink truncate">{l.name}</span>
                    {l.address && (
                      <span className="block text-xs text-ink-3 truncate">{l.address}</span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </main>
  );
}

/**
 * Changing it afterwards: pick the shop, then prove you are someone the
 * Permissions screen named for `switch-location`. The PIN approves one
 * action; it does not sign anyone in.
 */
export function LocationSwitchDialog({ current, locations, onCancel, onSwitch }) {
  const [pickedId, setPickedId] = useState(current?.id ?? null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState(null);
  const roster = useCompanyRoster();
  const { allows } = useActionAccess();

  const picked = locations.find((l) => l.id === pickedId) || null;
  const changing = picked && picked.id !== current?.id;

  const approve = () => {
    const person = roster.findByPin(pin);
    if (!person) {
      setError("PIN not recognised.");
      setPin("");
      return;
    }
    /* Named, not merely senior: an admin left off the list is still refused,
     * otherwise the Permissions assignment would be decoration. */
    if (!allows("switch-location", person.id)) {
      setError(`${person.name.split(" ")[0]} isn't allowed to move a tablet between shops.`);
      setPin("");
      return;
    }
    onSwitch(picked.id, person);
  };

  return (
    <Modal
      open
      onClose={onCancel}
      title="Change which shop this tablet is set to"
      icon={MapPin}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant="primary"
            icon={Check}
            disabled={!changing || pin.length !== 4}
            onClick={approve}
          >
            Switch shop
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="space-y-1.5">
          {locations.map((l) => {
            const on = l.id === pickedId;
            return (
              <button
                key={l.id}
                type="button"
                onClick={() => {
                  setError(null);
                  setPickedId(l.id);
                }}
                className={cx(
                  "w-full flex items-center gap-2.5 px-3 py-2 rounded-md border text-sm text-left",
                  on ? "border-line-strong bg-hover text-ink" : "border-line text-ink-2 hover:bg-hover"
                )}
              >
                <MapPin size={14} className="shrink-0 text-icon-2" />
                <span className="min-w-0 flex-1 truncate">{l.name}</span>
                {l.id === current?.id && <span className="text-xs text-ink-4 shrink-0">Current</span>}
              </button>
            );
          })}
        </div>

        {/* Warning shown only once a change is actually on the table. */}
        {changing && (
          <p className="text-xs text-ink-3 leading-relaxed">
            Everything recorded from now on files against{" "}
            <span className="font-medium text-ink">{picked.name}</span>. Work already logged stays
            where it is.
          </p>
        )}

        <div>
          <p className="flex items-center gap-1.5 text-xs text-ink-3 mb-1.5">
            <ShieldCheck size={12} className="text-icon-2" /> Manager PIN
          </p>
          <PinInput
            value={pin}
            invalid={!!error}
            autoFocus
            onChange={(e) => {
              setError(null);
              setPin(e.target.value.replace(/\D/g, "").slice(0, 4));
            }}
            onKeyDown={(e) => e.key === "Enter" && changing && pin.length === 4 && approve()}
          />
          <p className={cx("mt-2 text-xs h-4", error ? "text-danger" : "text-transparent")}>
            {error || "placeholder"}
          </p>
        </div>
      </div>
    </Modal>
  );
}
