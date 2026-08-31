"use client";

import React, { useState } from "react";
import { Building2, Calendar, Mail, Save, Sparkles } from "lucide-react";

import { Badge, Button, Card, Field, Input } from "../../components/ui";
import { relativeTime } from "../../lib/domain";

/**
 * Business details for the company itself — name and the owner's contact
 * email. Plan and account-created date are shown for reference but aren't
 * editable here; this is a demo, there's no billing system behind "plan"
 * to change it against.
 */
export default function SettingsScreen({ company, canManage, onUpdate }) {
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
  };

  return (
    <div className="space-y-4">
      <Card>
        <div className="px-4 sm:px-5 py-3.5 border-b border-line">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
            <Building2 size={14} className="text-primary-ink" /> Business details
          </h3>
          <p className="mt-0.5 text-xs text-ink-3">
            {canManage
              ? "The name and contact on file for this account."
              : "Only an owner or admin can change these."}
          </p>
        </div>

        <div className="px-4 sm:px-5 py-4 space-y-4">
          <Field label="Business name">
            <Input
              value={name}
              disabled={!canManage}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your company name"
            />
          </Field>

          <Field
            label="Owner email"
            hint="Where account and billing notices go."
            error={trimmedEmail && !validEmail ? "That doesn't look like a valid email." : undefined}
          >
            <Input
              type="email"
              value={ownerEmail}
              disabled={!canManage}
              onChange={(e) => setOwnerEmail(e.target.value)}
              placeholder="owner@business.com"
            />
          </Field>

          {canManage && (
            <div className="flex items-center justify-end gap-2 pt-1">
              <Button
                variant="ghost"
                disabled={!dirty}
                onClick={() => {
                  setName(company.name);
                  setOwnerEmail(company.ownerEmail);
                }}
              >
                Discard
              </Button>
              <Button variant="primary" icon={Save} disabled={!canSave} onClick={handleSave}>
                Save changes
              </Button>
            </div>
          )}
        </div>
      </Card>

      <Card>
        <div className="px-4 sm:px-5 py-3.5 border-b border-line">
          <h3 className="text-sm font-semibold text-ink">Account</h3>
        </div>
        <div className="divide-y divide-line">
          <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3">
            <span className="inline-flex items-center gap-2 text-sm text-ink-2">
              <Sparkles size={14} className="text-ink-3 shrink-0" /> Plan
            </span>
            <Badge tone="info">{company.plan}</Badge>
          </div>
          <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3">
            <span className="inline-flex items-center gap-2 text-sm text-ink-2">
              <Calendar size={14} className="text-ink-3 shrink-0" /> Account created
            </span>
            <span className="text-sm text-ink-3">{relativeTime(company.createdAt)}</span>
          </div>
          <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3">
            <span className="inline-flex items-center gap-2 text-sm text-ink-2">
              <Mail size={14} className="text-ink-3 shrink-0" /> Owner email
            </span>
            <span className="text-sm text-ink-3 truncate">{company.ownerEmail}</span>
          </div>
        </div>
      </Card>
    </div>
  );
}
