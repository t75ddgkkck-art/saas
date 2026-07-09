"use client";

import { Sidebar } from "@/components/layout/Sidebar";

import { PWAInstallBanner } from "@/components/layout/PWAInstallBanner";
import { PWARegister } from "@/components/layout/PWARegister";
import { LangProvider } from "@/contexts/LangContext";
import { LangHtmlSync } from "@/components/layout/LangHtmlSync";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <LangProvider>
      <LangHtmlSync />
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
        <PWARegister />
        <Sidebar />
        <main
          id="main-content"
          role="main"
          tabIndex={-1}
          className="lg:ml-72 min-h-screen focus:outline-none"
        >
          <div className="mx-auto max-w-7xl px-4 py-8 pt-20 lg:px-8 lg:pt-8">{children}</div>
        </main>
        <PWAInstallBanner />
      </div>
    </LangProvider>
  );
}
