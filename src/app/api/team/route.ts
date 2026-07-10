/**
 * F5 (Lot 32) — GET /api/team
 *
 * Liste les membres actifs (non soft-deleted) du business courant, avec :
 *  - infos membre (email, name, role)
 *  - statut invitation (pending si acceptedAt null, actif si non)
 *  - lien user_id s'il est connecté au moins une fois
 *
 * Refonte : l'ancien POST/DELETE sont remplacés par :
 *  - POST /api/team/invite (invitation par email avec magic-link)
 *  - PATCH /api/team/[id] (change role, active)
 *  - DELETE /api/team/[id] (soft-delete)
 */

import { NextResponse } from "next/server";
import { db } from "@/db";
import { teamMembers, users } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { handleApiError } from "@/lib/api-error";
import { requireTeamPermission } from "@/lib/team-context";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const ctx = await requireTeamPermission("team.view");

    const members = await db
      .select({
        id: teamMembers.id,
        email: teamMembers.email,
        firstName: teamMembers.firstName,
        lastName: teamMembers.lastName,
        memberRole: teamMembers.memberRole,
        active: teamMembers.active,
        invitedAt: teamMembers.invitedAt,
        acceptedAt: teamMembers.acceptedAt,
        userId: teamMembers.userId,
        // Optionnel : nom de l'inviteur si présent (pour audit UI)
        invitedByName: users.firstName,
      })
      .from(teamMembers)
      .leftJoin(users, eq(teamMembers.invitedByUserId, users.id))
      .where(and(eq(teamMembers.businessId, ctx.business.id), isNull(teamMembers.deletedAt)));

    return NextResponse.json({
      members,
      // Renvoie aussi le rôle courant + capabilities (utile pour l'UI cliente)
      currentRole: ctx.role,
      isOwner: ctx.isOwner,
    });
  } catch (err) {
    return handleApiError(err, { route: "GET /api/team" });
  }
}
