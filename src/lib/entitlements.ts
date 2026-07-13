/**
 * F1 (Lot 29) — Entitlements sémantiques centralisés.
 *
 * Pourquoi ce module ?
 * ---------------------
 * Avant : 15+ fichiers font `plan === "premium"` inline (voir grep pré-F1).
 * Ces checks divergent (blog gate ≠ ai-tools gate ≠ vitrine gate), personne
 * ne peut auditer d'un coup d'œil "qui a droit à quoi", et les 5 routes API
 * critiques (`/api/loyalty`, `/api/ai-chat`, `/api/ai/*`) ne gatent PAS
 * → n'importe quel user Free peut hit /api/loyalty POST → fuite de valeur.
 *
 * Après : une clé sémantique unique par feature (`loyalty.enable`, `ai.chat`),
 * une matrice `FEATURES` qui liste les plans autorisés, un guard API unique
 * `requireEntitlement(req, "ai.chat")` et un composant UI `<UpgradeGate>`.
 *
 * Ce module NE REMPLACE PAS `permissions.ts` (qui garde la matrice détaillée
 * `PLAN_PERMISSIONS` avec ~30 flags). Il l'AGRÈGE derrière des clés parlantes
 * pour la UI et les gates API.
 *
 * Conventions :
 * - Une feature = string kebab.dot (`domaine.action`)
 * - Les plans autorisés sont explicites (pas d'ordre implicite)
 * - Si un jour on ajoute "business" ou "enterprise", il suffit d'ajouter
 *   dans la matrice sans toucher les gates.
 */

import type { SubscriptionPlan } from "./permissions";
import { PLAN_PERMISSIONS } from "./permissions";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

/**
 * Liste FIGÉE des features gatable dans l'app.
 * Ajouter ici + dans FEATURES pour créer une nouvelle feature.
 * Le type est exhaustif : TS force à mettre à jour FEATURES si on ajoute.
 */
export type FeatureKey =
  // --- IA ---
  | "ai.chat" // chatbot conversationnel dashboard
  | "ai.blog" // génération d'articles blog
  | "ai.social_post" // posts réseaux sociaux
  | "ai.monthly_report" // rapport mensuel automatique
  | "ai.auto_review_reply" // réponse auto avis
  // --- Vitrine ---
  | "vitrine.custom_template" // choisir/personnaliser un template
  | "vitrine.hide_branding" // masquer "Powered by Vitrix"
  | "vitrine.custom_domain" // domaine perso
  // --- Business ---
  | "loyalty.enable" // programme fidélité
  | "payments.stripe" // encaisser via Stripe
  | "payments.apple_pay" // Apple Pay
  | "quotes.enable" // création devis
  | "quotes.ai_generation" // F8 (Lot 38) : génération IA des lignes de devis
  | "invoices.auto_generation" // F9 (Lot 42) : facture PDF auto-générée à la signature
  // --- Automatisations ---
  | "reminders.email" // rappels par email
  | "reminders.sms" // rappels SMS
  | "reminders.whatsapp" // rappels WhatsApp
  | "reviews.auto_request" // demande auto d'avis post-RDV
  // --- Équipe & Analytics ---
  | "team.enable" // inviter des membres
  | "analytics.advanced" // dashboard analytics avancé
  | "pdf.multi_template"; // plusieurs templates de PDF

export interface FeatureDefinition {
  /** Plans autorisés à utiliser cette feature. */
  plans: readonly SubscriptionPlan[];
  /** Libellé humain (FR) affiché dans les upgrade prompts. */
  label: string;
  /** Description courte (FR). */
  description: string;
  /** Plan MINIMUM à afficher dans un CTA upgrade ("Passez Pro"). */
  minPlan: Exclude<SubscriptionPlan, "free">;
}

// -----------------------------------------------------------------------------
// Matrice des features — SOURCE UNIQUE DE VÉRITÉ pour la UI et les gates
// -----------------------------------------------------------------------------

/**
 * Matrice principale. Cohérente avec `PLAN_PERMISSIONS` de permissions.ts
 * mais avec la sémantique CÔTÉ PRODUIT (pas côté attributs techniques).
 *
 * Si un plan doit changer d'accès → 1 seule ligne à modifier ici + la ligne
 * correspondante dans `PLAN_PERMISSIONS`. Un test snapshot fige la matrice
 * pour détecter les changements non intentionnels.
 */
