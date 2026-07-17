import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { availabilitySlots, businesses } from "@/db/schema";
import { eq, and, gte } from "drizzle-orm";
import { checkRateLimit } from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
  // Lot 59 MIN1 : route publique appelée à chaque ouverture du widget booking
  // sur la vitrine. Sans rate-limit, un scraper peut extraire tous les créneaux
  // de tous les pros (concurrence) ou faire tomber la DB par spam.
  // 60 req/min par IP = largement au-dessus du besoin légitime (un visiteur
  // ouvre le widget ~5 fois max avant de réserver).
  const rl = checkRateLimit(request, { key: "availability", limit: 60, windowSec: 60 });
  if (!rl.ok) return rl.response;

  const { searchParams } = new URL(request.url);
  const businessSlug = searchParams.get("business");

  if (!businessSlug) {
    return NextResponse.json({ error: "business slug requis" }, { status: 400 });
  }

  const biz = await db.select().from(businesses).where(eq(businesses.slug, businessSlug)).limit(1);
  if (biz.length === 0) {
    return NextResponse.json({ error: "Business non trouvé" }, { status: 404 });
  }

  const today = new Date().toISOString().split("T")[0];

  const slots = await db
    .select()
    .from(availabilitySlots)
    .where(
      and(
        eq(availabilitySlots.businessId, biz[0].id),
        eq(availabilitySlots.isBooked, false),
        eq(availabilitySlots.isBlocked, false),
        gte(availabilitySlots.date, today)
      )
    )
    .orderBy(availabilitySlots.date, availabilitySlots.startTime)
    .limit(100);

  return NextResponse.json({ slots });
}
