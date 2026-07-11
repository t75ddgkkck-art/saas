/**
 * F5 (Lot 32) — POST /api/team/accept
 *
 * Consomme une invitation d'équipe et link le team_member avec l'user courant.
 *
 * Pré-requis : user connecté avec l'email exact de l'invitation.
 * Si email différent → 403 (empêche qu'un user quelconque n'accepte une invitation
 * ciblant quelqu'un d'autre).
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { teamMembers } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { checkRateLimit } from "@/lib/rate-limit";
import { getCurrentUser } from "@/lib/session";
import { handleApiError, unauthorized, badRequest, forbidden, notFound } from "@/lib/api-error";
import { validateBody } from "@/lib/api-helpers";
import { consumeTeamInvitation } from "@/lib/team-invitations";
import { logger } from "@/lib/logger";
// F6 (Lot 34, B25) : notif à l'inviteur quand un membre accepte
import { notifyAsync } from "@/lib/notify";
import { teamInvitations, businesses as businessesTable } from "@/db/schema";

export const dynamic = "force-dynamic";

const RATE = { key: "team-accept", limit: 10, windowSec: 3600 } as const;

const Schema = z.object({
  token: z.string().length(64, "Token invalide"),
});

export async function POST(request: NextRequest) {
  const rl = checkRateLimit(request, RATE);
  if (!rl.ok) return rl.response;

  try {
    const user = await getCurrentUser();
    if (!user) throw unauthorized();

    const { token } = await validateBody(request, Schema);

    const result = await consumeTeamInvitation(token);
    if (!result.ok) {
      const message =
        result.reason === "expired"
          ? "Cette invitation a expiré. Demandez-en une nouvelle."
          : result.reason === "already_used"
            ? "Cette invitation a déjà été utilisée."
            : "Invitation introuvable.";
      throw notFound(message);
    }

    // Vérifie que l'user courant match l'email de l'invitation (case-insensitive)
    if ((user.email || "").toLowerCase() !== result.email.toLowerCase()) {
      throw forbidden(
        `Cette invitation cible ${result.email}. Connectez-vous avec ce compte pour l'accepter.`
      );
    }

    // Link le team_members correspondant (créé au moment de l'invite)
    const [member] = await db
      .select()
      .from(teamMembers)
      .where(
        and(eq(teamMembers.businessId, result.businessId), eq(teamMembers.email, result.email))
      )
      .limit(1);

    if (!member) {
      // Cas de bord : l'invite existe mais pas la ligne team_members
      // (nettoyage manuel, etc.) → on la crée à la volée
      await db.insert(teamMembers).values({
        businessId: result.businessId,
        userId: user.id,
        email: result.email,
        firstName: user.firstName,
        lastName: user.lastName,
        memberRole: result.memberRole,
        acceptedAt: new Date(),
        active: true,
      });
    } else {
      // Link user_id + marquer accepté
      await db
        .update(teamMembers)
        .set({
          userId: user.id,
          acceptedAt: new Date(),
          active: true,
          // Si le user avait un firstName vide côté team_members, on prend le sien
          firstName: member.firstName || user.firstName,
          lastName: member.lastName || user.lastName,
        })
        .where(eq(teamMembers.id, member.id));
    }

    logger.info("team.accept.success", {
      userId: user.id,
      businessId: result.businessId,
      role: result.memberRole,
    });

    // F6 (Lot 34, B25) : notifie l'inviteur (le user qui a envoyé l'invitation)
    // du fait que le membre a accepté. Silencieux si l'invitation n'a pas
    // `invitedByUserId` (edge case).
    try {
      const [inv] = await db
        .select({ invitedByUserId: teamInvitations.invitedByUserId })
        .from(teamInvitations)
        .where(eq(teamInvitations.id, result.invitationId))
        .limit(1);
      const [biz] = await db
        .select({ name: businessesTable.name })
        .from(businessesTable)
        .where(eq(businessesTable.id, result.businessId))
        .limit(1);
      if (inv?.invitedByUserId) {
        notifyAsync({
          userId: inv.invitedByUserId,
          businessId: result.businessId,
          type: "team.invitation_accepted",
          title: "Invitation acceptée",
          message: `${user.firstName} a rejoint l'équipe de ${biz?.name ?? "votre business"} en tant que ${result.memberRole}.`,
          url: "/dashboard/team",
        });
      }
    } catch {
      /* non bloquant */
    }

    return NextResponse.json({
      success: true,
      businessId: result.businessId,
      role: result.memberRole,
    });
  } catch (err) {
    return handleApiError(err, { route: "POST /api/team/accept" });
  }
}

// -----------------------------------------------------------------------------
// GET : peek de l'invitation (affiche infos business+role avant accept)
// -----------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const rl = checkRateLimit(request, RATE);
  if (!rl.ok) return rl.response;

  const token = new URL(request.url).searchParams.get("token") ?? "";
  if (!token || token.length !== 64) {
    return NextResponse.json({ ok: false, reason: "invalid_token" }, { status: 400 });
  }

  const { peekTeamInvitation } = await import("@/lib/team-invitations");
  const info = await peekTeamInvitation(token);
  if (!info) {
    return NextResponse.json({ ok: false, reason: "not_found_or_expired" }, { status: 404 });
  }

  // Charger le nom du business pour l'UI
  const { db } = await import("@/db");
  const { businesses } = await import("@/db/schema");
  const [biz] = await db
    .select({ id: businesses.id, name: businesses.name, slug: businesses.slug })
    .from(businesses)
    .where(eq(businesses.id, info.businessId))
    .limit(1);

  return NextResponse.json({
    ok: true,
    email: info.email,
    memberRole: info.memberRole,
    businessName: biz?.name ?? null,
    businessSlug: biz?.slug ?? null,
    expiresAt: info.expiresAt.toISOString(),
  });
}
