"use client";

import React, { useState } from "react";
import { ArrowLeft, Building2, LogIn, Sparkles, UserPlus } from "lucide-react";

import { Button, Field, Input, Segmented, cx } from "../../components/ui";
import { isValidEmail } from "../lib/companyDomain";

/**
 * Owner/admin account entry — email + password, unlike the shared-terminal
 * PIN pad. This is a demo: no password is ever actually checked against a
 * server, so sign-in matches on email alone and any 6+ character password
 * is accepted. That's called out on-screen rather than hidden.
 */
export default function CompanyAuthScreen({ users, onSignIn, onCreateCompany }) {
  const [mode, setMode] = useState("signin");

  const [signInForm, setSignInForm] = useState({ email: "dana@milacameats.com", password: "" });
  const [signInError, setSignInError] = useState(null);

  const [createForm, setCreateForm] = useState({ company: "", name: "", email: "", password: "" });
  const [createError, setCreateError] = useState(null);

  const submitSignIn = () => {
    const email = signInForm.email.trim().toLowerCase();
    if (!isValidEmail(email)) return setSignInError("Enter a valid email address.");
    if (signInForm.password.length < 6) return setSignInError("Password must be at least 6 characters.");
    const user = users.find((u) => u.email.toLowerCase() === email);
    if (!user) return setSignInError("No account found for that email.");
    if (user.status !== "active") return setSignInError("This invite hasn't been accepted yet.");
    setSignInError(null);
    onSignIn(user);
  };

  const submitCreate = () => {
    const email = createForm.email.trim().toLowerCase();
    if (!createForm.company.trim()) return setCreateError("Company name is required.");
    if (!createForm.name.trim()) return setCreateError("Your name is required.");
    if (!isValidEmail(email)) return setCreateError("Enter a valid email address.");
    if (createForm.password.length < 6) return setCreateError("Password must be at least 6 characters.");
    setCreateError(null);
    onCreateCompany({ companyName: createForm.company.trim(), name: createForm.name.trim(), email });
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-5 py-10 bg-canvas">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-primary-soft text-primary-ink mb-3">
            <Building2 size={20} />
          </div>
          <h1 className="text-2xl font-bold text-ink font-display">Company account</h1>
          <p className="mt-2 text-sm text-ink-3">
            Manage locations, your team, and POS integrations across your business.
          </p>
        </div>

        <div className="flex justify-center mb-5">
          <Segmented
            value={mode}
            onChange={setMode}
            options={[
              { value: "signin", label: "Sign in" },
              { value: "create", label: "Create account" },
            ]}
          />
        </div>

        <div className="bg-surface border border-line rounded-xl shadow-sm p-5">
          {mode === "signin" ? (
            <div className="space-y-4">
              <Field label="Email">
                <Input
                  autoFocus
                  type="email"
                  value={signInForm.email}
                  onChange={(e) => setSignInForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="you@company.com"
                />
              </Field>
              <Field label="Password" error={signInError}>
                <Input
                  type="password"
                  value={signInForm.password}
                  onChange={(e) => setSignInForm((f) => ({ ...f, password: e.target.value }))}
                  onKeyDown={(e) => e.key === "Enter" && submitSignIn()}
                  placeholder="••••••••"
                />
              </Field>
              <Button block size="lg" variant="primary" icon={LogIn} onClick={submitSignIn}>
                Sign in
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <Field label="Company name">
                <Input
                  autoFocus
                  value={createForm.company}
                  onChange={(e) => setCreateForm((f) => ({ ...f, company: e.target.value }))}
                  placeholder="Your business name"
                />
              </Field>
              <Field label="Your name">
                <Input
                  value={createForm.name}
                  onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Full name"
                />
              </Field>
              <Field label="Email">
                <Input
                  type="email"
                  value={createForm.email}
                  onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="you@company.com"
                />
              </Field>
              <Field label="Password" error={createError}>
                <Input
                  type="password"
                  value={createForm.password}
                  onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))}
                  onKeyDown={(e) => e.key === "Enter" && submitCreate()}
                  placeholder="At least 6 characters"
                />
              </Field>
              <Button block size="lg" variant="primary" icon={UserPlus} onClick={submitCreate}>
                Create company account
              </Button>
            </div>
          )}
        </div>

        <p
          className={cx(
            "mt-5 flex items-start gap-1.5 text-xs text-ink-4 leading-relaxed",
            "px-3 py-2.5 rounded-lg bg-sunken"
          )}
        >
          <Sparkles size={13} className="shrink-0 mt-0.5 text-primary-ink" />
          Demo mode — sign-in only checks the email, any password of 6+ characters works. Try{" "}
          <span className="font-mono text-ink-3">dana@milacameats.com</span> (owner) or{" "}
          <span className="font-mono text-ink-3">maria.ruiz@milacameats.com</span> (admin).
        </p>

        <a
          href="/"
          className="mt-4 flex items-center justify-center gap-1.5 text-xs font-medium text-ink-3 hover:text-primary-ink transition-colors"
        >
          <ArrowLeft size={12} /> Back to the shop floor terminal
        </a>
      </div>
    </main>
  );
}
