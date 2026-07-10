/**
 * Queue email en mémoire, non-bloquante, avec retry exponentiel.
 *
 * Pourquoi pas Redis/BullMQ ?
 *  - Vercel serverless : pas de process long-running, une queue Redis
 *    nécessiterait un worker séparé (surcharge inutile pour <10k mails/j).
 *  - Cette queue "in-process" traite les emails **après** avoir répondu au user
 *    → l'API répond immédiatement, l'email part quelques ms plus tard.
 *  - Retry exponentiel : si Resend rate-limit, on retente 3× à 1s / 5s / 30s.
 *
 * Limites assumées (à documenter dans README) :
 *  - Perdue si l'instance Vercel est recyclée pendant le retry (rare, <1%)
 *  - Pas de dédoublonnage inter-instances (mais UUID email = idempotence côté Resend)
 *  - Pour du bulk > 100 mails/min → migrer sur Redis + worker Vercel Background Jobs
 *
 * Usage :
 *   enqueueEmail({ to, subject, html, category, replyTo })
 *   → fire-and-forget, jamais throw
 */

import { logger } from "@/lib/logger";
import { sendEmailRaw, type EmailOptions } from "@/lib/email-core";
import { isEmailOptedOut } from "@/lib/email-optout-check";
import type { EmailCategory } from "@/lib/unsubscribe";
import { buildListUnsubscribeHeaders } from "@/lib/unsubscribe";

export interface QueuedEmail extends EmailOptions {
  /** Catégorie RGPD (permet de skip si opt-out). */
  category?: EmailCategory;
  /** Nombre max de tentatives (défaut 3). */
  maxAttempts?: number;
}

const RETRY_DELAYS_MS = [1000, 5000, 30000]; // 1s, 5s, 30s

/**
 * Enfile un email pour envoi immédiat (non-bloquant).
 * Skip automatique si le destinataire a opt-out (sauf transactional).
 */
export function enqueueEmail(email: QueuedEmail): void {
  // Fire-and-forget : on ne bloque JAMAIS la réponse HTTP en cours
  void processEmail(email).catch((err) => {
    logger.error("email-queue.uncaught", {
      to: email.to,
      subject: email.subject,
      message: err instanceof Error ? err.message : String(err),
    });
  });
}

async function processEmail(email: QueuedEmail, attempt = 1): Promise<void> {
  const category = email.category ?? "transactional";

  // 1) Vérif RGPD : opt-out ?
  //    Les emails "transactional" (confirmations RDV, devis) sont exempts
  //    car obligation contractuelle. Les autres respectent l'opt-out.
  if (category !== "transactional") {
    try {
      const optedOut = await isEmailOptedOut(email.to, category);
      if (optedOut) {
        logger.info("email-queue.skipped_optout", {
          to: email.to,
          category,
          subject: email.subject,
        });
        return;
      }
    } catch (err) {
      // Si la vérif DB échoue, on préfère envoyer (mieux qu'un client qui
      // rate sa confirmation) mais on logge.
      logger.warn("email-queue.optout_check_failed", {
        to: email.to,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // 2) Ajout des headers List-Unsubscribe (RFC 8058) sauf pour transactional pur
  const extraHeaders =
    category === "transactional"
      ? undefined
      : buildListUnsubscribeHeaders(email.to, category);

  // 3) Envoi
  try {
    const result = await sendEmailRaw({
      ...email,
      headers: { ...email.headers, ...extraHeaders },
    });

    if (result.success) {
      logger.info("email-queue.sent", {
        to: email.to,
        subject: email.subject,
        category,
        attempt,
        id: "id" in result ? result.id : undefined,
      });
      return;
    }

    // Sinon on retry
    throw new Error("error" in result ? result.error : "unknown");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const maxAttempts = email.maxAttempts ?? RETRY_DELAYS_MS.length + 1;

    if (attempt >= maxAttempts) {
      logger.error("email-queue.failed_final", {
        to: email.to,
        subject: email.subject,
        category,
        attempt,
        message,
      });
      return;
    }

    const delay = RETRY_DELAYS_MS[attempt - 1] ?? 30000;
    logger.warn("email-queue.retry_scheduled", {
      to: email.to,
      subject: email.subject,
      attempt,
      delayMs: delay,
      message,
    });

    setTimeout(() => {
      void processEmail(email, attempt + 1);
    }, delay);
  }
}
