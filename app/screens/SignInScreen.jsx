"use client";

import React, { useState } from "react";
import { Delete, KeyRound, LogIn } from "lucide-react";

import { Button, PinInput, cx } from "../components/ui";
import { findStaffByPin } from "../lib/domain";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", null, "0", "del"];

/**
 * Shop-floor terminals are shared, so the product opens on a sign-in rather
 * than assuming an identity. The keypad is there because most of these screens
 * are wall-mounted tablets with gloves nearby.
 */
export default function SignInScreen({ onSignIn }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);

  const submit = (value = pin) => {
    const staff = findStaffByPin(value);
    if (staff) onSignIn(staff);
    else {
      setError(true);
      setPin("");
    }
  };

  const press = (k) => {
    setError(false);
    if (k === "del") return setPin((p) => p.slice(0, -1));
    if (pin.length >= 4) return;
    const next = pin + k;
    setPin(next);
    if (next.length === 4) setTimeout(() => submit(next), 120);
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-5 py-10 bg-canvas">
      <div className="w-full max-w-xs">
        <div className="text-center mb-8">
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-brand mb-2">
            Milaca Meats
          </p>
          <h1 className="text-2xl font-bold text-ink font-display">Production</h1>
          <p className="mt-2 text-sm text-ink-3">Enter your PIN to start your shift.</p>
        </div>

        <div className="bg-surface border border-line rounded-xl shadow-sm p-5">
          <label htmlFor="pin" className="sr-only">
            Staff PIN
          </label>
          <PinInput
            id="pin"
            value={pin}
            invalid={error}
            autoFocus
            onChange={(e) => {
              setError(false);
              setPin(e.target.value.replace(/\D/g, ""));
            }}
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />

          <p
            className={cx(
              "mt-2 text-center text-xs h-4",
              error ? "text-danger" : "text-transparent"
            )}
          >
            PIN not recognised.
          </p>

          <div className="grid grid-cols-3 gap-2 mt-2">
            {KEYS.map((k, i) =>
              k === null ? (
                <div key={i} />
              ) : (
                <button
                  key={i}
                  onClick={() => press(k)}
                  className={cx(
                    "min-h-14 rounded-lg text-lg font-medium tnum",
                    "border border-line-strong bg-surface text-ink",
                    "hover:bg-sunken active:bg-sunken transition-colors duration-75",
                    "flex items-center justify-center"
                  )}
                >
                  {k === "del" ? <Delete size={18} className="text-ink-3" /> : k}
                </button>
              )
            )}
          </div>

          <Button
            block
            size="lg"
            variant="primary"
            icon={LogIn}
            className="mt-3"
            disabled={pin.length !== 4}
            onClick={() => submit()}
          >
            Sign in
          </Button>
        </div>

        <p className="mt-5 flex items-center justify-center gap-1.5 text-xs text-ink-4">
          <KeyRound size={12} /> Ask a manager if you need a PIN.
        </p>
      </div>
    </main>
  );
}
