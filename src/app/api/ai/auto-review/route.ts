import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { appointments, reviews, businesses, clients } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentBusiness } from "@/lib/session";
import { requirePermission } from "@/lib/validation";
import { sendEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const { error } = await requirePermission("canAutoReviewRequest");
  if (error) return error;

  try {
    const body = await request.json();
    const { appointmentId } = body;

    if (!appointmentId) {
      return NextResponse.json(
        { error: "appointmentId requis" },
        { status: 400 }
      );
    }

    // Récupérer le RDV
    const appointment = await db
      .select()
      .from(appointments)
      .where(eq(appointments.id, appointmentId))
      .limit(1);

    if (!appointment.length) {
      return NextResponse.json(
        { error: "RDV introuvable" },
        { status: 404 }
      );
    }

    const apt = appointment[0];

    // Récupérer le client
    const client = await db
      .select()
      .from(clients)
      .where(eq(clients.id, apt.clientId))
      .limit(1);

    if (!client.length || !client[0].email) {
      return NextResponse.json(
        { error: "Client sans email" },
        { status: 400 }
      );
    }

    // Récupérer le business
    const business = await db
      .select()
      .from(businesses)
      .where(eq(businesses.id, apt.businessId))
      .limit(1);

    if (!business.length) {
      return NextResponse.json(
        { error: "Business introuvable" },
        { status: 404 }
      );
    }

    const biz = business[0];
    const cli = client[0];

    // Envoyer l'email de demande d'avis
    const emailResult = await sendEmail({
      to: cli.email || "",
      subject: `Comment s'est passé votre rendez-vous avec ${biz.name} ?`,
      html: `
        <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #0f172a;">Bonjour ${cli.firstName},</h1>
          <p>Votre rendez-vous avec <strong>${biz.name}</strong> a eu lieu le ${apt.date}.</p>
          <p>Nous aimerions connaître votre expérience !</p>
          <p style="text-align: center; margin: 30px 0;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL}/avis/${biz.slug}" 
               style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block;">
              Laisser un avis
            </a>
          </p>
          <p>Merci de votre confiance !</p>
          <p style="color: #64748b; font-size: 12px; margin-top: 30px;">
            ${biz.name} - ${biz.phone}
          </p>
        </div>
      `,
    });

    if (!emailResult.success) {
      return NextResponse.json(
        { error: "Erreur lors de l'envoi de l'email" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Email de demande d'avis envoyé",
    });
  } catch (error: any) {
    console.error("Auto review error:", error);
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}
