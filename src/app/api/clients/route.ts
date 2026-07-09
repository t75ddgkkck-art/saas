import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { clients } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { getCurrentBusiness } from "@/lib/session";
import { requirePermission, isValidEmail, normalizePhone } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { error, user } = await requirePermission("canAddClients");
  if (error) return error;

  try {
    const business = await getCurrentBusiness();
    if (!business) {
      return NextResponse.json({ clients: [] });
    }

    const clientList = await db
      .select()
      .from(clients)
      .where(eq(clients.businessId, business.id))
      .orderBy(desc(clients.createdAt));

    return NextResponse.json({ clients: clientList });
  } catch (error: any) {
    console.error("GET clients error:", error);
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const { error } = await requirePermission("canAddClients");
  if (error) return error;

  try {
    const business = await getCurrentBusiness();
    if (!business) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const body = await request.json();
    const { firstName, lastName, email, phone } = body;

    // Validation
    if (!firstName && !lastName && !email) {
      return NextResponse.json(
        { error: "Nom ou email requis" },
        { status: 400 }
      );
    }

    if (email && !isValidEmail(email)) {
      return NextResponse.json(
        { error: "Email invalide" },
        { status: 400 }
      );
    }

    const normalizedPhone = phone ? normalizePhone(phone) : "";

    // Vérification anti-doublon
    if (email) {
      const existing = await db
        .select()
        .from(clients)
        .where(
          and(
            eq(clients.businessId, business.id),
            eq(clients.email, email.toLowerCase())
          )
        )
        .limit(1);

      if (existing.length > 0) {
        return NextResponse.json(
          { error: "Un client avec cet email existe déjà" },
          { status: 409 }
        );
      }
    }

    await db.insert(clients).values({
      businessId: business.id,
      firstName: firstName?.trim() || "",
      lastName: lastName?.trim() || "",
      email: email?.trim().toLowerCase() || "",
      phone: normalizedPhone || "",
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("POST client error:", error);
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}
