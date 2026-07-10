/**
 * F5 (Lot 32) — Contexte équipe pour un user.
 *
 * Résout : "à quel business est connecté l'user courant + quel rôle a-t-il ?"
 *
 * L'user peut être :
 *  - Owner d'un ou plusieurs businesses (via `businesses.ownerId`)
 *  - Membre invité d'un ou plusieurs autres businesses (via `team_members.userId`)
 *
 * `getCurrentTeamContext()` renvoie le business ACTIF (owner d'abord, sinon
 * premier team_members actif) + le rôle correspondant.
 *
 * Pour switcher entre plusieurs businesses (owner + membre invité), un
 * mécanisme "current business" via cookie sera ajouté en v2 si besoin.
 * Pour v1, priorité : own > invited actif le plus ancien.
 */

import { and, eq, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import { businesses, teamMembers } from "@/db/schema";
import type { Business } from "@/db/types";
import { getCurrentUser } from "@/lib/session";
import type { TeamRole, TeamCapability } from "@/lib/team-permissions";
import { roleHas } from "@/lib/team-permissions";

export interface TeamContext {
  user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;
  business: Business;
  role: TeamRole;
  /** true si l'user est le owner (raccourci pratique) */
  isOwner: boolean;
}

/**
 * Résout le contexte équipe : quel business + quel rôle pour l'user courant.
 * Renvoie null si pas de session ou pas de business associé.
 */
export async function getCurrentTeamContext(): Promise<TeamContext | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  // 1. Cherche un business dont l'user est owner
  const ownedRows = await db
    .select()
    .from(businesses)
    .where(and(eq(businesses.ownerId, user.id), isNull(businesses.deletedAt)))
    .limit(1);

  if (ownedRows[0]) {
    return {
      user,
      business: ownedRows[0],
      role: "owner",
      isOwner: true,
    };
  }

  // 2. Sinon, cherche un business où l'user est membre invité actif
  const memberRows = await db
    .select({
      business: businesses,
      memberRole: teamMembers.memberRole,
    })
    .from(teamMembers)
    .innerJoin(businesses, eq(teamMembers.businessId, businesses.id))
    .where(
      and(
        eq(teamMembers.userId, user.id),
        eq(teamMembers.active, true),
        isNull(teamMembers.deletedAt),
        isNull(businesses.deletedAt)
      )
    )
    .limit(1);

  if (memberRows[0]) {
    const role = normalizeRole(memberRows[0].memberRole);
    return {
      user,
      business: memberRows[0].business,
      role,
      isOwner: false,
    };
  }

  return null;
}

/**
 * Vérifie que l'user courant a une capability sur son business courant.
 * Renvoie le contexte si OK, throw si non autorisé (à catcher dans le handler API).
 */
export async function requireTeamPermission(capability: TeamCapability): Promise<TeamContext> {
  const ctx = await getCurrentTeamContext();
  if (!ctx) {
    // Import dynamique pour éviter le cycle (api-error → team-context → session)
    const { unauthorized } = await import("@/lib/api-error");
    throw unauthorized();
  }
  if (!roleHas(ctx.role, capability)) {
    const { forbidden } = await import("@/lib/api-error");
    throw forbidden(
      `Action non autorisée avec votre rôle (${ctx.role}). Contactez le propriétaire du business.`
    );
  }
  return ctx;
}

/**
 * Renvoie tous les businesses accessibles à l'user courant (owner + membre).
 * Utile pour un futur "switcher de business" en v2.
 */
export async function listUserBusinesses(): Promise<
  { business: Business; role: TeamRole; isOwner: boolean }[]
> {
  const user = await getCurrentUser();
  if (!user) return [];

  // Own + invited en une seule query via OR + LEFT JOIN sur team_members
  const rows = await db
    .selectDistinct({
      business: businesses,
      memberRole: teamMembers.memberRole,
      ownerId: businesses.ownerId,
    })
    .from(businesses)
    .leftJoin(
      teamMembers,
      and(
        eq(teamMembers.businessId, businesses.id),
        eq(teamMembers.userId, user.id),
        eq(teamMembers.active, true),
        isNull(teamMembers.deletedAt)
      )
    )
    .where(
      and(
        or(eq(businesses.ownerId, user.id), eq(teamMembers.userId, user.id)),
        isNull(businesses.deletedAt)
      )
    );

  return rows.map((r) => {
    const isOwner = r.ownerId === user.id;
    return {
      business: r.business,
      role: isOwner ? ("owner" as const) : normalizeRole(r.memberRole),
      isOwner,
    };
  });
}

// -----------------------------------------------------------------------------
// Helper : normalise un rôle DB (varchar) vers l'union TeamRole (fallback safe)
// -----------------------------------------------------------------------------

function normalizeRole(raw: string | null | undefined): TeamRole {
  if (raw === "admin" || raw === "employee" || raw === "viewer") return raw;
  // Migration douce : ancien "assistant" → employee, tout autre → viewer (safe)
  if (raw === "assistant") return "employee";
  return "viewer";
}
