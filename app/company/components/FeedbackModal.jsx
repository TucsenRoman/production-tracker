"use client";

import React, { useState } from "react";
import { MessageSquareText, Send } from "lucide-react";

import { Button, Field, Modal, Segmented, useToast } from "../../components/ui";

const CATEGORIES = [
  { value: "idea", label: "Idea" },
  { value: "bug", label: "Bug" },
  { value: "question", label: "Question" },
  { value: "other", label: "Other" },
];

const TEXTAREA_BASE =
  "w-full min-h-32 bg-surface border border-line-strong rounded-md px-2.5 py-2 text-sm text-ink " +
  "placeholder:text-ink-4 transition-colors duration-100 focus:border-primary outline-none resize-y";

/**
 * Feedback as a modal (Sept 2026) — opened from the brand-title dropdown
 * (ConsoleShell's BrandMenu), same pivot as SettingsModal.jsx: replaced
 * the standalone `/company/feedback` route from earlier the same session.
 * No admin gate — any signed-in user reaches it. No backend behind it
 * yet — "Send" is a mock, same "sort of" placeholder pattern as
 * PermissionsScreen's request-access flow and IntegrationsScreen's test
 * connection.
 *
 * The parent only mounts this while `feedbackOpen` is true, so it always
 * opens on a blank form.
 */
export default function FeedbackModal({ onClose }) {
  const toast = useToast();
  const [category, setCategory] = useState("idea");
  const [message, setMessage] = useState("");

  const trimmed = message.trim();
  const canSend = trimmed.length > 0;

  const handleSend = () => {
    if (!canSend) return;
    toast("Feedback sent — sort of", {
      detail: "There's no inbox behind this yet; the real thing arrives with the full build.",
    });
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Feedback"
      icon={MessageSquareText}
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" icon={Send} disabled={!canSend} onClick={handleSend}>
            Send
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-xs text-ink-3">
          Bug reports, ideas, or anything else about the console or the floor terminal.
        </p>

        <Field label="What kind of feedback is this?">
          <Segmented options={CATEGORIES} value={category} onChange={setCategory} />
        </Field>

        <Field label="Message">
          <textarea
            autoFocus
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="What's on your mind?"
            className={TEXTAREA_BASE}
          />
        </Field>
      </div>
    </Modal>
  );
}
