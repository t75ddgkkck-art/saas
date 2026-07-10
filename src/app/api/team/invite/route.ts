/**
 * F5 (Lot 32) — POST /api/team/invite
 *
 * Envoie une invitation email à un futur membre d'équipe.
 * Vérifie :
 *  - L'user courant a la capability `team.invite` (owner ou admin)
 *  - L'entitlement `team.enable` (Pro+)
 *  - La limite de sièges du plan (`maxTeamMembers`) n'est pas atteinte
 *  - Pas de doublon actif (invitation ou membre)
 *
 * Rate-limit 10/heure/IP.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { teamMembers, teamInvitations, users } from "@/db/schema";
import { and, eq, isNull, gt, count } from "drizzle-orm";
import { checkRateLimit } from "@/lib/rate-limit";
import { handleApiError, badRequest, conflict, forbidden } from "@/lib/api-error";
import { validateBody } from "@/lib/api-helpers";
import { requireTeamPermission } from "@/lib/team-context";
import { requireEntitlement } from "@/lib/require-entitlement";
import { checkQuota } from "@/lib/entitlements";
import { canManageRole } from "@/lib/team-permissions";
import type { SubscriptionPlan } from "@/lib/permissions";
import { createTeamInvitation, INVITATION_TTL_SEC } from "@/lib/team-invitations";
import { sendEmail } from "@/lib/email";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const RATE = { key: "team-invite", limit: 10, windowSec: 3600 } as const;

const Schema = z.object({
  email: z.string().trim().toLowerCase().email("Email invalide").max(255),
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().max(100).optional().default(""),
  memberRole: z.enum(["admin", "employee", "viewer"]),
});

export async function POST(request: NextRequest) {
  const rl = checkRateLimit(request, RATE);
  if (!rl.ok) return rl.response;

  try {
    // 1. Gate rôle (owner/admin uniquement)
    const ctx = await requireTeamPermission("team.invite");

    // 2. Gate entitlement (Pro+ pour l'équipe)
    // On appelle sur le PLAN de l'owner du business, pas de l'user courant
    // (un admin invité peut inviter d'autres membres si le business est Pro+).
    const [owner] = await db
      .select({ subscription: users.subscription })
      .from(users)
      .where(eq(users.id, ctx.business.ownerId))
      .limit(1);
    const ownerPlan = (owner?.subscription || "free") as SubscriptionPlan;

    // Réutilise entitlements.checkQuota pour la limite plan
    const currentActiveCount = await db
      .select({ n: count() })
      .from(teamMembers)
      .where(
        and(
          eq(teamMembers.businessId, ctx.business.id),
          eq(teamMembers.active, true),
          isNull(teamMembers.deletedAt)
        )
      );
    const memberCount = Number(currentActiveCount[0]?.n ?? 0);

    // Chec plan Pro+ (permissions.ts.canAddTeamMembers)
    if (!(await import("@/lib/entitlements")).canUse(ownerPlan, "team.enable")) {
      // On throw un 402 en réutilisant requireEntitlement (plus propre pour l'UI)
      await requireEntitlement("team.enable");
    }

    const quota = checkQuota(ownerPlan, "maxTeamMembers", memberCount);
    if (!quota.allowed) {
      throw forbidden(
        `Limite d'équipe atteinte (${quota.limit} sièges sur le plan ${ownerPlan}). Passez à Premium pour un nombre illimité.`
      );
    }

    // 3. Body
    const data = await validateBody(request, Schema);

    // 4. Vérifie que l'inviteur peut assigner ce rôle (admin ne peut pas
    //    inviter un autre admin ou un owner)
    if (!canManageRole(ctx.role, data.memberRole)) {
      throw forbidden(
        `Votre rôle (${ctx.role}) ne permet pas d'inviter un membre en tant que ${data.memberRole}.`
      );
    }

    // 5. Anti-doublon : membre déjà présent OU invitation active
    const [existingMember] = await db
      .select({ id: teamMembers.id })
      .from(teamMembers)
      .where(
        and(
          eq(teamMembers.businessId, ctx.business.id),
          eq(teamMembers.email, data.email),
          isNull(teamMembers.deletedAt)
        )
      )
      .limit(1);
    if (existingMember) throw conflict("Ce membre fait déjà partie de votre équipe.");

    const [pendingInvite] = await db
      .select({ id: teamInvitations.id })
      .from(teamInvitations)
      .where(
        and(
          eq(teamInvitations.businessId, ctx.business.id),
          eq(teamInvitations.email, data.email),
          isNull(teamInvitations.acceptedAt),
          gt(teamInvitations.expiresAt, new Date())
        )
      )
      .limit(1);
    if (pendingInvite) {
      throw conflict("Une invitation est déjà en cours pour cet email.");
    }

    // 6. Créer la ligne team_members (accepted_at NULL = en attente)
    const [inserted] = await db
      .insert(teamMembers)
      .values({
        businessId: ctx.business.id,
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        memberRole: data.memberRole,
        invitedByUserId: ctx.user.id,
        active: true,
      })
      .returning({ id: teamMembers.id });

    // 7. Créer le token d'invitation
    const invitation = await createTeamInvitation({
      businessId: ctx.business.id,
      email: data.email,
      memberRole: data.memberRole,
      invitedByUserId: ctx.user.id,
    });

    // 8. Envoyer l'email
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.vitrix.fr";
    const acceptUrl = `${appUrl}/team/accept?token=${invitation.rawToken}`;

    await sendEmail(
      {
        to: data.email,
        subject: `Invitation à rejoindre ${ctx.business.name} sur Vitrix`,
        html: buildInvitationEmail({
          firstName: data.firstName,
          businessName: ctx.business.name,
          inviterName: ctx.user.firstName,
          role: data.memberRole,
          acceptUrl,
          expiryDays: Math.round(INVITATION_TTL_SEC / 86400),
        }),
      },
      { category: "transactional" }
    );

    logger.info("team.invite.sent", {
      businessId: ctx.business.id,
      email: data.email,
      role: data.memberRole,
      invitedByUserId: ctx.user.id,
    });

    return NextResponse.json({
      success: true,
      memberId: inserted.id,
      expiresAt: invitation.expiresAt.toISOString(),
    });
  } catch (err) {
    return handleApiError(err, { route: "POST /api/team/invite" });
  }
}

// -----------------------------------------------------------------------------
// Template email inline (spécifique F5, cohérent avec baseWrapper Vitrix)
// -----------------------------------------------------------------------------

function buildInvitationEmail(data: {
  firstName: string;
  businessName: string;
  inviterName: string;
  role: string;
  acceptUrl: string;
  expiryDays: number;
}): string {
  const roleFr =
    data.role === "admin"
      ? "administrateur"
      : data.role === "employee"
        ? "employé"
        : "lecteur seul";
  return `
    <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #0f172a;">
      <h1 style="font-size: 22px; margin: 0 0 16px;">Vous êtes invité·e à rejoindre une équipe Vitrix</h1>
      <p style="color: #334155; margin: 0 0 16px;">Bonjour ${data.firstName},</p>
      <p style="color: #334155; margin: 0 0 24px;">
        <strong>${data.inviterName}</strong> vous invite à rejoindre l'équipe de
        <strong>${data.businessName}</strong> sur Vitrix en tant que <strong>${roleFr}</strong>.
      </p>
      <div style="text-align: center; margin: 32px 0;">
        <a href="${data.acceptUrl}" style="display: inline-block; background: #0f172a; color: white; padding: 14px 28px; border-radius: 10px; text-decoration: none; font-weight: 600;">
          Accepter l'invitation
        </a>
      </div>
      <p style="color: #64748b; font-size: 13px;">
        Ce lien expire dans ${data.expiryDays} jours. Si vous n'avez pas encore de compte Vitrix,
        vous pourrez le créer en cliquant sur le lien.
      </p>
      <p style="color: #94a3b8; font-size: 12px; margin: 24px 0 0; word-break: break-all;">
        Lien de secours :<br/>
        <a href="${data.acceptUrl}" style="color: #64748b;">${data.acceptUrl}</a>
      </p>
    </div>
  `;
}
