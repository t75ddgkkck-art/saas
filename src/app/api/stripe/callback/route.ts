import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { businesses } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentBusiness } from "@/lib/session";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.vitrix.fr";

  if (error) {
    logger.warn("stripe.connect.callback_error", { error });
    return NextResponse.redirect(`${appUrl}/dashboard/vitrine?stripe=error`);
  }
  if (!code) {
    return NextResponse.redirect(`${appUrl}/dashboard/vitrine?stripe=error`);
  }

  try {
    if (!isStripeConfigured()) {
      return NextResponse.redirect(`${appUrl}/dashboard/vitrine?stripe=error`);
    }

    const stripe = getStripe();
    const response = await stripe.oauth.token({
      grant_type: "authorization_code",
      code,
    });

    const business = await getCurrentBusiness();
    if (!business) {
      return NextResponse.redirect(`${appUrl}/dashboard/vitrine?stripe=error`);
    }

    await db
      .update(businesses)
      .set({
        stripeAccountId: response.stripe_user_id,
        enableStripe: true,
      })
      .where(eq(businesses.id, business.id));

    logger.info("stripe.connect.connected", {
      businessId: business.id,
      accountId: response.stripe_user_id,
    });

    return NextResponse.redirect(`${appUrl}/dashboard/vitrine?stripe=connected`);
  } catch (err) {
    logger.error("stripe.connect.callback_failed", {
      message: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.redirect(`${appUrl}/dashboard/vitrine?stripe=error`);
  }
}
