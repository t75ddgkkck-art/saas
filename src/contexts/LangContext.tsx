"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import {
  td,
  t as tRaw,
  SUPPORTED_LANGS,
  DEFAULT_LANG,
  type Lang,
  type TranslationKey,
} from "@/lib/i18n";

interface LangContextType {
  lang: Lang;
  setLang: (lang: Lang) => void;
  /** Alias historique (dashboard) — signature compatible avec l'ancien `td(key)`. */
  td: (key: string) => string;
  /** Traduction typée avec support d'interpolation. */
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
}

const LangContext = createContext<LangContextType>({
  lang: DEFAULT_LANG,
  setLang: () => {},
  td: (key) => td(DEFAULT_LANG, key),
  t: (key) => td(DEFAULT_LANG, key),
});

/**
 * Détection de la langue préférée du user à l'ouverture :
 *   1. localStorage ("vitrix_lang") — choix explicite précédent
 *   2. Langue du business courant (fetch /api/my-business)
 *   3. navigator.language (préférence du navigateur)
 *   4. Défaut "fr"
 */
function readInitialLang(): Lang {
  if (typeof window === "undefined") return DEFAULT_LANG;
  try {
    const cached = window.localStorage.getItem("vitrix_lang");
    if (cached && SUPPORTED_LANGS.includes(cached as Lang)) return cached as Lang;
    const nav = window.navigator.language?.split("-")[0]?.toLowerCase();
    if (nav && SUPPORTED_LANGS.includes(nav as Lang)) return nav as Lang;
  } catch {
    // ignore : localStorage peut être bloqué (Safari private)
  }
  return DEFAULT_LANG;
}

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(DEFAULT_LANG);

  useEffect(() => {
    // Hydratation initiale (client-only)
    const initial = readInitialLang();
    setLangState(initial);

    // Puis on tente d'écraser avec la langue du business si l'user a un compte
    // ET qu'il n'a jamais fait de choix explicite (pas de cached).
    if (window.localStorage.getItem("vitrix_lang")) return;

    fetch("/api/my-business", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((b) => {
        if (b?.language && SUPPORTED_LANGS.includes(b.language)) {
          setLangState(b.language);
        }
      })
      .catch(() => {
        // Non connecté ou API down : on garde la langue détectée
      });
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    try {
      window.localStorage.setItem("vitrix_lang", l);
    } catch {
      // ignore
    }
  };

  return (
    <LangContext.Provider
      value={{
        lang,
        setLang,
        td: (key) => td(lang, key),
        t: (key, vars) => tRaw(lang, key, vars),
      }}
    >
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  return useContext(LangContext);
}
