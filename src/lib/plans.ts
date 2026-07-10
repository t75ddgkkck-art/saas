/**
 * Source UNIQUE de vérité pour les plans Vitrix + leur mapping Stripe.
 *
 * Avant : prix affichés dans PricingSection dupliqués dans utils.ts dupliqués
 * dans Stripe Dashboard → divergence garantie tôt ou tard.
 *
 * Après : ce module est la référence. La UI lit `getDisplayPlans()`,
 * Stripe reçoit `getStripePriceId(plan, billing)`. Un seul endroit à mettre à jour.
 *
 * Les IDs Stripe restent dans les env vars (jamais commités) — voir README.
 */

export type PlanId = "free" | "pro" | "premium";
export type BillingCycle = "monthly" | "yearly";

export interface PlanDefinition {
  id: PlanId;
  name: string;
  tagline: string;
  /** Prix mensuel affiché en €. Info uniquement (Stripe fait foi côté paiement). */
  monthlyPrice: number;
  /** Prix annuel affiché en €. Doit correspondre au Price ID Stripe. */
  yearlyPrice: number;
  /** Nombre de jours d'essai gratuit (branché sur Stripe subscription_data.trial_period_days). */
  trialDays: number;
  features: string[];
  highlight?: boolean;
}

/**
 * Définition CANONIQUE des plans. Modifiez ici ET dans le Stripe Dashboard.
 * Une CI check (à ajouter) pourra vérifier que les env `STRIPE_PRICE_ID_*`
 * pointent bien vers ces montants côté Stripe.
 */
export const PLANS: Record<PlanId, PlanDefinition> = {
  free: {
    id: "free",
    name: "Gratuit",
    tagline: "Pour démarrer votre présence en ligne",
    monthlyPrice: 0,
    yearlyPrice: 0,
    trialDays: 0,
    features: [
      "Page vitrine personnalisée",
      "Boutons contact & WhatsApp",
      "Galerie photos",
      "QR Code imprimable",
      "3 articles de blog SEO",
      "FAQ personnalisable",
    ],
  },
  pro: {
    id: "pro",
    name: "Pro",
    tagline: "Pour développer votre activité",
    monthlyPrice: 29,
    yearlyPrice: 278, // = 29 * 12 * 0.8 (2 mois offerts)
    trialDays: 14,
    features: [
      "Tout du Gratuit",
      "Réservation en ligne 24/7",
      "Devis & signature électronique",
      "Paiements Stripe / Apple Pay",
      "CRM clients complet",
      "4 templates de vitrine",
      "Blog illimité",
      "Rappels email automatiques",
    ],
    highlight: true,
  },
  premium: {
    id: "premium",
    name: "Premium",
    tagline: "L'expérience complète, sans limite",
    monthlyPrice: 79,
    yearlyPrice: 758,
    trialDays: 14,
    features: [
      "Tout du Pro",
      "Assistant IA 24/7",
      "Programme de fidélité clients",
      "Marque blanche (sans logo Vitrix)",
      "7 templates dont 3 exclusifs",
      "Rappels SMS & WhatsApp",
      "Statistiques avancées",
      "Support prioritaire",
    ],
  },
};

/**
 * Renvoie les plans dans l'ordre d'affichage (free → pro → premium)
 * avec le calcul des économies annuelles.
 */
export function getDisplayPlans() {
  return (["free", "pro", "premium"] as const).map((id) => {
    const p = PLANS[id];
    const yearlySavings = p.monthlyPrice * 12 - p.yearlyPrice;
    return {
      ...p,
      yearlySavings, // en €
      effectiveMonthly: p.yearlyPrice > 0 ? p.yearlyPrice / 12 : 0,
    };
  });
}

/**
 * Renvoie le Price ID Stripe correspondant à un couple (plan, billing).
 * Retourne `null` si non configuré (dev sans clés Stripe).
 */
export function getStripePriceId(plan: PlanId, billing: BillingCycle): string | null {
  if (plan === "free") return null;
  const key = `STRIPE_PRICE_ID_${plan.toUpperCase()}_${billing.toUpperCase()}` as const;
  const v = process.env[key];
  return v && v.trim().length > 0 ? v : null;
}

/**
 * Renvoie le prix en cents attendu par Stripe (utile pour vérifs post-webhook).
 */
export function getPriceCents(plan: PlanId, billing: BillingCycle): number {
  const p = PLANS[plan];
  const eur = billing === "yearly" ? p.yearlyPrice : p.monthlyPrice;
  return Math.round(eur * 100);
}

/**
 * Décrit une durée de grace period pour un plan.
 * Grace period = combien de temps on maintient l'accès après un échec de paiement
 * avant de downgrader vers free. Standard SaaS : 3 à 7 jours.
 */
export const GRACE_PERIOD_DAYS: Record<Exclude<PlanId, "free">, number> = {
  pro: 3,
  premium: 7, // Premium plus tolérant : churn payant plus douloureux
};
