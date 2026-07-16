/**
 * Lot 53 (F15) — Cron digest hebdomadaire (refonte complète).
 *
 * Avant (Lot 18 initial) : template daté, réservé Pro/Premium, pas d'opt-out,
 * pas d'action items, pas de segmentation. Résultat : email vu comme spam.
 *
 * Après :
 *  - Envoi à TOUS les plans (Free compris — anti-churn essentiel)
 *  - Segmentation 4 tons : power / active / quiet / dormant
 *  - Action items cliquables : devis à relancer, avis à répondre, RDV demain
 *  - Opt-out RGPD-compliant via lien List-Unsubscribe RFC 8058
 *  - Anti-doublon via `users.weekly_digest_sent_at`
 *  - Skip si "quiet + zéro action" (évite email inutile)
 *  - Skip si "dormant" mais réactivation récente < 30j (double email prévenu)
 *  - Update `weekly_digest_sent_at` en fin d'envoi
 *
 * Programmation : `vercel.json` → dimanche 18h Europe/Paris.
 * Auth : `Authorization: Bearer <CRON_SECRET>` (Vercel) ou `x-cron-secret` (manuel).
 *
 * Ressources : le cron parcourt tous les businesses. Sur une base 10K users
 * ça prend ~10-20s. Si ça devient un problème → batch async par blocs.
 */

import { NextRequest, NextResponse } from "next/server";
import { and, count, eq, gte, isNotNull, isNull, lt, lte, sql } from "drizzle-orm";
import { handleApiError } from "@/lib/api-error";
import { db } from "@/db";
import {
  users,
  businesses,
  appointments,
  quotes,
  payments,
  pageVisits,
  reviews,
  invoices,
} from "@/db/schema";
import { sendEmailRaw } from "@/lib/email-core";
import { isEmailOptedOut } from "@/lib/email-optout-check";
import { buildUnsubscribeUrl, buildListUnsubscribeHeaders } from "@/lib/unsubscribe";
import { logger } from "@/lib/logger";
import {
  computeDigestSegment,
  computeActionItems,
  shouldSendDigest,
  buildDigestHtml,
  buildDigestSubject,
  type WeekStats,
} from "@/lib/weekly-digest";

export const dynamic = "force-dynamic";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.vitrix.fr";

