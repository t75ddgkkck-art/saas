import Stripe from "stripe";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

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
  plan: "pro" | "premium";
  billing: "monthly" | "yearly";
  successUrl: string;
  cancelUrl: string;
}) {
  const stripe = getStripe();

  const priceMap: Record<string, string> = {
    "pro-monthly": process.env.STRIPE_PRICE_ID_PRO_MONTHLY || "",
    "pro-yearly": process.env.STRIPE_PRICE_ID_PRO_YEARLY || "",
    "premium-monthly": process.env.STRIPE_PRICE_ID_PREMIUM_MONTHLY || "",
    "premium-yearly": process.env.STRIPE_PRICE_ID_PREMIUM_YEARLY || "",
  };

  const priceId = priceMap[`${params.plan}-${params.billing}`];
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

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    metadata: {
      userId: params.userId,
      plan: params.plan,
      billing: params.billing,
    },
  });

  return session;
}

// Annuler un abonnement à la fin de la période
export async function cancelSubscriptionAtPeriodEnd(subscriptionId: string) {
  const stripe = getStripe();
  return stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: true,
  });
}
