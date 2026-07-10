import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { availabilitySlots, businesses } from "@/db/schema";
import { eq, and, gte } from "drizzle-orm";

export async function GET(request: NextRequest) {
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
