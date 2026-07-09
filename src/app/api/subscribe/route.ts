import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/session";
import { createSubscriptionSession, isStripeConfigured } from "@/lib/stripe";
import { handleApiError, unauthorized } from "@/lib/api-error";
import { validateBody } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

const Schema = z.object({
  plan: z.enum(["pro", "premium"]),
  billing: z.enum(["monthly", "yearly"]),
});

export async function POST(request: NextRequest) {
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
