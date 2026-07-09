import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { appointments, businesses, clients } from "@/db/schema";
import { eq, gte, lte, and } from "drizzle-orm";

export const dynamic = "force-dynamic";

// Envoyer des rappels de RDV 24h avant (SMS/WhatsApp)
export async function GET(request: NextRequest) {
  // Sécurité simple (à renforcer avec un secret en prod)
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0];

    // Récupérer les RDV de demain
    const appts = await db.select({
      id: appointments.id,
      date: appointments.date,
      startTime: appointments.startTime,
      clientId: appointments.clientId,
      businessId: appointments.businessId,
      businessName: businesses.name,
      reminderSmsEnabled: businesses.reminderSmsEnabled,
      reminderWhatsappEnabled: businesses.reminderWhatsappEnabled,
      clientPhone: clients.phone,
      clientFirstName: clients.firstName,
    })
    .from(appointments)
    .innerJoin(businesses, eq(appointments.businessId, businesses.id))
    .innerJoin(clients, eq(appointments.clientId, clients.id))
    .where(and(eq(appointments.date, tomorrowStr), eq(appointments.status, 'confirmed'))); // Supposons un statut 'confirmed'

    let sentCount = 0;
    for (const apt of appts) {
      const message = `Bonjour ${apt.clientFirstName}, rappel de votre RDV chez ${apt.businessName} demain à ${apt.startTime}. À bientôt !`;
      
      // Simulation d'envoi (à remplacer par Twilio/WhatsApp API)
      if (apt.reminderSmsEnabled || apt.reminderWhatsappEnabled) {
        console.log(`[RAPPEL] Envoi à ${apt.clientPhone}: ${message}`);
        // Ici: appel API Twilio ou WhatsApp Business
        sentCount++;
      }
    }

    return NextResponse.json({ success: true, remindersSent: sentCount });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Vercel Cron appelle en GET
export async function POST(request: NextRequest) {
  return GET(request);
}
