/**
 * Parrainage (Lot 16.3).
 *
 * Fonctionnement :
 *  - À l'inscription, chaque user reçoit un code unique `referralCode` (ex: VX-A3F7K2).
 *  - Il peut le partager : `https://vitrix.fr/register?ref=VX-A3F7K2`.
 *  - Le filleul saisit le code au register OU il est prérempli via ?ref=...
 *  - On stocke `users.referredBy` = id du parrain.
 *  - Quand le filleul complète son 1er paiement (webhook Stripe checkout.completed),
 *    on crédite +1 mois au parrain via `users.referralCreditMonths`.
 *  - Le crédit est appliqué sur la prochaine facture Stripe (via coupon manuel
 *    OU décrément à la souscription du parrain — voir applyReferralCreditIfAny).
 *
 * Design volontairement simple : pas de table dédiée `referrals` avec statut.
 * Tout tient sur 3 colonnes users. Extensible plus tard (table `referral_events`
 * si besoin d'un vrai funnel).
 */

import { randomBytes } from "crypto";
import { db } from "@/db";
import { users } from "@/db/schema";
import { and, eq, isNull, sql } from "drizzle-orm";
import { logger } from "@/lib/logger";

/**
 * Génère un code parrain lisible (VX-XXXXXX, base32 sans caractères ambigus).
 * Format : préfixe "VX-" + 6 caractères Crockford (pas de I/O/L/U).
 * Espace de valeur : 32^6 = ~1 milliard → collisions rarissimes.
 */
export function generateReferralCode(): string {
  const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  const bytes = randomBytes(6);
  let code = "VX-";
  for (let i = 0; i < 6; i++) {
    code += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return code;
}

/**
 * Génère un code unique en DB en réessayant si collision.
 * Après 10 tentatives on abandonne (probabilité < 1 chance sur 10^60).
 */
export async function generateUniqueReferralCode(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateReferralCode();
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.referralCode, code))
      .limit(1);
    if (existing.length === 0) return code;
  }
  throw new Error("Impossible de générer un code parrain unique après 10 tentatives");
}

/**
 * Résout un code parrain → renvoie l'id du parrain, ou `null` si code invalide,
 * user supprimé, ou banni.
 * Utilisé au register pour valider `?ref=VX-XXXXX`.
 */
export async function resolveReferralCode(code: string): Promise<string | null> {
  const clean = code.trim().toUpperCase();
  if (!/^VX-[0-9A-Z]{6}$/.test(clean)) return null;

  const rows = await db
    .select({ id: users.id, bannedAt: users.bannedAt, deletedAt: users.deletedAt })
    .from(users)
    .where(eq(users.referralCode, clean))
    .limit(1);
  const referrer = rows[0];
  if (!referrer) return null;
  if (referrer.bannedAt || referrer.deletedAt) return null;
  return referrer.id;
}

/**
 * Crédite +N mois au parrain (appelé au checkout complété du filleul).
 * Non-bloquant : si l'écriture échoue on log mais on ne throw pas — la
 * conversion Stripe reste le happy path critique.
 */
export async function creditReferrer(referrerId: string, months = 1): Promise<void> {
  try {
    await db
      .update(users)
      .set({
        referralCreditMonths: sql`${users.referralCreditMonths} + ${months}`,
      })
      .where(and(eq(users.id, referrerId), isNull(users.deletedAt)));
    logger.info("[referral] parrain crédité", { referrerId, months });
  } catch (err) {
    logger.warn("[referral] credit failed", {
      referrerId,
      err: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Consomme (soustrait) N mois de crédit sur un user, mais jamais en dessous
 * de 0. Retourne le nombre de mois effectivement consommés.
 * Appelé au prochain paiement du parrain pour "utiliser" son crédit.
 *
 * Note : dans une v2, on pourrait pousser ces crédits en `subscription_expires_at`
 * ou générer un coupon Stripe. Pour l'instant on tient le compteur en DB,
 * l'application effective sera implémentée dans le webhook Stripe côté paiement.
 */
export async function consumeReferralCredit(userId: string, months = 1): Promise<number> {
  const rows = await db
    .select({ credits: users.referralCreditMonths })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const current = rows[0]?.credits ?? 0;
  const toConsume = Math.min(current, Math.max(0, months));
  if (toConsume === 0) return 0;

  await db
    .update(users)
    .set({
      referralCreditMonths: sql`greatest(${users.referralCreditMonths} - ${toConsume}, 0)`,
    })
    .where(eq(users.id, userId));

  logger.info("[referral] crédit consommé", { userId, consumed: toConsume, remaining: current - toConsume });
  return toConsume;
}
