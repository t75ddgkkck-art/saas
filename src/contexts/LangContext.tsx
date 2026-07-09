"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { td } from "@/lib/i18n";

interface LangContextType {
  lang: string;
  setLang: (lang: string) => void;
  td: (key: string) => string;
}

const LangContext = createContext<LangContextType>({
  lang: "fr",
  setLang: () => {},
  td: (key) => td("fr", key),
});

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState("fr");

  useEffect(() => {
    // Charger la langue du pro depuis son business
    const cached = localStorage.getItem("vitrix_lang");
    if (cached) setLangState(cached);

    fetch("/api/my-business")
      .then(r => r.json())
      .then(b => {
        if (b?.language) {
          setLangState(b.language);
          localStorage.setItem("vitrix_lang", b.language);
        }
      })
      .catch(() => {});
  }, []);

  const setLang = (l: string) => {
    setLangState(l);
    localStorage.setItem("vitrix_lang", l);
  };

  return (
    <LangContext.Provider value={{ lang, setLang, td: (key) => td(lang, key) }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  return useContext(LangContext);
}
