import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { teamMembers } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getCurrentBusiness, getCurrentUser } from "@/lib/session";
import { requirePermission } from "@/lib/validation";
import { PLAN_PERMISSIONS, type SubscriptionPlan } from "@/lib/permissions";
import {
  handleApiError,
  badRequest,
  conflict,
  forbidden,
  unauthorized,
  notFound,
} from "@/lib/api-error";
import { validateBody } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

const CreateSchema = z.object({
  email: z.string().trim().toLowerCase().email("Email invalide").max(255),
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().max(100).optional().default(""),
  memberRole: z.enum(["assistant", "employee"]).optional().default("assistant"),
});

const DeleteSchema = z.object({
  memberId: z.string().uuid("memberId invalide"),
});

export async function GET() {
  const { error } = await requirePermission("canAddTeamMembers");
  if (error) return error;

  try {
    const business = await getCurrentBusiness();
    if (!business) return NextResponse.json({ members: [] });

    const members = await db
      .select()
      .from(teamMembers)
      .where(eq(teamMembers.businessId, business.id));

    return NextResponse.json({ members });
  } catch (err) {
    return handleApiError(err, { route: "GET /api/team" });
  }
}

export async function POST(request: NextRequest) {
  const perm = await requirePermission("canAddTeamMembers");
  if (perm.error) return perm.error;

  try {
    const business = await getCurrentBusiness();
    if (!business) throw unauthorized();

    const data = await validateBody(request, CreateSchema);

    // Vérif de la limite de plan
    const plan = (perm.user?.subscription || "free") as SubscriptionPlan;
    const maxMembers = PLAN_PERMISSIONS[plan].maxTeamMembers;

    const currentMembers = await db
      .select({ id: teamMembers.id })
      .from(teamMembers)
      .where(eq(teamMembers.businessId, business.id));

    if (maxMembers !== -1 && currentMembers.length >= maxMembers) {
      throw forbidden(`Limite d'équipe atteinte (${maxMembers} membre(s) maximum sur ${plan})`);
    }

    // Anti-doublon : même email pour ce business
    const [dup] = await db
      .select({ id: teamMembers.id })
      .from(teamMembers)
      .where(and(eq(teamMembers.businessId, business.id), eq(teamMembers.email, data.email)))
      .limit(1);
    if (dup) throw conflict("Ce membre est déjà dans votre équipe.");

    await db.insert(teamMembers).values({
      businessId: business.id,
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
      memberRole: data.memberRole,
      active: true,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return handleApiError(err, { route: "POST /api/team" });
  }
}

// DELETE : retire un membre — vérifie qu'il appartient bien au business courant (fix IDOR)
export async function DELETE(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  try {
    const business = await getCurrentBusiness();
    if (!business) throw unauthorized();

    const { memberId } = await validateBody(request, DeleteSchema);

    // Vérif d'ownership avant delete
    const [row] = await db
      .select({ id: teamMembers.id, businessId: teamMembers.businessId })
      .from(teamMembers)
      .where(eq(teamMembers.id, memberId))
      .limit(1);
    if (!row) throw notFound("Membre introuvable");
    if (row.businessId !== business.id) throw forbidden();

    await db.delete(teamMembers).where(eq(teamMembers.id, memberId));
    return NextResponse.json({ success: true });
  } catch (err) {
    return handleApiError(err, { route: "DELETE /api/team" });
  }
}
