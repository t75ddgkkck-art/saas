/**
 * GET /api/quotes/[id]
 * Détail d'un devis + items + client (jointure). Vérifie l'ownership business
 * (anti-IDOR) et filtre soft-deleted.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { quotes, quoteItems, clients } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { getCurrentBusiness } from "@/lib/session";
import { handleApiError, notFound, unauthorized } from "@/lib/api-error";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const business = await getCurrentBusiness();
    if (!business) throw unauthorized();

    // Ownership check en SQL : businessId doit matcher.
    const [quote] = await db
      .select()
      .from(quotes)
      .where(and(eq(quotes.id, id), eq(quotes.businessId, business.id), isNull(quotes.deletedAt)))
      .limit(1);

    if (!quote) throw notFound("Devis introuvable");

    const items = await db.select().from(quoteItems).where(eq(quoteItems.quoteId, quote.id));

    let client = null;
    if (quote.clientId) {
      const [c] = await db
        .select({
          id: clients.id,
          firstName: clients.firstName,
          lastName: clients.lastName,
          email: clients.email,
          phone: clients.phone,
        })
        .from(clients)
        .where(eq(clients.id, quote.clientId))
        .limit(1);
      client = c || null;
    }

    return NextResponse.json({ quote, items, client });
  } catch (err) {
    return handleApiError(err, { route: `GET /api/quotes/${id}` });
  }
}
