/**
 * Transport email pur — pas de template ni de logique métier ici.
 * Utilisé par `email-queue.ts` (envoi avec retry) et rarement direct.
 *
 * Config par variables d'env :
 *   RESEND_API_KEY        — clé API Resend
 *   RESEND_FROM_EMAIL     — expéditeur par défaut (défaut noreply@vitrix.fr)
 *   RESEND_REPLY_TO       — reply-to par défaut (défaut absent → users répondent à FROM)
 *   RESEND_FROM_NAME      — nom affiché avant l'email ("Vitrix <noreply@…>")
 */

import { Resend } from "resend";
import { logger } from "@/lib/logger";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const FROM_ADDRESS = process.env.RESEND_FROM_EMAIL || "noreply@vitrix.fr";
const FROM_NAME = process.env.RESEND_FROM_NAME || "Vitrix";
const DEFAULT_REPLY_TO = process.env.RESEND_REPLY_TO;

/**
 * Lot 42 : attachment simple (PDF facture principalement).
 * Le Buffer est encodé en base64 pour Resend (leur SDK accepte les deux mais
 * base64 est plus safe côté sérialisation JSON quand on file-attend l'email).
 */
export interface EmailAttachment {
  filename: string;
  /** Contenu binaire — sera encodé en base64 avant envoi Resend. */
  content: Buffer;
  contentType?: string;
}

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  /** Optionnel : "Nom Pro <owner@example.com>" pour que le client puisse répondre au pro. */
  replyTo?: string;
  /** Headers custom (List-Unsubscribe, etc.) */
  headers?: Record<string, string>;
  /** From personnalisé (par défaut "Vitrix <noreply@vitrix.fr>"). */
  from?: string;
  /** Lot 42 : pièces jointes (PDF facture, etc.). */
  attachments?: EmailAttachment[];
}

export type EmailResult =
  { success: true; id?: string; simulated?: boolean } | { success: false; error: string };

/**
 * Envoi brut (bloquant). À utiliser DIRECTEMENT uniquement si on veut connaître
 * le résultat synchrone. Sinon préférer `enqueueEmail` (queue non-bloquante).
 */
export async function sendEmailRaw(opts: EmailOptions): Promise<EmailResult> {
  if (!resend) {
    logger.warn("email.simulated", {
      to: opts.to,
      subject: opts.subject,
      reason: "RESEND_API_KEY missing",
    });
    return { success: true, simulated: true };
  }

  try {
    const from = opts.from || `${FROM_NAME} <${FROM_ADDRESS}>`;
    const replyTo = opts.replyTo || DEFAULT_REPLY_TO;

    // Lot 42 : mapping des attachments au format attendu par Resend.
    // Resend accepte `content: Buffer | string (base64)`. On passe le Buffer
    // direct — plus simple, moins de surcharge mémoire côté sérialisation.
    const attachments = opts.attachments?.map((a) => ({
      filename: a.filename,
      content: a.content,
      contentType: a.contentType,
    }));

    const result = await resend.emails.send({
      from,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      replyTo,
      headers: opts.headers,
      attachments,
    });

    return { success: true, id: result.data?.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("email.send_failed", { to: opts.to, subject: opts.subject, message });
    return { success: false, error: message };
  }
}
