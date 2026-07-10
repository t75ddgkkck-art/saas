/**
 * F1 (Lot 29) — <PlanBadge plan="premium" />
 *
 * Petit badge coloré pour indiquer le plan requis d'une feature dans une liste
 * (settings, /pricing, tooltip UpgradeGate).
 */

import { Sparkles } from "lucide-react";
import type { SubscriptionPlan } from "@/lib/permissions";

interface PlanBadgeProps {
  plan: SubscriptionPlan;
  size?: "sm" | "md";
}

export function PlanBadge({ plan, size = "sm" }: PlanBadgeProps) {
  const label = plan === "premium" ? "Premium" : plan === "pro" ? "Pro" : "Gratuit";
  const sizeCls = size === "sm" ? "text-[10px] px-1.5 py-0.5" : "text-xs px-2 py-1";

  if (plan === "premium") {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 text-white font-semibold ${sizeCls}`}
      >
        <Sparkles className="h-3 w-3" aria-hidden />
        {label}
      </span>
    );
  }
  if (plan === "pro") {
    return (
      <span
        className={`inline-flex items-center rounded-full bg-indigo-600 text-white font-semibold ${sizeCls}`}
      >
        {label}
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium ${sizeCls}`}
    >
      {label}
    </span>
  );
}
