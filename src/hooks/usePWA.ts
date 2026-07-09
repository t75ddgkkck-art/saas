"use client";

import { useEffect, useState, useCallback } from "react";

// Type minimal du BeforeInstallPromptEvent — non standard mais présent sur Chrome
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function usePWA() {
  const [isInstalled, setIsInstalled] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [pushEnabled, setPushEnabled] = useState(false);

  useEffect(() => {
    // Enregistrement du SW en prod uniquement
    if (
      "serviceWorker" in navigator &&
      process.env.NODE_ENV === "production"
    ) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Silencieux : un échec SW ne casse pas l'app
      });
    }

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);

    if ("Notification" in window) {
      setPushEnabled(Notification.permission === "granted");
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const installApp = useCallback(async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const result = await deferredPrompt.userChoice;
    if (result.outcome === "accepted") setIsInstalled(true);
    setDeferredPrompt(null);
    return result.outcome === "accepted";
  }, [deferredPrompt]);

  const requestPushPermission = useCallback(async () => {
    if (!("Notification" in window)) return false;
    const permission = await Notification.requestPermission();
    setPushEnabled(permission === "granted");

    if (permission === "granted" && "serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.ready;
      const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapid) return true; // pas de clé VAPID → on ne subscribe pas, mais permission OK

      try {
        const subscription = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapid),
        });
        await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(subscription),
        });
      } catch {
        // Silent : l'utilisateur a peut-être refusé, ou VAPID key invalide
      }
    }
    return permission === "granted";
  }, []);

  return {
    isInstalled,
    canInstall: !!deferredPrompt,
    installApp,
    pushEnabled,
    requestPushPermission,
  };
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return new Uint8Array([...rawData].map((char) => char.charCodeAt(0)));
}
