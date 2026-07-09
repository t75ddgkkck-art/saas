"use client";

import { useEffect } from "react";

// Enregistre le service worker en prod uniquement (évite les warnings HMR en dev).
export function PWARegister() {
  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      process.env.NODE_ENV !== "production"
    ) {
      return;
    }
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Swallow : un échec de SW ne doit pas casser l'app. Les erreurs
      // sont déjà visibles dans l'onglet "Application" des devtools.
    });
  }, []);

  return null;
}
