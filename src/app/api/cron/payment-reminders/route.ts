/**
 * Cron relance impayés (Lot 24).
 *
 * Fréquence : 1× par jour (vercel.json cron).
 *
 * Cible : `payments.status = 'pending'` avec `created_at` >= 7 jours.
 * Envoie un email de relance au client lié :
 *   - 1ère relance : J+7 (aimable)
 *   - 2ème relance : J+15 (rappel + acompte)
 *   - 3ème relance : J+30 (dernière avant mise en demeure)
 *
 * On stocke `last_reminder_at` et `reminder_count` pour ne pas spammer et
 * limiter à 3 relances max.
 *
 * Sécurité : `CRON_SECRET` obligatoire en prod.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { payments, clients, businesses } from "@/db/schema";
import { and, eq, lt, or, isNull, sql } from "drizzle-orm";
import { logger } from "@/lib/logger";
import { captureException } from "@/lib/monitoring";
import { sendEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

function assertCronAuth(request: NextRequest): NextResponse | null {
  if (!process.env.CRON_SECRET) return null;
  const auth = request.headers.get("authorization");
  const custom = request.headers.get("x-cron-secret");
  const bearer = `Bearer ${process.env.CRON_SECRET}`;
  if (auth !== bearer && custom !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

/**
 * Retourne la prochaine échelle de relance :
 *   count=0 + createdAt < J-7   → 1ère relance
 *   count=1 + lastReminder < J-8 (7 jours après la 1ère) → 2ème
 *   count=2 + lastReminder < J-15 (15 jours après la 2ème) → 3ème
 *   count>=3 → stop, on n'envoie plus
 */
function shouldRemind(
  reminderCount: number,
  createdAt: Date,
  lastReminderAt: Date | null
): { should: boolean; step: 1 | 2 | 3 | null } {
  const now = Date.now();
  const ageDays = (now - createdAt.getTime()) / (1000 * 60 * 60 * 24);
  const sinceLastDays = lastReminderAt
    ? (now - lastReminderAt.getTime()) / (1000 * 60 * 60 * 24)
    : Infinity;

  if (reminderCount === 0 && ageDays >= 7) return { should: true, step: 1 };
  if (reminderCount === 1 && sinceLastDays >= 8) return { should: true, step: 2 };
  if (reminderCount === 2 && sinceLastDays >= 15) return { should: true, step: 3 };
  return { should: false, step: null };
}

function reminderCopy(step: 1 | 2 | 3, businessName: string, amount: string, currency: string) {
  const amt = `${amount} ${currency}`;
  if (step === 1) {
    return {
      subject: `Rappel amical — Facture ${businessName}`,
      html: `<div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #0f172a;">Rappel de paiement</h1>
        <p>Bonjour,</p>
        <p>Nous vous rappelons qu'une facture de <strong>${amt}</strong> émise par <strong>${businessName}</strong> reste en attente de règlement depuis 7 jours.</p>
        <p>Si vous l'avez déjà réglée, merci d'ignorer ce message.</p>
        <p style="color: #64748b; font-size: 13px;">Sinon, contactez ${businessName} pour régler la situation.</p>
      </div>`,
    };
  }
  if (step === 2) {
    return {
      subject: `2ème rappel — Facture ${businessName} en attente`,
      html: `<div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #92400e;">2ème rappel de paiement</h1>
        <p>Bonjour,</p>
        <p>Votre facture de <strong>${amt}</strong> émise par <strong>${businessName}</strong> reste impayée depuis <strong>plus de 15 jours</strong>.</p>
        <p>Merci de procéder au règlement rapidement pour éviter tout frais supplémentaire.</p>
        <p style="color: #64748b; font-size: 13px;">Contactez ${businessName} si vous rencontrez une difficulté.</p>
      </div>`,
    };
  }
  return {
    subject: `⚠️ Dernier rappel — Facture ${businessName}`,
    html: `<div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #dc2626;">Dernier rappel avant mise en demeure</h1>
      <p>Bonjour,</p>
      <p>Votre facture de <strong>${amt}</strong> émise par <strong>${businessName}</strong> est impayée depuis <strong>plus de 30 jours</strong>.</p>
      <p>Sans règlement sous 8 jours, ${businessName} pourra engager une procédure de recouvrement.</p>
      <p style="color: #dc2626; font-size: 13px;"><strong>Merci de régler cette facture au plus vite.</strong></p>
    </div>`,
  };
}

export async function GET(request: NextRequest) {
  const unauth = assertCronAuth(request);
  if (unauth) return unauth;

  const stats = { scanned: 0, sent: 0, skipped: 0, capped: 0, failed: 0 };

  try {
    // Cible : paiements pending depuis >= 7 jours, reminder_count < 3
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const candidates = await db
      .select({
        paymentId: payments.id,
        amount: payments.amount,
        currency: payments.currency,
        createdAt: payments.createdAt,
        lastReminderAt: payments.lastReminderAt,
        reminderCount: payments.reminderCount,
        clientEmail: clients.email,
        clientFirstName: clients.firstName,
        businessName: businesses.name,
      })
      .from(payments)
      .leftJoin(clients, eq(clients.id, payments.clientId))
      .leftJoin(businesses, eq(businesses.id, payments.businessId))
      .where(
        and(
          eq(payments.status, "pending"),
          lt(payments.createdAt, sevenDaysAgo),
          // Skip ceux déjà relancés 3× (safety net, la logique step gère aussi)
          or(isNull(payments.reminderCount), lt(payments.reminderCount, 3))
        )
      );

    stats.scanned = candidates.length;

    for (const c of candidates) {
      const decision = shouldRemind(c.reminderCount ?? 0, c.createdAt, c.lastReminderAt);
      if (!decision.should) {
        stats.skipped++;
        continue;
      }
      if ((c.reminderCount ?? 0) >= 3) {
        stats.capped++;
        continue;
      }
      if (!c.clientEmail) {
        // Pas d'email → pas de relance auto possible (l'user pourra le faire manuellement)
        stats.skipped++;
        continue;
      }

      const tpl = reminderCopy(
        decision.step!,
        c.businessName || "votre prestataire",
        c.amount,
        c.currency || "EUR"
      );

      try {
        await sendEmail(
          {
            to: c.clientEmail,
            subject: tpl.subject,
            html: tpl.html,
          },
          { category: "reminders" }
        );
        // MAJ compteur + dernière date
        await db
          .update(payments)
          .set({
            reminderCount: sql`${payments.reminderCount} + 1`,
            lastReminderAt: new Date(),
          })
          .where(eq(payments.id, c.paymentId));
        stats.sent++;
      } catch (err) {
        stats.failed++;
        logger.warn("[cron/payment-reminders] échec envoi", {
          paymentId: c.paymentId,
          err: err instanceof Error ? err.message : String(err),
        });
      }
    }

    logger.info("[cron/payment-reminders] terminé", stats);
    return NextResponse.json({ ok: true, ...stats });
  } catch (err) {
    captureException(err, {
      route: "GET /api/cron/payment-reminders",
      severity: "error",
      extra: stats,
    });
    return NextResponse.json({ ok: false, error: "cron failed", ...stats }, { status: 500 });
  }
}

// Export interne pour tests unit
export const __cronInternals = { shouldRemind };
