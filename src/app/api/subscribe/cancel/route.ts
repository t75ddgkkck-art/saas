import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { cancelSubscriptionAtPeriodEnd, isStripeConfigured } from "@/lib/stripe";
import { handleApiError, badRequest, unauthorized } from "@/lib/api-error";

export const dynamic = "force-dynamic";

export async function POST() {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: "Stripe n'est pas configuré. Contactez le support." },
      { status: 503 }
    );
  }

  try {
    const user = await getCurrentUser();
    if (!user) throw unauthorized();

    if (!user.stripeSubscriptionId) {
      throw badRequest("Aucun abonnement actif");
    }

    await cancelSubscriptionAtPeriodEnd(user.stripeSubscriptionId);

    // On garde stripeSubscriptionId pour référence, on downgrade uniquement à la fin de période
    // via le webhook customer.subscription.deleted. Ici on ne fait qu'annuler côté Stripe.
    // NB: la version précédente forçait subscription="free" immédiatement, c'est un bug UX.
    // On laisse le webhook s'en occuper à la fin de la période payée.

    return NextResponse.json({
      success: true,
      message: "Abonnement annulé. Vous conservez vos avantages jusqu'à la fin de la période payée.",
      endOfPeriod: true,
    });
  } catch (err) {
    return handleApiError(err, { route: "POST /api/subscribe/cancel" });
  }
}
