import { NextResponse } from "next/server";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.vitrix.fr";

  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: "Stripe n'est pas configuré. Contactez le support." },
      { status: 503 }
    );
  }

  try {
    const stripe = getStripe();
    const url = await stripe.oauth.authorizeUrl({
      redirect_uri: `${appUrl}/api/stripe/callback`,
      response_type: "code",
    });
    return NextResponse.redirect(url);
  } catch (err) {
    logger.error("stripe.connect.authorize_failed", {
      message: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.redirect(`${appUrl}/dashboard/vitrine?stripe=error`);
  }
}
