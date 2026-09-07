"use client";

import React, { useState } from "react";
import { ArrowLeft, Building2, Check, Delete, KeyRound, LogIn } from "lucide-react";

import { Button, PinInput, cx } from "../components/ui";
import { useStaff } from "../lib/staff";
import { asFloorUser, useCompanyRoster } from "../lib/companyRoster";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", null, "0", "del"];

/** The pad itself, so signing in and choosing a PIN use the same one. */
function Keypad({ onPress }) {
  return (
    <div className="grid grid-cols-3 gap-2 mt-2">
      {KEYS.map((k, i) =>
        k === null ? (
          <div key={i} />
        ) : (
          <button
            key={i}
            onClick={() => onPress(k)}
            className={cx(
              "min-h-14 rounded-md text-lg font-medium tnum",
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
  );
}

/**
 * Shop-floor terminals are shared, so the product opens on a sign-in rather
 * than assuming an identity. The keypad is there because most of these screens
 * are wall-mounted tablets with gloves nearby.
 *
 * On a tablet-and-up viewport (matching TabletFrame's own `lg` tablet preset)
 * the sign-in card gets a companion illustration panel (public/sign-in-
 * illustration.jpg, supplied by the user and used as-is) — a deliberate,
 * recorded exception to the DNA's "never an illustration" rule (see
 * .claude/skills/notion/dna.json -> approved_forks). Below `lg` the screen is
 * exactly what it always was: a single centred card, no illustration. The
 * two panels share one hairline divider, never a card border.
 */
export default function SignInScreen({ onSignIn }) {
  const { findByPin } = useStaff();
  const roster = useCompanyRoster();
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);

  /* "pin" is the shift sign-in. "claim" is a floor manager choosing their PIN
   * for the first time — a one-off that happens on this same tablet, so it is
   * a mode of this screen rather than a route of its own. */
  const [mode, setMode] = useState("pin");
  const [claiming, setClaiming] = useState(null); // the person picked
  const [first, setFirst] = useState("");         // their new PIN
  const [confirm, setConfirm] = useState("");     // typed again
  const [claimError, setClaimError] = useState(null);

  const submit = (value = pin) => {
    /* The company roster first: a floor manager's PIN lives on their one
     * person record now, not in a second staff list. `findByPin` stays as the
     * fallback until the two rosters are actually merged. */
    const person = roster.findByPin(value);
    const staff = person ? asFloorUser(person) : findByPin(value);
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

  /* One pad drives whichever box is live: the new PIN until it has four
   * digits, then the confirmation. */
  const stage = first.length < 4 ? "first" : "confirm";
  const claimPress = (k) => {
    setClaimError(null);
    const [value, set] = stage === "first" ? [first, setFirst] : [confirm, setConfirm];
    if (k === "del") return set(value.slice(0, -1));
    if (value.length >= 4) return;
    const next = value + k;
    set(next);
    if (stage === "confirm" && next.length === 4) setTimeout(() => finishClaim(first, next), 140);
  };

  const finishClaim = (a, b) => {
    if (a !== b) {
      setClaimError("Those didn't match. Try again.");
      setFirst("");
      setConfirm("");
      return;
    }
    const failure = roster.claim(claiming.id, a);
    if (failure) {
      setClaimError(failure);
      setFirst("");
      setConfirm("");
      return;
    }
    /* Straight onto the floor — they came to start a shift, not to fill in a
     * form and then sign in again. */
    onSignIn(asFloorUser({ ...claiming, pin: a }));
  };

  const resetClaim = () => {
    setMode("pin");
    setClaiming(null);
    setFirst("");
    setConfirm("");
    setClaimError(null);
  };

  return (
    <main className="min-h-screen flex bg-canvas">
      <div className="hidden lg:flex lg:w-1/2 items-center justify-center border-r border-line overflow-hidden">
        {/* Reference illustration supplied directly by the user — dropped in
            as-is rather than redrawn, per their instruction. Its own
            near-white background (see the img) already sits close enough to
            --color-canvas that it reads as native to the page. Scaled up
            2.5x from its fitted size, cropped by the panel's overflow. */}
        <img
          src="/sign-in-illustration.jpg"
          alt="Illustration of a production floor with a rear office loft"
          className="w-full h-auto scale-[2.5]"
        />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-5 py-10">
        <div className="w-full max-w-xs">
          <div className="mb-8">
            <p className="text-xs font-medium text-brand mb-2">
              Milaca Meats
            </p>
            <h1 className="text-[32px] font-bold text-ink leading-tight">Production</h1>
            <p className="mt-2 text-sm text-ink-3">
              {mode === "pin"
                ? "Enter your PIN to start your shift."
                : claiming
                  ? `Choose a PIN, ${claiming.name.split(" ")[0]}. Only you will know it.`
                  : "Find your name to set up your PIN."}
            </p>
          </div>

          {mode === "pin" ? (
            <div className="bg-surface border border-line rounded-md p-5">
              <label htmlFor="pin" className="sr-only">
                Staff PIN
              </label>
              <PinInput
                id="pin" value={pin}
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
                  "mt-2  text-xs h-4",
                  error ? "text-danger" : "text-transparent"
                )}
              >
                PIN not recognised.
              </p>

              <Keypad onPress={press} />

              <Button
                block
                size="lg" variant="primary" icon={LogIn}
                className="mt-3" disabled={pin.length !== 4}
                onClick={() => submit()}
              >
                Sign in
              </Button>
            </div>
          ) : (
            <div className="bg-surface border border-line rounded-md p-5">
              {!claiming ? (
                /* Only people an admin has already added, and only the ones
                 * without a PIN — so this is a short list that empties itself,
                 * not a directory of everyone who works here. */
                roster.unclaimed.length === 0 ? (
                  <p className="text-sm text-ink-3 leading-relaxed">
                    Everyone on the roster has a PIN already. If yours isn&rsquo;t working, ask an
                    admin to clear it — they can reset it, but they can&rsquo;t read it.
                  </p>
                ) : (
                  <ul className="-mx-2">
                    {roster.unclaimed.map((p) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          onClick={() => setClaiming(p)}
                          className="w-full flex items-center gap-3 px-2 py-3 rounded-md text-left hover:bg-hover transition-colors duration-100"
                        >
                          <span className="flex items-center justify-center w-9 h-9 rounded-full bg-sunken text-ink-2 text-xs font-semibold shrink-0">
                            {p.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-medium text-ink truncate">{p.name}</span>
                            <span className="block text-xs text-ink-3">Needs a PIN</span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )
              ) : (
                <>
                  {/* Two boxes, not two screens: seeing the first one filled
                    * while typing the second is what makes "type it again"
                    * feel like confirmation rather than a repeat. */}
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-ink-3 mb-1.5">New PIN</p>
                      <PinInput value={first} readOnly invalid={!!claimError} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-ink-3 mb-1.5">Again</p>
                      <PinInput value={confirm} readOnly invalid={!!claimError} />
                    </div>
                  </div>

                  <p
                    className={cx(
                      "mt-2 text-xs h-4",
                      claimError ? "text-danger" : "text-transparent"
                    )}
                  >
                    {claimError || "placeholder"}
                  </p>

                  <Keypad onPress={claimPress} />

                  <Button
                    block
                    size="lg" variant="primary" icon={Check}
                    className="mt-3"
                    disabled={first.length !== 4 || confirm.length !== 4}
                    onClick={() => finishClaim(first, confirm)}
                  >
                    Set PIN and start shift
                  </Button>
                </>
              )}
            </div>
          )}

          {mode === "pin" ? (
            <>
              <p className="mt-5 flex items-center justify-center gap-1.5 text-xs text-ink-4">
                <KeyRound size={12} /> Ask a manager if you need a PIN.
              </p>
              {roster.unclaimed.length > 0 && (
                <button
                  type="button"
                  onClick={() => setMode("claim")}
                  className="mt-3 w-full flex items-center justify-center gap-1.5 text-xs font-medium text-ink-3 hover:text-ink hover:underline transition-colors"
                >
                  Setting up? Find your name
                </button>
              )}
            </>
          ) : (
            <button
              type="button"
              onClick={claiming ? () => { setClaiming(null); setFirst(""); setConfirm(""); setClaimError(null); } : resetClaim}
              className="mt-5 w-full flex items-center justify-center gap-1.5 text-xs font-medium text-ink-3 hover:text-ink hover:underline transition-colors"
            >
              <ArrowLeft size={12} /> {claiming ? "Pick a different name" : "Back to sign in"}
            </button>
          )}

          <a
            href="/company/milaca-meats" className="mt-3 flex items-center justify-center gap-1.5 text-xs font-medium text-ink-3 hover:text-ink hover:underline transition-colors"
          >
            <Building2 size={12} /> Manage your company account
          </a>
        </div>
      </div>
    </main>
  );
}
