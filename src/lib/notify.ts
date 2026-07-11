/**
 * F6 (Lot 34, B25) — Helper unifié de notification.
 *
 * Un seul point d'entrée `notify()` qui gère :
 *  - Insert dans `notifications` (in-app, pour le NotificationBell)
 *  - Envoi push OS via `sendPushToUser()` (best-effort)
 *  - Respect des préférences user (`notification_preferences`)
 *  - Respect du DND (Do Not Disturb) — la push est skip mais l'in-app reste
 *  - Deduplication tag (2 notifs même tag rapprochées → 2e écrase 1re en push)
 *
 * Utilisé partout où on veut notifier un pro : nouveau RDV, paiement reçu,
 * avis reçu, invitation acceptée, quota atteint, etc.
 *
 * TOUJOURS non-throwing : une notif qui foire ne doit JAMAIS bloquer le flow métier.
 */

import { db } from "@/db";
import { notifications, notificationPreferences } from "@/db/schema";
import { eq } from "drizzle-orm";
import { logger } from "@/lib/logger";
import { sendPushToUser, type PushPayload } from "@/lib/push";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

/**
 * Enum figé des types d'events. Ajouter ici quand on ajoute un nouveau
 * point de notification, pour permettre à l'user de le désactiver.
 */
export type NotifType =
  // Rendez-vous
  | "appointment.created"
  | "appointment.cancelled_by_client"
  | "appointment.no_show_detected"
  | "appointment.reminder_sent"
  // Paiements & acomptes
  | "payment.received"
  | "deposit.paid"
  | "deposit.refunded"
  | "invoice.overdue"
  // Devis
  | "quote.received"
  | "quote.accepted"
  | "quote.declined"
  | "quote.expired"
  // Avis
  | "review.received"
  // Équipe (F5)
  | "team.invitation_accepted"
  | "team.member_left"
  // Quotas
  | "quota.ai_reached"
  | "quota.sms_reached"
  | "quota.storage_reached"
  // Abonnement
  | "subscription.trial_ending"
  | "subscription.grace_period"
  | "subscription.expired"
  // Sync externes
  | "sync.google_calendar_broken"
  // Générique (fallback)
  | "system.info";

export interface NotifyParams {
  /** Destinataire (généralement le owner ou un admin du business). */
  userId: string;
  /** Business concerné (optionnel — pour filtrer les notifs multi-business). */
  businessId?: string | null;
  /** Type d'event (figé). */
  type: NotifType;
  /** Titre court (max 200 chars). */
  title: string;
  /** Corps du message (max 1000 chars pratique — text illimité). */
  message: string;
  /** Données structurées attachées (appointmentId, invoiceId, etc.). */
  data?: Record<string, unknown>;
  /** Canaux voulus. Défaut : ["db", "push"]. */
  channels?: ("db" | "push")[];
  /** Priorité — `high` bypass le DND (urgence : deposit expired, sub expired). */
  priority?: "low" | "normal" | "high";
  /** URL cible pour la push OS (clic → cette page). Défaut : /dashboard. */
  url?: string;
  /** Tag pour dedup côté push (2 push même tag → écrasement). */
  tag?: string;
}

export interface NotifyResult {
  /** ID de la ligne notifications insérée (null si canal db désactivé). */
  notificationId: string | null;
  /** Nombre de devices touchés par la push OS. */
  pushDevices: number;
  /** True si la notif a été skip pour cause de préférence user. */
  skipped: boolean;
}

// -----------------------------------------------------------------------------
// Résolution des préférences user
// -----------------------------------------------------------------------------

interface UserPrefs {
  disabledTypes: string[];
  disabledChannels: string[];
  dndStart: string | null;
  dndEnd: string | null;
}

async function getUserPrefs(userId: string): Promise<UserPrefs> {
  const [row] = await db
    .select()
    .from(notificationPreferences)
    .where(eq(notificationPreferences.userId, userId))
    .limit(1);
  if (!row) {
    // Pas de row = tout activé (opt-out, pas opt-in)
    return { disabledTypes: [], disabledChannels: [], dndStart: null, dndEnd: null };
  }
  return {
    disabledTypes: row.disabledTypes ?? [],
    disabledChannels: row.disabledChannels ?? [],
    dndStart: row.dndStart,
    dndEnd: row.dndEnd,
  };
}

