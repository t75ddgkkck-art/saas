/**
 * F3 (Lot 31) — Sessions pour l'espace client final.
 *
 * Séparé de `session.ts` (pros) pour :
 *  - Cookie distinct (`vx_client_session`) → un même navigateur peut avoir
 *    une session pro ET une session client sans conflit
 *  - Table `client_sessions` séparée (email au lieu de userId)
 *  - Aucune notion de subscription/role côté client
 *
 * Sécurité :
 *  - Token session = 32 bytes random hex (comme les auth-tokens)
 *  - Stockage = SHA-256 du token
 *  - Signature HMAC du cookie (empêche la forge)
 *  - TTL 30 jours, `lastSeenAt` mis à jour à chaque check
 *  - Révocation via `revokedAt`
 *  - HttpOnly, SameSite=Lax, Secure en prod
 */

import { cookies } from "next/headers";
import { createHmac, createHash, randomBytes, timingSafeEqual } from "crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/db";
import { clientSessions } from "@/db/schema";

// Nom du cookie — préfixe `vx_` pour cohérence, `client_` pour distinguer des pros
export const CLIENT_COOKIE_NAME = "vx_client_session";

// 30 jours (un client qui revient une fois par mois reste connecté)
const CLIENT_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

// -----------------------------------------------------------------------------
// Secret (réutilise NEXTAUTH_SECRET — pas besoin d'une clé de plus à gérer)
// -----------------------------------------------------------------------------

function getSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret || secret.length < 16) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("NEXTAUTH_SECRET manquant ou trop court (>= 16 chars requis en production).");
    }
    // eslint-disable-next-line no-console
    console.warn(
      "[client-session] NEXTAUTH_SECRET non défini — utilisation d'un secret DEV, ne PAS utiliser en prod."
    );
    return "dev-secret-change-me-please-use-32bytes-min";
  }
  return secret;
}

function sign(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("hex");
}

function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

// -----------------------------------------------------------------------------
// Format du cookie : base64url(rawToken.expiry.signature)
// -----------------------------------------------------------------------------
// - rawToken (64 chars hex) → identifie la ligne DB via son SHA-256
// - expiry (ms epoch) → double-check TTL même si la DB n'était pas cohérente
// - signature (HMAC hex 64 chars) → empêche la forge
// -----------------------------------------------------------------------------

function encodeCookie(rawToken: string, expiryMs: number): string {
  const payload = `${rawToken}.${expiryMs}`;
  const signature = sign(payload);
  return Buffer.from(`${payload}.${signature}`).toString("base64url");
}

function decodeCookie(cookieValue: string): { rawToken: string; expiryMs: number } | null {
  try {
    const decoded = Buffer.from(cookieValue, "base64url").toString("utf8");
    const parts = decoded.split(".");
    if (parts.length !== 3) return null;
    const [rawToken, expiryStr, signature] = parts;
    const expiryMs = Number(expiryStr);
    if (!Number.isFinite(expiryMs)) return null;
    if (expiryMs < Date.now()) return null; // expiré

    // Vérif signature en temps constant
    const expected = sign(`${rawToken}.${expiryStr}`);
    const a = Buffer.from(signature, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length) return null;
    if (!timingSafeEqual(a, b)) return null;

    // Format rawToken : 64 chars hex
    if (rawToken.length !== 64) return null;

    return { rawToken, expiryMs };
  } catch {
    return null;
  }
}

// -----------------------------------------------------------------------------
// Création de session (à appeler après consommation du magic-link)
// -----------------------------------------------------------------------------

export interface CreateClientSessionOptions {
  email: string;
  ip?: string | null;
  userAgent?: string | null;
}

/**
 * Crée une session client + pose le cookie signé.
 * Retourne l'objet cookie prêt à poser (pour cas SSR).
 */
export async function createClientSession(opts: CreateClientSessionOptions) {
  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = sha256Hex(rawToken);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + CLIENT_SESSION_TTL_MS);
  const normalizedEmail = opts.email.trim().toLowerCase();

  await db.insert(clientSessions).values({
    email: normalizedEmail,
    tokenHash,
    expiresAt,
    ip: opts.ip?.slice(0, 45) ?? null,
    userAgent: opts.userAgent?.slice(0, 500) ?? null,
  });

  const cookieValue = encodeCookie(rawToken, expiresAt.getTime());

  // Set cookie côté request (App Router)
  const cookieStore = await cookies();
  cookieStore.set(CLIENT_COOKIE_NAME, cookieValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: CLIENT_SESSION_TTL_MS / 1000,
  });

  return { email: normalizedEmail, expiresAt };
}

// -----------------------------------------------------------------------------
// Lecture de session (SSR/API)
// -----------------------------------------------------------------------------

export interface CurrentClient {
  email: string;
  sessionId: string;
}

/**
 * Renvoie l'email du client connecté depuis le cookie, ou null.
 * Vérifie :
 *  1. Cookie présent
 *  2. Signature HMAC valide
 *  3. Expiration côté cookie
 *  4. Session existe en DB, non révoquée, non expirée
 * Met à jour `last_seen_at` (soft, non-throwing).
 */
export async function getCurrentClient(): Promise<CurrentClient | null> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(CLIENT_COOKIE_NAME)?.value;
  if (!cookie) return null;

  const decoded = decodeCookie(cookie);
  if (!decoded) return null;

  const tokenHash = sha256Hex(decoded.rawToken);
  const now = new Date();

  const rows = await db
    .select({
      id: clientSessions.id,
      email: clientSessions.email,
      expiresAt: clientSessions.expiresAt,
    })
    .from(clientSessions)
    .where(
      and(
        eq(clientSessions.tokenHash, tokenHash),
        isNull(clientSessions.revokedAt),
        gt(clientSessions.expiresAt, now)
      )
    )
    .limit(1);

  const session = rows[0];
  if (!session) return null;

  // Mise à jour last_seen_at (bruit acceptable — un update par requête client)
  try {
    await db
      .update(clientSessions)
      .set({ lastSeenAt: now })
      .where(eq(clientSessions.id, session.id));
  } catch {
    // Non bloquant
  }

  return { email: session.email, sessionId: session.id };
}

// -----------------------------------------------------------------------------
// Révocation (logout)
// -----------------------------------------------------------------------------

export async function revokeCurrentClientSession(): Promise<void> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(CLIENT_COOKIE_NAME)?.value;
  if (cookie) {
    const decoded = decodeCookie(cookie);
    if (decoded) {
      const tokenHash = sha256Hex(decoded.rawToken);
      await db
        .update(clientSessions)
        .set({ revokedAt: new Date() })
        .where(eq(clientSessions.tokenHash, tokenHash));
    }
  }
  // Clear le cookie
  cookieStore.set(CLIENT_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
