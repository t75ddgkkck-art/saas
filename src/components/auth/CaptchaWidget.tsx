"use client";

/**
 * Widget Cloudflare Turnstile (Lot 19).
 *
 * DESIGN :
 * - Ne rend RIEN si `NEXT_PUBLIC_TURNSTILE_SITE_KEY` n'est pas défini
 *   → dev local sans setup, prod protégée quand la clé est set
 * - Charge le script Turnstile 1× (guard via `window.turnstile`)
 * - Rend le widget dans un ref div, callback `onToken` reçu à chaque succès
 * - Callback `onExpire` reset le token (l'user doit re-cocher)
 *
 * L'appelant utilise `onToken` pour stocker le token en state et l'envoyer
 * au POST du formulaire (dans le body JSON via `captchaToken`).
 *
 * Le script Turnstile est chargé depuis Cloudflare, tag `defer async` pour
 * ne pas bloquer le render.
 */

import { useEffect, useRef } from "react";

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js";

// L'API Turnstile expose une global `turnstile` sur window
interface TurnstileAPI {
  render: (
    el: HTMLElement,
    opts: {
      sitekey: string;
      callback: (token: string) => void;
      "expired-callback"?: () => void;
      "error-callback"?: () => void;
      theme?: "light" | "dark" | "auto";
    }
  ) => string;
  reset: (widgetId?: string) => void;
  remove: (widgetId?: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileAPI;
  }
}

function loadScriptOnce(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") return resolve();
    if (window.turnstile) return resolve();
    // Est-ce que le script est déjà dans le DOM (chargement précédent) ?
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${SCRIPT_SRC}"]`
    );
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Turnstile script error")), {
        once: true,
      });
      return;
    }
    const s = document.createElement("script");
    s.src = SCRIPT_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Turnstile script error"));
    document.head.appendChild(s);
  });
}

export function CaptchaWidget({ onToken }: { onToken: (token: string | null) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!SITE_KEY) return; // Pas de captcha en dev sans clé
    let cancelled = false;

    void loadScriptOnce().then(() => {
      if (cancelled || !containerRef.current || !window.turnstile) return;
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: SITE_KEY,
        theme: "auto",
        callback: (token) => onToken(token),
        "expired-callback": () => onToken(null),
        "error-callback": () => onToken(null),
      });
    });

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          /* noop */
        }
      }
    };
    // onToken est stable dans les cas d'usage (setState) — on l'ignore intentionnellement
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Si pas de clé configurée → render nothing (invisible pour l'user)
  if (!SITE_KEY) return null;

  return (
    <div>
      <div ref={containerRef} />
      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
        Vérification anti-robot par Cloudflare Turnstile
      </p>
    </div>
  );
}
