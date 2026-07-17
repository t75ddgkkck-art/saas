import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/session";
import { createSubscriptionSession, isStripeConfigured } from "@/lib/stripe";
import { handleApiError, unauthorized } from "@/lib/api-error";
import { validateBody } from "@/lib/api-helpers";
import { checkRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const Schema = z.object({
  plan: z.enum(["pro", "premium"]),
  billing: z.enum(["monthly", "yearly"]),
});

export async function POST(request: NextRequest) {
  // Lot 63 SEC3 : 10 checkouts/h → largement suffisant (un user légitime
  // en crée 1 puis paie/annule, pas 10 dans l'heure). Empêche spam à coût
  // Stripe (chaque call = 1 création session côté Stripe API).
  const rl = checkRateLimit(request, { key: "subscribe-post", limit: 10, windowSec: 3600 });
  if (!rl.ok) return rl.response;

  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: "Stripe n'est pas configuré. Contactez le support." },
      { status: 503 }
    );
  }

  try {
    const user = await getCurrentUser();
    if (!user) throw unauthorized();

    const { plan, billing } = await validateBody(request, Schema);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.vitrix.fr";

    const session = await createSubscriptionSession({
      userId: user.id,
      plan,
      billing,
      successUrl: `${appUrl}/dashboard/settings?tab=abonnement&checkout=success`,
      cancelUrl: `${appUrl}/dashboard/settings?tab=abonnement&checkout=cancelled`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    return handleApiError(err, { route: "POST /api/subscribe" });
  }
}