export const FEATURES: Readonly<Record<FeatureKey, FeatureDefinition>> = {
  // --- IA ---
  "ai.chat": {
    plans: ["premium"],
    label: "Assistant IA conversationnel",
    description:
      "Répondez aux questions de vos clients 24/7 via un chatbot entraîné sur votre activité.",
    minPlan: "premium",
  },
  "ai.blog": {
    plans: ["pro", "premium"],
    label: "Génération d'articles de blog",
    description: "Créez des articles SEO en quelques secondes avec l'IA.",
    minPlan: "pro",
  },
  "ai.social_post": {
    plans: ["premium"],
    label: "Posts réseaux sociaux IA",
    description: "Générez posts Facebook, Instagram, LinkedIn à partir d'une description.",
    minPlan: "premium",
  },
  "ai.monthly_report": {
    plans: ["premium"],
    label: "Rapport mensuel IA",
    description: "Rapport d'activité mensuel synthétisé automatiquement.",
    minPlan: "premium",
  },
  "ai.auto_review_reply": {
    plans: ["premium"],
    label: "Réponse automatique aux avis",
    description: "L'IA rédige une réponse personnalisée à chaque nouvel avis.",
    minPlan: "premium",
  },

  // --- Vitrine ---
  "vitrine.custom_template": {
    plans: ["pro", "premium"],
    label: "Choix de template",
    description: "Personnalisez l'apparence de votre vitrine avec plusieurs designs.",
    minPlan: "pro",
  },
  "vitrine.hide_branding": {
    plans: ["premium"],
    label: "Marque blanche",
    description: 'Masquez la mention "Propulsé par Vitrix" sur votre vitrine.',
    minPlan: "premium",
  },
  "vitrine.custom_domain": {
    plans: ["premium"],
    label: "Domaine personnalisé",
    description: "Utilisez votre propre nom de domaine (mon-entreprise.fr).",
    minPlan: "premium",
  },

  // --- Business ---
  "loyalty.enable": {
    plans: ["premium"],
    label: "Programme de fidélité",
    description: "Récompensez vos clients avec un système de points personnalisable.",
    minPlan: "premium",
  },
  "payments.stripe": {
    plans: ["pro", "premium"],
    label: "Paiements en ligne",
    description: "Encaissez cartes, Apple Pay, virements directement depuis votre vitrine.",
    minPlan: "pro",
  },
  "payments.apple_pay": {
    plans: ["pro", "premium"],
    label: "Apple Pay",
    description: "Paiement en 1 tap depuis iPhone.",
    minPlan: "pro",
  },
  "quotes.enable": {
    plans: ["pro", "premium"],
    label: "Devis",
    description: "Créez, envoyez et suivez vos devis. Signature électronique incluse.",
    minPlan: "pro",
  },
  "quotes.ai_generation": {
    plans: ["premium"],
    label: "Génération de devis par IA",
    description:
      "Décrivez le chantier en une phrase, l'IA propose les lignes détaillées avec prix médians du marché.",
    minPlan: "premium",
  },
  "invoices.auto_generation": {
    plans: ["pro", "premium"],
    label: "Facture automatique",
    description:
      "À chaque signature de devis, une facture PDF numérotée (séquence légale) est générée et envoyée au client.",
    minPlan: "pro",
  },

  // --- Automatisations ---
  "reminders.email": {
    plans: ["pro", "premium"],
    label: "Rappels email automatiques",
    description: "Réduisez les no-show avec des rappels email 24h avant le RDV.",
    minPlan: "pro",
  },
  "reminders.sms": {
    plans: ["premium"],
    label: "Rappels SMS",
    description: "Rappels SMS 24h avant le RDV (budget mensuel inclus).",
    minPlan: "premium",
  },
  "reminders.whatsapp": {
    plans: ["premium"],
    label: "Rappels WhatsApp",
    description: "Rappels WhatsApp Business (canal préféré des clients français).",
    minPlan: "premium",
  },
  "reviews.auto_request": {
    plans: ["pro", "premium"],
    label: "Demande d'avis automatique",
    description: "Email de demande d'avis envoyé 24h après chaque RDV.",
    minPlan: "pro",
  },

  // --- Équipe & Analytics ---
  "team.enable": {
    plans: ["pro", "premium"],
    label: "Équipe multi-utilisateurs",
    description: "Invitez vos collaborateurs (2 sièges en Pro, illimité en Premium).",
    minPlan: "pro",
  },
  "analytics.advanced": {
    plans: ["pro", "premium"],
    label: "Analytics avancés",
    description: "Sources de trafic, funnel de conversion, comparatif mois.",
    minPlan: "pro",
  },
  "pdf.multi_template": {
    plans: ["pro", "premium"],
    label: "Plusieurs templates PDF",
    description: "3 templates PDF en Pro, 10 en Premium (devis / facture).",
    minPlan: "pro",
  },
};

