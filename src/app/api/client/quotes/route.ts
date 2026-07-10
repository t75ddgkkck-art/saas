/**
 * F3 (Lot 31) — GET /api/client/quotes
 *
 * Liste les devis reçus par le client connecté (tous businesses confondus).
 * Filtre les soft-deleted. Rate-limit 60/min.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { quotes, clients, businesses } from "@/db/schema";
import { and, eq, isNull, sql, desc } from "drizzle-orm";
import { checkRateLimit } from "@/lib/rate-limit";
import { getCurrentClient } from "@/lib/client-session";
import { handleApiError, unauthorized } from "@/lib/api-error";

export const dynamic = "force-dynamic";

const RATE = { key: "client-quotes", limit: 60, windowSec: 60 } as const;

export async function GET(request: NextRequest) {
  const rl = checkRateLimit(request, RATE);
  if (!rl.ok) return rl.response;

  try {
    const client = await getCurrentClient();
    if (!client) throw unauthorized();

    const rows = await db
      .select({
        id: quotes.id,
        businessId: quotes.businessId,
        businessName: businesses.name,
        businessSlug: businesses.slug,
        quoteNumber: quotes.quoteNumber,
        title: quotes.title,
        total: quotes.total,
        status: quotes.status,
        validUntil: quotes.validUntil,
        createdAt: quotes.createdAt,
        signedAt: quotes.signedAt,
      })
      .from(quotes)
      .innerJoin(clients, eq(quotes.clientId, clients.id))
      .innerJoin(businesses, eq(quotes.businessId, businesses.id))
      .where(and(sql`lower(${clients.email}) = ${client.email}`, isNull(quotes.deletedAt)))
      .orderBy(desc(quotes.createdAt))
      .limit(200);

    return NextResponse.json({ quotes: rows }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return handleApiError(err, { route: "GET /api/client/quotes" });
  }
}
