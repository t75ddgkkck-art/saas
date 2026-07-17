import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { appointments, clients } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { getCurrentBusiness } from "@/lib/session";
import { requirePermission } from "@/lib/validation";
import { sendEmail } from "@/lib/email";
import { handleApiError, unauthorized, badRequest, notFound } from "@/lib/api-error";
import { validateBody } from "@/lib/api-helpers";
import { logger } from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const Schema = z.object({
  appointmentId: z.string().uuid("appointmentId invalide"),
});

export async function POST(request: NextRequest) {
  // Lot 64 : 30 emails d'avis/h — chaque call envoie un email au client (coût
  // Resend + potentiel spam). 30/h = un pro très actif fait 3-5 demandes/h.
  const rl = checkRateLimit(request, { key: "ai-auto-review", limit: 30, windowSec: 3600 });
  if (!rl.ok) return rl.response;

  const perm = await requirePermission("canAutoReviewRequest");
  if (perm.error) return perm.error;

  try {
    const business = await getCurrentBusiness();
    if (!business) throw unauthorized();

    const { appointmentId } = await validateBody(request, Schema);

    // Fix IDOR : vérifier l'appartenance du RDV au business courant
    const [apt] = await db
      .select()
      .from(appointments)
      .where(and(eq(appointments.id, appointmentId), eq(appointments.businessId, business.id)))
      .limit(1);
    if (!apt) throw notFound("RDV introuvable");

    const [client] = await db.select().from(clients).where(eq(clients.id, apt.clientId)).limit(1);
    if (!client?.email) throw badRequest("Client sans email");

    const emailResult = await sendEmail({
      to: client.email,
      subject: `Comment s'est passé votre rendez-vous avec ${business.name} ?`,
      html: `
        <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #0f172a;">Bonjour ${client.firstName},</h1>
          <p>Votre rendez-vous avec <strong>${business.name}</strong> a eu lieu le ${apt.date}.</p>
          <p>Nous aimerions connaître votre expérience !</p>
          <p style="text-align: center; margin: 30px 0;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://www.vitrix.fr"}/${business.slug}"
               style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block;">
              Laisser un avis
            </a>
          </p>
          <p>Merci de votre confiance !</p>
          <p style="color: #64748b; font-size: 12px; margin-top: 30px;">
            ${business.name}${business.phone ? " — " + business.phone : ""}
          </p>
        </div>
      `,
    });

    if (!emailResult.success) {
      logger.warn("ai.auto-review.email_failed", { appointmentId });
      throw new Error("Erreur lors de l'envoi de l'email");
    }

    return NextResponse.json({ success: true, message: "Email de demande d'avis envoyé" });
  } catch (err) {
    return handleApiError(err, { route: "POST /api/ai/auto-review" });
  }
}
