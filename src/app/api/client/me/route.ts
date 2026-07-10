/**
 * F3 (Lot 31) — GET /api/client/me
 *
 * Retourne les infos du client connecté :
 *  - email
 *  - liste des businesses chez qui il a au moins une entrée `clients`
 *    (nom, slug, ville, avatar) — un vrai "carnet d'adresses" personnalisé
 *
 * Rate-limit léger (60/min) car appelé au montage de /mon-compte.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { clients, businesses } from "@/db/schema";
import { eq, sql, and, isNull } from "drizzle-orm";
import { checkRateLimit } from "@/lib/rate-limit";
import { getCurrentClient } from "@/lib/client-session";
import { handleApiError, unauthorized } from "@/lib/api-error";

export const dynamic = "force-dynamic";

const RATE = { key: "client-me", limit: 60, windowSec: 60 } as const;

export async function GET(request: NextRequest) {
  const rl = checkRateLimit(request, RATE);
  if (!rl.ok) return rl.response;

  try {
    const client = await getCurrentClient();
    if (!client) throw unauthorized();

    // Liste des businesses où ce client a au moins une entrée
    // On soft-filtrer businesses.deletedAt (Lot 14)
    const rows = await db
      .selectDistinct({
        id: businesses.id,
        slug: businesses.slug,
        name: businesses.name,
        city: businesses.city,
        category: businesses.category,
        profileImage: businesses.profileImage,
      })
      .from(clients)
      .innerJoin(businesses, eq(clients.businessId, businesses.id))
      .where(and(sql`lower(${clients.email}) = ${client.email}`, isNull(businesses.deletedAt)));

    return NextResponse.json(
      {
        email: client.email,
        businesses: rows,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    return handleApiError(err, { route: "GET /api/client/me" });
  }
}
