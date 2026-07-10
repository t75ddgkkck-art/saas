/**
 * API keys (Lot 16.4).
 *
 * Format des clés : `vx_live_<24 chars base32>` (ou `vx_test_...` en dev).
 * Le prefix visible = premiers 12 chars (ex: "vx_live_A3F7") → affiché
 * dans le dashboard, safe à mettre dans les logs.
 * Le secret complet est SHA-256 hashé en DB (pas de bcrypt : on veut un
 * lookup O(1) sur `key_hash`, et l'entropie native de la clé est suffisante
 * pour ne pas nécessiter de key-stretching).
 */

import { randomBytes, createHash } from "crypto";
import { db } from "@/db";
import { apiKeys } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { logger } from "@/lib/logger";
import type { NextRequest } from "next/server";

const PREFIX_LIVE = "vx_live_";
const PREFIX_TEST = "vx_test_";
const SECRET_LENGTH = 24; // chars base32 après le préfixe

/** Base32 Crockford (sans I/O/L/U pour la lisibilité) */
const B32 = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

function randomB32(len: number): string {
  const bytes = randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) out += B32[bytes[i] % 32];
  return out;
}

/** Hash SHA-256 hex (lookup rapide, résistant aux collisions dans notre volumétrie). */
export function hashApiKey(rawKey: string): string {
  return createHash("sha256").update(rawKey).digest("hex");
}

/**
 * Génère une nouvelle clé.
 * Retourne { rawKey, keyPrefix, keyHash } — le rawKey NE DOIT PAS être stocké,
 * uniquement montré une fois au user à la création.
 */
export function generateApiKey(env: "live" | "test" = "live"): {
  rawKey: string;
  keyPrefix: string;
  keyHash: string;
} {
  const prefix = env === "test" ? PREFIX_TEST : PREFIX_LIVE;
  const secret = randomB32(SECRET_LENGTH);
  const rawKey = prefix + secret;
  const keyPrefix = rawKey.slice(0, 12); // "vx_live_XXXX"
  const keyHash = hashApiKey(rawKey);
  return { rawKey, keyPrefix, keyHash };
}

/**
 * Extrait la clé depuis `Authorization: Bearer <key>` OU header `X-Api-Key`.
 */
export function extractApiKey(req: NextRequest): string | null {
  const authHeader = req.headers.get("authorization");
  if (authHeader) {
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (match) return match[1].trim();
  }
  const xApiKey = req.headers.get("x-api-key");
  if (xApiKey) return xApiKey.trim();
  return null;
}

export interface ApiKeyAuthResult {
  keyId: string;
  userId: string;
  businessId: string;
  scope: "read" | "read_write";
}

/**
 * Authentifie une requête API par sa clé. Retourne `null` si :
 *  - Pas de clé fournie
 *  - Format invalide
 *  - Clé inconnue en DB
 *  - Clé révoquée
 *
 * Effet secondaire : met à jour `last_used_at` et `last_used_ip` (fire and forget).
 */
export async function authenticateApiKey(req: NextRequest): Promise<ApiKeyAuthResult | null> {
  const raw = extractApiKey(req);
  if (!raw) return null;
  if (!raw.startsWith(PREFIX_LIVE) && !raw.startsWith(PREFIX_TEST)) return null;
  // Un peu de sanity check sur la longueur (préfixe + secret)
  if (raw.length < PREFIX_LIVE.length + SECRET_LENGTH) return null;

  const keyHash = hashApiKey(raw);
  const rows = await db
    .select({
      id: apiKeys.id,
      userId: apiKeys.userId,
      businessId: apiKeys.businessId,
      scope: apiKeys.scope,
      revokedAt: apiKeys.revokedAt,
    })
    .from(apiKeys)
    .where(and(eq(apiKeys.keyHash, keyHash), isNull(apiKeys.revokedAt)))
    .limit(1);

  const key = rows[0];
  if (!key) return null;
  if (key.revokedAt) return null;

  // Fire and forget : on met à jour last_used_at sans attendre
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    null;
  void db
    .update(apiKeys)
    .set({ lastUsedAt: new Date(), lastUsedIp: ip?.slice(0, 45) || null })
    .where(eq(apiKeys.id, key.id))
    .catch((err) => {
      logger.warn("[api-keys] failed to update last_used_at", {
        keyId: key.id,
        err: err instanceof Error ? err.message : String(err),
      });
    });

  return {
    keyId: key.id,
    userId: key.userId,
    businessId: key.businessId,
    scope: (key.scope === "read_write" ? "read_write" : "read") as "read" | "read_write",
  };
}
