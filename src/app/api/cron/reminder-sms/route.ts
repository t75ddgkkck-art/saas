import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { appointments, businesses, clients } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { sendSMS, sendWhatsApp } from "@/lib/sms";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

function assertCronAuth(request: NextRequest): NextResponse | null {
  if (!process.env.CRON_SECRET) return null;
  const authHeader = request.headers.get("authorization");
  const cronSecret = request.headers.get("x-cron-secret");
  if (
    authHeader !== `Bearer ${process.env.CRON_SECRET}` &&
    cronSecret !== process.env.CRON_SECRET
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

async function handler(request: NextRequest) {
  const authErr = assertCronAuth(request);
  if (authErr) return authErr;

  try {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0];

    const appts = await db
      .select({
        id: appointments.id,
        date: appointments.date,
        startTime: appointments.startTime,
        clientId: appointments.clientId,
        businessId: appointments.businessId,
        businessName: businesses.name,
        smsEnabled: businesses.reminderSmsEnabled,
        whatsappEnabled: businesses.reminderWhatsappEnabled,
        clientPhone: clients.phone,
        clientFirstName: clients.firstName,
      })
      .from(appointments)
      .innerJoin(businesses, eq(appointments.businessId, businesses.id))
      .innerJoin(clients, eq(appointments.clientId, clients.id))
      .where(and(eq(appointments.date, tomorrowStr), eq(appointments.status, "confirmed")));

    let smsSent = 0;
    let waSent = 0;
    const errors: Array<{ appointmentId: string; reason: string }> = [];

    for (const apt of appts) {
      if (!apt.clientPhone) continue;
      const message = `Bonjour ${apt.clientFirstName}, rappel de votre RDV chez ${apt.businessName} demain à ${apt.startTime}. À bientôt !`;

      try {
        if (apt.smsEnabled) {
          const r = await sendSMS({ to: apt.clientPhone, body: message });
          if (r.success) smsSent += 1;
        }
        if (apt.whatsappEnabled) {
          const r = await sendWhatsApp({ to: apt.clientPhone, body: message });
          if (r.success) waSent += 1;
        }
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        errors.push({ appointmentId: apt.id, reason });
      }
    }

    logger.info("cron.reminder-sms.done", {
      candidates: appts.length,
      smsSent,
      waSent,
      errors: errors.length,
    });

    return NextResponse.json({
      success: true,
      candidates: appts.length,
      smsSent,
      whatsappSent: waSent,
      errors,
    });
  } catch (err) {
    logger.error("cron.reminder-sms.failed", {
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
