import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createSubscriptionSession, isStripeConfigured } from "@/lib/stripe";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: "Stripe n'est pas configuré. Contactez le support." },
      { status: 503 }
    );
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { plan, billing } = body;

    if (!plan || !billing) {
      return NextResponse.json({ error: "plan et billing requis" }, { status: 400 });
    }

    if (!["pro", "premium"].includes(plan)) {
      return NextResponse.json({ error: "Plan invalide" }, { status: 400 });
    }

    if (!["monthly", "yearly"].includes(billing)) {
      return NextResponse.json({ error: "Billing invalide" }, { status: 400 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.vitrix.fr";

    const session = await createSubscriptionSession({
      userId: user.id,
      plan,
      billing,
      successUrl: `${appUrl}/dashboard/settings?tab=abonnement&checkout=success`,
      cancelUrl: `${appUrl}/dashboard/settings?tab=abonnement&checkout=cancelled`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error("Subscribe error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
