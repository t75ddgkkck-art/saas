"use client";

import { Sidebar } from "@/components/layout/Sidebar";

import { PWAInstallBanner } from "@/components/layout/PWAInstallBanner";
import { PWARegister } from "@/components/layout/PWARegister";
import { LangProvider } from "@/contexts/LangContext";
import { LangHtmlSync } from "@/components/layout/LangHtmlSync";
import { SupportBubble } from "@/components/layout/SupportBubble";
import { MobileTopBar } from "@/components/layout/MobileTopBar";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { EmailVerifyBanner } from "@/components/dashboard/EmailVerifyBanner";
// F5 (Lot 32) : bandeau "vous êtes membre invité de X"
import { TeamMemberBanner } from "@/components/dashboard/TeamMemberBanner";
// Lot 55 : Command Palette globale (Cmd+K / Ctrl+K)
import { CommandPaletteProvider } from "@/components/command/useCommandPalette";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <LangProvider>
      <LangHtmlSync />
      {/* Lot 55 : Provider Cmd+K enveloppe TOUT le dashboard — le shortcut
          fonctionne peu importe où l'user se trouve (sauf inputs qui overrident). */}
      <CommandPaletteProvider>
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
          <PWARegister />
          <Sidebar />
          {/* Lot 18 B11 : topbar mobile persistante avec ThemeToggle + NotificationBell */}
          <MobileTopBar />
          <main
            id="main-content"
            role="main"
            tabIndex={-1}
            className="lg:ml-72 min-h-screen focus:outline-none"
          >
            <div className="mx-auto max-w-7xl px-4 py-8 pt-20 lg:px-8 lg:pt-8">
              {/* Lot 19 : bannière verify email — dismissable 7j */}
              <div className="mb-4">
                <EmailVerifyBanner />
              </div>
              {/* F5 : bandeau si l'user est membre invité (pas owner) */}
              <TeamMemberBanner />
              {/* Lot 22 : breadcrumbs auto sur toutes les sous-pages dashboard */}
              <Breadcrumbs />
              {children}
            </div>
          </main>
          <PWAInstallBanner />
          {/* Lot 16.5 : bouton support (Crisp/Intercom si env défini, sinon mailto) */}
          <SupportBubble />
        </div>
      </CommandPaletteProvider>
    </LangProvider>
  );
}
