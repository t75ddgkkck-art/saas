"use client";

import { useEffect, useState, useCallback } from "react";

export function usePWA() {
  const [isInstalled, setIsInstalled] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [pushEnabled, setPushEnabled] = useState(false);

  useEffect(() => {
    // Register service worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").then((reg) => {
        console.log("SW registered");
      }).catch((err) => console.error("SW error:", err));
    }

    // Listen for install prompt
    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    });

    // Check if already installed
    window.addEventListener("appinstalled", () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    });

    // Check push permission
    if ("Notification" in window) {
      setPushEnabled(Notification.permission === "granted");
    }
  }, []);

  const installApp = useCallback(async () => {
    if (!deferredPrompt) return false;
    deferredPrompt.prompt();
    const result = await deferredPrompt.userChoice;
    if (result.outcome === "accepted") {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
    return result.outcome === "accepted";
  }, [deferredPrompt]);

  const requestPushPermission = useCallback(async () => {
    if (!("Notification" in window)) return false;
    const permission = await Notification.requestPermission();
    setPushEnabled(permission === "granted");

    if (permission === "granted" && "serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.ready;
      // In production, subscribe with VAPID public key
      try {
        const subscription = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "demo-key"),
        });
        // Send subscription to server
        await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(subscription),
        });
      } catch (e) {
        console.log("Push subscription failed (expected without VAPID key)");
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
