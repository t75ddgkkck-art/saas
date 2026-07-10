/**
 * Cron : downgrade les users dont la grace period a expiré.
 *
 * Fréquence : 1× par jour (voir vercel.json cron)
 *
 * Cette route agit comme un filet de sécurité :
 *  - Normalement Stripe envoie `customer.subscription.deleted` à la fin de la
 *    grace period → notre webhook downgrade
 *  - Mais si le webhook a échoué (429 Stripe, DB down…), les users restent
 *    en grace period infinie → ce cron rattrape
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { and, eq, isNotNull, lte, ne } from "drizzle-orm";
import { logger } from "@/lib/logger";
import { sendEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

function assertCronAuth(request: NextRequest): NextResponse | null {
  if (!process.env.CRON_SECRET) return null;
  const auth = request.headers.get("authorization");
  const custom = request.headers.get("x-cron-secret");
  const bearer = `Bearer ${process.env.CRON_SECRET}`;
  if (auth !== bearer && custom !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

async function handler(request: NextRequest): Promise<NextResponse> {
  const authErr = assertCronAuth(request);
  if (authErr) return authErr;

  try {
    const now = new Date();

    // Users en grace period expirée qui ne sont pas déjà free
    const expired = await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        subscription: users.subscription,
      })
      .from(users)
      .where(
        and(
          isNotNull(users.subscriptionExpiresAt),
          lte(users.subscriptionExpiresAt, now),
          ne(users.subscription, "free")
        )
      );

    let downgraded = 0;
    for (const u of expired) {
      // On downgrade individuellement (par id) pour être sûr de ne toucher
      // que les users listés (défense en profondeur contre une race condition
      // avec un webhook Stripe qui aurait entre-temps rétabli l'accès).
      await db
        .update(users)
        .set({
          subscription: "free",
          subscriptionStatus: "canceled",
          subscriptionExpiresAt: null,
        })
        .where(eq(users.id, u.id));
      downgraded++;

      // Email : "votre compte est repassé en Gratuit"
      if (u.email) {
        await sendEmail(
          {
            to: u.email,
            subject: "Votre compte Vitrix est repassé en Gratuit",
            html: `
              <div style="font-family: system-ui, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
                <h1 style="color: #0f172a; font-size: 20px;">Passage au plan Gratuit</h1>
                <p>Bonjour ${u.firstName},</p>
                <p>Faute de paiement, votre abonnement <strong>${u.subscription}</strong> a expiré et votre compte est revenu au plan Gratuit.</p>
                <p>Toutes vos données sont conservées : vous pouvez repasser Pro/Premium à tout moment depuis vos paramètres.</p>
                <p style="text-align: center; margin: 24px 0;">
                  <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://www.vitrix.fr"}/dashboard/settings?tab=abonnement" style="display: inline-block; background: #0f172a; color: #fff; padding: 10px 20px; border-radius: 10px; text-decoration: none; font-weight: 600;">
                    Réactiver mon abonnement
                  </a>
                </p>
              </div>
            `,
          },
          { category: "transactional" }
        );
      }

      logger.info("cron.grace_period.downgraded", {
        userId: u.id,
        previousPlan: u.subscription,
      });
    }

    return NextResponse.json({ success: true, downgraded });
  } catch (err) {
    logger.error("cron.grace_period.failed", {
      message: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: "cron_failed" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return handler(request);
}
export async function POST(request: NextRequest) {
  return handler(request);
}
