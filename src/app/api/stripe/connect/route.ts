import { NextRequest, NextResponse } from "next/server";
import { getStripe, isStripeConfigured } from "@/lib/stripe";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: "Stripe n'est pas configuré. Contactez le support." },
      { status: 503 }
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.vitrix.fr";
  const redirectUri = `${appUrl}/api/stripe/callback`;

  try {
    const stripe = getStripe();
    const accountId = await stripe.oauth.authorizeUrl({
      redirect_uri: redirectUri,
      response_type: "code",
    });

    return NextResponse.redirect(accountId);
  } catch (error: any) {
    console.error("Stripe connect error:", error);
    return NextResponse.redirect(`${appUrl}/dashboard/vitrine?stripe=error`);
  }
}
