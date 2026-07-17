/**
 * Lot 56 — GET /api/analytics/export?period=30d
 *
 * Génère un CSV téléchargeable des stats du business courant.
 *
 * Sections incluses :
 *  - Vue d'ensemble (tous plans)
 *  - Visites par jour (tous plans)
 *  - Sources / Devices / Top paths (Pro+ via `analytics.advanced`)
 *
 * Sécurité :
 *  - Auth via `getCurrentBusiness`
 *  - Rate limit 5/min (export = usage rare, protection contre le scraping)
 *  - Filtrage strict businessId (anti-IDOR)
 *
 * Réponse : text/csv + Content-Disposition attachment → téléchargement natif nav.
 */

import { NextRequest, NextResponse } from "next/server";
import { and, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { pageVisits, appointments, quotes, payments } from "@/db/schema";
import { getCurrentBusiness } from "@/lib/session";
import { handleApiError, unauthorized, badRequest } from "@/lib/api-error";
import { checkRateLimit } from "@/lib/rate-limit";
import { canUse } from "@/lib/entitlements";
import { getCurrentUser } from "@/lib/session";
import type { SubscriptionPlan } from "@/lib/permissions";
import { buildAnalyticsCsv, buildFilename, type AnalyticsExportData } from "@/lib/analytics-export";

export const dynamic = "force-dynamic";

const RATE = { key: "analytics-export", limit: 5, windowSec: 60 } as const;

// Périodes autorisées — cohérent avec /api/analytics
const VALID_PERIODS = new Set(["7d", "30d", "90d"]);

function periodToDays(period: string): number {
  if (period === "7d") return 7;
  if (period === "30d") return 30;
  return 90;
}

export async function GET(req: NextRequest) {
  const rl = checkRateLimit(req, RATE);
  if (!rl.ok) return rl.response;

  try {
    const biz = await getCurrentBusiness();
    if (!biz) throw unauthorized();

    const user = await getCurrentUser();
    if (!user) throw unauthorized();

    const url = new URL(req.url);
    const period = url.searchParams.get("period") || "30d";
    if (!VALID_PERIODS.has(period)) {
      throw badRequest("Période invalide (7d, 30d ou 90d attendu)");
    }

    // Check si le user a droit aux sections avancées (Pro+)
    const plan = (user.subscription || "free") as SubscriptionPlan;
    const advanced = canUse(plan, "analytics.advanced");

    // Calcul des bornes de période
    const now = new Date();
    const from = new Date(now);
    from.setDate(from.getDate() - periodToDays(period));
    const fromStr = from.toISOString().slice(0, 10);
    const toStr = now.toISOString().slice(0, 10);

    // === Requêtes stats (parallel) ===
    const [
      summaryRow,
      timelineRows,
      appointmentsCountRow,
      quotesCountRow,
      revenueRow,
      sourcesRows,
      devicesRows,
      topPathsRows,
    ] = await Promise.all([
      // Vue d'ensemble
      db
        .select({
          totalVisits: sql<number>`count(*)::int`,
          uniqueVisitors: sql<number>`count(distinct ${pageVisits.visitorHash})::int`,
        })
        .from(pageVisits)
        .where(
          and(
            eq(pageVisits.businessId, biz.id),
            gte(pageVisits.date, fromStr),
            lte(pageVisits.date, toStr)
          )
        ),

      // Timeline (par jour, ordonnée)
      db
        .select({
          date: pageVisits.date,
          visits: sql<number>`count(*)::int`,
          uniques: sql<number>`count(distinct ${pageVisits.visitorHash})::int`,
        })
        .from(pageVisits)
        .where(
          and(
            eq(pageVisits.businessId, biz.id),
            gte(pageVisits.date, fromStr),
            lte(pageVisits.date, toStr)
          )
        )
        .groupBy(pageVisits.date)
        .orderBy(pageVisits.date),

      // Nouveaux RDV
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(appointments)
        .where(and(eq(appointments.businessId, biz.id), gte(appointments.createdAt, from))),

      // Nouveaux devis
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(quotes)
        .where(and(eq(quotes.businessId, biz.id), gte(quotes.createdAt, from))),

      // Revenue
      db
        .select({
          sum: sql<string>`coalesce(sum(amount), '0')`,
        })
        .from(payments)
        .where(
          and(
            eq(payments.businessId, biz.id),
            eq(payments.status, "completed"),
            gte(payments.createdAt, from)
          )
        ),

      // Sources (Pro+ uniquement — on filtre en JS après)
      advanced
        ? db
            .select({
              source: pageVisits.source,
              count: sql<number>`count(*)::int`,
            })
            .from(pageVisits)
            .where(
              and(
                eq(pageVisits.businessId, biz.id),
                gte(pageVisits.date, fromStr),
                lte(pageVisits.date, toStr)
              )
            )
            .groupBy(pageVisits.source)
            .orderBy(sql`count(*) desc`)
            .limit(20)
        : Promise.resolve([]),

      advanced
        ? db
            .select({
              device: pageVisits.device,
              count: sql<number>`count(*)::int`,
            })
            .from(pageVisits)
            .where(
              and(
                eq(pageVisits.businessId, biz.id),
                gte(pageVisits.date, fromStr),
                lte(pageVisits.date, toStr)
              )
            )
            .groupBy(pageVisits.device)
            .orderBy(sql`count(*) desc`)
        : Promise.resolve([]),

      advanced
        ? db
            .select({
              path: pageVisits.path,
              count: sql<number>`count(*)::int`,
            })
            .from(pageVisits)
            .where(
              and(
                eq(pageVisits.businessId, biz.id),
                gte(pageVisits.date, fromStr),
                lte(pageVisits.date, toStr)
              )
            )
            .groupBy(pageVisits.path)
            .orderBy(sql`count(*) desc`)
            .limit(20)
        : Promise.resolve([]),
    ]);

    // === Construction de la payload export ===
    const exportData: AnalyticsExportData = {
      period,
      businessName: biz.name,
      businessSlug: biz.slug,
      summary: {
        totalVisits: Number(summaryRow[0]?.totalVisits ?? 0),
        uniqueVisitors: Number(summaryRow[0]?.uniqueVisitors ?? 0),
        newAppointments: Number(appointmentsCountRow[0]?.count ?? 0),
        newQuotes: Number(quotesCountRow[0]?.count ?? 0),
        revenueEur: parseFloat(revenueRow[0]?.sum ?? "0"),
      },
      daily: timelineRows.map((t) => ({
        date: t.date,
        visits: Number(t.visits),
        uniqueVisitors: Number(t.uniques),
      })),
      // Note : Drizzle infère les colonnes nullable comme `string | null`.
      // On filtre les null (rows sans source/device/path enregistré) puis on
      // remap en `string` non-null pour matcher AnalyticsExportData.
      sources: advanced
        ? sourcesRows
            .filter((s) => s.source !== null)
            .map((s) => ({ source: s.source as string, count: Number(s.count) }))
        : undefined,
      devices: advanced
        ? devicesRows
            .filter((d) => d.device !== null)
            .map((d) => ({ device: d.device as string, count: Number(d.count) }))
        : undefined,
      topPaths: advanced
        ? topPathsRows
            .filter((p) => p.path !== null)
            .map((p) => ({ path: p.path as string, count: Number(p.count) }))
        : undefined,
    };

    const csv = buildAnalyticsCsv(exportData);
    const filename = buildFilename(biz.slug, period);

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store, private",
      },
    });
  } catch (err) {
    return handleApiError(err, { route: "GET /api/analytics/export" });
  }
}
