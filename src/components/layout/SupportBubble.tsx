"use client";

/**
 * SupportBubble (Lot 16.5).
 *
 * Bouton flottant en bas à droite avec 3 comportements possibles selon l'env :
 *   1. `NEXT_PUBLIC_CRISP_ID` défini → charge Crisp Live Chat (chat temps réel)
 *   2. `NEXT_PUBLIC_INTERCOM_APP_ID` défini → charge Intercom
 *   3. Sinon → fallback mailto vers `NEXT_PUBLIC_LEGAL_EMAIL`
 *
 * Volontairement pas de dépendance NPM (chargement dynamique du script tiers)
 * pour rester léger : si l'user n'a pas configuré Crisp/Intercom, aucune
 * requête externe.
 *
 * A11y : bouton avec aria-label + focus visible.
 */

import { useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";

const CRISP_ID = process.env.NEXT_PUBLIC_CRISP_ID;
const INTERCOM_ID = process.env.NEXT_PUBLIC_INTERCOM_APP_ID;
const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_LEGAL_EMAIL || "contact@vitrix.fr";

export function SupportBubble() {
  const [mode, setMode] = useState<"crisp" | "intercom" | "mailto" | null>(null);

  useEffect(() => {
    if (CRISP_ID) {
      setMode("crisp");
      // Injection Crisp - script officiel, minimal
      if (typeof window !== "undefined" && !("$crisp" in window)) {
        (window as unknown as { $crisp: unknown[] }).$crisp = [];
        (window as unknown as { CRISP_WEBSITE_ID: string }).CRISP_WEBSITE_ID = CRISP_ID;
        const s = document.createElement("script");
        s.src = "https://client.crisp.chat/l.js";
        s.async = true;
        document.head.appendChild(s);
      }
    } else if (INTERCOM_ID) {
      setMode("intercom");
      // Injection Intercom (script officiel light, sans dépendance NPM)
      if (typeof window !== "undefined") {
        (window as unknown as { intercomSettings: { app_id: string } }).intercomSettings = {
          app_id: INTERCOM_ID,
        };
        const s = document.createElement("script");
        s.src = `https://widget.intercom.io/widget/${INTERCOM_ID}`;
        s.async = true;
        document.head.appendChild(s);
      }
    } else {
      setMode("mailto");
    }
  }, []);

  // Crisp / Intercom affichent leur propre widget → on ne rend rien nous-mêmes
  if (mode === "crisp" || mode === "intercom") return null;

  if (mode !== "mailto") return null;

  // Fallback mailto : bouton simple, aucune dépendance externe
  return (
    <a
      href={`mailto:${SUPPORT_EMAIL}?subject=Support%20Vitrix`}
      aria-label="Contacter le support"
      className="fixed bottom-4 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-slate-900 text-white shadow-lg transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 dark:bg-white dark:text-slate-900 sm:h-14 sm:w-14"
      title="Contactez le support"
    >
      <MessageCircle className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden="true" />
    </a>
  );
}
