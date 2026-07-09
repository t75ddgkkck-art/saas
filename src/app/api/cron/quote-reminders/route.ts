import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { quotes, clients, businesses } from "@/db/schema";
import { eq, and, lte } from "drizzle-orm";

export const dynamic = "force-dynamic";

// This endpoint should be called by a cron job (e.g., Vercel Cron, GitHub Actions, etc.)
// Schedule: every day at 9 AM
// It checks for quotes that were sent more than 7 days ago and are still pending

async function handler(request: NextRequest) {
  // In production, verify the cron secret
  // Accepte le header Vercel Cron (Authorization: Bearer) OU x-cron-secret (appels manuels)
  const authHeader = request.headers.get("authorization");
  const cronSecret = request.headers.get("x-cron-secret");
  if (process.env.CRON_SECRET) {
    const validBearer = authHeader === `Bearer ${process.env.CRON_SECRET}`;
    const validHeader = cronSecret === process.env.CRON_SECRET;
    if (!validBearer && !validHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Get all pending/sent quotes older than 7 days
    const oldQuotes = await db
      .select()
      .from(quotes)
      .where(
        and(
          eq(quotes.status, "sent"),
          lte(quotes.updatedAt, sevenDaysAgo)
        )
      );

    const results = [];

    for (const quote of oldQuotes) {
      // Get client info
      let clientInfo = null;
      if (quote.clientId) {
        const clientResult = await db
          .select()
          .from(clients)
          .where(eq(clients.id, quote.clientId))
          .limit(1);
        if (clientResult.length > 0) {
          clientInfo = clientResult[0];
        }
      }

      // Get business info
      const bizResult = await db
        .select()
        .from(businesses)
        .where(eq(businesses.id, quote.businessId))
        .limit(1);
      const biz = bizResult[0];

      // In production, send email/SMS/WhatsApp here
      // For now, just log the reminder
      const reminder = {
        quoteId: quote.id,
        quoteNumber: quote.quoteNumber,
        clientName: clientInfo ? `${clientInfo.firstName} ${clientInfo.lastName}` : "Client",
        clientEmail: clientInfo?.email,
        clientPhone: clientInfo?.phone,
        businessName: biz?.name,
        message: `Bonjour ${clientInfo?.firstName || "client"}, votre devis ${quote.quoteNumber} est toujours en attente. N'hésitez pas à nous contacter si vous avez des questions.`,
        sent: false, // Would be true if email/SMS was sent
      };

      results.push(reminder);
      console.log(`[Reminder] Devis ${quote.quoteNumber} pour ${reminder.clientName}`);

      // TODO: In production, uncomment to send actual reminders:
      // if (clientInfo?.email) {
      //   await sendEmail({
      //     to: clientInfo.email,
      //     subject: `Rappel: Devis ${quote.quoteNumber} en attente`,
      //     body: reminder.message,
      //   });
      // }
      // if (clientInfo?.phone && biz?.subscription === "premium") {
      //   await sendSMS({
      //     to: clientInfo.phone,
      //     body: reminder.message,
      //   });
      // }
    }

    return NextResponse.json({
      success: true,
      remindersSent: results.length,
      reminders: results,
    });
  } catch (error: any) {
    console.error("Cron job error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}


// Vercel Cron appelle en GET ; on accepte aussi POST pour les appels manuels
export async function GET(request: NextRequest) {
  return handler(request);
}

export async function POST(request: NextRequest) {
  return handler(request);
}
