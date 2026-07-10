/**
 * GET /api/v1/me
 * Retourne les infos du business associé à la clé API.
 * Sans données sensibles (pas de user email, pas de config Stripe).
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { businesses } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireApiKey } from "@/lib/public-api";
import { handleApiError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const gate = await requireApiKey(req);
  if (!gate.ok) return gate.response;

  try {
    const [biz] = await db
      .select({
        id: businesses.id,
        slug: businesses.slug,
        name: businesses.name,
        category: businesses.category,
        city: businesses.city,
        postalCode: businesses.postalCode,
        phone: businesses.phone,
        email: businesses.email,
        website: businesses.website,
        createdAt: businesses.createdAt,
      })
      .from(businesses)
      .where(eq(businesses.id, gate.auth.businessId))
      .limit(1);

    if (!biz) {
      return NextResponse.json({ error: "business_not_found" }, { status: 404 });
    }

    return NextResponse.json({ business: biz });
  } catch (err) {
    return handleApiError(err, { route: "GET /api/v1/me" });
  }
}
