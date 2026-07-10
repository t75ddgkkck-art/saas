import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { logger } from "@/lib/logger";
import {
  handleCheckoutCompleted,
  handleSubscriptionUpdated,
  handleSubscriptionDeleted,
  handleInvoicePaymentFailed,
  handleInvoiceUpcoming,
  handleInvoicePaid,
  handleTrialWillEnd,
  handleDisputeCreated,
} from "@/lib/stripe-events";

export const dynamic = "force-dynamic";

/**
 * Webhook Stripe complet — traite 7 types d'événements clés.
 *
 * Sécurité :
 *  - Vérif signature via constructEvent (rejette toute requête falsifiée)
 *  - Body brut requis (jamais parsé par Next avant vérif)
 *
 * Idempotence :
 *  - Stripe retente automatiquement en cas de 5xx (jusqu'à 3 jours)
 *  - Nos handlers DB sont idempotents (UPDATE sur user_id)
 *  - On répond toujours 200 après traitement (même si logique interne échoue)
 *    → évite les boucles de retry sur des erreurs qu'un retry ne résoudrait pas
 */

const HANDLERS: Record<string, (event: Stripe.Event) => Promise<void>> = {
  "checkout.session.completed": handleCheckoutCompleted,
  "customer.subscription.updated": handleSubscriptionUpdated,
  "customer.subscription.deleted": handleSubscriptionDeleted,
  "customer.subscription.trial_will_end": handleTrialWillEnd,
  "invoice.paid": handleInvoicePaid,
  "invoice.payment_succeeded": handleInvoicePaid, // alias historique
  "invoice.payment_failed": handleInvoicePaymentFailed,
  "invoice.upcoming": handleInvoiceUpcoming,
  "charge.dispute.created": handleDisputeCreated,
};

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

  const handler = HANDLERS[event.type];
  if (!handler) {
    logger.debug("stripe.webhook.unhandled", { type: event.type });
    return NextResponse.json({ received: true, handled: false });
  }

  try {
    await handler(event);
    return NextResponse.json({ received: true, handled: true });
  } catch (err) {
    logger.error("stripe.webhook.processing_failed", {
      type: event.type,
      eventId: event.id,
      message: err instanceof Error ? err.message : String(err),
    });
    // 200 OK volontaire pour éviter les retry en boucle sur une erreur DB
    // qui ne sera pas résolue par un retry (ex: contrainte violée).
    // L'événement est loggué → resolution manuelle possible.
    return NextResponse.json({ received: true, warning: "processing_failed" });
  }
}
