"use client";

import { Sidebar } from "@/components/layout/Sidebar";

import { PWAInstallBanner } from "@/components/layout/PWAInstallBanner";
import { PWARegister } from "@/components/layout/PWARegister";
import { LangProvider } from "@/contexts/LangContext";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <LangProvider>
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
        <PWARegister />
        <Sidebar />
        <main className="lg:ml-72 min-h-screen">
          <div className="mx-auto max-w-7xl px-4 py-8 pt-20 lg:px-8 lg:pt-8">{children}</div>
        </main>
        <PWAInstallBanner />
      </div>
    </LangProvider>
  );
}
