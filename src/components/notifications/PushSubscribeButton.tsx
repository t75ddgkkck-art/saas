/**
 * F6 (Lot 34) — Bouton "Activer les notifications OS".
 *
 * Cycle de vie :
 *  1. Fetch /api/push/vapid-key → si `configured=false`, on cache le bouton
 *  2. Check `Notification.permission` :
 *     - "default"  → bouton "Activer"
 *     - "granted"  → check si subscription existe → sinon (re)subscribe
 *     - "denied"   → message "Autorisez dans les paramètres du navigateur"
 *  3. Au clic, `requestPermission()` puis `pushManager.subscribe()`
 *  4. POST /api/push/subscribe avec { endpoint, keys }
 *
 * Note : sur iOS, l'API Push Notification n'est disponible qu'en PWA installée
 * (Add to Home Screen), pas dans Safari. On détecte le mode standalone et on
 * affiche un message explicatif si non-standalone.
 */

"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, BellRing, Info, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/Toast";

type PermissionState = "default" | "granted" | "denied" | "unsupported";

interface VapidResponse {
  publicKey: string | null;
  configured: boolean;
}

/**
 * Convertit base64 (URL-safe ou classique) en Uint8Array pour applicationServerKey.
 * Web Push API l'exige dans ce format.
 *
 * Note TS : on force ArrayBuffer (pas SharedArrayBuffer) pour satisfaire le
 * type BufferSource attendu par `pushManager.subscribe()`.
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  // Alloue explicitement un ArrayBuffer (pas SharedArrayBuffer)
  const buffer = new ArrayBuffer(rawData.length);
  const output = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; i++) {
    output[i] = rawData.charCodeAt(i);
  }
  return output;
}

export function PushSubscribeButton() {
  const [permission, setPermission] = useState<PermissionState>("default");
  const [vapid, setVapid] = useState<VapidResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const toast = useToast();

  // Détecte support + charge la clé VAPID
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (
      !("Notification" in window) ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window)
    ) {
      setPermission("unsupported");
      return;
    }
    setPermission(Notification.permission as PermissionState);
    void fetch("/api/push/vapid-key")
      .then((r) => r.json())
      .then((data: VapidResponse) => setVapid(data));

    // Check si déjà subscribed
    void navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setSubscribed(Boolean(sub)))
      .catch(() => {
        /* pas de SW actif — normal en dev */
      });
  }, []);

  const isStandalone =
    typeof window !== "undefined" &&
    (window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as { standalone?: boolean }).standalone === true);

  // iOS Safari nécessite le mode PWA installé pour push
  const isIOS = typeof navigator !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent);
  const iosNeedsInstall = isIOS && !isStandalone;

  async function handleSubscribe() {
    if (!vapid?.publicKey) {
      toast.error("Notifications push non configurées côté serveur.");
      return;
    }
    setBusy(true);
    try {
      // 1. Demander la permission
      const perm = await Notification.requestPermission();
      setPermission(perm as PermissionState);
      if (perm !== "granted") {
        toast.error("Vous devez autoriser les notifications pour continuer.");
        return;
      }

      // 2. Subscribe via Push API
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapid.publicKey),
      });
      const subJson = sub.toJSON() as {
        endpoint: string;
        keys: { p256dh: string; auth: string };
      };

      // 3. Envoi au backend
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subJson),
      });
      if (!res.ok) {
        toast.error("Impossible d'enregistrer la souscription.");
        return;
      }

      setSubscribed(true);
      toast.success("Notifications activées !");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de l'activation");
    } finally {
      setBusy(false);
    }
  }

  async function handleUnsubscribe() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await sub.unsubscribe();
      }
      setSubscribed(false);
      toast.success("Notifications désactivées");
    } catch {
      toast.error("Erreur lors de la désactivation");
    } finally {
      setBusy(false);
    }
  }

  // -------------------------------------------------------------------------
  // Rendus par état
  // -------------------------------------------------------------------------

  if (permission === "unsupported") {
    return (
      <InfoBox tone="info">
        Votre navigateur ne supporte pas les notifications push. Utilisez Chrome, Firefox, Edge ou
        Safari récent.
      </InfoBox>
    );
  }

  if (!vapid) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Chargement…
      </div>
    );
  }

  if (!vapid.configured) {
    return (
      <InfoBox tone="warn">
        Les notifications push ne sont pas configurées côté serveur. Contactez
        l&apos;administrateur.
      </InfoBox>
    );
  }

  if (iosNeedsInstall) {
    return (
      <InfoBox tone="info">
        Sur iPhone/iPad, les notifications nécessitent d&apos;installer Vitrix sur l&apos;écran
        d&apos;accueil. Cliquez sur <strong>Partager</strong> puis{" "}
        <strong>Sur l&apos;écran d&apos;accueil</strong>.
      </InfoBox>
    );
  }

  if (permission === "denied") {
    return (
      <InfoBox tone="warn">
        Vous avez bloqué les notifications. Autorisez-les dans les paramètres du navigateur (icône
        cadenas dans la barre d&apos;URL) puis rechargez la page.
      </InfoBox>
    );
  }

  if (subscribed) {
    return (
      <button
        type="button"
        onClick={handleUnsubscribe}
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60 disabled:opacity-50"
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <BellOff className="h-4 w-4" aria-hidden />
        )}
        Désactiver les notifications
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleSubscribe}
      disabled={busy}
      className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
    >
      {busy ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      ) : permission === "granted" ? (
        <BellRing className="h-4 w-4" aria-hidden />
      ) : (
        <Bell className="h-4 w-4" aria-hidden />
      )}
      Activer les notifications
    </button>
  );
}

function InfoBox({ tone, children }: { tone: "info" | "warn"; children: React.ReactNode }) {
  const cls =
    tone === "warn"
      ? "border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-900/20 text-amber-900 dark:text-amber-200"
      : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300";
  return (
    <div className={`flex items-start gap-2 rounded-lg border p-3 text-xs ${cls}`} role="status">
      <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div>{children}</div>
    </div>
  );
}
