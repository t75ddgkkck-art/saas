import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { teamMembers } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getCurrentBusiness } from "@/lib/session";
import { requirePermission, isValidEmail } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { error } = await requirePermission("canAddTeamMembers");
  if (error) return error;

  try {
    const business = await getCurrentBusiness();
    if (!business) {
      return NextResponse.json({ members: [] });
    }

    const members = await db
      .select()
      .from(teamMembers)
      .where(eq(teamMembers.businessId, business.id));

    return NextResponse.json({ members });
  } catch (error: any) {
    console.error("GET team error:", error);
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const { error } = await requirePermission("canAddTeamMembers");
  if (error) return error;

  try {
    const business = await getCurrentBusiness();
    if (!business) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const body = await request.json();
    const { email, firstName, lastName, memberRole } = body;

    if (!email || !isValidEmail(email)) {
      return NextResponse.json(
        { error: "Email valide requis" },
        { status: 400 }
      );
    }

    if (!firstName) {
      return NextResponse.json(
        { error: "Prénom requis" },
        { status: 400 }
      );
    }

    // Vérifier les limites
    const currentMembers = await db
      .select()
      .from(teamMembers)
      .where(eq(teamMembers.businessId, business.id));

    const PLAN_PERMISSIONS = (await import("@/lib/permissions")).PLAN_PERMISSIONS;
    const { getCurrentUser } = await import("@/lib/session");
    const user = await getCurrentUser();
    const plan = (user?.subscription || "free") as "free" | "pro" | "premium";
    const maxMembers = PLAN_PERMISSIONS[plan].maxTeamMembers;

    if (maxMembers !== -1 && currentMembers.length >= maxMembers) {
      return NextResponse.json(
        { error: `Limite d'équipe atteinte (${maxMembers} membres maximum)` },
        { status: 403 }
      );
    }

    await db.insert(teamMembers).values({
      businessId: business.id,
      email: email.toLowerCase(),
      firstName,
      lastName: lastName || "",
      memberRole: memberRole || "assistant",
      active: true,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("POST team error:", error);
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}
