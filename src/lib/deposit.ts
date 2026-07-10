/**
 * F2 (Lot 30) — Calcul et politique d'acompte pour les RDV.
 *
 * Logique métier centralisée pour :
 *  - Calculer le montant d'acompte d'un service (fixed | percent)
 *  - Vérifier si un service nécessite un acompte
 *  - Décider si un remboursement est dû à l'annulation
 *
 * Toutes les valeurs sont manipulées en CENTIMES pour éviter les erreurs
 * float sur des multiplications % (ex : 30€ × 20% ≠ 6€ exactement en float).
 */

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type DepositType = "fixed" | "percent" | null;

export interface ServiceLike {
  /** Prix du service en centimes (peut être null si "sur devis"). */
  priceCents?: number | null;
  /** Type d'acompte configuré ("fixed" | "percent" | null). */
  depositType?: DepositType;
  /** Montant : centimes si fixed, 0-100 si percent. */
  depositAmount?: number | null;
}

// -----------------------------------------------------------------------------
// Calcul du montant d'acompte
// -----------------------------------------------------------------------------

/**
 * Renvoie le montant d'acompte à demander pour un service, en centimes.
 * Retourne `0` si aucun acompte n'est configuré ou si le calcul aboutit à 0.
 *
 * Règles :
 *  - depositType = null → 0 (pas d'acompte)
 *  - depositType = "fixed" → depositAmount (centimes)
 *  - depositType = "percent" → priceCents × (depositAmount / 100)
 *  - priceCents null + percent → 0 (impossible de calculer, service "sur devis")
 *
 * On garantit :
 *  - Montant >= 0
 *  - Montant <= priceCents (l'acompte ne peut pas dépasser le prix total)
 *  - Arrondi entier (Stripe n'accepte que des centimes entiers)
 */
export function computeDepositCents(service: ServiceLike): number {
  const type = service.depositType;
  const amount = service.depositAmount ?? 0;
  if (!type || amount <= 0) return 0;

  if (type === "fixed") {
    const capped =
      service.priceCents !== null && service.priceCents !== undefined
        ? Math.min(amount, service.priceCents)
        : amount;
    return Math.max(0, Math.round(capped));
  }

  // percent
  if (service.priceCents === null || service.priceCents === undefined || service.priceCents <= 0)
    return 0;
  const raw = (service.priceCents * amount) / 100;
  const rounded = Math.round(raw);
  // Ne jamais dépasser le prix total (percent > 100 = impossible via CHECK SQL,
  // mais on ceinture-bretelles)
  return Math.min(service.priceCents, Math.max(0, rounded));
}

/**
 * Renvoie true si le service demande un acompte à la réservation.
 */
export function requiresDeposit(service: ServiceLike): boolean {
  return computeDepositCents(service) > 0;
}

// -----------------------------------------------------------------------------
// Politique de remboursement
// -----------------------------------------------------------------------------

export interface RefundContext {
  /** Heures avant le RDV où l'annulation donne droit au remboursement (ex : 48). */
  refundHours: number | null;
  /** Date+heure prévue du RDV (ISO string ou Date). */
  appointmentStart: Date | string;
  /** Date+heure d'annulation (par défaut : maintenant). */
  cancelledAt?: Date;
}

/**
 * Décide si l'acompte doit être remboursé lors d'une annulation.
 *
 * Règles :
 *  - `refundHours = null` → jamais remboursé automatiquement (le pro décide)
 *  - `refundHours = 0` → toujours remboursé (politique généreuse)
 *  - `refundHours > 0` → remboursé si l'annulation a lieu > N heures avant le RDV
 *
 * Renvoie `"refunded"` (remboursement dû) ou `"forfeited"` (acompte perdu).
 */
export function decideRefundOnCancel(ctx: RefundContext): "refunded" | "forfeited" {
  if (ctx.refundHours === null || ctx.refundHours === undefined) return "forfeited";
  if (ctx.refundHours <= 0) return "refunded";

  const cancelAt = ctx.cancelledAt ?? new Date();
  const startAt =
    typeof ctx.appointmentStart === "string"
      ? new Date(ctx.appointmentStart)
      : ctx.appointmentStart;

  const diffMs = startAt.getTime() - cancelAt.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);

  return diffHours >= ctx.refundHours ? "refunded" : "forfeited";
}

// -----------------------------------------------------------------------------
// Formatage humain
// -----------------------------------------------------------------------------

/**
 * Convertit des centimes en chaîne "12,50 €" (locale fr-FR).
 */
export function formatCentsEur(cents: number): string {
  return (cents / 100).toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
  });
}

/**
 * Résume la config deposit d'un service en une phrase humaine.
 * Ex : "20 % soit 6,00 €" ou "10,00 € fixe" ou "Aucun acompte".
 */
export function describeDeposit(service: ServiceLike): string {
  const cents = computeDepositCents(service);
  if (cents === 0) return "Aucun acompte";
  if (service.depositType === "fixed") {
    return `${formatCentsEur(cents)} fixe`;
  }
  // percent
  return `${service.depositAmount ?? 0} % soit ${formatCentsEur(cents)}`;
}

/**
 * Fenêtre d'expiration d'une session Checkout d'acompte, en secondes.
 * Stripe accepte 30 min à 24h ; on choisit 30 min = équilibre entre
 * "temps de finir la CB" et "libérer le créneau si abandon".
 * (Stripe minimum = 30 minutes après now.)
 */
export const DEPOSIT_CHECKOUT_EXPIRY_SEC = 30 * 60;
