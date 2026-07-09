import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { checkRateLimit } from "@/lib/rate-limit";
import { handleApiError, badRequest } from "@/lib/api-error";
import { validateBody } from "@/lib/api-helpers";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const RATE = { key: "stripe-payment", limit: 20, windowSec: 60 } as const;

const Schema = z.object({
  quoteId: z.string().max(100).optional(),
  amount: z.number().positive().max(50000),
  type: z.enum(["deposit", "full"]).optional().default("full"),
  businessId: z.string().uuid().optional(),
  clientId: z.string().uuid().optional(),
});

// Crée un lien de paiement Stripe pour un devis.
// Note : quand Stripe n'est PAS configuré, on renvoie un mode démo (URL factice)
// pour ne pas bloquer le développement local. En prod, la variable est requise.
export async function POST(request: NextRequest) {
  const rl = checkRateLimit(request, RATE);
  if (!rl.ok) return rl.response;

  try {
    const { quoteId, amount, type, businessId, clientId } = await validateBody(
      request,
      Schema
    );

    if (isStripeConfigured()) {
      try {
        const stripe = getStripe();
        const session = await stripe.checkout.sessions.create({
          payment_method_types: ["card"],
          line_items: [
            {
              price_data: {
                currency: "eur",
                product_data: {
                  name:
                    type === "deposit"
                      ? `Acompte - Devis ${quoteId || ""}`
                      : `Paiement - Devis ${quoteId || ""}`,
                  description: type === "deposit" ? "Acompte pour réservation" : "Paiement total",
                },
                unit_amount: Math.round(amount * 100),
              },
              quantity: 1,
            },
          ],
          mode: "payment",
          metadata: {
            quoteId: quoteId || "",
            businessId: businessId || "",
            clientId: clientId || "",
            type: type || "full",
          },
          success_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/payment/cancel`,
        });

        return NextResponse.json({
          success: true,
          paymentUrl: session.url,
          sessionId: session.id,
        });
      } catch (stripeErr) {
        logger.error("stripe-payment.checkout_failed", {
          message: stripeErr instanceof Error ? stripeErr.message : String(stripeErr),
        });
        throw badRequest("Erreur lors de la création du paiement");
      }
    }

    // Mode démo (Stripe non configuré)
    logger.warn("stripe-payment.demo_mode", { quoteId });
    return NextResponse.json({
      success: true,
      paymentUrl: `https://checkout.stripe.com/pay/demo_${quoteId || "unknown"}`,
      sessionId: `demo_session_${Date.now()}`,
      mode: "demo",
    });
  } catch (err) {
    return handleApiError(err, { route: "POST /api/stripe-payment" });
  }
}
