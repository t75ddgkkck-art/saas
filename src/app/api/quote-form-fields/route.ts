import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { quoteFormFields, businesses } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentBusiness } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const businessSlug = searchParams.get("business");
    
    let businessId: string;
    if (businessSlug) {
      // Mode public : on récupère l'ID par le slug
      const biz = await db.select().from(businesses).where(eq(businesses.slug, businessSlug)).limit(1);
      if (biz.length === 0) return NextResponse.json({ fields: [] });
      businessId = biz[0].id;
    } else {
      // Mode authentifié (dashboard)
      const business = await getCurrentBusiness();
      if (!business) return NextResponse.json({ fields: [] });
      businessId = business.id;
    }

    const fields = await db.select().from(quoteFormFields).where(eq(quoteFormFields.businessId, businessId)).orderBy(quoteFormFields.sortOrder);
    return NextResponse.json({ fields });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const business = await getCurrentBusiness();
    if (!business) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

    const body = await request.json();
    const items: Array<{ label: string; type: string; options?: string; required: boolean }> = body.fields || [];

    // Supprimer les anciens et insérer les nouveaux
    await db.delete(quoteFormFields).where(eq(quoteFormFields.businessId, business.id));
    if (items.length > 0) {
      await db.insert(quoteFormFields).values(
        items
          .filter(f => f.label?.trim())
          .map((f, i) => ({
            businessId: business.id,
            label: f.label.trim(),
            type: f.type || "text",
            options: f.options || null,
            required: f.required || false,
            sortOrder: i,
          }))
      );
    }
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
