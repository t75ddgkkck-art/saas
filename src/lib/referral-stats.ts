/**
 * Lot 52 (F14) — Stats agrégées + liste filleuls pour /dashboard/parrainage.
 *
 * Design :
 *  - `loadReferralStats(userId)` : 4 KPIs en 1 seul SELECT groupé (pas de N+1)
 *  - `loadReferralList(userId)` : liste des filleuls avec statut + date
 *    conversion. Emails masqués (m***@example.com) pour respect vie privée.
 *
 * Utilisé par GET /api/account/referral (enrichi Lot 52).
 */

import { and, eq, isNotNull, isNull, ne } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { REFERRAL_MAX_CREDIT_MONTHS } from "@/lib/referral";

export interface ReferralStats {
  /** Total filleuls inscrits (Free/Pro/Premium confondus) — soft delete filtré */
  totalReferred: number;
  /** Filleuls convertis en Pro ou Premium (payants) */
  converted: number;
  /** Filleuls encore en Free (opportunité de nudge) */
  pending: number;
  /** Mois offerts cumulés (plafonné à REFERRAL_MAX_CREDIT_MONTHS) */
  creditMonths: number;
  /** Vrai si le plafond a été atteint — UI affiche "🎉 Plafond max atteint" */
  atMaxCredit: boolean;
  /** Constante réexportée pour l'affichage UI ("X mois sur 12 max") */
  maxCreditMonths: number;
}

/**
 * Charge les stats agrégées en 3 requêtes parallèles (Postgres/driver mutualisent).
 * Rapide même sur des bases avec 10K+ users grâce à `users_referred_by_idx`.
 */
export async function loadReferralStats(userId: string): Promise<ReferralStats> {
  const [totalRows, convertedRows, userRows] = await Promise.all([
    // 1) Total filleuls (Free + payants)
    db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.referredBy, userId), isNull(users.deletedAt))),

    // 2) Filleuls PAYANTS (Pro ou Premium avec stripeSubscriptionId)
    db
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          eq(users.referredBy, userId),
          isNull(users.deletedAt),
          isNotNull(users.stripeSubscriptionId),
          ne(users.subscription, "free")
        )
      ),

    // 3) Credits du parrain (colonne dédiée)
    db.select({ credits: users.referralCreditMonths }).from(users).where(eq(users.id, userId)).limit(1),
  ]);

  const total = totalRows.length;
  const converted = convertedRows.length;
  const credits = userRows[0]?.credits ?? 0;

  return {
    totalReferred: total,
    converted,
    pending: Math.max(0, total - converted),
    creditMonths: credits,
    atMaxCredit: credits >= REFERRAL_MAX_CREDIT_MONTHS,
    maxCreditMonths: REFERRAL_MAX_CREDIT_MONTHS,
  };
}

// -----------------------------------------------------------------------------
// Liste des filleuls (pour affichage table)
// -----------------------------------------------------------------------------

export interface ReferredUser {
  id: string;
  /** Prénom + initiale nom (ex: "Jean D.") — préserve un minimum de vie privée */
  displayName: string;
  /** Email masqué : "j***@example.com" */
  maskedEmail: string;
  /** "free" | "pro" | "premium" */
  subscription: string;
  /** true si compte payant (stripeSubscriptionId set + subscription !== free) */
  isConverted: boolean;
  /** Date d'inscription du filleul */
  createdAt: Date;
}

/**
 * Charge la liste des filleuls d'un user, ordonnée du + récent au + ancien.
 * Cap 50 par défaut (défensif — un power-user peut en avoir des centaines,
 * on paginera plus tard si besoin).
 */
export async function loadReferralList(userId: string, limit = 50): Promise<ReferredUser[]> {
  const rows = await db
    .select({
      id: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
      email: users.email,
      subscription: users.subscription,
      stripeSubscriptionId: users.stripeSubscriptionId,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(and(eq(users.referredBy, userId), isNull(users.deletedAt)))
    .limit(Math.min(200, Math.max(1, limit)));

  // Tri chronologique inverse (le plus récent d'abord) côté JS pour éviter
  // un ORDER BY sur toute la table (Drizzle groupBy signature parfois lourde).
  rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return rows.map((r) => ({
    id: r.id,
    displayName: buildDisplayName(r.firstName, r.lastName),
    maskedEmail: maskEmail(r.email),
    subscription: r.subscription,
    isConverted: Boolean(r.stripeSubscriptionId) && r.subscription !== "free",
    createdAt: r.createdAt,
  }));
}

// -----------------------------------------------------------------------------
// Helpers privés
// -----------------------------------------------------------------------------

function buildDisplayName(firstName: string | null, lastName: string | null): string {
  const first = (firstName ?? "").trim();
  const last = (lastName ?? "").trim();
  if (!first && !last) return "—";
  if (!last) return first;
  return `${first} ${last.charAt(0).toUpperCase()}.`;
}

/**
 * Masque un email en gardant la 1re lettre + domaine complet.
 * "jean.dupont@gmail.com" → "j***@gmail.com"
 * Défensif contre les emails malformés.
 */
function maskEmail(email: string | null): string {
  if (!email) return "—";
  const at = email.indexOf("@");
  if (at <= 1) return "***";
  const first = email.charAt(0);
  const domain = email.slice(at);
  return `${first}***${domain}`;
}
