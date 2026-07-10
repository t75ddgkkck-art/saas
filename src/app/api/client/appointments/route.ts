/**
 * F3 (Lot 31) — GET /api/client/appointments
 *
 * Liste les RDV du client connecté tous businesses confondus.
 * Retourne les infos utiles pour l'espace : date, heure, service, business, statut.
 *
 * Filtre :
 *  - Soft-deleted exclus (Lot 14)
 *  - Optionnel `?upcoming=1` → uniquement les RDV à venir
 *  - Optionnel `?businessId=` → filtre par pro
 *
 * Rate-limit 60/min/IP.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { appointments, clients, businesses } from "@/db/schema";
import { and, eq, gte, isNull, sql, desc } from "drizzle-orm";
import { checkRateLimit } from "@/lib/rate-limit";
import { getCurrentClient } from "@/lib/client-session";
import { handleApiError, unauthorized } from "@/lib/api-error";

export const dynamic = "force-dynamic";

const RATE = { key: "client-appointments", limit: 60, windowSec: 60 } as const;

export async function GET(request: NextRequest) {
  const rl = checkRateLimit(request, RATE);
  if (!rl.ok) return rl.response;

  try {
    const client = await getCurrentClient();
    if (!client) throw unauthorized();

    const url = new URL(request.url);
    const upcoming = url.searchParams.get("upcoming") === "1";
    const businessIdFilter = url.searchParams.get("businessId");
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    const conditions = [
      sql`lower(${clients.email}) = ${client.email}`,
      isNull(appointments.deletedAt),
    ];
    if (upcoming) {
      conditions.push(gte(appointments.date, today));
    }
    if (businessIdFilter) {
      conditions.push(eq(appointments.businessId, businessIdFilter));
    }

    const rows = await db
      .select({
        id: appointments.id,
        businessId: appointments.businessId,
        businessName: businesses.name,
        businessSlug: businesses.slug,
        businessCity: businesses.city,
        title: appointments.title,
        description: appointments.description,
        date: appointments.date,
        startTime: appointments.startTime,
        endTime: appointments.endTime,
        status: appointments.status,
        depositRequired: appointments.depositRequired,
        depositAmountCents: appointments.depositAmountCents,
        depositStatus: appointments.depositStatus,
        createdAt: appointments.createdAt,
      })
      .from(appointments)
      .innerJoin(clients, eq(appointments.clientId, clients.id))
      .innerJoin(businesses, eq(appointments.businessId, businesses.id))
      .where(and(...conditions))
      .orderBy(desc(appointments.date), desc(appointments.startTime))
      .limit(200);

    return NextResponse.json({ appointments: rows }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return handleApiError(err, { route: "GET /api/client/appointments" });
  }
}
