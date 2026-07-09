import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { businesses } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { checkRateLimit } from "@/lib/rate-limit";
import { handleApiError, badRequest, notFound } from "@/lib/api-error";
import { validateBody } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

const RATE = { key: "stripe-checkout", limit: 20, windowSec: 60 } as const;

const Schema = z.object({
  businessSlug: z.string().trim().min(1).max(150),
  amount: z.number().positive("Montant invalide").max(10000, "Montant maximum dépassé"),
  description: z.string().trim().max(500).optional(),
});

export async function POST(request: NextRequest) {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "Stripe non configuré" }, { status: 503 });
  }

  const rl = checkRateLimit(request, RATE);
  if (!rl.ok) return rl.response;

  try {
    const { businessSlug, amount, description } = await validateBody(request, Schema);

    const [business] = await db
      .select()
      .from(businesses)
      .where(eq(businesses.slug, businessSlug))
      .limit(1);
    if (!business) throw notFound("Professionnel introuvable");

    if (!business.enableStripe || !business.stripeAccountId) {
      throw badRequest("Ce professionnel n'a pas connecté Stripe");
    }

    const stripe = getStripe();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.vitrix.fr";

    const session = await stripe.checkout.sessions.create(
      {
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "eur",
              product_data: {
                name: description || `Paiement ${business.name}`,
              },
              unit_amount: Math.round(amount * 100),
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        success_url: `${appUrl}/${businessSlug}?payment=success`,
        cancel_url: `${appUrl}/${businessSlug}?payment=cancelled`,
        metadata: {
          businessId: business.id,
          description: description || "",
        },
      },
      { stripeAccount: business.stripeAccountId }
    );

    return NextResponse.json({ url: session.url });
  } catch (err) {
    return handleApiError(err, { route: "POST /api/stripe/checkout" });
  }
}
