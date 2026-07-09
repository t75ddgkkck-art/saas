"use client";

import { useEffect } from "react";
import { useLang } from "@/contexts/LangContext";

/**
 * Synchronise `<html lang="...">` avec la langue choisie par l'utilisateur.
 * Impact SEO (Google), lecteurs d'écran (bonne prononciation), et hreflang.
 *
 * Note : le rendu SSR démarre toujours avec `lang="fr"` (défini dans layout.tsx).
 * Ce composant ajuste l'attribut au premier render client si nécessaire.
 */
export function LangHtmlSync() {
  const { lang } = useLang();

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (!lang) return;
    if (document.documentElement.getAttribute("lang") !== lang) {
      document.documentElement.setAttribute("lang", lang);
    }
  }, [lang]);

  return null;
}
