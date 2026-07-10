import Stripe from "stripe";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getStripePriceId, PLANS, type PlanId, type BillingCycle } from "@/lib/plans";

// Initialisation Stripe sécurisée
let stripeInstance: Stripe | null = null;

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }
  if (!stripeInstance) {
    stripeInstance = new Stripe(key);
  }
  return stripeInstance;
}

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

// Connect Stripe pour un pro
export async function createStripeConnectAccount(userId: string) {
  const stripe = getStripe();
  return stripe.accounts.create({
    type: "standard",
    metadata: { userId },
  });
}

// Récupérer le compte Stripe du pro
export async function getBusinessStripeAccount(stripeAccountId: string) {
  const stripe = getStripe();
  return stripe.accounts.retrieve(stripeAccountId);
}

// Créer une session de paiement pour un client (paiement direct sur le compte du pro)
export async function createCheckoutSession(params: {
  businessStripeAccountId: string;
  businessSlug: string;
  amount: number;
  description: string;
  successUrl: string;
  cancelUrl: string;
}) {
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create(
    {
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: {
              name: params.description,
            },
            unit_amount: Math.round(params.amount * 100),
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      metadata: {
        businessSlug: params.businessSlug,
      },
    },
    {
      stripeAccount: params.businessStripeAccountId,
    }
  );
  return session;
}

// Créer une session d'abonnement (Pro / Premium)
export async function createSubscriptionSession(params: {
  userId: string;
  plan: Exclude<PlanId, "free">;
  billing: BillingCycle;
  successUrl: string;
  cancelUrl: string;
}) {
  const stripe = getStripe();

  const priceId = getStripePriceId(params.plan, params.billing);
  if (!priceId) {
    throw new Error(`Price not configured for ${params.plan}-${params.billing}`);
  }

  const user = await db.select().from(users).where(eq(users.id, params.userId)).limit(1);
  const userData = user[0];

  let customerId = userData?.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: userData?.email,
      metadata: { userId: params.userId },
    });
    customerId = customer.id;

    if (userData) {
      await db.update(users).set({ stripeCustomerId: customerId }).where(eq(users.id, params.userId));
    }
  }

  // Trial period : si le user n'a jamais eu de subscription active, on lui offre
  // le trial défini côté PLANS. S'il a déjà eu un trial, Stripe le refusera
  // silencieusement (protection contre l'abus).
  const trialDays = PLANS[params.plan].trialDays;
  const isFirstSubscription = !userData?.stripeSubscriptionId;

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    // Activation du trial UNIQUEMENT sur la 1ère souscription
    subscription_data:
      isFirstSubscription && trialDays > 0
        ? {
            trial_period_days: trialDays,
            trial_settings: {
              end_behavior: {
                // Si le user n'a pas mis de CB à la fin du trial → annulation
                // automatique (au lieu de facturer sans consentement clair)
                missing_payment_method: "cancel",
              },
            },
            metadata: { userId: params.userId, plan: params.plan },
          }
        : {
            metadata: { userId: params.userId, plan: params.plan },
          },
    // Force la collecte de la CB dès le trial (obligatoire pour trial + auto-charge)
    payment_method_collection: "always",
    // Permet au user de revoir/modifier ses infos billing depuis Stripe Portal
    billing_address_collection: "auto",
    // Métadonnées reprises côté webhook checkout.session.completed
    metadata: {
      userId: params.userId,
      plan: params.plan,
      billing: params.billing,
    },
    // URL de retour après paiement + lien vers le Customer Portal Stripe
    allow_promotion_codes: true,
  });

  return session;
}

/**
 * Ouvre le Customer Portal Stripe pour un user (facture, CB, historique).
 * → Zéro UI custom à maintenir, Stripe gère tout.
 */
export async function createPortalSession(params: {
  customerId: string;
  returnUrl: string;
}) {
  const stripe = getStripe();
  return stripe.billingPortal.sessions.create({
    customer: params.customerId,
    return_url: params.returnUrl,
  });
}

// Annuler un abonnement à la fin de la période
export async function cancelSubscriptionAtPeriodEnd(subscriptionId: string) {
  const stripe = getStripe();
  return stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: true,
  });
}
