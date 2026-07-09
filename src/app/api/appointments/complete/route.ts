import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { appointments, clients, reviewRequests, businesses } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentBusiness } from "@/lib/session";
import { sendEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

// Marquer un RDV comme terminé → déclenche la demande d'avis automatique (si activée)
export async function POST(request: NextRequest) {
  try {
    const business = await getCurrentBusiness();
    if (!business) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

    const body = await request.json();
    const { appointmentId } = body;
    if (!appointmentId) return NextResponse.json({ error: "appointmentId requis" }, { status: 400 });

    const aptResult = await db.select().from(appointments).where(eq(appointments.id, appointmentId)).limit(1);
    const apt = aptResult[0];
    if (!apt || apt.businessId !== business.id) {
      return NextResponse.json({ error: "Rendez-vous introuvable" }, { status: 404 });
    }

    await db.update(appointments).set({ status: "completed", updatedAt: new Date() }).where(eq(appointments.id, appointmentId));

    let reviewRequested = false;

    // Demande d'avis automatique (pilotage de réputation)
    if (business.autoReviewRequest) {
      const clientResult = await db.select().from(clients).where(eq(clients.id, apt.clientId)).limit(1);
      const client = clientResult[0];
      if (client?.email) {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.vitrix.fr";
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
      }
    }

    return NextResponse.json({ success: true, reviewRequested });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
