import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { clients } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { getCurrentBusiness } from "@/lib/session";
import { requirePermission } from "@/lib/validation";
import { normalizePhone } from "@/lib/validation";
import { handleApiError, unauthorized, conflict, badRequest } from "@/lib/api-error";
import { validateBody } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

const CreateSchema = z
  .object({
    firstName: z.string().trim().max(100).optional().default(""),
    lastName: z.string().trim().max(100).optional().default(""),
    email: z.string().trim().toLowerCase().email("Email invalide").optional().or(z.literal("")),
    phone: z.string().trim().max(30).optional().default(""),
    notes: z.string().trim().max(2000).optional(),
    source: z.enum(["website", "google", "referral", "social", "other"]).optional(),
  })
  .refine((v) => v.firstName || v.lastName || v.email, {
    message: "Nom, prénom ou email requis",
    path: ["firstName"],
  });

export async function GET() {
  const { error } = await requirePermission("canAddClients");
  if (error) return error;

  try {
    const business = await getCurrentBusiness();
    if (!business) return NextResponse.json({ clients: [] });

    const list = await db
      .select()
      .from(clients)
      .where(eq(clients.businessId, business.id))
      .orderBy(desc(clients.createdAt));

    return NextResponse.json({ clients: list });
  } catch (err) {
    return handleApiError(err, { route: "GET /api/clients" });
  }
}

export async function POST(request: NextRequest) {
  const { error } = await requirePermission("canAddClients");
  if (error) return error;

  try {
    const business = await getCurrentBusiness();
    if (!business) throw unauthorized();

    const data = await validateBody(request, CreateSchema);

    const normalizedPhone = data.phone ? normalizePhone(data.phone) : "";
    const emailNormalized = data.email ? data.email : "";

    // Anti-doublon par email pour ce business
    if (emailNormalized) {
      const [dup] = await db
        .select({ id: clients.id })
        .from(clients)
        .where(and(eq(clients.businessId, business.id), eq(clients.email, emailNormalized)))
        .limit(1);
      if (dup) throw conflict("Un client avec cet email existe déjà");
    }

    // Anti-doublon par téléphone pour ce business (si fourni)
    if (normalizedPhone) {
      const [dup] = await db
        .select({ id: clients.id })
        .from(clients)
        .where(and(eq(clients.businessId, business.id), eq(clients.phone, normalizedPhone)))
        .limit(1);
      if (dup) throw conflict("Un client avec ce téléphone existe déjà");
    }

    if (!emailNormalized && !normalizedPhone) {
      throw badRequest("Un moyen de contact (email ou téléphone) est requis");
    }

    await db.insert(clients).values({
      businessId: business.id,
      firstName: data.firstName || "",
      lastName: data.lastName || "",
      email: emailNormalized || "",
      phone: normalizedPhone || "",
      source: data.source || "website",
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return handleApiError(err, { route: "POST /api/clients" });
  }
}
