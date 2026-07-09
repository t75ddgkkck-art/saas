import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// Singleton Stripe : évite d'instancier à chaque webhook (hot path).
let stripeSingleton: Stripe | null = null;
function getStripe(): Stripe {
  if (!stripeSingleton) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY missing");
    stripeSingleton = new Stripe(key);
  }
  return stripeSingleton;
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Signature manquante" }, { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    logger.error("stripe.webhook.missing_secret");
    return NextResponse.json({ error: "Webhook non configuré" }, { status: 500 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    logger.warn("stripe.webhook.signature_invalid", {
      message: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: "Signature invalide" }, { status: 400 });
  }

  try {
    const { type, data } = event;

    switch (type) {
      case "checkout.session.completed": {
        const session = data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        const plan = session.metadata?.plan;

        if (userId && (plan === "pro" || plan === "premium")) {
          await db.update(users).set({ subscription: plan }).where(eq(users.id, userId));
          logger.info("stripe.subscription.upgraded", { userId, plan });
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = data.object as Stripe.Subscription;
        const userId = subscription.metadata?.userId;

        if (
          userId &&
          (subscription.status === "canceled" || subscription.status === "unpaid")
        ) {
          await db.update(users).set({ subscription: "free" }).where(eq(users.id, userId));
          logger.info("stripe.subscription.downgraded", { userId, reason: subscription.status });
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = data.object as Stripe.Subscription;
        const userId = subscription.metadata?.userId;

        if (userId) {
          await db
            .update(users)
            .set({ subscription: "free", stripeSubscriptionId: null })
            .where(eq(users.id, userId));
          logger.info("stripe.subscription.deleted", { userId });
        }
        break;
      }

      default:
        logger.debug("stripe.webhook.unhandled", { type });
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    logger.error("stripe.webhook.processing_failed", {
      message: err instanceof Error ? err.message : String(err),
      type: event.type,
    });
    // On renvoie 200 quand même pour éviter que Stripe ne retente en boucle
    // sur une erreur DB que le retry ne résoudra pas. Le log permet le fix manuel.
    return NextResponse.json({ received: true, warning: "processing_failed" });
  }
}
