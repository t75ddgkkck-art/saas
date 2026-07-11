/**
 * F8 (Lot 38) — GET /api/cron/quote-signature-reminders
 *
 * Envoie un rappel de signature aux clients qui n'ont pas encore signé.
 *
 * Politique 3 échelons (pattern payment-reminders Lot 24) :
 *  - J+3 après envoi : rappel amical (rappel_count == 0)
 *  - J+7 après envoi : relance ferme (rappel_count == 1)
 *  - J+15 : dernier rappel avant expiration (rappel_count == 2)
 *  - Après : plus rien (le pro relance manuellement)
 *
 * Cible : quotes.status = "sent", signatureTokenHash NOT NULL,
 *         signatureTokenExpiresAt > now, deletedAt IS NULL.
 *
 * Sécurité : `Authorization: Bearer ${CRON_SECRET}`.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { quotes, clients, businesses } from "@/db/schema";
import { and, eq, gt, isNull, lte, or, sql } from "drizzle-orm";
import { logger } from "@/lib/logger";
import { sendEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

/**
 * Pure : décide si un devis doit recevoir un rappel + quel échelon.
 * Testable sans DB. Exportée pour tests unitaires.
 */
export function decideReminderTier(
  quote: {
    status: string;
    signatureTokenHash: string | null;
    signatureTokenExpiresAt: Date | null;
    signatureReminderCount: number;
    signatureReminderSentAt: Date | null;
    updatedAt: Date;
  },
  now: Date = new Date()
): "J+3" | "J+7" | "J+15" | null {
  if (quote.status !== "sent") return null;
  if (!quote.signatureTokenHash) return null;
  if (quote.signatureTokenExpiresAt && quote.signatureTokenExpiresAt < now) return null;

  const daysSinceSend = (now.getTime() - quote.updatedAt.getTime()) / (24 * 3600 * 1000);
  const daysSinceReminder = quote.signatureReminderSentAt
    ? (now.getTime() - quote.signatureReminderSentAt.getTime()) / (24 * 3600 * 1000)
    : Number.POSITIVE_INFINITY;

  // Échelon 1 : J+3, jamais relancé
  if (quote.signatureReminderCount === 0 && daysSinceSend >= 3) return "J+3";
  // Échelon 2 : J+7, 1 rappel déjà envoyé il y a > 3j
  if (quote.signatureReminderCount === 1 && daysSinceSend >= 7 && daysSinceReminder >= 3) {
    return "J+7";
  }
  // Échelon 3 : J+15, 2 rappels déjà envoyés il y a > 7j
  if (quote.signatureReminderCount === 2 && daysSinceSend >= 15 && daysSinceReminder >= 7) {
    return "J+15";
  }
  return null;
}

const TIER_LABELS: Record<string, { subject: string; tone: string }> = {
  "J+3": {
    subject: "Petit rappel : votre devis vous attend",
    tone: "Voici un petit rappel amical concernant votre devis. Prenez quelques minutes pour le consulter dès que possible.",
  },
  "J+7": {
    subject: "Votre devis attend votre signature",
    tone: "Cela fait maintenant une semaine que votre devis vous a été envoyé. N'hésitez pas à nous contacter si vous avez des questions.",
  },
  "J+15": {
    subject: "Dernier rappel : votre devis va bientôt expirer",
    tone: "Attention : votre devis approche de sa date d'expiration. Signez-le rapidement pour verrouiller les tarifs proposés.",
  },
};

