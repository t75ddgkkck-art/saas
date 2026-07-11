"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Palette,
  FileText,
  Settings,
  Menu,
  X,
  Store,
  LogOut,
  Zap,
  QrCode,
  Wrench,
  Shield,
  Users,
  Sun,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLang } from "@/contexts/LangContext";
import { Button } from "@/components/ui/Button";
import { GlobalSearch } from "./GlobalSearch";
import { NotificationBell } from "./NotificationBell";
import { ThemeToggle } from "./ThemeToggle";

// Menu simplifié
// F6 (Lot 35) : "Aujourd'hui" en tête (usage terrain quotidien).
const baseNavItems = [
  { href: "/dashboard/today", labelKey: "todayNav", icon: Sun },
  { href: "/dashboard", labelKey: "dashboard", icon: LayoutDashboard },
  { href: "/dashboard/vitrine", labelKey: "myVitrine", icon: Palette },
  { href: "/dashboard/blog", labelKey: "blogNav", icon: FileText },
  { href: "/dashboard/qr-code", labelKey: "qrCodeNav", icon: QrCode },
  { href: "/dashboard/outils", labelKey: "toolsNav", icon: Wrench },
  { href: "/dashboard/settings", labelKey: "settings", icon: Settings },
];

// Assistant IA réservé aux plans Pro / Premium
const aiNavItem = { href: "/dashboard/ai-chat", labelKey: "aiAssistant", icon: Zap };
// F5 (Lot 32) : équipe réservée aux plans Pro / Premium (via entitlement `team.enable`)
const teamNavItem = { href: "/dashboard/team", labelKey: "teamNav", icon: Users };

export function Sidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { td } = useLang();
  const plan = user?.subscription || "free";
  // Assistant IA réservé UNIQUEMENT au plan Premium
  // F5 (Lot 32) : équipe visible pour Pro et Premium (matrice entitlements)
  const showTeam = plan === "pro" || plan === "premium";
  let navItems = [...baseNavItems];
  // Helper : insère un item juste avant Settings (référence stable, robuste
  // aux ajouts futurs dans baseNavItems — indépendant des indices).
  function insertBeforeSettings(item: (typeof baseNavItems)[number]) {
    const idx = navItems.findIndex((i) => i.href === "/dashboard/settings");
    navItems = [...navItems.slice(0, idx), item, ...navItems.slice(idx)];
  }
  if (plan === "premium") insertBeforeSettings(aiNavItem);
  if (showTeam) insertBeforeSettings(teamNavItem);

  // Lot 13 : entrée admin uniquement pour les users role=admin
  if (user?.role === "admin") {
    navItems = [...navItems, { href: "/dashboard/admin", labelKey: "adminNav", icon: Shield }];
  }

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={isOpen ? "Fermer le menu" : "Ouvrir le menu"}
        aria-expanded={isOpen}
        aria-controls="dashboard-sidebar"
        className="fixed left-4 top-safe pl-safe z-50 rounded-xl bg-white p-2 shadow-lg lg:hidden dark:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
      >
        {isOpen ? (
          <X className="h-5 w-5" aria-hidden="true" />
        ) : (
          <Menu className="h-5 w-5" aria-hidden="true" />
        )}
      </button>

      <aside
        id="dashboard-sidebar"
        aria-label="Navigation principale"
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-slate-200/60 bg-white dark:border-slate-800 dark:bg-slate-950 transition-transform duration-300 lg:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Logo + Notifications */}
        <div className="flex h-16 items-center justify-between gap-3 border-b border-slate-200/60 px-6 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900"
              aria-hidden="true"
            >
              <Store className="h-5 w-5" />
            </div>
            <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Vitrix
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <ThemeToggle />
            <NotificationBell />
          </div>
        </div>

        {/* Recherche */}
        <div className="border-b border-slate-200/60 px-4 py-3 dark:border-slate-800">
          <GlobalSearch />
        </div>

        {/* Navigation */}
        <nav
          aria-label="Sections du tableau de bord"
          className="flex-1 space-y-1 overflow-y-auto p-4"
        >
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsOpen(false)}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400",
                  isActive
                    ? "bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-900"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                )}
              >
                <item.icon className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
                {td(item.labelKey)}
              </Link>
            );
          })}
        </nav>

        {/* User */}
        <div className="border-t border-slate-200/60 p-4 dark:border-slate-800">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
              {user?.firstName?.[0]}
              {user?.lastName?.[0]}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">{user?.email}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
            onClick={logout}
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            {td("logout")}
          </Button>
        </div>
      </aside>
    </>
  );
}
