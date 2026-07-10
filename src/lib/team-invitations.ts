/**
 * F5 (Lot 32) — Génération et consommation des invitations d'équipe.
 *
 * Pattern identique à `auth-tokens.ts` et `client-auth.ts` : token brut
 * 256 bits, stocké en SHA-256, single-use via `accepted_at`.
 * TTL 7 jours (le membre a le temps de recevoir l'email et l'accepter).
 */

import { randomBytes, createHash } from "crypto";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { teamInvitations } from "@/db/schema";
import { logger } from "@/lib/logger";
import type { TeamRole } from "@/lib/team-permissions";

export const INVITATION_TTL_SEC = 7 * 24 * 60 * 60; // 7 jours

// -----------------------------------------------------------------------------
// Génération / hash
// -----------------------------------------------------------------------------

export function generateInvitationRawToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashInvitationToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

// -----------------------------------------------------------------------------
// Création
// -----------------------------------------------------------------------------

export async function createTeamInvitation(params: {
  businessId: string;
  email: string;
  memberRole: Exclude<TeamRole, "owner">;
  invitedByUserId: string;
}): Promise<{ rawToken: string; id: string; expiresAt: Date }> {
  const rawToken = generateInvitationRawToken();
  const tokenHash = hashInvitationToken(rawToken);
  const expiresAt = new Date(Date.now() + INVITATION_TTL_SEC * 1000);
  const normalizedEmail = params.email.trim().toLowerCase();

  const [inserted] = await db
    .insert(teamInvitations)
    .values({
      businessId: params.businessId,
      email: normalizedEmail,
      memberRole: params.memberRole,
      tokenHash,
      expiresAt,
      invitedByUserId: params.invitedByUserId,
    })
    .returning({ id: teamInvitations.id });

  logger.info("[team-invitations] créée", {
    businessId: params.businessId,
    email: normalizedEmail,
    role: params.memberRole,
    id: inserted.id,
  });

  return { rawToken, id: inserted.id, expiresAt };
}

// -----------------------------------------------------------------------------
// Consommation
// -----------------------------------------------------------------------------

export type ConsumeInvitationResult =
  | {
      ok: true;
      invitationId: string;
      businessId: string;
      email: string;
      memberRole: TeamRole;
    }
  | { ok: false; reason: "not_found" | "expired" | "already_used" };

/**
 * Consomme une invitation. Retourne les infos pour créer/lier le team_member.
 * Consommation atomique via WHERE accepted_at IS NULL.
 */
export async function consumeTeamInvitation(rawToken: string): Promise<ConsumeInvitationResult> {
  if (!rawToken || rawToken.length !== 64) {
    return { ok: false, reason: "not_found" };
  }

  const tokenHash = hashInvitationToken(rawToken);
  const rows = await db
    .select()
    .from(teamInvitations)
    .where(eq(teamInvitations.tokenHash, tokenHash))
    .limit(1);

  const invitation = rows[0];
  if (!invitation) return { ok: false, reason: "not_found" };
  if (invitation.acceptedAt) return { ok: false, reason: "already_used" };
  if (invitation.expiresAt.getTime() < Date.now()) return { ok: false, reason: "expired" };

  const updated = await db
    .update(teamInvitations)
    .set({ acceptedAt: new Date() })
    .where(and(eq(teamInvitations.id, invitation.id), isNull(teamInvitations.acceptedAt)))
    .returning({ id: teamInvitations.id });

  if (updated.length === 0) return { ok: false, reason: "already_used" };

  const role = normalizeInvitationRole(invitation.memberRole);

  return {
    ok: true,
    invitationId: invitation.id,
    businessId: invitation.businessId,
    email: invitation.email,
    memberRole: role,
  };
}

function normalizeInvitationRole(raw: string): TeamRole {
  if (raw === "admin" || raw === "employee" || raw === "viewer") return raw;
  return "viewer"; // fallback safe
}

/**
 * Peek une invitation SANS la consommer (pour la page /team/accept qui
 * affiche l'info avant l'action).
 */
export async function peekTeamInvitation(rawToken: string): Promise<{
  businessId: string;
  email: string;
  memberRole: TeamRole;
  expiresAt: Date;
} | null> {
  if (!rawToken || rawToken.length !== 64) return null;
  const tokenHash = hashInvitationToken(rawToken);
  const rows = await db
    .select()
    .from(teamInvitations)
    .where(eq(teamInvitations.tokenHash, tokenHash))
    .limit(1);
  const inv = rows[0];
  if (!inv) return null;
  if (inv.acceptedAt) return null;
  if (inv.expiresAt.getTime() < Date.now()) return null;
  return {
    businessId: inv.businessId,
    email: inv.email,
    memberRole: normalizeInvitationRole(inv.memberRole),
    expiresAt: inv.expiresAt,
  };
}
