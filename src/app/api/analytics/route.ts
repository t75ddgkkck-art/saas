/**
 * Lot 36 — GET /api/analytics?period=7d|30d|90d
 *
 * Agrégations réelles depuis DB pour le dashboard analytics.
 * Retourne :
 *  - Timeline visites/jour (visites totales + visiteurs uniques)
 *  - Sources (top 5)
 *  - Devices (mobile/desktop/tablet)
 *  - Top paths
 *  - Funnel : visites → clics contact → RDV créés → RDV confirmés → payés
 *  - Comparatif période précédente (delta %)
 *
 * Auth : requireTeamPermission("analytics.view") + entitlement `analytics.advanced` (Pro+).
 * Free : renvoie une réponse minimale (visites 7j uniquement).
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { pageVisits, appointments, payments, businesses, users } from "@/db/schema";
import { and, eq, gte, isNull, sql, lte } from "drizzle-orm";
import { checkRateLimit } from "@/lib/rate-limit";
import { getCurrentTeamContext } from "@/lib/team-context";
import { handleApiError, unauthorized } from "@/lib/api-error";
import { canUse } from "@/lib/entitlements";
import type { SubscriptionPlan } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const RATE = { key: "analytics", limit: 60, windowSec: 60 } as const;

type Period = "7d" | "30d" | "90d";

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function periodToDays(p: Period): number {
  return p === "7d" ? 7 : p === "30d" ? 30 : 90;
}

export async function GET(request: NextRequest) {
  const rl = checkRateLimit(request, RATE);
  if (!rl.ok) return rl.response;

  try {
    const ctx = await getCurrentTeamContext();
    if (!ctx) throw unauthorized();

    const url = new URL(request.url);
    const periodParam = (url.searchParams.get("period") ?? "30d") as Period;
    const period: Period =
      periodParam === "7d" || periodParam === "30d" || periodParam === "90d" ? periodParam : "30d";
    const days = periodToDays(period);

    // Charge le plan du business owner pour gating analytics.advanced
    const [owner] = await db
      .select({ subscription: users.subscription })
      .from(users)
      .where(eq(users.id, ctx.business.ownerId))
      .limit(1);
    const ownerPlan = (owner?.subscription || "free") as SubscriptionPlan;
    const advanced = canUse(ownerPlan, "analytics.advanced");

    // Fenêtres temporelles
    const now = new Date();
    const from = new Date(now.getTime() - days * 24 * 3600 * 1000);
    const fromStr = isoDate(from);
    const toStr = isoDate(now);
    // Période précédente pour le comparatif
    const prevFrom = new Date(from.getTime() - days * 24 * 3600 * 1000);
    const prevFromStr = isoDate(prevFrom);

    // ------------------------------------------------------------
    // 1. Timeline visites/jour (visites + unique visitors)
    // ------------------------------------------------------------
    const timeline = await db
      .select({
        date: pageVisits.date,
        visits: sql<number>`count(*)::int`,
        uniques: sql<number>`count(distinct ${pageVisits.visitorHash})::int`,
      })
      .from(pageVisits)
      .where(
        and(
          eq(pageVisits.businessId, ctx.business.id),
          gte(pageVisits.date, fromStr),
          lte(pageVisits.date, toStr)
        )
      )
      .groupBy(pageVisits.date)
      .orderBy(pageVisits.date);

    // Résumé période
    const [summary] = await db
      .select({
        totalVisits: sql<number>`count(*)::int`,
        uniqueVisitors: sql<number>`count(distinct ${pageVisits.visitorHash})::int`,
      })
      .from(pageVisits)
      .where(
        and(
          eq(pageVisits.businessId, ctx.business.id),
          gte(pageVisits.date, fromStr),
          lte(pageVisits.date, toStr)
        )
      );

    // Comparatif période précédente (juste totalVisits pour le delta %)
    const [prevSummary] = await db
      .select({
        totalVisits: sql<number>`count(*)::int`,
      })
      .from(pageVisits)
      .where(
        and(
          eq(pageVisits.businessId, ctx.business.id),
          gte(pageVisits.date, prevFromStr),
          lte(pageVisits.date, fromStr)
        )
      );

    const prevVisits = prevSummary?.totalVisits ?? 0;
    const currVisits = summary?.totalVisits ?? 0;
    const deltaVisitsPct =
      prevVisits === 0
        ? currVisits > 0
          ? 100
          : 0
        : Math.round(((currVisits - prevVisits) / prevVisits) * 100);

    // ------------------------------------------------------------
    // 2. Funnel : visites → RDV créés → RDV confirmés/completed → paiements
    // ------------------------------------------------------------
    const [appointmentsAgg] = await db
      .select({
        created: sql<number>`count(*)::int`,
        confirmed: sql<number>`count(*) filter (where status in ('confirmed', 'en_route', 'in_progress', 'completed'))::int`,
        completed: sql<number>`count(*) filter (where status = 'completed')::int`,
      })
      .from(appointments)
      .where(
        and(
          eq(appointments.businessId, ctx.business.id),
          gte(appointments.date, fromStr),
          lte(appointments.date, toStr),
          isNull(appointments.deletedAt)
        )
      );

    const [paymentsAgg] = await db
      .select({
        count: sql<number>`count(*)::int`,
        totalCents: sql<number>`coalesce(sum(cast(amount as numeric) * 100)::bigint, 0)::bigint`,
      })
      .from(payments)
      .where(
        and(
          eq(payments.businessId, ctx.business.id),
          eq(payments.status, "completed"),
          gte(payments.createdAt, from)
        )
      );

    // ------------------------------------------------------------
    // 3. Réponse minimale pour Free (juste timeline + summary)
    // ------------------------------------------------------------
    if (!advanced) {
      return NextResponse.json(
        {
          period,
          upgradeRequired: true,
          summary: {
            totalVisits: currVisits,
            uniqueVisitors: summary?.uniqueVisitors ?? 0,
            deltaVisitsPct,
          },
          timeline,
          funnel: {
            visits: currVisits,
            appointmentsCreated: appointmentsAgg?.created ?? 0,
            appointmentsCompleted: appointmentsAgg?.completed ?? 0,
            paymentsCount: paymentsAgg?.count ?? 0,
            revenueCents: Number(paymentsAgg?.totalCents ?? 0),
          },
        },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    // ------------------------------------------------------------
    // 4. Advanced (Pro+) : sources, devices, top paths
    // ------------------------------------------------------------
    const sources = await db
      .select({
        source: pageVisits.source,
        count: sql<number>`count(*)::int`,
      })
      .from(pageVisits)
      .where(
        and(
          eq(pageVisits.businessId, ctx.business.id),
          gte(pageVisits.date, fromStr),
          lte(pageVisits.date, toStr)
        )
      )
      .groupBy(pageVisits.source)
      .orderBy(sql`count(*) desc`)
      .limit(10);

    const devices = await db
      .select({
        device: pageVisits.device,
        count: sql<number>`count(*)::int`,
      })
      .from(pageVisits)
      .where(
        and(
          eq(pageVisits.businessId, ctx.business.id),
          gte(pageVisits.date, fromStr),
          lte(pageVisits.date, toStr)
        )
      )
      .groupBy(pageVisits.device)
      .orderBy(sql`count(*) desc`);

    const topPaths = await db
      .select({
        path: pageVisits.path,
        count: sql<number>`count(*)::int`,
      })
      .from(pageVisits)
      .where(
        and(
          eq(pageVisits.businessId, ctx.business.id),
          gte(pageVisits.date, fromStr),
          lte(pageVisits.date, toStr)
        )
      )
      .groupBy(pageVisits.path)
      .orderBy(sql`count(*) desc`)
      .limit(10);

    return NextResponse.json(
      {
        period,
        upgradeRequired: false,
        summary: {
          totalVisits: currVisits,
          uniqueVisitors: summary?.uniqueVisitors ?? 0,
          deltaVisitsPct,
        },
        timeline,
        sources,
        devices,
        topPaths,
        funnel: {
          visits: currVisits,
          appointmentsCreated: appointmentsAgg?.created ?? 0,
          appointmentsConfirmed: appointmentsAgg?.confirmed ?? 0,
          appointmentsCompleted: appointmentsAgg?.completed ?? 0,
          paymentsCount: paymentsAgg?.count ?? 0,
          revenueCents: Number(paymentsAgg?.totalCents ?? 0),
        },
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    return handleApiError(err, { route: "GET /api/analytics" });
  }
}
