import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { quotes, clients, businesses, users } from "@/db/schema";
import { and, eq, isNull, lte, or } from "drizzle-orm";
import { sendEmail } from "@/lib/email";
import { sendSMS } from "@/lib/sms";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// Cron quotidien : relance les devis `sent` restés > 7 jours sans réponse.
// Déclenché par Vercel Cron (Authorization: Bearer $CRON_SECRET) ou manuellement
// via header `x-cron-secret`.

function assertCronAuth(request: NextRequest): NextResponse | null {
  if (!process.env.CRON_SECRET) return null; // dev / test
  const authHeader = request.headers.get("authorization");
  const cronSecret = request.headers.get("x-cron-secret");
  const validBearer = authHeader === `Bearer ${process.env.CRON_SECRET}`;
  const validHeader = cronSecret === process.env.CRON_SECRET;
  if (!validBearer && !validHeader) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

async function handler(request: NextRequest) {
  const authErr = assertCronAuth(request);
  if (authErr) return authErr;

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  try {
    // JOIN unique = 1 requête au lieu de N+1
    // Ne relance PAS un devis déjà relancé (reminder_sent_at IS NULL OR < now-7j)
    const rows = await db
      .select({
        quote: quotes,
        client: clients,
        business: businesses,
        ownerSubscription: users.subscription,
      })
      .from(quotes)
      .innerJoin(clients, eq(clients.id, quotes.clientId))
      .innerJoin(businesses, eq(businesses.id, quotes.businessId))
      .innerJoin(users, eq(users.id, businesses.ownerId))
      .where(
        and(
          eq(quotes.status, "sent"),
          lte(quotes.updatedAt, sevenDaysAgo),
          or(isNull(quotes.reminderSentAt), lte(quotes.reminderSentAt, sevenDaysAgo))
        )
      );

    let emailsSent = 0;
    let smsSent = 0;
    const errors: Array<{ quoteId: string; reason: string }> = [];

    for (const row of rows) {
      const { quote, client, business, ownerSubscription } = row;
      const clientFirstName = client.firstName || "client";
      const message = `Bonjour ${clientFirstName}, votre devis ${quote.quoteNumber} de ${business.name} est toujours en attente. N'hésitez pas à nous recontacter si vous avez des questions.`;

      try {
        if (client.email) {
          const r = await sendEmail({
            to: client.email,
            subject: `Rappel : devis ${quote.quoteNumber} en attente`,
            html: `
              <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
                <h1 style="color: #0f172a; font-size: 20px;">Votre devis vous attend</h1>
                <p>${message}</p>
                <p style="color: #94a3b8; font-size: 12px; margin-top: 24px;">${business.name}</p>
              </div>
            `,
          });
          if (r.success) emailsSent += 1;
        }

        // SMS uniquement pour les businesses avec option Premium activée
        if (
          client.phone &&
          ownerSubscription === "premium" &&
          business.reminderSmsEnabled
        ) {
          const r = await sendSMS({ to: client.phone, body: message });
          if (r.success) smsSent += 1;
        }

        // Marque le rappel envoyé pour ne pas répéter tous les jours
        await db
          .update(quotes)
          .set({ reminderSentAt: new Date() })
          .where(eq(quotes.id, quote.id));
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        errors.push({ quoteId: quote.id, reason });
        logger.warn("cron.quote-reminders.item_failed", { quoteId: quote.id, reason });
      }
    }

    logger.info("cron.quote-reminders.done", {
      candidates: rows.length,
      emailsSent,
      smsSent,
      errors: errors.length,
    });

    return NextResponse.json({
      success: true,
      candidates: rows.length,
      emailsSent,
      smsSent,
      errors,
    });
  } catch (err) {
    logger.error("cron.quote-reminders.failed", {
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
