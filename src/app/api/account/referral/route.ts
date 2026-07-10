/**
 * GET /api/account/referral
 * Retourne le code parrain du user + les filleuls + le crédit accumulé.
 */

import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { and, count, eq, isNotNull, isNull, ne } from "drizzle-orm";
import { getCurrentUser } from "@/lib/session";
import { handleApiError, unauthorized } from "@/lib/api-error";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) throw unauthorized();

    // Compte total de filleuls (inscrits) + filleuls convertis (payants)
    const [{ total }] = await db
      .select({ total: count() })
      .from(users)
      .where(and(eq(users.referredBy, user.id), isNull(users.deletedAt)));

    const [{ paid }] = await db
      .select({ paid: count() })
      .from(users)
      .where(
        and(
          eq(users.referredBy, user.id),
          isNull(users.deletedAt),
          isNotNull(users.stripeSubscriptionId),
          ne(users.subscription, "free")
        )
      );

    return NextResponse.json({
      referralCode: user.referralCode,
      // URL de partage pré-formatée
      shareUrl: user.referralCode
        ? `${process.env.NEXT_PUBLIC_APP_URL || "https://www.vitrix.fr"}/register?ref=${user.referralCode}`
        : null,
      creditMonths: user.referralCreditMonths,
      stats: {
        totalReferred: Number(total),
        paidReferred: Number(paid),
      },
    });
  } catch (err) {
    return handleApiError(err, { route: "GET /api/account/referral" });
  }
}
