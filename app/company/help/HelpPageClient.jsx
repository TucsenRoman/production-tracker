"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CircleHelp } from "lucide-react";

import { Button, EmptyState, ToastProvider, useToast } from "../../components/ui";
import ConsoleShell from "../components/ConsoleShell";
import BrandModals from "../components/BrandModals";
import HelpScreen from "../screens/HelpScreen";
import { usePersistentState, useCompanySession, useHydrated } from "../lib/companyStore";
import { useBrandModals } from "../lib/useBrandModals";
import { COMPANY_SEED } from "../lib/companyDomain";
import { navFor } from "../lib/nav";

/**
 * Help as a real route: the one brand-dropdown item that's a page rather
 * than a modal, since reference material is worth deep-linking. Gates on
 * useHydrated and never redirects on mount: the session lives in storage,
 * so redirecting before hydration would bounce a signed-in user.
 *
 * Wires its own brand-dropdown modals via useBrandModals/BrandModals, same
 * as CompanyConsole.jsx, so the dropdown behaves identically from either page.
 */
function Application() {
  const router = useRouter();
  const toast = useToast();
  const hydrated = useHydrated();
  const { session, signIn, signOut } = useCompanySession();

  const [company, setCompany] = usePersistentState("company", COMPANY_SEED.company);
  const [users] = usePersistentState("users", COMPANY_SEED.users);
  const [locations] = usePersistentState("locations", COMPANY_SEED.locations);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [brandMenuOpen, setBrandMenuOpen] = useState(false);
  const { open: brandModalsOpen, openModal: openBrandModal, closeModal: closeBrandModal } = useBrandModals(setBrandMenuOpen);

  const currentUser = session ? users.find((u) => u.id === session.userId) : null;

  if (!hydrated) return null;

  if (!session || !currentUser) {
    return (
      <EmptyState
        title="You're not signed in"
        description="Sign in to the console, then come back to Help."
        action={
          <Link href="/company">
            <Button variant="secondary" size="sm">
              Go to sign in
            </Button>
          </Link>
        }
      />
    );
  }

  const isAdmin = currentUser.role === "admin";
  const isManager = currentUser.role === "manager";
  const nav = [...navFor({ isAdmin, isManager }), { id: "help", label: "Help", icon: CircleHelp, hidden: true }];

  const handleSwitchUser = (user) => {
    signIn(user);
    setUserMenuOpen(false);
    toast(`Switched to ${user.name.split(" ")[0]}`, { tone: "info" });
  };

  const handleUpdateCompany = (patch) => {
    setCompany((prev) => ({ ...prev, ...patch }));
    toast("Business details updated");
  };

  const handleChangePlan = (planName) => {
    setCompany((prev) => ({ ...prev, plan: planName }));
    toast(`Switched to the ${planName} plan`, { detail: "This is a demo \u2014 nothing was actually billed." });
  };

  return (
    <>
      <ConsoleShell
        company={company}
        currentUser={currentUser}
        nav={nav}
        view="help"
        onNavigate={() => router.push("/company/milaca-meats")}
        onSignOut={signOut}
        bundle={{ users, locations }}
        userMenuOpen={userMenuOpen}
        onUserMenuOpenChange={setUserMenuOpen}
        onSwitchUser={handleSwitchUser}
        brandMenuOpen={brandMenuOpen}
        onBrandMenuOpenChange={setBrandMenuOpen}
        onOpenSettings={() => openBrandModal("settings")}
        onOpenFeedback={() => openBrandModal("feedback")}
        onOpenPricing={() => openBrandModal("pricing")}
      >
        <HelpScreen onSendFeedback={() => openBrandModal("feedback")} />
      </ConsoleShell>

      <BrandModals
        open={brandModalsOpen}
        onClose={closeBrandModal}
        company={company}
        canManage={isAdmin}
        onUpdateCompany={handleUpdateCompany}
        onChangePlan={handleChangePlan}
      />
    </>
  );
}

export default function HelpPage() {
  return (
    <ToastProvider>
      <Application />
    </ToastProvider>
  );
}
