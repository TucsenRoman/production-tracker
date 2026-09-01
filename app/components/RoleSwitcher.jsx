"use client";

/**
 * Role switcher.
 *
 * This build is a demo, so the switcher is always available: showing the
 * permission-gated screens is the point, and making someone sign out and
 * re-enter a PIN to see the manager view is friction with no payoff.
 *
 * If this ever becomes a real deployment, put it behind
 * `process.env.NODE_ENV !== "production"` — a shop-floor tablet with a "become
 * owner" button would undo the whole PIN hierarchy it sits on top of.
 *
 * The change is session-only either way: the stored staff record is untouched,
 * so a refresh returns the user to the role they actually hold.
 */

import React, { useState } from "react";
import { ChevronUp, ShieldCheck } from "lucide-react";

import { ROLES, ROLE_BLURB, ROLE_LABEL } from "../lib/domain";
import { cx } from "./ui";

export default function RoleSwitcher({ user, onChange }) {
  const [open, setOpen] = useState(false);

  if (!user) return null;

  // Highest first, so the ladder reads top-down the way the popover stacks.
  const roles = [...ROLES].reverse();

  return (
    <div
      // Hover for a mouse, tap for a tablet, focus for a keyboard — the same
      // wrapper covers all three, and wrapping the popover keeps it open while
      // the pointer travels from the button up into it.
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false);
      }}
      className={cx(
        "fixed z-[55] flex flex-col items-end gap-2",
        // Clear of the mobile tab bar, and below the toast layer so a message
        // is never hidden behind a button that is always there anyway.
        "right-4 bottom-20 lg:right-5 lg:bottom-5"
      )}
    >
      {open && (
        <div className="w-56 bg-surface border border-line rounded-xl shadow-pop overflow-hidden animate-pop-in">
          <div className="px-3 py-2 border-b border-line">
            <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-ink-4">
              View as
            </p>
            <p className="mt-0.5 text-xs text-ink-3 truncate">{user.name}</p>
          </div>

          <div className="p-1">
            {roles.map((role) => {
              const active = user.role === role;
              return (
                <button
                  key={role}
                  type="button"
                  onClick={() => {
                    onChange(role);
                    setOpen(false);
                  }}
                  className={cx(
                    "w-full text-left px-2.5 py-2 rounded-md transition-colors duration-100",
                    active ? "bg-primary-soft" : "hover:bg-sunken"
                  )}
                >
                  <span
                    className={cx(
                      "block text-sm font-medium",
                      active ? "text-primary-ink" : "text-ink"
                    )}
                  >
                    {ROLE_LABEL[role]}
                    {active && <span className="ml-1.5 text-[11px] font-normal">· current</span>}
                  </span>
                  <span className="block mt-0.5 text-[11px] leading-snug text-ink-3">
                    {ROLE_BLURB[role]}
                  </span>
                </button>
              );
            })}
          </div>

          <p className="px-3 py-2 border-t border-line text-[11px] leading-snug text-ink-4">
            Session only — a refresh restores the real role.
          </p>
        </div>
      )}

      <button
        type="button"
        aria-expanded={open}
        aria-label={`Development role switcher — currently ${ROLE_LABEL[user.role]}`}
        onClick={() => setOpen((v) => !v)}
        className={cx(
          "flex items-center gap-1.5 pl-3 pr-2.5 h-10 rounded-full shadow-lg",
          "border border-line-strong bg-surface text-ink-2",
          "hover:bg-sunken transition-colors duration-100"
        )}
      >
        <ShieldCheck size={15} className="text-primary-ink shrink-0" />
        <span className="text-xs font-medium capitalize">{ROLE_LABEL[user.role]}</span>
        <ChevronUp
          size={13}
          className={cx("text-ink-4 transition-transform duration-150", open && "rotate-180")}
        />
      </button>
    </div>
  );
}
