import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { faqs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentBusiness } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const business = await getCurrentBusiness();
    if (!business) return NextResponse.json({ faqs: [] });
    const list = await db.select().from(faqs).where(eq(faqs.businessId, business.id)).orderBy(faqs.sortOrder);
    return NextResponse.json({ faqs: list });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT: remplace toute la FAQ (édition en bloc depuis la page vitrine)
export async function PUT(request: NextRequest) {
  try {
    const business = await getCurrentBusiness();
    if (!business) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

    const body = await request.json();
    const items: { question: string; answer: string }[] = body.faqs || [];

    // Supprimer les anciennes et insérer les nouvelles
    await db.delete(faqs).where(eq(faqs.businessId, business.id));
    if (items.length > 0) {
      await db.insert(faqs).values(
        items
          .filter(f => f.question?.trim() && f.answer?.trim())
          .map((f, i) => ({
            businessId: business.id,
            question: f.question.trim(),
            answer: f.answer.trim(),
            sortOrder: i,
            isPublished: true,
          }))
      );
    }
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
