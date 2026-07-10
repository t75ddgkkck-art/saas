import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createPortalSession, isStripeConfigured } from "@/lib/stripe";
import { handleApiError, badRequest, unauthorized } from "@/lib/api-error";

export const dynamic = "force-dynamic";

/**
 * POST /api/stripe/portal
 *
 * Ouvre le Stripe Customer Portal pour le user courant :
 *  - Mise à jour de la CB
 *  - Consultation de l'historique de factures + PDF
 *  - Annulation de l'abonnement (au lieu de le faire côté nous)
 *
 * → Renvoie { url } que le front redirige.
 */
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
    if (!user.stripeCustomerId) {
      throw badRequest("Aucun compte Stripe associé (souscrivez d'abord un plan payant).");
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.vitrix.fr";
    const session = await createPortalSession({
      customerId: user.stripeCustomerId,
      returnUrl: `${appUrl}/dashboard/settings?tab=abonnement`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    return handleApiError(err, { route: "POST /api/stripe/portal" });
  }
}
