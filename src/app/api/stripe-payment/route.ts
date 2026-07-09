import { NextRequest, NextResponse } from "next/server";

// Create a Stripe payment link for a quote
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { quoteId, amount, type, businessId, clientId } = body;

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: "Montant invalide" }, { status: 400 });
    }

    // If Stripe is configured, create a real payment link
    if (process.env.STRIPE_SECRET_KEY) {
      try {
        const stripe = (await import("stripe")).default;
        const stripeInstance = new stripe(process.env.STRIPE_SECRET_KEY!);

        // Create or get customer
        let customerId: string | undefined;
        if (clientId) {
          // In production, store Stripe customer IDs in the DB
        }

        // Create checkout session
        const session = await stripeInstance.checkout.sessions.create({
          payment_method_types: ["card"],
          line_items: [
            {
              price_data: {
                currency: "eur",
                product_data: {
                  name: type === "deposit" ? `Acompte - Devis ${quoteId || ""}` : `Paiement - Devis ${quoteId || ""}`,
                  description: type === "deposit" ? "Acompte pour reservation" : "Paiement total",
                },
                unit_amount: Math.round(amount * 100), // Stripe uses cents
              },
              quantity: 1,
            },
          ],
          mode: "payment",
          customer: customerId,
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
      } catch (stripeError: any) {
        console.error("Stripe error:", stripeError);
        // Fall through to demo mode
      }
    }

    // Demo mode: return a mock payment URL
    return NextResponse.json({
      success: true,
      paymentUrl: `https://checkout.stripe.com/pay/demo_${quoteId || "unknown"}`,
      sessionId: `demo_session_${Date.now()}`,
      mode: "demo",
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
