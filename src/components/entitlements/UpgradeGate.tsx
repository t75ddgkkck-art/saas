/**
 * F1 (Lot 29) — <UpgradeGate feature="ai.chat">...</UpgradeGate>
 *
 * Wrap n'importe quel bout de UI derrière un check d'entitlement.
 * Si le user a accès → affiche les enfants tels quels.
 * Sinon → affiche une carte "Passez Pro/Premium" avec CTA vers /pricing.
 *
 * Trois modes d'affichage :
 * - "card" (par défaut) : encadré avec label + description + CTA
 * - "inline" : petit badge cliquable minimaliste
 * - "blur" : les enfants sont rendus flous + overlay CTA (démo visuelle)
 *
 * Exemple d'usage :
 *   <UpgradeGate feature="ai.chat">
 *     <ChatWidget />
 *   </UpgradeGate>
 *
 *   <UpgradeGate feature="loyalty.enable" mode="blur">
 *     <LoyaltyDashboard />
 *   </UpgradeGate>
 */

"use client";

import Link from "next/link";
import { Lock, Sparkles } from "lucide-react";
import { useEntitlement } from "@/hooks/useEntitlement";
import type { FeatureKey } from "@/lib/entitlements";

interface UpgradeGateProps {
  feature: FeatureKey;
  children: React.ReactNode;
  mode?: "card" | "inline" | "blur";
  /** Fallback custom (override du CTA par défaut). */
  fallback?: React.ReactNode;
  /** Skeleton à afficher pendant le chargement (par défaut : les enfants restent verrouillés). */
  loadingFallback?: React.ReactNode;
}

export function UpgradeGate({
  feature,
  children,
  mode = "card",
  fallback,
  loadingFallback,
}: UpgradeGateProps) {
  const { allowed, loading, requiredPlan, label, description } = useEntitlement(feature);

  // Pendant le chargement : verrouillé par défaut (évite le flash de contenu).
  // Le composant parent peut passer un `loadingFallback` explicite (skeleton).
  if (loading) {
    if (loadingFallback) return <>{loadingFallback}</>;
    return (
      <LockedFallback
        mode={mode}
        label="Chargement…"
        description=""
        requiredPlan={requiredPlan}
        feature={feature}
      />
    );
  }

  if (allowed) return <>{children}</>;
  if (fallback) return <>{fallback}</>;

  return (
    <LockedFallback
      mode={mode}
      label={label}
      description={description}
      requiredPlan={requiredPlan}
      feature={feature}
      lockedContent={mode === "blur" ? children : undefined}
    />
  );
}

// -----------------------------------------------------------------------------
// Rendu du fallback selon le mode
// -----------------------------------------------------------------------------

function LockedFallback({
  mode,
  label,
  description,
  requiredPlan,
  feature,
  lockedContent,
}: {
  mode: "card" | "inline" | "blur";
  label: string;
  description: string;
  requiredPlan: "pro" | "premium";
  feature: FeatureKey;
  lockedContent?: React.ReactNode;
}) {
  const planLabel = requiredPlan === "premium" ? "Premium" : "Pro";
  // On passe la feature en query pour tracker les upgrades contextuels
  // (ex : /pricing?from=ai.chat → analytics conversion par feature)
  const upgradeUrl = `/pricing?from=${encodeURIComponent(feature)}`;

  if (mode === "inline") {
    return (
      <Link
        href={upgradeUrl}
        className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 dark:bg-amber-900/30 px-3 py-1 text-xs font-medium text-amber-900 dark:text-amber-200 hover:bg-amber-200 dark:hover:bg-amber-900/50 transition"
      >
        <Lock className="h-3 w-3" aria-hidden />
        Réservé au plan {planLabel}
      </Link>
    );
  }

  if (mode === "blur") {
    return (
      <div className="relative">
        {/* Contenu réel flouté en arrière-plan (démo visuelle de ce que le user aurait) */}
        <div aria-hidden className="pointer-events-none blur-sm opacity-60 select-none">
          {lockedContent}
        </div>
        {/* Overlay CTA */}
        <div className="absolute inset-0 flex items-center justify-center bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
          <UpgradeCard
            label={label}
            description={description}
            planLabel={planLabel}
            upgradeUrl={upgradeUrl}
          />
        </div>
      </div>
    );
  }

  // mode === "card"
  return (
    <UpgradeCard
      label={label}
      description={description}
      planLabel={planLabel}
      upgradeUrl={upgradeUrl}
    />
  );
}

function UpgradeCard({
  label,
  description,
  planLabel,
  upgradeUrl,
}: {
  label: string;
  description: string;
  planLabel: "Pro" | "Premium";
  upgradeUrl: string;
}) {
  const isPremium = planLabel === "Premium";
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 text-center shadow-sm">
      <div
        className={`mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full ${
          isPremium
            ? "bg-gradient-to-br from-amber-400 to-orange-500 text-white"
            : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
        }`}
      >
        {isPremium ? (
          <Sparkles className="h-6 w-6" aria-hidden />
        ) : (
          <Lock className="h-6 w-6" aria-hidden />
        )}
      </div>
      <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">{label}</h3>
      {description && (
        <p className="text-sm text-slate-600 dark:text-slate-300 mb-5 max-w-md mx-auto">
          {description}
        </p>
      )}
      <div className="flex flex-col sm:flex-row gap-2 justify-center">
        <Link
          href={upgradeUrl}
          className={`inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition ${
            isPremium
              ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600"
              : "bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100"
          }`}
        >
          <Sparkles className="h-4 w-4" aria-hidden />
          Passer au plan {planLabel}
        </Link>
        <Link
          href="/pricing"
          className="inline-flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 px-5 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
        >
          Voir tous les plans
        </Link>
      </div>
      <p className="mt-4 text-xs text-slate-500 dark:text-slate-500">
        Essai gratuit 14 jours · Sans carte bancaire · Annulation en 1 clic
      </p>
    </div>
  );
}