/**
 * True si l'heure actuelle (locale server = Europe/Paris sur Vercel EU) tombe
 * dans la fenêtre DND [dndStart, dndEnd].
 *
 * Support des fenêtres à cheval sur minuit (ex : 22h-8h).
 */
export function isInDnd(now: Date, dndStart: string | null, dndEnd: string | null): boolean {
  if (!dndStart || !dndEnd) return false;
  const [sh, sm] = dndStart.split(":").map(Number);
  const [eh, em] = dndEnd.split(":").map(Number);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const startMin = sh * 60 + sm;
  const endMin = eh * 60 + em;
  if (startMin === endMin) return false;
  if (startMin < endMin) {
    // Fenêtre simple : ex 22h-23h → dans DND si nowMin ∈ [22h, 23h]
    return nowMin >= startMin && nowMin < endMin;
  }
  // Fenêtre wrap around minuit : ex 22h-8h → dans DND si >=22h OU <8h
  return nowMin >= startMin || nowMin < endMin;
}

// -----------------------------------------------------------------------------
// API publique
// -----------------------------------------------------------------------------

/**
 * Envoie une notification à un user, respect des préférences.
 * Non-throwing — log + continue en cas d'erreur.
 */
export async function notify(params: NotifyParams): Promise<NotifyResult> {
  const channels = params.channels ?? ["db", "push"];
  const priority = params.priority ?? "normal";
  const result: NotifyResult = { notificationId: null, pushDevices: 0, skipped: false };

  try {
    const prefs = await getUserPrefs(params.userId);

    // 1. User a explicitement désactivé ce type d'event → skip complet
    if (prefs.disabledTypes.includes(params.type)) {
      result.skipped = true;
      logger.debug("[notify] skip: type désactivé", { userId: params.userId, type: params.type });
      return result;
    }

    // 2. Canal DB : insert dans notifications (visible dans NotificationBell)
    if (channels.includes("db") && !prefs.disabledChannels.includes("db")) {
      try {
        const [inserted] = await db
          .insert(notifications)
          .values({
            userId: params.userId,
            businessId: params.businessId ?? null,
            type: params.type,
            title: params.title,
            message: params.message,
            data: (params.data ?? null) as unknown,
          })
          .returning({ id: notifications.id });
        result.notificationId = inserted.id;
      } catch (err) {
        logger.warn("[notify] insert DB échoué", {
          userId: params.userId,
          type: params.type,
          err: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // 3. Canal PUSH : envoi OS via web-push (respecte DND sauf priority=high)
    if (channels.includes("push") && !prefs.disabledChannels.includes("push")) {
      const inDnd = isInDnd(new Date(), prefs.dndStart, prefs.dndEnd);
      if (inDnd && priority !== "high") {
        logger.debug("[notify] push suppressed (DND actif)", {
          userId: params.userId,
          type: params.type,
        });
      } else {
        const pushPayload: PushPayload = {
          title: params.title,
          body: params.message.slice(0, 300),
          url: params.url ?? "/dashboard",
          tag: params.tag ?? params.type, // dedup par type par défaut
        };
        result.pushDevices = await sendPushToUser(params.userId, pushPayload);
      }
    }
  } catch (err) {
    // Never throw — le flow métier appelant ne doit pas casser
    logger.error("[notify] fatal (silencieux)", {
      userId: params.userId,
      type: params.type,
      err: err instanceof Error ? err.message : String(err),
    });
  }

  return result;
}

/**
 * Variante fire-and-forget — pratique quand on ne veut pas attendre.
 * Ex : dans un webhook Stripe où on répond 200 immédiatement.
 */
export function notifyAsync(params: NotifyParams): void {
  void notify(params).catch(() => {
    /* déjà loggé dans notify() */
  });
}
