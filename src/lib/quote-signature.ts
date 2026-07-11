/**
 * F8 (Lot 38) — Signature électronique légère pour devis.
 *
 * Objectif : preuve d'intégrité + audit trail sans passer par un tiers (Yousign,
 * DocuSign) — suffit pour la plupart des devis artisans (< 10 K€).
 * Pour eIDAS qualifié → intégration Yousign en v2.
 *
 * Modèle :
 *  1. Le pro clique "Envoyer à signer" → générer `signatureTokenHash` +
 *     envoyer magic-link `/devis/[token]` par email
 *  2. Le client ouvre le lien, voit le devis, dessine sa signature ou tape son nom
 *  3. POST `/api/quotes/[id]/sign` avec token + payload → on calcule le
 *     `signatureHash = SHA-256(quoteId + total + items + signedByEmail + ip + ua + timestamp)`
 *  4. Stockage : signedAt, signedByEmail, signedIp, signedUserAgent, signatureHash
 *  5. Le devis passe en status "accepted" (autre transition), on invalide le token
 *
 * Vérification d'intégrité (future) : recomputer le hash sur le devis actuel
 * → si le hash matche = le devis n'a pas été modifié après signature.
 * → si le hash ne matche PAS = fraude/modification post-signature.
 */

import { createHash, randomBytes } from "crypto";

// -----------------------------------------------------------------------------
// Token magic-link (envoi au client pour signer)
// -----------------------------------------------------------------------------

export const SIGNATURE_TOKEN_TTL_SEC = 30 * 24 * 60 * 60; // 30 jours

export function generateSignatureRawToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashSignatureToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

// -----------------------------------------------------------------------------
// Hash de preuve d'intégrité (calculé au moment de la signature)
// -----------------------------------------------------------------------------

/**
 * Payload canonique pour hash. Ordre stable des champs = même hash à chaque
 * recalcul (sur les mêmes données). JSON.stringify natif garantit l'ordre
 * d'insertion des clés.
 *
 * Ce que l'on hash :
 *  - quoteId (identifiant devis)
 *  - total (montant final)
 *  - itemsFingerprint (concat des lignes triées par description + total)
 *  - signedByEmail (qui a signé)
 *  - signedAt ISO (quand)
 *  - signedIp + userAgent tronqués (contexte)
 *
 * Volontairement PAS le contenu HTML libre (description longue) : trop
 * facilement modifiable après signature sans changement fonctionnel.
 */
export interface SignaturePayload {
  quoteId: string;
  total: string;
  itemsFingerprint: string;
  signedByEmail: string;
  signedAt: string;
  signedIp: string;
  signedUserAgent: string;
}

export function computeSignatureHash(payload: SignaturePayload): string {
  const canonical = JSON.stringify({
    q: payload.quoteId,
    t: payload.total,
    i: payload.itemsFingerprint,
    e: payload.signedByEmail.trim().toLowerCase(),
    a: payload.signedAt,
    ip: payload.signedIp.slice(0, 45),
    ua: payload.signedUserAgent.slice(0, 500),
  });
  return createHash("sha256").update(canonical).digest("hex");
}

/**
 * Empreinte compacte d'une liste d'items pour la signature.
 * Trié par description (ordre stable indépendant de l'insertion) puis concaténé.
 *
 * Format ligne : "description|quantity|unit_price"
 */
export function computeItemsFingerprint(
  items: { description: string; quantity: number | string; unitPrice: number | string }[]
): string {
  return items
    .map((i) => ({
      d: i.description.trim(),
      q: String(i.quantity),
      p: String(i.unitPrice),
    }))
    .sort((a, b) => a.d.localeCompare(b.d))
    .map((i) => `${i.d}|${i.q}|${i.p}`)
    .join("||");
}

// -----------------------------------------------------------------------------
// Génération de l'URL de signature
// -----------------------------------------------------------------------------

export function buildSignatureUrl(rawToken: string): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.vitrix.fr";
  return `${appUrl}/devis/${rawToken}`;
}
