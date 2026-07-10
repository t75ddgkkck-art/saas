/**
 * F1 (Lot 29) — Hook client pour lire les entitlements.
 *
 * Charge la matrice une seule fois au premier appel (cache module-level),
 * partagée entre tous les composants qui l'utilisent. Rafraîchit uniquement
 * si on appelle `refetchEntitlements()`.
 *
 * Usage :
 *   const { allowed, requiredPlan, loading } = useEntitlement("ai.chat");
 *   if (!allowed) return <UpgradeGate feature="ai.chat" />;
 *
 * Pourquoi pas SWR/react-query : on veut zéro dépendance externe et le
 * comportement souhaité est très simple (fetch une fois, invalidation manuelle
 * quand on upgrade).
 */

"use client";

import { useEffect, useState, useCallback } from "react";
import type { FeatureKey, EntitlementsSnapshot } from "@/lib/entitlements";
import { FEATURES } from "@/lib/entitlements";

// -----------------------------------------------------------------------------
// Cache module-level partagé entre tous les composants du process client.
// -----------------------------------------------------------------------------

let cache: EntitlementsSnapshot | null = null;
let inflight: Promise<EntitlementsSnapshot | null> | null = null;
const listeners = new Set<() => void>();

async function fetchEntitlements(): Promise<EntitlementsSnapshot | null> {
  // Déduplique les requêtes concurrentes (2 hooks montés en même temps → 1 fetch)
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const res = await fetch("/api/account/entitlements", { credentials: "include" });
      if (!res.ok) return null;
      const data = (await res.json()) as EntitlementsSnapshot;
      cache = data;
      // Notifier tous les hooks montés qu'une nouvelle valeur est dispo
      listeners.forEach((l) => l());
      return data;
    } catch {
      return null;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/**
 * Invalide le cache et refetch. À appeler après un upgrade Stripe réussi.
 */
export function refetchEntitlements(): Promise<EntitlementsSnapshot | null> {
  cache = null;
  return fetchEntitlements();
}

export interface EntitlementResult {
  /** true si le user a accès à la feature. */
  allowed: boolean;
  /** Plan minimum à afficher dans un CTA upgrade ("pro" ou "premium"). */
  requiredPlan: "pro" | "premium";
  /** true tant que la première requête n'est pas revenue. */
  loading: boolean;
  /** Libellé humain de la feature. */
  label: string;
  /** Description courte. */
  description: string;
  /** Plan actuel de l'utilisateur (utile pour affichage). */
  currentPlan: "free" | "pro" | "premium" | null;
}

/**
 * Hook principal. Lit une feature dans la matrice et renvoie l'accès.
 *
 * Optimisation : pendant que le fetch initial est en cours (`loading = true`),
 * on RETOURNE la définition figée de la matrice (`allowed = false` par défaut)
 * → pas de flash de contenu autorisé pour un user Free.
 * → optimiste vers "verrouillé" plutôt que "ouvert".
 */
export function useEntitlement(feature: FeatureKey): EntitlementResult {
  const def = FEATURES[feature];
  const [snapshot, setSnapshot] = useState<EntitlementsSnapshot | null>(cache);

  useEffect(() => {
    const listener = () => setSnapshot(cache);
    listeners.add(listener);
    if (!cache && !inflight) {
      void fetchEntitlements();
    } else if (cache) {
      setSnapshot(cache);
    }
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const allowed = snapshot?.features[feature] ?? false;
  const loading = snapshot === null;

  return {
    allowed,
    requiredPlan: def.minPlan,
    loading,
    label: def.label,
    description: def.description,
    currentPlan: snapshot?.plan ?? null,
  };
}

/**
 * Renvoie le snapshot complet (utile pour afficher la liste des features
 * accessibles dans les settings).
 */
export function useEntitlementsSnapshot(): {
  snapshot: EntitlementsSnapshot | null;
  loading: boolean;
  refetch: () => Promise<EntitlementsSnapshot | null>;
} {
  const [snapshot, setSnapshot] = useState<EntitlementsSnapshot | null>(cache);

  useEffect(() => {
    const listener = () => setSnapshot(cache);
    listeners.add(listener);
    if (!cache && !inflight) {
      void fetchEntitlements();
    } else if (cache) {
      setSnapshot(cache);
    }
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const refetch = useCallback(() => refetchEntitlements(), []);

  return { snapshot, loading: snapshot === null, refetch };
}

/**
 * Helper pour usage impératif (hors composant React) — ex : dans un handler
 * `onClick` d'un bouton qui doit vérifier avant d'appeler l'API.
 */
export async function getEntitlementSync(feature: FeatureKey): Promise<boolean> {
  const snap = cache ?? (await fetchEntitlements());
  return snap?.features[feature] ?? false;
}
