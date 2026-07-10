/**
 * Gestion des tokens d'unsubscribe (RGPD art. 21 + CAN-SPAM).
 *
 * Token signé HMAC-SHA256, format : base64url(email.category.expiry.sig)
 * → impossible de forger un lien unsubscribe pour l'email d'autrui
 * → révocable simplement en changeant NEXTAUTH_SECRET
 * → pas de stockage DB nécessaire (stateless)
 *
 * Catégories supportées :
 *  - "transactional" : confirmations RDV, devis (jamais désabonnables — obligation contractuelle)
 *  - "reminders"     : rappels RDV/devis
 *  - "review-request": demandes d'avis
 *  - "marketing"     : nouveautés produit, promos (le seul obligatoire par RGPD)
 *  - "all"           : opt-out global (bloque tout sauf transactional)
 */

import { createHmac, timingSafeEqual } from "crypto";

export type EmailCategory =
  | "transactional"
  | "reminders"
  | "review-request"
  | "marketing"
  | "all";

const TOKEN_EXPIRY_MS = 365 * 24 * 60 * 60 * 1000; // 1 an

function getSecret(): string {
  const s = process.env.NEXTAUTH_SECRET;
  if (!s || s.length < 16) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("NEXTAUTH_SECRET manquant pour les tokens unsubscribe");
    }
    return "dev-secret-change-me-please-use-32bytes-min";
  }
  return s;
}

function sign(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("hex");
}

/**
 * Crée un token d'unsubscribe pour un couple (email, catégorie).
 * À embed dans le lien : /api/unsubscribe?token=XYZ
 */
export function createUnsubscribeToken(
  email: string,
  category: EmailCategory = "all"
): string {
  const normalizedEmail = email.trim().toLowerCase();
  const expiry = Date.now() + TOKEN_EXPIRY_MS;
  const payload = `${normalizedEmail}|${category}|${expiry}`;
  const signature = sign(payload);
  return Buffer.from(`${payload}|${signature}`).toString("base64url");
}

/**
 * Vérifie un token et renvoie { email, category } si valide, null sinon.
 * Comparaison en temps constant contre les timing attacks.
 */
export function verifyUnsubscribeToken(
  token: string
): { email: string; category: EmailCategory } | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf-8");
    const parts = decoded.split("|");
    if (parts.length !== 4) return null;
    const [email, category, expiryStr, signature] = parts;
    if (!email || !category || !expiryStr || !signature) return null;

    const expected = sign(`${email}|${category}|${expiryStr}`);
    const a = Buffer.from(signature, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

    const expiry = Number.parseInt(expiryStr, 10);
    if (!Number.isFinite(expiry) || Date.now() > expiry) return null;

    if (!isValidCategory(category)) return null;

    return { email, category };
  } catch {
    return null;
  }
}

export function isValidCategory(c: string): c is EmailCategory {
  return ["transactional", "reminders", "review-request", "marketing", "all"].includes(c);
}

/**
 * Construit le lien complet d'unsubscribe pour un email/catégorie donnés.
 */
export function buildUnsubscribeUrl(
  email: string,
  category: EmailCategory = "all",
  appUrl?: string
): string {
  const base = (appUrl || process.env.NEXT_PUBLIC_APP_URL || "https://www.vitrix.fr").replace(
    /\/$/,
    ""
  );
  const token = createUnsubscribeToken(email, category);
  return `${base}/api/unsubscribe?token=${encodeURIComponent(token)}`;
}

/**
 * Header `List-Unsubscribe` conforme RFC 8058.
 * Gmail / Yahoo l'affichent comme un bouton "Se désabonner" en un clic
 * dans l'en-tête du mail (drastique pour la délivrabilité).
 *
 * @returns tuple [headerValue, listUnsubscribePost] à injecter dans les headers
 */
export function buildListUnsubscribeHeaders(
  email: string,
  category: EmailCategory = "all",
  appUrl?: string
): { "List-Unsubscribe": string; "List-Unsubscribe-Post": string } {
  const url = buildUnsubscribeUrl(email, category, appUrl);
  return {
    "List-Unsubscribe": `<${url}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}
