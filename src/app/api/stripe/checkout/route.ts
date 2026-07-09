import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { businesses } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getStripe, isStripeConfigured } from "@/lib/stripe";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "Stripe non configuré" }, { status: 503 });
  }

  try {
    const body = await request.json();
    const { businessSlug, amount, description } = body;

    if (!businessSlug) {
      return NextResponse.json({ error: "businessSlug requis" }, { status: 400 });
    }
    if (!amount || amount <= 0) {
      return NextResponse.json({ error: "Montant invalide" }, { status: 400 });
    }
    if (amount > 10000) {
      return NextResponse.json({ error: "Montant maximum dépassé" }, { status: 400 });
    }

    const biz = await db
      .select()
      .from(businesses)
      .where(eq(businesses.slug, businessSlug))
      .limit(1);

    if (!biz.length) {
      return NextResponse.json({ error: "Professionnel introuvable" }, { status: 404 });
    }

    const business = biz[0];

    if (!business.enableStripe || !business.stripeAccountId) {
      return NextResponse.json(
        { error: "Ce professionnel n'a pas connecté Stripe" },
        { status: 400 }
      );
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
      {
        stripeAccount: business.stripeAccountId,
      }
    );

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error("Stripe checkout error:", error);
    return NextResponse.json(
      { error: error.message || "Erreur lors de la création du paiement" },
      { status: 500 }
    );
  }
}
