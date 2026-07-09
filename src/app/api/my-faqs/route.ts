import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { faqs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentBusiness } from "@/lib/session";
import { handleApiError, unauthorized } from "@/lib/api-error";
import { validateBody } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

const PutSchema = z.object({
  faqs: z
    .array(
      z.object({
        question: z.string().trim().min(1).max(300),
        answer: z.string().trim().min(1).max(3000),
      })
    )
    .max(50, "Maximum 50 questions dans la FAQ"),
});

export async function GET() {
  try {
    const business = await getCurrentBusiness();
    if (!business) return NextResponse.json({ faqs: [] });
    const list = await db
      .select()
      .from(faqs)
      .where(eq(faqs.businessId, business.id))
      .orderBy(faqs.sortOrder);
    return NextResponse.json({ faqs: list });
  } catch (err) {
    return handleApiError(err, { route: "GET /api/my-faqs" });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const business = await getCurrentBusiness();
    if (!business) throw unauthorized();

    const { faqs: items } = await validateBody(request, PutSchema);

    // Purge scopée au business courant (fix IDOR implicite)
    await db.delete(faqs).where(eq(faqs.businessId, business.id));

    if (items.length > 0) {
      await db.insert(faqs).values(
        items.map((f, i) => ({
          businessId: business.id,
          question: f.question,
          answer: f.answer,
          sortOrder: i,
          isPublished: true,
        }))
      );
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    return handleApiError(err, { route: "PUT /api/my-faqs" });
  }
}
