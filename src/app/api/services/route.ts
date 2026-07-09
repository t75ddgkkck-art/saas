import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { services } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentBusiness } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const business = await getCurrentBusiness();
    if (!business) return NextResponse.json({ services: [] });
    const list = await db.select().from(services).where(eq(services.businessId, business.id)).orderBy(services.sortOrder);
    return NextResponse.json({ services: list });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const business = await getCurrentBusiness();
    if (!business) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

    const body = await request.json();
    const items: Array<{ name: string; description?: string; price?: string }> = body.services || [];

    await db.delete(services).where(eq(services.businessId, business.id));
    if (items.length > 0) {
      await db.insert(services).values(
        items
          .filter(s => s.name?.trim())
          .map((s, i) => ({
            businessId: business.id,
            name: s.name.trim(),
            description: s.description?.trim() || null,
            price: s.price?.trim() || null,
            sortOrder: i,
          }))
      );
    }
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