function buildReminderEmail(data: {
  clientName: string;
  bizName: string;
  quoteNumber: string;
  total: string;
  signatureUrl: string;
  tone: string;
}): string {
  return `
    <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #0f172a;">
      <h1 style="font-size: 20px; margin: 0 0 16px;">${data.clientName},</h1>
      <p style="color: #334155; margin: 0 0 16px;">${data.tone}</p>
      <p style="color: #334155; margin: 0 0 24px;">
        Devis <strong>N° ${data.quoteNumber}</strong> de <strong>${data.bizName}</strong> —
        <strong>${data.total} €</strong>.
      </p>
      <div style="text-align: center; margin: 32px 0;">
        <a href="${data.signatureUrl}" style="display: inline-block; background: #0f172a; color: white; padding: 14px 28px; border-radius: 10px; text-decoration: none; font-weight: 600;">
          Consulter et signer
        </a>
      </div>
    </div>
  `;
}

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET || ""}`;
  if (!process.env.CRON_SECRET || auth !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const fifteenDaysAgo = new Date(now.getTime() - 15 * 24 * 3600 * 1000);

  try {
    // Pré-filtre SQL large (les quotes envoyés dans les 30 derniers jours,
    // non signés, avec token actif). Le filtrage fin passe par decideReminderTier.
    const candidates = await db
      .select({
        quote: quotes,
        clientEmail: clients.email,
        clientFirstName: clients.firstName,
        clientLastName: clients.lastName,
        bizName: businesses.name,
      })
      .from(quotes)
      .leftJoin(clients, eq(quotes.clientId, clients.id))
      .innerJoin(businesses, eq(quotes.businessId, businesses.id))
      .where(
        and(
          eq(quotes.status, "sent"),
          isNull(quotes.deletedAt),
          isNull(quotes.signedAt),
          gt(quotes.signatureTokenExpiresAt, now),
          // signatureReminderCount < 3 = pas encore atteint la limite
          sql`${quotes.signatureReminderCount} < 3`,
          // updatedAt >= J-30 (économise le scan sur les vieux)
          gt(quotes.updatedAt, fifteenDaysAgo),
          // Client a un email (sinon pas de destination)
          or(sql`${clients.email} IS NOT NULL`, sql`${clients.email} != ''`)
        )
      )
      .limit(200);

    let sent = 0;
    const errors: string[] = [];

    for (const c of candidates) {
      const tier = decideReminderTier(c.quote, now);
      if (!tier) continue;
      if (!c.clientEmail) continue;

      // Reconstruit l'URL de signature à partir du token — SAUF QUE
      // on n'a que le HASH côté DB (le token brut n'est jamais stocké).
      // Solution : renvoyer une URL vers l'espace client public + demander
      // à l'utilisateur de re-cliquer sur son lien original.
      // Alternative simple : le pro peut aussi renvoyer le mail manuellement
      // via le dashboard (POST /api/quotes/[id]/send-signature) qui regénère
      // un token → cet endpoint est un "poussage passif" qui rappelle.
      //
      // Pour v1 : on envoie un email de rappel SANS lien direct (renvoie
      // au message d'origine du pro). Simple, efficace, pas de leak.
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.vitrix.fr";
      const fallbackUrl = `${appUrl}/`;

      const clientName =
        [c.clientFirstName, c.clientLastName].filter(Boolean).join(" ") || "Bonjour";

      try {
        await sendEmail(
          {
            to: c.clientEmail,
            subject: TIER_LABELS[tier].subject,
            html: buildReminderEmail({
              clientName,
              bizName: c.bizName,
              quoteNumber: c.quote.quoteNumber,
              total: c.quote.total ?? "0",
              signatureUrl: fallbackUrl,
              tone: TIER_LABELS[tier].tone,
            }),
          },
          { category: "reminders" }
        );

        await db
          .update(quotes)
          .set({
            signatureReminderSentAt: now,
            signatureReminderCount: (c.quote.signatureReminderCount ?? 0) + 1,
          })
          .where(eq(quotes.id, c.quote.id));

        sent++;
      } catch (err) {
        errors.push(`${c.quote.id}: ${err instanceof Error ? err.message : String(err)}`);
        logger.warn("cron.quote-signature-reminder.send_failed", {
          quoteId: c.quote.id,
        });
      }
    }

    logger.info("cron.quote-signature-reminders.done", {
      candidates: candidates.length,
      sent,
      errors: errors.length,
    });

    return NextResponse.json({
      candidates: candidates.length,
      sent,
      errors: errors.length,
    });
  } catch (err) {
    logger.error("cron.quote-signature-reminders.failed", {
      err: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

/** Exports pour tests (pattern déjà utilisé sur payment-reminders Lot 24). */
export const __cronInternals = { decideReminderTier };
