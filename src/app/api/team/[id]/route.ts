/**
 * F5 (Lot 32) — PATCH /api/team/[id]
 *
 * Modifie un membre d'équipe : rôle, actif/inactif, ou suppression (soft).
 *
 * DELETE = soft-delete (deletedAt set), garde trace historique.
 *
 * Vérifs :
 *  - Le membre appartient au business courant (anti-IDOR)
 *  - L'user courant a la capability appropriée (team.change_role, team.remove)
 *  - `canManageRole(actor, target)` — un admin ne peut pas modifier un autre admin
 *  - Impossible de désactiver/supprimer le owner (impossible par design car le
 *    owner n'est pas dans team_members)
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { teamMembers } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { checkRateLimit } from "@/lib/rate-limit";
import { handleApiError, forbidden, notFound } from "@/lib/api-error";
import { validateBody } from "@/lib/api-helpers";
import { requireTeamPermission } from "@/lib/team-context";
import { canManageRole, type TeamRole } from "@/lib/team-permissions";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const RATE = { key: "team-patch", limit: 30, windowSec: 3600 } as const;

const PatchSchema = z.object({
  memberRole: z.enum(["admin", "employee", "viewer"]).optional(),
  active: z.boolean().optional(),
});

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const rl = checkRateLimit(request, RATE);
  if (!rl.ok) return rl.response;

  try {
    // Any change → capability team.change_role
    const context = await requireTeamPermission("team.change_role");
    const { id: memberId } = await ctx.params;
    const data = await validateBody(request, PatchSchema);

    // Récupère membre + vérif ownership + rôle courant
    const [member] = await db
      .select()
      .from(teamMembers)
      .where(
        and(
          eq(teamMembers.id, memberId),
          eq(teamMembers.businessId, context.business.id),
          isNull(teamMembers.deletedAt)
        )
      )
      .limit(1);
    if (!member) throw notFound("Membre introuvable");

    const currentRole = normalizeRole(member.memberRole);

    // Vérifie que l'actor peut gérer ce membre (admin ne peut pas modifier admin)
    if (!canManageRole(context.role, currentRole)) {
      throw forbidden(`Votre rôle (${context.role}) ne permet pas de modifier un ${currentRole}.`);
    }

    // Si changement de rôle : vérifier aussi qu'il peut assigner le nouveau rôle
    if (data.memberRole && data.memberRole !== currentRole) {
      if (!canManageRole(context.role, data.memberRole)) {
        throw forbidden(
          `Votre rôle (${context.role}) ne permet pas d'assigner le rôle ${data.memberRole}.`
        );
      }
    }

    const patch: Partial<typeof member> = {};
    if (data.memberRole !== undefined) patch.memberRole = data.memberRole;
    if (data.active !== undefined) patch.active = data.active;

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ success: true, unchanged: true });
    }

    await db.update(teamMembers).set(patch).where(eq(teamMembers.id, memberId));

    logger.info("team.patch", {
      memberId,
      businessId: context.business.id,
      changes: patch,
      actorUserId: context.user.id,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return handleApiError(err, { route: "PATCH /api/team/[id]" });
  }
}

export async function DELETE(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const rl = checkRateLimit(request, RATE);
  if (!rl.ok) return rl.response;

  try {
    const context = await requireTeamPermission("team.remove");
    const { id: memberId } = await ctx.params;

    const [member] = await db
      .select()
      .from(teamMembers)
      .where(
        and(
          eq(teamMembers.id, memberId),
          eq(teamMembers.businessId, context.business.id),
          isNull(teamMembers.deletedAt)
        )
      )
      .limit(1);
    if (!member) throw notFound("Membre introuvable");

    const currentRole = normalizeRole(member.memberRole);
    if (!canManageRole(context.role, currentRole)) {
      throw forbidden(`Votre rôle (${context.role}) ne permet pas de retirer un ${currentRole}.`);
    }

    // Soft delete (garde trace historique)
    await db
      .update(teamMembers)
      .set({ deletedAt: new Date(), active: false })
      .where(eq(teamMembers.id, memberId));

    logger.info("team.delete", {
      memberId,
      businessId: context.business.id,
      actorUserId: context.user.id,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return handleApiError(err, { route: "DELETE /api/team/[id]" });
  }
}

function normalizeRole(raw: string | null | undefined): TeamRole {
  if (raw === "admin" || raw === "employee" || raw === "viewer") return raw;
  return "employee";
}