// -----------------------------------------------------------------------------
// API programmatique
// -----------------------------------------------------------------------------

/**
 * Renvoie true si le plan a accès à la feature.
 * Utilisé par les gates UI (`useEntitlement`) et API (`requireEntitlement`).
 *
 * @example
 *   canUse("premium", "ai.chat") // true
 *   canUse("free", "loyalty.enable") // false
 */
export function canUse(plan: SubscriptionPlan, feature: FeatureKey): boolean {
  return FEATURES[feature].plans.includes(plan);
}

/**
 * Renvoie true si le plan a accès à N'IMPORTE LAQUELLE des features listées.
 * Utile pour afficher une section entière si au moins une feature est débloquée.
 */
export function canUseAny(plan: SubscriptionPlan, features: readonly FeatureKey[]): boolean {
  return features.some((f) => canUse(plan, f));
}

/**
 * Renvoie true si le plan a accès à TOUTES les features listées.
 */
export function canUseAll(plan: SubscriptionPlan, features: readonly FeatureKey[]): boolean {
  return features.every((f) => canUse(plan, f));
}

/**
 * Renvoie le plan minimum requis pour une feature.
 * Utilisé dans les CTA "Passez Pro/Premium".
 */
export function getRequiredPlan(feature: FeatureKey): Exclude<SubscriptionPlan, "free"> {
  return FEATURES[feature].minPlan;
}

/**
 * Renvoie la liste EXHAUSTIVE des features accessibles par un plan.
 * Utile pour affichage "Ce que vous avez avec votre plan" en dashboard.
 */
export function listEntitlements(plan: SubscriptionPlan): FeatureKey[] {
  return (Object.keys(FEATURES) as FeatureKey[]).filter((f) => canUse(plan, f));
}

/**
 * Renvoie la liste des features NON accessibles par un plan
 * (= arguments d'upsell).
 */
export function listMissingEntitlements(plan: SubscriptionPlan): FeatureKey[] {
  return (Object.keys(FEATURES) as FeatureKey[]).filter((f) => !canUse(plan, f));
}

/**
 * Snapshot compact pour /api/account/entitlements — un objet plan-user-agnostic
 * envoyable au client sans exposer la matrice complète.
 */
export interface EntitlementsSnapshot {
  plan: SubscriptionPlan;
  features: Record<FeatureKey, boolean>;
}

export function buildEntitlementsSnapshot(plan: SubscriptionPlan): EntitlementsSnapshot {
  const features = {} as Record<FeatureKey, boolean>;
  for (const key of Object.keys(FEATURES) as FeatureKey[]) {
    features[key] = canUse(plan, key);
  }
  return { plan, features };
}

// -----------------------------------------------------------------------------
// Ponts avec permissions.ts (limites numériques)
// -----------------------------------------------------------------------------

/**
 * Renvoie la limite numérique pour un plan (ex : `maxClients`).
 * `-1` = illimité. Alias de `PLAN_PERMISSIONS[plan][limit]` avec typage strict.
 */
export function getLimit(
  plan: SubscriptionPlan,
  limit:
    | "maxClients"
    | "maxServices"
    | "maxBlogPosts"
    | "maxTeamMembers"
    | "maxTemplates"
    | "maxPdfTemplates"
): number {
  return PLAN_PERMISSIONS[plan][limit] as number;
}

/**
 * Vérifie qu'un compteur actuel est sous la limite du plan.
 * Retourne `{ allowed, limit, remaining }`. Si `limit === -1` (illimité),
 * remaining vaut Infinity.
 */
export function checkQuota(
  plan: SubscriptionPlan,
  limit:
    | "maxClients"
    | "maxServices"
    | "maxBlogPosts"
    | "maxTeamMembers"
    | "maxTemplates"
    | "maxPdfTemplates",
  currentCount: number
): { allowed: boolean; limit: number; remaining: number } {
  const max = getLimit(plan, limit);
  if (max === -1) {
    return { allowed: true, limit: -1, remaining: Number.POSITIVE_INFINITY };
  }
  return {
    allowed: currentCount < max,
    limit: max,
    remaining: Math.max(0, max - currentCount),
  };
}
