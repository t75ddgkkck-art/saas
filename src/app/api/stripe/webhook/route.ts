import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Signature manquante" }, { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET non configuré");
    return NextResponse.json({ error: "Webhook non configuré" }, { status: 500 });
  }

  let event: Stripe.Event;

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err: any) {
    console.error("Webhook signature verification failed:", err.message);
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
          await db
            .update(users)
            .set({ subscription: plan })
            .where(eq(users.id, userId));

          console.log(`User ${userId} upgraded to ${plan}`);
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = data.object as Stripe.Subscription;
        const userId = subscription.metadata?.userId;

        if (subscription.status === "canceled" || subscription.status === "unpaid") {
          if (userId) {
            await db
              .update(users)
              .set({ subscription: "free" })
              .where(eq(users.id, userId));
            console.log(`User ${userId} downgraded to free`);
          }
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = data.object as Stripe.Subscription;
        const userId = subscription.metadata?.userId;

        if (userId) {
          await db
            .update(users)
            .set({ subscription: "free" })
            .where(eq(users.id, userId));
          console.log(`User ${userId} subscription deleted, downgraded to free`);
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${type}`);
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error("Webhook processing error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
