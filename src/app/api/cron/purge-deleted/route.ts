/**
 * Cron RGPD (Lot 15) : purge finale des données soft-deleted depuis > N jours.
 *
 * Fréquence : 1× par jour (voir vercel.json cron).
 *
 * Le Lot 14 a mis en place le soft delete (`deleted_at = NOW()`) qui garde
 * les données visibles pour restauration. Ce cron fait le vrai `DELETE`
 * après une période de rétention pour honorer le RGPD article 17
 * (droit à l'effacement).
 *
 * Rétention : 30 jours par défaut (`RGPD_PURGE_DAYS` env var pour override).
 *
 * Sécurité : `CRON_SECRET` obligatoire en prod, vérification par header
 * `x-cron-secret` ou `Authorization: Bearer <secret>`.
 *
 * Cascade : le hard DELETE sur users/businesses fait cascader tout le reste
 * (Lot 14.8) → clients, RDV, devis, blog, paiements, notes disparaissent
 * avec le user. Pour clients/appointments/blog_posts supprimés isolément
 * (sans que le user soit lui-même supprimé), on les purge aussi.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  users,
  businesses,
  clients,
  appointments,
  quotes,
  blogPosts,
} from "@/db/schema";
import { and, isNotNull, lt } from "drizzle-orm";
import { logger } from "@/lib/logger";
import { captureException } from "@/lib/monitoring";

export const dynamic = "force-dynamic";

/**
 * Vérifie le secret cron. Si `CRON_SECRET` n'est pas défini (dev),
 * on autorise sans check pour ne pas bloquer les tests locaux.
 */
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

/** Rétention par défaut : 30 jours. Overridable via env. */
function getRetentionDays(): number {
  const raw = Number(process.env.RGPD_PURGE_DAYS);
  if (Number.isFinite(raw) && raw >= 1 && raw <= 365) return raw;
  return 30;
}

export async function GET(request: NextRequest) {
  const unauth = assertCronAuth(request);
  if (unauth) return unauth;

  const retentionDays = getRetentionDays();
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  const purged: Record<string, number> = {};

  try {
    // Order matters : on purge users EN DERNIER pour que le cascade nettoie
    // aussi ce qu'on n'aurait pas ciblé explicitement (safety net).
    // Pour chaque table, on utilise `.returning({ id })` pour compter les rows.
    for (const [name, table, col] of [
      ["appointments", appointments, appointments.deletedAt],
      ["quotes", quotes, quotes.deletedAt],
      ["blog_posts", blogPosts, blogPosts.deletedAt],
      ["clients", clients, clients.deletedAt],
      ["businesses", businesses, businesses.deletedAt],
      ["users", users, users.deletedAt],
    ] as const) {
      // where : deleted_at IS NOT NULL AND deleted_at < cutoff
      const result = await db
        .delete(table)
        .where(and(isNotNull(col), lt(col, cutoff)))
        .returning({ id: table.id });
      purged[name] = result.length;
    }

    const total = Object.values(purged).reduce((a, b) => a + b, 0);
    logger.info("[cron/purge-deleted] purge RGPD terminée", { retentionDays, purged, total });

    return NextResponse.json({
      ok: true,
      retentionDays,
      cutoff: cutoff.toISOString(),
      purged,
      total,
    });
  } catch (err) {
    // Ce cron doit être visible dès qu'il échoue → severity critical
    captureException(err, {
      route: "GET /api/cron/purge-deleted",
      severity: "critical",
      extra: { retentionDays, purged },
    });
    return NextResponse.json(
      { error: "purge failed", partial: purged },
      { status: 500 }
    );
  }
}
