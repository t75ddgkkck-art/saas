import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { quoteFormFields, businesses } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentBusiness } from "@/lib/session";
import { handleApiError, unauthorized } from "@/lib/api-error";
import { validateBody } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

const PutSchema = z.object({
  fields: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(200),
        type: z.enum(["text", "textarea", "number", "select", "checkbox", "date", "file"]).default("text"),
        options: z.string().max(1000).optional().nullable(),
        required: z.boolean().default(false),
      })
    )
    .max(30, "Maximum 30 champs par formulaire"),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const businessSlug = searchParams.get("business");

    let businessId: string;
    if (businessSlug) {
      // Mode public : on récupère l'ID par le slug
      const [biz] = await db
        .select({ id: businesses.id })
        .from(businesses)
        .where(eq(businesses.slug, businessSlug))
        .limit(1);
      if (!biz) return NextResponse.json({ fields: [] });
      businessId = biz.id;
    } else {
      // Mode authentifié (dashboard)
      const business = await getCurrentBusiness();
      if (!business) return NextResponse.json({ fields: [] });
      businessId = business.id;
    }

    const fields = await db
      .select()
      .from(quoteFormFields)
      .where(eq(quoteFormFields.businessId, businessId))
      .orderBy(quoteFormFields.sortOrder);
    return NextResponse.json({ fields });
  } catch (err) {
    return handleApiError(err, { route: "GET /api/quote-form-fields" });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const business = await getCurrentBusiness();
    if (!business) throw unauthorized();

    const { fields } = await validateBody(request, PutSchema);

    // Purge + réinsertion (scopé au business courant : fix IDOR implicite)
    await db.delete(quoteFormFields).where(eq(quoteFormFields.businessId, business.id));

    if (fields.length > 0) {
      await db.insert(quoteFormFields).values(
        fields.map((f, i) => ({
          businessId: business.id,
          label: f.label,
          type: f.type,
          options: f.options || null,
          required: f.required,
          sortOrder: i,
        }))
      );
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    return handleApiError(err, { route: "PUT /api/quote-form-fields" });
  }
}
