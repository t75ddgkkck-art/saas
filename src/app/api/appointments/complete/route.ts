import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { appointments, clients, reviewRequests } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { getCurrentBusiness } from "@/lib/session";
import { sendEmail } from "@/lib/email";
import { handleApiError, unauthorized, notFound, forbidden } from "@/lib/api-error";
import { validateBody } from "@/lib/api-helpers";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const Schema = z.object({
  appointmentId: z.string().uuid("appointmentId invalide"),
});

// Marquer un RDV comme terminé → déclenche la demande d'avis automatique (si activée)
export async function POST(request: NextRequest) {
  try {
    const business = await getCurrentBusiness();
    if (!business) throw unauthorized();

    const { appointmentId } = await validateBody(request, Schema);

    const [apt] = await db
      .select()
      .from(appointments)
      .where(and(eq(appointments.id, appointmentId), eq(appointments.businessId, business.id)))
      .limit(1);
    if (!apt) throw notFound("Rendez-vous introuvable");
    // Sécurité en défense en profondeur (le WHERE ci-dessus filtre déjà, mais on ne sait jamais)
    if (apt.businessId !== business.id) throw forbidden();

    await db
      .update(appointments)
      .set({ status: "completed", updatedAt: new Date() })
      .where(eq(appointments.id, appointmentId));

    let reviewRequested = false;

    if (business.autoReviewRequest) {
      const [client] = await db
        .select()
        .from(clients)
        .where(eq(clients.id, apt.clientId))
        .limit(1);
      if (client?.email) {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.vitrix.fr";
        try {
          await sendEmail({
            to: client.email,
            subject: `Comment s'est passée votre intervention avec ${business.name} ?`,
            html: `
              <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; text-align: center;">
                <div style="font-size: 40px;">⭐</div>
                <h1 style="color: #0f172a; font-size: 22px;">Votre avis compte !</h1>
                <p style="color: #64748b;">Bonjour ${client.firstName}, merci d'avoir fait appel à <strong>${business.name}</strong>.</p>
                <p style="color: #64748b;">Votre retour aide d'autres clients à trouver un professionnel de confiance. Cela ne prend que 30 secondes.</p>
                <a href="${appUrl}/${business.slug}" style="display: inline-block; background: #0f172a; color: white; padding: 14px 32px; border-radius: 12px; text-decoration: none; font-weight: 600; margin-top: 12px;">Laisser un avis</a>
                <p style="color: #94a3b8; font-size: 12px; margin-top: 24px;">${business.name} via Vitrix</p>
              </div>
            `,
          });
          await db.insert(reviewRequests).values({
            businessId: business.id,
            clientId: client.id,
            appointmentId: apt.id,
            channel: "email",
          });
          reviewRequested = true;
        } catch (mailErr) {
          logger.warn("appointment.complete.review_mail_failed", {
            appointmentId: apt.id,
            message: mailErr instanceof Error ? mailErr.message : String(mailErr),
          });
        }
      }
    }

    return NextResponse.json({ success: true, reviewRequested });
  } catch (err) {
    return handleApiError(err, { route: "POST /api/appointments/complete" });
  }
}
