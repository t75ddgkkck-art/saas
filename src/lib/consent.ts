/**
 * Gestion du consentement cookies (Lot 15.2).
 *
 * État possible :
 *  - `null`         : jamais choisi → afficher la bannière
 *  - `"essential"`  : refuse tout sauf strictement nécessaire (auth_token)
 *  - `"all"`        : accepte tout (analytics, futures features tracking)
 *
 * Stockage : `localStorage` (pas un cookie, ironiquement — ça évite justement
 * un cookie sans consent au moment où on demande le consent).
 *
 * IMPORTANT : notre app N'A actuellement AUCUN cookie non-essentiel. Le seul
 * cookie `auth_token` est strictement nécessaire (fonctionnement du service),
 * donc légalement dispensé de consent (CNIL/ePrivacy). La bannière est là
 * pour informer + être prête si on ajoute Plausible/GA plus tard.
 */

export type ConsentValue = "essential" | "all";
export const CONSENT_STORAGE_KEY = "vx_cookie_consent";
export const CONSENT_VERSION = 1;

interface StoredConsent {
  v: number;
  value: ConsentValue;
  at: number; // timestamp
}

/**
 * Lit le consent depuis localStorage. Retourne `null` si :
 *  - Aucune décision prise
 *  - Décision d'une ancienne version (à re-demander si on change la politique)
 *  - Environnement sans localStorage (SSR)
 */
export function readConsent(): ConsentValue | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredConsent>;
    if (parsed.v !== CONSENT_VERSION) return null;
    if (parsed.value !== "essential" && parsed.value !== "all") return null;
    return parsed.value;
  } catch {
    return null;
  }
}

/**
 * Écrit le consent. Non-bloquant : si localStorage est indispo (mode privé
 * strict), on ignore silencieusement — la bannière réapparaîtra au prochain
 * chargement, ce qui est acceptable.
 */
export function writeConsent(value: ConsentValue): void {
  if (typeof window === "undefined") return;
  try {
    const payload: StoredConsent = { v: CONSENT_VERSION, value, at: Date.now() };
    window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* noop */
  }
}

/**
 * Réinitialise le consent (utile pour "modifier mes préférences" côté user).
 */
export function resetConsent(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(CONSENT_STORAGE_KEY);
  } catch {
    /* noop */
  }
}
