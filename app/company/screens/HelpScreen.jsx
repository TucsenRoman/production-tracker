"use client";

import React from "react";
import { MessageSquareText } from "lucide-react";

import { Button, SectionHeading } from "../../components/ui";

const FAQS = [
  {
    q: "What's the difference between Targets and Assignments?",
    a: "Targets is what to make — a product and quantity per station per day. Assignments is staff to-do items — who's doing what, not what's being produced. They're genuinely different things, not two names for the same screen.",
  },
  {
    q: "How do I invite someone to the team?",
    a: "Go to Team (admins only) and choose Invite. They'll show up as active once they accept — simulated in this demo, no real email goes out.",
  },
  {
    q: "How do I connect our point-of-sale?",
    a: "Go to Integrations (admins only) and connect Clover for each location that needs it.",
  },
  {
    q: "Where do I change the business name or owner email?",
    a: "Open the “Milaca Meats ⌄” dropdown next to the sidebar's brand name and choose Settings.",
  },
  {
    q: "How do I switch between the console and the shop floor terminal?",
    a: "Click your account in the sidebar footer, then “Switch to the shop floor terminal.”",
  },
  {
    q: "Can we change our plan?",
    a: "Yes — open the “Milaca Meats ⌄” dropdown and choose Plan to compare tiers and switch.",
  },
  {
    q: "Who can see what?",
    a: "Permissions (admins only) controls which actions need a Lead PIN, and each teammate's role controls which screens they see at all.",
  },
];

/**
 * The one item in the brand-title dropdown that's a real page
 * (`/company/help`) rather than a modal (Sept 2026) — reference
 * material worth deep-linking or leaving open in another tab, unlike
 * Settings/Feedback/Plan's quick in-place actions. See HelpPageClient.jsx
 * and ConsoleShell.jsx's BrandMenu doc comment.
 */
export default function HelpScreen({ onSendFeedback }) {
  return (
    <div className="space-y-6">
      <div>
        <SectionHeading label="Getting started" />
        <ul className="mt-2 space-y-2 text-sm text-ink-2 leading-relaxed">
          <li>Sign in with your work email (any password of 6+ characters works in this demo), or switch accounts from the sidebar footer.</li>
          <li>The sidebar moves you between Insights, Targets, Assignments, Inventory, Team, Permissions, Locations, Stations, and Integrations — what you see depends on your role.</li>
          <li>The “Milaca Meats ⌄” dropdown next to the brand name holds Settings, Feedback, Plan, and this Help page.</li>
          <li>Double-tap “b” to collapse the sidebar, or double-tap a number key (1–9) to jump straight to a nav item.</li>
        </ul>
      </div>

      <div>
        <SectionHeading label="Frequently asked questions" />
        <ul className="mt-1 divide-y divide-line">
          {FAQS.map((item) => (
            <li key={item.q} className="py-3">
              <p className="text-sm font-medium text-ink">{item.q}</p>
              <p className="mt-1 text-sm text-ink-3 leading-relaxed">{item.a}</p>
            </li>
          ))}
        </ul>
      </div>

      <div className="pt-3 border-t border-line">
        <p className="text-sm text-ink-2">Still stuck?</p>
        <p className="mt-0.5 text-xs text-ink-3">Send us a note and we'll take a look.</p>
        <Button variant="secondary" icon={MessageSquareText} className="mt-2" onClick={onSendFeedback}>
          Send feedback
        </Button>
      </div>
    </div>
  );
}
