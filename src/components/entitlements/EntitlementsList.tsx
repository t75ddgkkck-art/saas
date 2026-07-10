/**
 * F1 (Lot 29) — <EntitlementsList />
 *
 * Affiche la matrice complète des features avec :
 * - ✓ verte si accessible dans le plan actuel
 * - ✗ grise + badge du plan requis si verrouillée
 *
 * Utilisé dans /dashboard/settings > Abonnement pour donner au user
 * une vue exhaustive de ce qu'il a / de ce qu'il aurait.
 *
 * Regroupé par catégorie (IA, Vitrine, Business, etc.) pour la lisibilité.
 */

"use client";

import { Check, X } from "lucide-react";
import { useEntitlementsSnapshot } from "@/hooks/useEntitlement";
import { FEATURES, type FeatureKey } from "@/lib/entitlements";
import { PlanBadge } from "./PlanBadge";

// Regroupement par domaine — préfixe de la FeatureKey
const CATEGORY_LABELS: Record<string, string> = {
  ai: "Intelligence artificielle",
  vitrine: "Vitrine publique",
  loyalty: "Fidélisation",
  payments: "Paiements",
  quotes: "Devis",
  reminders: "Rappels automatiques",
  reviews: "Avis clients",
  team: "Équipe",
  analytics: "Analytics",
  pdf: "Documents PDF",
};

function categoryOf(key: FeatureKey): string {
  return key.split(".")[0];
}

export function EntitlementsList() {
  const { snapshot, loading } = useEntitlementsSnapshot();

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-6">
        <div className="animate-pulse space-y-2">
          <div className="h-4 w-1/3 bg-slate-200 dark:bg-slate-800 rounded" />
          <div className="h-4 w-1/2 bg-slate-200 dark:bg-slate-800 rounded" />
          <div className="h-4 w-1/4 bg-slate-200 dark:bg-slate-800 rounded" />
        </div>
      </div>
    );
  }

  if (!snapshot) return null;

  // Grouper les features par catégorie tout en préservant l'ordre de FEATURES
  const grouped = new Map<string, FeatureKey[]>();
  for (const key of Object.keys(FEATURES) as FeatureKey[]) {
    const cat = categoryOf(key);
    if (!grouped.has(cat)) grouped.set(cat, []);
    grouped.get(cat)!.push(key);
  }

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">
            Fonctionnalités de votre plan
          </h3>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Vue détaillée de ce qui est débloqué ({snapshot.plan})
          </p>
        </div>
        <PlanBadge plan={snapshot.plan} size="md" />
      </div>

      <div className="space-y-5">
        {Array.from(grouped.entries()).map(([cat, keys]) => (
          <div key={cat}>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {CATEGORY_LABELS[cat] ?? cat}
            </h4>
            <ul className="divide-y divide-slate-100 dark:divide-slate-800 rounded-lg border border-slate-100 dark:border-slate-800">
              {keys.map((key) => {
                const allowed = snapshot.features[key];
                const def = FEATURES[key];
                return (
                  <li key={key} className="flex items-start gap-3 px-3 py-2.5">
                    <span
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                        allowed
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                          : "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500"
                      }`}
                      aria-hidden
                    >
                      {allowed ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p
                          className={`text-sm font-medium ${
                            allowed
                              ? "text-slate-900 dark:text-slate-100"
                              : "text-slate-500 dark:text-slate-400"
                          }`}
                        >
                          {def.label}
                        </p>
                        {!allowed && <PlanBadge plan={def.minPlan} />}
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-500">
                        {def.description}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
