/**
 * Helpers admin - garde d'accès et logging d'événements admin.
 *
 * `requireAdmin()` → throw 401/403 si user pas admin.
 * `logAdminEvent()` → écrit dans `admin_events` (audit trail).
 *
 * L'accès admin est déterminé par `users.role === "admin"` (enum existant).
 */

import { headers } from "next/headers";
import { db } from "@/db";
import { adminEvents } from "@/db/schema";
import { getCurrentUser } from "@/lib/session";
import { forbidden, unauthorized } from "@/lib/api-error";
import { logger } from "@/lib/logger";
import type { User } from "@/db/types";

/**
 * Récupère le user courant ET vérifie qu'il est admin.
 * À utiliser en tête de toute route /api/admin/*.
 */
export async function requireAdmin(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) throw unauthorized();
  if (user.role !== "admin") throw forbidden("Accès réservé aux administrateurs");
  return user;
}

/**
 * Version "safe" pour les Server Components : retourne le user si admin,
 * `null` sinon. Ne throw pas — permet de gérer la redirection côté page.
 */
export async function getAdminUser(): Promise<User | null> {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return null;
  return user;
}

export type AdminAction =
  | "ban_user"
  | "unban_user"
  | "override_plan"
  | "refund"
  | "delete_business"
  | "reset_password"
  | "impersonate"
  | "custom";

/**
 * Enregistre une action admin dans `admin_events`.
 * L'IP est récupérée via les headers (X-Forwarded-For sur Vercel).
 * Non-bloquant : si l'écriture échoue, on log en warn mais l'action se poursuit.
 */
export async function logAdminEvent(params: {
  actorUserId: string;
  targetUserId?: string | null;
  action: AdminAction | string;
  payload?: Record<string, unknown>;
}): Promise<void> {
  try {
    const h = await headers();
    const ip = h.get("x-forwarded-for")?.split(",")[0].trim() || h.get("x-real-ip") || null;

    await db.insert(adminEvents).values({
      actorUserId: params.actorUserId,
      targetUserId: params.targetUserId ?? null,
      action: params.action,
      payload: params.payload ?? null,
      ip: ip?.slice(0, 45) || null,
    });
  } catch (err) {
    logger.warn("[admin] logAdminEvent failed", {
      err: err instanceof Error ? err.message : String(err),
      action: params.action,
    });
  }
}
