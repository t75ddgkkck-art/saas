/**
 * F6 (Lot 34, B30) — Envoi de push notifications OS via Web Push API.
 *
 * Dépendance `web-push` OPTIONNELLE (comme Sentry au Lot 13) — pas dans
 * package.json. Le user installe `web-push` + set les VAPID keys uniquement
 * s'il veut des push réelles :
 *
 *   npm install web-push
 *   npx web-push generate-vapid-keys
 *   → set VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT en env
 *
 * Sans ces vars ou sans la dep, `sendPushToUser()` no-op silencieusement.
 * Aucun crash — le flow métier continue de fonctionner.
 *
 * Résiliance :
 *  - Erreur 410 Gone / 404 Not Found → supprime la subscription (device
 *    a désinstallé la PWA ou révoqué la permission)
 *  - Autres erreurs → log + continue (partial failure sur plusieurs devices)
 */

import { db } from "@/db";
import { pushSubscriptions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { logger } from "@/lib/logger";

// -----------------------------------------------------------------------------
// Chargement lazy de web-push (dep optionnelle)
// -----------------------------------------------------------------------------

interface WebPushLib {
  setVapidDetails: (subject: string, publicKey: string, privateKey: string) => void;
  sendNotification: (
    subscription: {
      endpoint: string;
      keys: { p256dh: string; auth: string };
    },
    payload: string,
    options?: { TTL?: number; urgency?: "very-low" | "low" | "normal" | "high" }
  ) => Promise<{ statusCode: number }>;
}

let webpushCache: WebPushLib | null | undefined = undefined;

function loadWebPush(): WebPushLib | null {
  if (webpushCache !== undefined) return webpushCache;
  try {
    // Import indirect pour que Next ne le bundle pas s'il est absent
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const req = Function("return require")() as (m: string) => WebPushLib;
    const lib = req("web-push");
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT || "mailto:contact@vitrix.fr";
    if (!publicKey || !privateKey) {
      logger.debug("[push] VAPID keys manquantes — push OS désactivé");
      webpushCache = null;
      return null;
    }
    lib.setVapidDetails(subject, publicKey, privateKey);
    webpushCache = lib;
    return lib;
  } catch {
    // web-push pas installé
    logger.debug("[push] `web-push` non installé — push OS désactivé");
    webpushCache = null;
    return null;
  }
}

/**
 * True si le système est prêt à envoyer des push (dep + VAPID configurés).
 * Utilisé par l'UI pour cacher le toggle "Activer les notifications" si non-supporté.
 */
export function isPushConfigured(): boolean {
  return loadWebPush() !== null;
}

/**
 * Renvoie la clé publique VAPID pour que le client puisse s'abonner.
 * Null si non configurée.
 */
export function getVapidPublicKey(): string | null {
  if (!process.env.VAPID_PUBLIC_KEY) return null;
  return process.env.VAPID_PUBLIC_KEY;
}

// -----------------------------------------------------------------------------
// Envoi
// -----------------------------------------------------------------------------

export interface PushPayload {
  title: string;
  body: string;
  /** URL à ouvrir au clic (défaut : /dashboard). */
  url?: string;
  /** Icône (défaut : /icons/icon-192.png). */
  icon?: string;
  /** Badge Android (petit rond en haut à gauche). */
  badge?: string;
  /** Tag pour grouping (2 push avec même tag → la 2e remplace la 1re). */
  tag?: string;
  /** Actions inline (Chrome/Android uniquement, ignoré iOS). */
  actions?: { action: string; title: string }[];
  /** Force le device à vibrer (Android). */
  vibrate?: number[];
}

/**
 * Envoie une push notification à TOUTES les subscriptions actives d'un user.
 * Best-effort strict : jamais throw, jamais bloquant.
 *
 * Retourne le nombre de devices touchés (utile pour tests + observabilité).
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<number> {
  const webpush = loadWebPush();
  if (!webpush) return 0;

  const subs = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId));

  if (subs.length === 0) return 0;

  const payloadStr = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url ?? "/dashboard",
    icon: payload.icon ?? "/icons/icon-192.png",
    badge: payload.badge ?? "/icons/icon-192.png",
    tag: payload.tag,
    actions: payload.actions,
    vibrate: payload.vibrate,
  });

  let delivered = 0;

  await Promise.all(
    subs.map(async (sub) => {
      try {
        const res = await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payloadStr,
          {
            TTL: 60 * 60 * 24, // 24h — après on considère la notif obsolète
            urgency: "normal",
          }
        );
        if (res.statusCode >= 200 && res.statusCode < 300) {
          delivered++;
        }
      } catch (err) {
        // Type minimal pour ne pas dépendre du type web-push
        const e = err as { statusCode?: number; message?: string };
        if (e.statusCode === 404 || e.statusCode === 410) {
          // Subscription expirée / device désinstallé → cleanup DB
          await db
            .delete(pushSubscriptions)
            .where(eq(pushSubscriptions.id, sub.id))
            .catch(() => {});
          logger.info("[push] subscription obsolète supprimée", {
            userId,
            statusCode: e.statusCode,
          });
        } else {
          logger.warn("[push] envoi échoué", {
            userId,
            statusCode: e.statusCode,
            message: e.message,
          });
        }
      }
    })
  );

  return delivered;
}