async function handler(request: NextRequest) {
  // Auth cron : Bearer (Vercel Cron) ou header custom (manuel)
  const authHeader = request.headers.get("authorization");
  const cronSecret = request.headers.get("x-cron-secret");
  if (process.env.CRON_SECRET) {
    const validBearer = authHeader === `Bearer ${process.env.CRON_SECRET}`;
    const validHeader = cronSecret === process.env.CRON_SECRET;
    if (!validBearer && !validHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const now = new Date();
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoStr = weekAgo.toISOString().slice(0, 10);

    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().slice(0, 10);

    // Charge tous les businesses (jointure owner pour digest + opt-in)
    const rows = await db
      .select({
        bizId: businesses.id,
        bizName: businesses.name,
        ownerId: users.id,
        ownerEmail: users.email,
        ownerFirstName: users.firstName,
        ownerLastLoginAt: users.lastLoginAt,
        ownerWeeklyDigestEnabled: users.weeklyDigestEnabled,
        ownerWeeklyDigestSentAt: users.weeklyDigestSentAt,
        ownerReactivationSentAt: users.reactivationEmailAt,
      })
      .from(businesses)
      .innerJoin(users, eq(businesses.ownerId, users.id))
      .where(and(isNull(users.deletedAt), isNull(users.bannedAt), isNotNull(users.email)));

    let sent = 0;
    let skipped = 0;
    const skipReasons: Record<string, number> = {};

    for (const row of rows) {
      if (!row.ownerEmail) continue;

      // 1) Check DB opt-in
      if (!row.ownerWeeklyDigestEnabled) {
        skipped++;
        skipReasons["opted_out_db"] = (skipReasons["opted_out_db"] ?? 0) + 1;
        continue;
      }

      // 2) Check email_optouts (opt-out via lien email — RGPD)
      const optedOut = await isEmailOptedOut(row.ownerEmail, "weekly-digest");
      const optedOutAll = await isEmailOptedOut(row.ownerEmail, "all");
      if (optedOut || optedOutAll) {
        skipped++;
        skipReasons["opted_out_email"] = (skipReasons["opted_out_email"] ?? 0) + 1;
        continue;
      }

      // 3) Charge les stats en parallèle
      const [
        visitsRow,
        apptRow,
        quotesRow,
        paymentsRow,
        reviewsRow,
        // Action items — devis en attente signature > 3j
        awaitingSigRow,
        // Avis négatifs non répondus (rating <= 2, semaine passée)
        negReviewsRow,
        // RDV demain non annulés
        apptTomorrowRow,
        // Factures en retard
        overdueRow,
      ] = await Promise.all([
        db
          .select({ n: count() })
          .from(pageVisits)
          .where(and(eq(pageVisits.businessId, row.bizId), gte(pageVisits.date, weekAgoStr))),
        db
          .select({ n: count() })
          .from(appointments)
          .where(and(eq(appointments.businessId, row.bizId), gte(appointments.createdAt, weekAgo))),
        db
          .select({ n: count() })
          .from(quotes)
          .where(
            and(
              eq(quotes.businessId, row.bizId),
              gte(quotes.createdAt, weekAgo),
              isNull(quotes.deletedAt)
            )
          ),
        db
          .select({
            n: count(),
            sum: sql<string>`coalesce(sum(amount), '0')`,
          })
          .from(payments)
          .where(
            and(
              eq(payments.businessId, row.bizId),
              gte(payments.createdAt, weekAgo),
              eq(payments.status, "completed")
            )
          ),
        db
          .select({ n: count() })
          .from(reviews)
          .where(and(eq(reviews.businessId, row.bizId), gte(reviews.createdAt, weekAgo))),
        // Devis "sent" > 3j sans signature
        db
          .select({ n: count() })
          .from(quotes)
          .where(
            and(
              eq(quotes.businessId, row.bizId),
              eq(quotes.status, "sent"),
              isNull(quotes.deletedAt),
              lt(quotes.updatedAt, new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000))
            )
          ),
        // Avis 1-2 étoiles cette semaine (proxy "non répondu" — on n'a pas de flag replied)
        db
          .select({ n: count() })
          .from(reviews)
          .where(
            and(
              eq(reviews.businessId, row.bizId),
              gte(reviews.createdAt, weekAgo),
              lte(reviews.rating, 2)
            )
          ),
        // RDV demain non cancelled
        db
          .select({ n: count() })
          .from(appointments)
          .where(
            and(
              eq(appointments.businessId, row.bizId),
              eq(appointments.date, tomorrowStr),
              isNull(appointments.deletedAt)
            )
          ),
        // Factures issued avec due_date < today (impayées en retard)
        db
          .select({ n: count() })
          .from(invoices)
          .where(
            and(
              eq(invoices.businessId, row.bizId),
              eq(invoices.status, "issued"),
              isNull(invoices.deletedAt),
              lt(invoices.dueDate, now.toISOString().slice(0, 10))
            )
          ),
      ]);

      // 4) Segmente le user
      const weeksSinceActivity = row.ownerLastLoginAt
        ? Math.floor((now.getTime() - row.ownerLastLoginAt.getTime()) / (1000 * 60 * 60 * 24 * 7))
        : 4; // Si aucun login connu → considère dormant

      const stats: WeekStats = {
        visitors: Number(visitsRow[0]?.n ?? 0),
        appointments: Number(apptRow[0]?.n ?? 0),
        quotes: Number(quotesRow[0]?.n ?? 0),
        reviews: Number(reviewsRow[0]?.n ?? 0),
        revenueEur: parseFloat(paymentsRow[0]?.sum ?? "0"),
        weeksSinceActivity,
      };
      const segment = computeDigestSegment(stats);

      const actionItems = computeActionItems({
        quotesAwaitingSignature: Number(awaitingSigRow[0]?.n ?? 0),
        negativeReviewsUnreplied: Number(negReviewsRow[0]?.n ?? 0),
        appointmentsTomorrow: Number(apptTomorrowRow[0]?.n ?? 0),
        invoicesOverdue: Number(overdueRow[0]?.n ?? 0),
      });

      // 5) Décide si on envoie
      const decision = shouldSendDigest({
        optIn: true, // déjà vérifié ci-dessus, on force à true pour éviter la double-vérif
        lastDigestSentAt: row.ownerWeeklyDigestSentAt,
        lastReactivationSentAt: row.ownerReactivationSentAt,
        segment,
        actionItemsCount: actionItems.length,
        now,
      });

      if (!decision.send) {
        skipped++;
        skipReasons[decision.reason] = (skipReasons[decision.reason] ?? 0) + 1;
        continue;
      }

      // 6) Build + send
      const unsubscribeUrl = buildUnsubscribeUrl(row.ownerEmail, "weekly-digest", APP_URL);
      const html = buildDigestHtml({
        firstName: row.ownerFirstName ?? "",
        businessName: row.bizName,
        segment,
        stats,
        actionItems,
        appUrl: APP_URL,
        unsubscribeUrl,
      });
      const subject = buildDigestSubject(segment, stats, row.bizName);

      const emailRes = await sendEmailRaw({
        to: row.ownerEmail,
        subject,
        html,
        headers: {
          // RFC 8058 : bouton natif "Se désabonner" Gmail/Outlook
          ...buildListUnsubscribeHeaders(row.ownerEmail, "weekly-digest", APP_URL),
        },
      });

      if (emailRes.success) {
        sent++;
        // Update flag anti-doublon
        await db
          .update(users)
          .set({ weeklyDigestSentAt: now, updatedAt: now })
          .where(eq(users.id, row.ownerId));
      } else {
        skipped++;
        skipReasons["email_failed"] = (skipReasons["email_failed"] ?? 0) + 1;
        logger.warn("weekly-digest.send_failed", {
          userId: row.ownerId,
          error: emailRes.error,
        });
      }
    }

    logger.info("weekly-digest.batch_done", {
      total: rows.length,
      sent,
      skipped,
      skipReasons,
    });

    return NextResponse.json({
      success: true,
      total: rows.length,
      sent,
      skipped,
      skipReasons,
    });
  } catch (err) {
    return handleApiError(err, { route: "/api/cron/weekly-summary" });
  }
}

// Vercel Cron appelle en GET ; on accepte aussi POST pour les appels manuels
export async function GET(request: NextRequest) {
  return handler(request);
}

export async function POST(request: NextRequest) {
  return handler(request);
}
