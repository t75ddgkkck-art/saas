import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { cancelSubscriptionAtPeriodEnd, isStripeConfigured } from "@/lib/stripe";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

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

  if (!user.stripeSubscriptionId) {
    return NextResponse.json(
      { error: "Aucun abonnement actif" },
      { status: 400 }
    );
  }

  try {
    await cancelSubscriptionAtPeriodEnd(user.stripeSubscriptionId);

    await db
      .update(users)
      .set({ stripeSubscriptionId: null, subscription: "free" })
      .where(eq(users.id, user.id));

    return NextResponse.json({
      success: true,
      message: "Abonnement annulé. Vous conservez vos avantages jusqu'à la fin de la période payée.",
      endOfPeriod: true,
    });
  } catch (error: any) {
    console.error("Cancel subscription error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
