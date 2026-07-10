"use client";

/**
 * Bannière de consentement cookies (Lot 15.2).
 *
 * Affichée uniquement si aucun choix n'a été fait (voir `src/lib/consent.ts`).
 * Non-bloquante : elle ne masque pas le contenu, se positionne en bas d'écran.
 * A11y : rôle "dialog", trap focus, aria-live pour l'apparition.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { readConsent, writeConsent, type ConsentValue } from "@/lib/consent";

export function CookieConsent() {
  // Par défaut on ne montre rien (SSR + hydration). Le vrai check se fait
  // dans useEffect (accès localStorage → uniquement côté client).
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const existing = readConsent();
    if (!existing) setVisible(true);
  }, []);

  function choose(value: ConsentValue) {
    writeConsent(value);
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-labelledby="cookie-consent-title"
      aria-describedby="cookie-consent-desc"
      className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-4 shadow-lg dark:border-slate-800 dark:bg-slate-900 sm:p-5"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex-1">
          <h2
            id="cookie-consent-title"
            className="text-sm font-semibold text-slate-900 dark:text-slate-100"
          >
            Cookies
          </h2>
          <p
            id="cookie-consent-desc"
            className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400"
          >
            Vitrix utilise uniquement des cookies strictement nécessaires (session de connexion).
            Aucun cookie publicitaire ou de pistage n&apos;est déposé. En savoir plus dans notre{" "}
            <Link
              href="/confidentialite"
              className="underline decoration-slate-400 underline-offset-2 hover:text-slate-900 dark:hover:text-slate-100"
            >
              politique de confidentialité
            </Link>
            .
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => choose("essential")}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            Essentiels uniquement
          </button>
          <button
            type="button"
            onClick={() => choose("all")}
            className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
          >
            Tout accepter
          </button>
        </div>
      </div>
    </div>
  );
}
