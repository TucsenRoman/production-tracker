"use client";

import React, { useState } from "react";
import { Calendar, Save, Settings as SettingsIcon, Sparkles } from "lucide-react";

import { Badge, Button, Field, Input, Modal } from "../../components/ui";
import { relativeTime } from "../../lib/domain";

/**
 * Business details as a modal (Sept 2026) — opened from the brand-title
 * dropdown (ConsoleShell's BrandMenu). Replaced the standalone
 * `/company/settings` route from earlier the same session: the user tried
 * a real page first, then asked for a modal instead. See AppShell.jsx's
 * project-memory notes for the full back-and-forth.
 *
 * The parent only mounts this while `settingsOpen` is true (see
 * CompanyConsole.jsx), so local form state always starts fresh from
 * `company` on every open — no reset effect needed, same convention as
 * TeamScreen.jsx's PersonDialog/PinDialog.
 */
export default function SettingsModal({ onClose, company, canManage, onUpdate }) {
  const [name, setName] = useState(company.name);
  const [ownerEmail, setOwnerEmail] = useState(company.ownerEmail);

  const trimmedName = name.trim();
  const trimmedEmail = ownerEmail.trim();
  const validEmail = /^\S+@\S+\.\S+$/.test(trimmedEmail);
  const dirty = trimmedName !== company.name || trimmedEmail !== company.ownerEmail;
  const canSave = canManage && dirty && trimmedName.length > 0 && validEmail;

  const handleSave = () => {
    if (!canSave) return;
    onUpdate({ name: trimmedName, ownerEmail: trimmedEmail });
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Settings"
      icon={SettingsIcon}
      size="md"
      footer={
        canManage ? (
          <>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" icon={Save} disabled={!canSave} onClick={handleSave}>
              Save changes
            </Button>
          </>
        ) : (
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        )
      }
    >
      <div className="space-y-4">
        {!canManage && <p className="text-xs text-ink-3">Only an admin can change these.</p>}

        <Field label="Business name">
          <Input
            autoFocus
            value={name}
            disabled={!canManage}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your company name"
          />
        </Field>

        <Field
          label="Owner email" hint="Where account and billing notices go." error={trimmedEmail && !validEmail ? "That doesn't look like a valid email." : undefined}
        >
          <Input
            type="email" value={ownerEmail}
            disabled={!canManage}
            onChange={(e) => setOwnerEmail(e.target.value)}
            placeholder="owner@business.com"
          />
        </Field>

        <div className="pt-2 mt-1 border-t border-line space-y-2">
          <div className="flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-2 text-sm text-ink-2">
              <Sparkles size={14} className="text-ink-3 shrink-0" /> Plan
            </span>
            <Badge tone="info">{company.plan}</Badge>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-2 text-sm text-ink-2">
              <Calendar size={14} className="text-ink-3 shrink-0" /> Account created
            </span>
            <span className="text-sm text-ink-3">{relativeTime(company.createdAt)}</span>
          </div>
        </div>
      </div>
    </Modal>
  );
}
