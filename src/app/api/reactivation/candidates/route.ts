/**
 * Lot 49 (F13) — GET /api/reactivation/candidates?limit=10
 *
 * Layer 1 déterministe — retourne le top N clients dormants scorés.
 * Accessible à TOUS les plans (aperçu gratuit).
 *
 * Le score et les factors sont calculés dans lib/client-reactivation.ts.
 * Cette route se contente de charger les clients + appliquer `rankCandidates`.
 */

import { NextRequest, NextResponse } from "next/server";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { clients } from "@/db/schema";
import { getCurrentBusiness } from "@/lib/session";
import { handleApiError, unauthorized } from "@/lib/api-error";
import { checkRateLimit } from "@/lib/rate-limit";
import { rankCandidates, type ClientScoringInput } from "@/lib/client-reactivation";

export const dynamic = "force-dynamic";

const RATE = { key: "reactivation-candidates", limit: 30, windowSec: 60 } as const;

export async function GET(req: NextRequest) {
  const rl = checkRateLimit(req, RATE);
  if (!rl.ok) return rl.response;

  try {
    const biz = await getCurrentBusiness();
    if (!biz) throw unauthorized();

    const url = new URL(req.url);
    const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit")) || 10));

    // 1) Charge les clients éligibles au scoring en 1 seul SELECT
    //    Pré-filtre en SQL les clients trivialement non-pertinents (0 RDV) → économise Node CPU
    const rows = await db
      .select({
        clientId: clients.id,
        firstName: clients.firstName,
        lastName: clients.lastName,
        email: clients.email,
        phone: clients.phone,
        lastContact: clients.lastContact,
        appointmentsCount: clients.appointmentsCount,
        noShowsCount: clients.noShowsCount,
        quotesCount: clients.quotesCount,
        totalSpent: clients.totalSpent,
      })
      .from(clients)
      .where(
        and(
          eq(clients.businessId, biz.id),
          isNull(clients.deletedAt),
          // Défensif : on filtre en SQL les clients avec 0 RDV (jamais scorés)
          sql`${clients.appointmentsCount} >= 1`
        )
      )
      // Limite raisonnable en amont pour éviter de charger 10000+ clients en mémoire
      // Si le business dépasse ce seuil, on chargera par batches en Lot ultérieur
      .limit(500);

    // Cast pour matcher ClientScoringInput (types compatibles)
    const inputs: ClientScoringInput[] = rows.map((r) => ({
      clientId: r.clientId,
      firstName: r.firstName,
      lastName: r.lastName,
      email: r.email,
      phone: r.phone,
      lastContact: r.lastContact,
      appointmentsCount: r.appointmentsCount ?? 0,
      noShowsCount: r.noShowsCount ?? 0,
      quotesCount: r.quotesCount ?? 0,
      totalSpent: r.totalSpent,
    }));

    // 2) Applique le ranking déterministe (pure fonction)
    const candidates = rankCandidates(inputs, limit);

    return NextResponse.json({
      ok: true,
      candidates,
      totalScreened: rows.length,
    });
  } catch (err) {
    return handleApiError(err, { route: "GET /api/reactivation/candidates" });
  }
}
