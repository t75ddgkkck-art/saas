/**
 * Lot 36 — Hash déterministe pour compter les VISITEURS UNIQUES par jour.
 *
 * Design RGPD-friendly :
 *  - Aucune PII stockée (IP + user-agent ne sont JAMAIS écrits en DB)
 *  - Salt journalier (`YYYY-MM-DD` + secret serveur) → un même visiteur
 *    obtient un hash DIFFÉRENT chaque jour → impossible de le tracker
 *    à travers les jours (cross-day tracking bloqué)
 *  - SHA-256 tronqué à 32 chars → non-inversible + faible collision (1/16^32)
 *
 * Utilisé par :
 *  - POST /api/track/visit → insert avec visitorHash
 *  - GET /api/analytics → COUNT DISTINCT visitorHash par (business, date)
 */

import { createHash } from "crypto";

/**
 * Renvoie une chaîne hash de 32 chars hex.
 * Utilise `NEXTAUTH_SECRET` comme salt "app-wide" pour éviter qu'un attaquant
 * qui connaît la formule puisse reproduire le hash sans accès au secret.
 */
export function computeVisitorHash(
  ip: string | null,
  userAgent: string | null,
  date: Date = new Date()
): string {
  const secret = process.env.NEXTAUTH_SECRET || "dev-visitor-salt";
  const dayKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const payload = `${ip ?? ""}|${userAgent ?? ""}|${dayKey}|${secret}`;
  return createHash("sha256").update(payload).digest("hex").slice(0, 32);
}

/**
 * Détecte le device à partir du user-agent (léger, sans lib externe).
 * Retourne "mobile" / "tablet" / "desktop".
 */
export function detectDevice(userAgent: string | null): "mobile" | "tablet" | "desktop" {
  if (!userAgent) return "desktop";
  const ua = userAgent.toLowerCase();
  if (/ipad|tablet|kindle|silk|playbook/.test(ua)) return "tablet";
  if (/mobile|iphone|android|blackberry|opera mini|webos/.test(ua)) return "mobile";
  return "desktop";
}

/**
 * Normalise la source depuis un referer + query param `?src=`.
 * Prio : query `?src=` (explicite, ex : QR code) > referer domain > "direct"
 */
export function detectSource(referer: string | null, srcQuery: string | null): string {
  if (srcQuery && srcQuery.length > 0 && srcQuery.length <= 50) {
    // Sanitize : garder alphanumeric + tirets
    return srcQuery.replace(/[^a-z0-9-]/gi, "").toLowerCase() || "direct";
  }
  if (!referer) return "direct";
  try {
    const url = new URL(referer);
    const host = url.hostname.toLowerCase();
    if (host.includes("google.")) return "google";
    if (host.includes("bing.")) return "bing";
    if (host.includes("yahoo.")) return "yahoo";
    if (host.includes("duckduckgo.")) return "duckduckgo";
    if (host.includes("facebook.") || host.includes("fb.")) return "facebook";
    if (host.includes("instagram.")) return "instagram";
    if (host.includes("linkedin.")) return "linkedin";
    if (host.includes("twitter.") || host.includes("x.com")) return "twitter";
    if (host.includes("whatsapp.") || host.includes("wa.me")) return "whatsapp";
    if (host.includes("tiktok.")) return "tiktok";
    if (host.includes("youtube.") || host.includes("youtu.be")) return "youtube";
    // Autre : renvoie le domain (utile pour partenaires)
    return host.replace(/^www\./, "").slice(0, 50);
  } catch {
    return "direct";
  }
}
