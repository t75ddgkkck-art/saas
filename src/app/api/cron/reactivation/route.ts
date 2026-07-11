/**
 * Lot 36 — GET /api/cron/reactivation
 *
 * Cron quotidien qui envoie un email de réactivation aux users inactifs :
 *  - lastLoginAt entre 30j et 90j (fenêtre "à récupérer")
 *  - reactivationEmailAt null OU > 30j (anti-spam : max 1 email/mois)
 *  - !bannedAt et !deletedAt
 *  - emailVerified = true (on ne re-spam pas les emails non vérifiés)
 *
 * Après envoi : met à jour reactivationEmailAt = now.
 *
 * Sécurité : header `Authorization: Bearer ${CRON_SECRET}` (pattern Vercel).
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { and, eq, gte, isNull, lte, or, sql } from "drizzle-orm";
import { logger } from "@/lib/logger";
import { sendEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

/**
 * Exposé pour tests unitaires : décide si un user doit recevoir le mail.
 * Pure : pas d'accès DB.
 */
export function shouldSendReactivation(
  user: {
    lastLoginAt: Date | null;
    reactivationEmailAt: Date | null;
    emailVerified: boolean;
    bannedAt: Date | null;
    deletedAt: Date | null;
  },
  now: Date = new Date()
): boolean {
  if (user.bannedAt || user.deletedAt) return false;
  if (!user.emailVerified) return false;
  if (!user.lastLoginAt) return false; // jamais loggé — on ignore

  const daysSinceLogin = (now.getTime() - user.lastLoginAt.getTime()) / 86_400_000;
  // Fenêtre "récupérable" : 30 → 90 jours (au-delà, on considère churn définitif)
  if (daysSinceLogin < 30 || daysSinceLogin > 90) return false;

  // Anti-spam : max 1 email de réactivation par 30 jours
  if (user.reactivationEmailAt) {
    const daysSinceEmail = (now.getTime() - user.reactivationEmailAt.getTime()) / 86_400_000;
    if (daysSinceEmail < 30) return false;
  }

  return true;
}

/**
 * Template email inline. Sobre, factuel, 1 CTA clair.
 * Personnalisé avec le prénom + le nombre de jours d'inactivité.
 */
function buildReactivationEmail(firstName: string, daysSinceLogin: number): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.vitrix.fr";
  return `
    <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #0f172a;">
      <h1 style="font-size: 22px; margin: 0 0 16px;">Vous nous manquez, ${firstName} 👋</h1>
      <p style="color: #334155; margin: 0 0 16px;">
        Cela fait <strong>${daysSinceLogin} jours</strong> que vous ne vous êtes pas connecté à Vitrix.
      </p>
      <p style="color: #334155; margin: 0 0 24px;">
        Pendant votre absence, plusieurs nouveautés sont arrivées :
      </p>
      <ul style="color: #334155; margin: 0 0 24px; padding-left: 20px;">
        <li style="margin-bottom: 6px;"><strong>Page Aujourd'hui</strong> — tout ce qu'il faut sur le terrain en 1 tap</li>
        <li style="margin-bottom: 6px;"><strong>Espace client</strong> — vos clients gèrent leurs RDV eux-mêmes</li>
        <li style="margin-bottom: 6px;"><strong>Acompte à la réservation</strong> — plus jamais de no-show</li>
        <li style="margin-bottom: 6px;"><strong>Calendrier drag&drop</strong> + sync Google Calendar</li>
      </ul>
      <div style="text-align: center; margin: 32px 0;">
        <a href="${appUrl}/login" style="display: inline-block; background: #0f172a; color: white; padding: 14px 28px; border-radius: 10px; text-decoration: none; font-weight: 600;">
          Reprendre mon activité
        </a>
      </div>
      <p style="color: #64748b; font-size: 13px; margin: 0 0 8px;">
        Si vous ne souhaitez plus utiliser Vitrix, vous pouvez supprimer votre compte
        depuis les paramètres — nous respectons votre choix.
      </p>
      <p style="color: #94a3b8; font-size: 12px; margin: 24px 0 0;">
        Cet email est envoyé une fois par mois maximum. Aucun autre rappel ne suivra.
      </p>
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
  const min = new Date(now.getTime() - 90 * 86_400_000);
  const max = new Date(now.getTime() - 30 * 86_400_000);
  const monthAgo = new Date(now.getTime() - 30 * 86_400_000);

  try {
    // Charge les candidats — SQL pré-filtre pour limiter la volumétrie.
    // Le filtrage fin (shouldSendReactivation) reste en JS pour tests unitaires.
    const candidates = await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastLoginAt: users.lastLoginAt,
        reactivationEmailAt: users.reactivationEmailAt,
        emailVerified: users.emailVerified,
        bannedAt: users.bannedAt,
        deletedAt: users.deletedAt,
      })
      .from(users)
      .where(
        and(
          eq(users.emailVerified, true),
          isNull(users.bannedAt),
          isNull(users.deletedAt),
          gte(users.lastLoginAt, min),
          lte(users.lastLoginAt, max),
          or(isNull(users.reactivationEmailAt), lte(users.reactivationEmailAt, monthAgo))
        )
      )
      .limit(500); // safety cap — un digest > 500 devrait être batché sur plusieurs jours

    let sent = 0;
    const errors: string[] = [];

    for (const u of candidates) {
      if (!shouldSendReactivation(u, now)) continue;
      const days = Math.floor(
        (now.getTime() - (u.lastLoginAt?.getTime() ?? now.getTime())) / 86_400_000
      );
      try {
        await sendEmail(
          {
            to: u.email,
            subject: `Vous nous manquez, ${u.firstName} 👋`,
            html: buildReactivationEmail(u.firstName, days),
          },
          { category: "reminders" }
        );
        await db.update(users).set({ reactivationEmailAt: now }).where(eq(users.id, u.id));
        sent++;
      } catch (err) {
        errors.push(`${u.id}: ${err instanceof Error ? err.message : String(err)}`);
        logger.warn("cron.reactivation.send_failed", { userId: u.id });
      }
    }

    logger.info("cron.reactivation.done", {
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
    logger.error("cron.reactivation.failed", {
      err: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

/**
 * Exports pour tests unitaires (pattern déjà utilisé sur payment-reminders Lot 24)
 */
export const __cronInternals = { shouldSendReactivation, buildReactivationEmail };
