/**
 * F3 (Lot 31) — Magic-link auth pour l'espace client final.
 *
 * Design séparé de `auth-tokens.ts` (qui gère les tokens des PROS) car :
 *  - Les clients finaux NE sont PAS dans la table `users` (réservée aux pros)
 *  - Ils vivent dans `clients` par businessId — unifiés par EMAIL côté espace client
 *  - Pas de mot de passe : uniquement magic-link envoyé par email
 *
 * Sécurité (identique au pattern auth-tokens pros) :
 *  - Token brut = 32 bytes random hex (256 bits)
 *  - Stockage = SHA-256 (si DB fuite, tokens inexploitables)
 *  - Single-use via `usedAt` (replay bloqué)
 *  - TTL court : 15 min
 *  - Anti-spam : max 3 tokens actifs par email
 *
 * Flow :
 *   1. Client demande login → POST /api/client/magic-link { email }
 *   2. Générer token, envoyer email avec URL contenant rawToken
 *   3. Client clique → GET /api/client/verify?token=<raw>
 *   4. `consumeClientAuthToken` valide + marque used_at
 *   5. Créer session cookie (via client-session.ts)
 *   6. Rediriger vers /mon-compte
 */

import { randomBytes, createHash } from "crypto";
import { and, count, eq, gt, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { clientAuthTokens } from "@/db/schema";
import { logger } from "@/lib/logger";

// TTL très court : le magic-link est cliqué en secondes normalement.
export const CLIENT_TOKEN_TTL_SEC = 15 * 60;

// Anti-spam : un client ne peut pas déclencher plus de 3 magic-links actifs
// simultanément (évite le flood de sa boîte mail par un attaquant).
export const CLIENT_MAX_ACTIVE_TOKENS = 3;

// -----------------------------------------------------------------------------
// Génération / hash
// -----------------------------------------------------------------------------

export function generateClientRawToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashClientToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

// -----------------------------------------------------------------------------
// Création
// -----------------------------------------------------------------------------

/**
 * Crée un token magic-link pour un email.
 * Anti-spam : throw "TOO_MANY_ACTIVE_TOKENS" si >= 3 tokens actifs.
 * L'appelant DOIT catcher ce cas et renvoyer la même réponse générique
 * (anti-énumération : ne pas révéler que l'email est connu ou spamé).
 */
export async function createClientAuthToken(params: {
  email: string;
  ip?: string | null;
  businessId?: string | null;
}): Promise<{ rawToken: string; id: string; expiresAt: Date }> {
  const now = new Date();
  const normalizedEmail = params.email.trim().toLowerCase();

  // Compte tokens actifs pour cet email
  const [{ activeCount }] = await db
    .select({ activeCount: count() })
    .from(clientAuthTokens)
    .where(
      and(
        eq(clientAuthTokens.email, normalizedEmail),
        isNull(clientAuthTokens.usedAt),
        gt(clientAuthTokens.expiresAt, now)
      )
    );

  if (Number(activeCount) >= CLIENT_MAX_ACTIVE_TOKENS) {
    logger.warn("[client-auth] limite tokens actifs atteinte", {
      email: normalizedEmail,
      active: activeCount,
    });
    throw new Error("TOO_MANY_ACTIVE_TOKENS");
  }

  const rawToken = generateClientRawToken();
  const tokenHash = hashClientToken(rawToken);
  const expiresAt = new Date(now.getTime() + CLIENT_TOKEN_TTL_SEC * 1000);

  const [inserted] = await db
    .insert(clientAuthTokens)
    .values({
      email: normalizedEmail,
      tokenHash,
      expiresAt,
      ip: params.ip?.slice(0, 45) ?? null,
      businessId: params.businessId ?? null,
    })
    .returning({ id: clientAuthTokens.id });

  logger.info("[client-auth] token créé", { email: normalizedEmail, id: inserted.id });

  return { rawToken, id: inserted.id, expiresAt };
}

// -----------------------------------------------------------------------------
// Consommation
// -----------------------------------------------------------------------------

export type ConsumeClientTokenResult =
  { ok: true; email: string } | { ok: false; reason: "not_found" | "expired" | "already_used" };

/**
 * Consomme atomiquement un token magic-link.
 * Le WHERE `used_at IS NULL` évite les race conditions (double-clic sur le lien).
 * On NE distingue PAS "n'existe pas" / "expiré" côté user (anti-énumération)
 * mais on garde le détail pour les logs internes.
 */
export async function consumeClientAuthToken(
  rawToken: string,
  opts?: { ip?: string | null }
): Promise<ConsumeClientTokenResult> {
  if (!rawToken || typeof rawToken !== "string" || rawToken.length !== 64) {
    return { ok: false, reason: "not_found" };
  }

  const tokenHash = hashClientToken(rawToken);
  const rows = await db
    .select({
      id: clientAuthTokens.id,
      email: clientAuthTokens.email,
      expiresAt: clientAuthTokens.expiresAt,
      usedAt: clientAuthTokens.usedAt,
    })
    .from(clientAuthTokens)
    .where(eq(clientAuthTokens.tokenHash, tokenHash))
    .limit(1);

  const token = rows[0];
  if (!token) return { ok: false, reason: "not_found" };
  if (token.usedAt) return { ok: false, reason: "already_used" };
  if (token.expiresAt.getTime() < Date.now()) return { ok: false, reason: "expired" };

  // Consommation atomique (WHERE used_at IS NULL bloque le double-consume)
  const updated = await db
    .update(clientAuthTokens)
    .set({
      usedAt: new Date(),
    })
    .where(and(eq(clientAuthTokens.id, token.id), isNull(clientAuthTokens.usedAt)))
    .returning({ id: clientAuthTokens.id });

  if (updated.length === 0) return { ok: false, reason: "already_used" };

  // Log audit (bruité si beaucoup de trafic → à passer en debug si nécessaire)
  logger.info("[client-auth] token consommé", { email: token.email, id: token.id });

  return { ok: true, email: token.email };
}

// -----------------------------------------------------------------------------
// Purge (utilisée par cron RGPD-friendly)
// -----------------------------------------------------------------------------

/**
 * Supprime les tokens expirés depuis > 7 jours. Idempotent, safe à appeler
 * régulièrement (cron ou lors de la purge Lot 15).
 */
export async function purgeExpiredClientTokens(): Promise<number> {
  const cutoff = new Date(Date.now() - 7 * 24 * 3600 * 1000);
  const result = await db
    .delete(clientAuthTokens)
    .where(sql`${clientAuthTokens.expiresAt} < ${cutoff}`)
    .returning({ id: clientAuthTokens.id });
  return result.length;
}
