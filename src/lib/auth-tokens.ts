/**
 * Tokens à usage unique pour password reset / email verify / magic link (Lot 19).
 *
 * DESIGN :
 * - Token brut = 32 bytes random hex (256 bits d'entropie) → non-devinable
 * - Stockage = SHA-256 du token → si DB fuite, tokens inexploitables
 * - Single-use : `used_at` marqué à la 1ère consommation → replay bloqué
 * - TTL court par type (1h reset, 24h verify)
 * - Anti-spam : limite N tokens actifs par (user, type) avant refus
 *
 * FLOW type password reset :
 *   1. User demande reset → POST /api/auth/forgot-password
 *   2. On génère createToken → renvoie { rawToken, id }
 *   3. On envoie l'email avec l'URL contenant `rawToken`
 *   4. User clique → GET/POST /api/auth/reset-password?token=<rawToken>
 *   5. consumeToken(rawToken, "password_reset") → valide + marque used_at
 *   6. Change le password hash
 *
 * Le `rawToken` ne repasse JAMAIS en DB : il vit uniquement dans l'email
 * envoyé et l'URL cliquée. Résistant au vol DB.
 */

import { randomBytes, createHash } from "crypto";
import { db } from "@/db";
import { authTokens } from "@/db/schema";
import { and, count, eq, gt, isNull, lt, sql } from "drizzle-orm";
import { logger } from "@/lib/logger";

export type AuthTokenType = "password_reset" | "email_verify" | "magic_link";

/** TTL par type (en secondes). Valeurs raisonnables anti-brute-force. */
const TTL_SEC: Record<AuthTokenType, number> = {
  password_reset: 60 * 60, // 1 heure
  email_verify: 24 * 60 * 60, // 24 heures
  magic_link: 15 * 60, // 15 minutes (rare mais safe)
};

/** Nombre max de tokens ACTIFS (non-consommés, non-expirés) par (user, type). */
const MAX_ACTIVE_PER_USER: Record<AuthTokenType, number> = {
  password_reset: 3,
  email_verify: 5,
  magic_link: 3,
};

/**
 * Génère un token brut cryptographiquement sûr (32 bytes hex = 64 chars).
 */
export function generateRawToken(): string {
  return randomBytes(32).toString("hex");
}

/** Hash SHA-256 hex (64 chars). Déterministe → lookup DB O(1). */
export function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

/**
 * Crée un nouveau token pour un user + type.
 *
 * Retourne le `rawToken` (à mettre dans l'URL de l'email) et l'`id` en DB.
 *
 * Anti-spam : si l'user a déjà `MAX_ACTIVE_PER_USER[type]` tokens actifs,
 * on refuse — évite qu'un attaquant floode la boîte mail d'un user cible.
 */
export async function createAuthToken(params: {
  userId: string;
  type: AuthTokenType;
  ip?: string | null;
  meta?: Record<string, unknown>;
}): Promise<{ rawToken: string; id: string }> {
  const now = new Date();

  // Compte les tokens actifs (non-utilisés, non-expirés)
  const [{ activeCount }] = await db
    .select({ activeCount: count() })
    .from(authTokens)
    .where(
      and(
        eq(authTokens.userId, params.userId),
        eq(authTokens.type, params.type),
        isNull(authTokens.usedAt),
        gt(authTokens.expiresAt, now)
      )
    );

  if (Number(activeCount) >= MAX_ACTIVE_PER_USER[params.type]) {
    // On log en warn pour audit + on throw explicite → l'appelant peut
    // retourner la même réponse générique à l'user (anti-énumération).
    logger.warn("[auth-tokens] limite tokens actifs atteinte", {
      userId: params.userId,
      type: params.type,
      active: activeCount,
    });
    throw new Error("TOO_MANY_ACTIVE_TOKENS");
  }

  const rawToken = generateRawToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(now.getTime() + TTL_SEC[params.type] * 1000);

  const [row] = await db
    .insert(authTokens)
    .values({
      userId: params.userId,
      type: params.type,
      tokenHash,
      expiresAt,
      ip: params.ip?.slice(0, 45) ?? null,
      meta: params.meta ?? null,
    })
    .returning({ id: authTokens.id });

  return { rawToken, id: row.id };
}

export interface ConsumeResult {
  ok: boolean;
  userId?: string;
  reason?: "not_found" | "expired" | "already_used" | "wrong_type";
}

/**
 * Consomme un token en mode single-use.
 *  - Vérifie qu'il existe (par hash) et matche le type attendu
 *  - Vérifie qu'il n'est ni expiré ni déjà utilisé
 *  - Marque `used_at = NOW()` de façon atomique (`UPDATE ... WHERE used_at IS NULL`)
 *    → deux consommations simultanées : une seule gagne, l'autre voit `already_used`
 *
 * Retourne `{ ok, userId }` en cas de succès, ou `{ ok: false, reason }` sinon.
 * On NE distingue PAS "n'existe pas" de "expiré" côté user (générique par sécurité)
 * mais on garde l'info interne dans `reason` pour logs.
 */
export async function consumeAuthToken(
  rawToken: string,
  expectedType: AuthTokenType,
  opts?: { ip?: string | null }
): Promise<ConsumeResult> {
  if (!rawToken || typeof rawToken !== "string" || rawToken.length !== 64) {
    return { ok: false, reason: "not_found" };
  }

  const tokenHash = hashToken(rawToken);
  const rows = await db
    .select({
      id: authTokens.id,
      userId: authTokens.userId,
      type: authTokens.type,
      expiresAt: authTokens.expiresAt,
      usedAt: authTokens.usedAt,
    })
    .from(authTokens)
    .where(eq(authTokens.tokenHash, tokenHash))
    .limit(1);

  const token = rows[0];
  if (!token) return { ok: false, reason: "not_found" };
  if (token.type !== expectedType) return { ok: false, reason: "wrong_type" };
  if (token.usedAt) return { ok: false, reason: "already_used" };
  if (token.expiresAt.getTime() < Date.now()) return { ok: false, reason: "expired" };

  // Consommation atomique : le WHERE used_at IS NULL évite la race condition.
  const updated = await db
    .update(authTokens)
    .set({
      usedAt: new Date(),
      meta: sql`coalesce(${authTokens.meta}, '{}'::jsonb) || ${JSON.stringify({
        consumedIp: opts?.ip?.slice(0, 45) ?? null,
      })}::jsonb`,
    })
    .where(and(eq(authTokens.id, token.id), isNull(authTokens.usedAt)))
    .returning({ id: authTokens.id });

  if (updated.length === 0) return { ok: false, reason: "already_used" };

  return { ok: true, userId: token.userId };
}

/**
 * Purge les tokens expirés depuis > 7 jours. Appelé par le cron RGPD (Lot 15)
 * ou par un cron dédié. Non-bloquant.
 */
export async function purgeExpiredTokens(): Promise<number> {
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const deleted = await db
    .delete(authTokens)
    .where(lt(authTokens.expiresAt, cutoff))
    .returning({ id: authTokens.id });
  return deleted.length;
}
