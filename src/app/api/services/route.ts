import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { services } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentBusiness } from "@/lib/session";
import { handleApiError, unauthorized } from "@/lib/api-error";
import { validateBody } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

// F2 (Lot 30) : ajout des champs deposit + priceCents. Tous optionnels pour
// rétro-compatibilité totale — l'ancien flow inline (name/description/price varchar)
// continue de fonctionner sans changement UI.
const PutSchema = z.object({
  services: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(200),
        description: z.string().trim().max(1000).optional(),
        price: z.string().trim().max(50).optional(),
        priceCents: z.number().int().min(0).max(10_000_000).nullable().optional(),
        depositType: z.enum(["fixed", "percent"]).nullable().optional(),
        depositAmount: z.number().int().min(0).max(10_000_000).nullable().optional(),
      })
    )
    .max(200, "Trop de services (200 max)"),
});

export async function GET() {
  try {
    const business = await getCurrentBusiness();
    if (!business) return NextResponse.json({ services: [] });

    const list = await db
      .select()
      .from(services)
      .where(eq(services.businessId, business.id))
      .orderBy(services.sortOrder);

    return NextResponse.json({ services: list });
  } catch (err) {
    return handleApiError(err, { route: "GET /api/services" });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const business = await getCurrentBusiness();
    if (!business) throw unauthorized();

    const { services: items } = await validateBody(request, PutSchema);

    // Purge + réinsertion, scopé au business courant (fix IDOR implicite)
    await db.delete(services).where(eq(services.businessId, business.id));

    if (items.length > 0) {
      await db.insert(services).values(
        items
          .filter((s) => s.name?.trim())
          .map((s, i) => {
            // F2 : validation cohérence deposit. Le CHECK SQL protège aussi
            // en dernier ressort mais on donne un message d'erreur clair ici.
            if (
              s.depositType === "percent" &&
              (s.depositAmount === null ||
                s.depositAmount === undefined ||
                s.depositAmount <= 0 ||
                s.depositAmount > 100)
            ) {
              throw new Error(
                `Service "${s.name}" : acompte en pourcentage doit être entre 1 et 100.`
              );
            }
            return {
              businessId: business.id,
              name: s.name.trim(),
              description: s.description?.trim() || null,
              price: s.price?.trim() || null,
              priceCents: s.priceCents ?? null,
              depositType: s.depositType ?? null,
              depositAmount: s.depositAmount ?? null,
              sortOrder: i,
            };
          })
      );
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    return handleApiError(err, { route: "PUT /api/services" });
  }
}
