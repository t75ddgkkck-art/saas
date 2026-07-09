import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { clients, appointments, availabilitySlots, businesses, users, notifications, teamMembers } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { sendEmail, EmailTemplates } from "@/lib/email";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { businessId, businessSlug, firstName, lastName, phone, email, notes, service, date, startTime, endTime } = body;

    if ((!businessId && !businessSlug) || !firstName || !phone || !date || !startTime) {
      return NextResponse.json({ error: "Champs requis manquants" }, { status: 400 });
    }

    // Email fortement recommandé pour recevoir la confirmation
    if (!email) {
      return NextResponse.json({ error: "L'email est requis pour recevoir votre confirmation de rendez-vous" }, { status: 400 });
    }

    // Résoudre le business (par ID ou slug)
    let business;
    if (businessId) {
      const r = await db.select().from(businesses).where(eq(businesses.id, businessId)).limit(1);
      business = r[0];
    } else {
      const r = await db.select().from(businesses).where(eq(businesses.slug, businessSlug)).limit(1);
      business = r[0];
    }
    if (!business) {
      return NextResponse.json({ error: "Professionnel introuvable" }, { status: 404 });
    }

    // Créer ou retrouver le client
    let clientResult = await db.select().from(clients)
      .where(and(eq(clients.phone, phone), eq(clients.businessId, business.id)))
      .limit(1);
    let clientId: string;

    if (clientResult.length === 0) {
      const [newClient] = await db.insert(clients).values({
        businessId: business.id, firstName, lastName: lastName || "",
        email: email || null, phone, source: "website",
        appointmentsCount: 1, lastContact: new Date(),
      }).returning();
      clientId = newClient.id;
    } else {
      clientId = clientResult[0].id;
      await db.update(clients).set({
        firstName, lastName: lastName || clientResult[0].lastName,
        email: email || clientResult[0].email,
        appointmentsCount: (clientResult[0].appointmentsCount || 0) + 1,
        lastContact: new Date(),
      }).where(eq(clients.id, clientId));
    }

    // Marquer le créneau comme réservé
    const slot = await db.select().from(availabilitySlots)
      .where(and(
        eq(availabilitySlots.businessId, business.id),
        eq(availabilitySlots.date, date),
        eq(availabilitySlots.startTime, startTime)
      )).limit(1);
    if (slot.length > 0) {
      await db.update(availabilitySlots).set({ isBooked: true }).where(eq(availabilitySlots.id, slot[0].id));
    }

    // Créer le RDV
    const title = service || notes || `Rendez-vous — ${firstName} ${lastName || ""}`.trim();
    const [appointment] = await db.insert(appointments).values({
      businessId: business.id, clientId,
      title,
      description: notes || service || null,
      date, startTime,
      endTime: endTime || `${String(parseInt(startTime.split(":")[0]) + 1).padStart(2, "0")}:${startTime.split(":")[1]}`,
      status: "confirmed",
    }).returning();

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.vitrix.fr";
    const dateFr = new Date(date + "T00:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

    // ===== AUTOMATISATIONS (non bloquantes) =====
    const automations: Promise<any>[] = [];

    // 1. Email de confirmation au CLIENT
    const loyaltyInfo = business.loyaltyEnabled
      ? `Programme fidélité : vous cumulez ${business.loyaltyPointsPerEuro || 1} point(s) par euro dépensé. ${business.loyaltyReward || ""}`
      : undefined;

    const clientTemplate = EmailTemplates.bookingConfirmationClient({
      clientName: firstName,
      businessName: business.name,
      date: dateFr,
      time: startTime,
      service: service || notes || undefined,
      address: business.address ? `${business.address}${business.city ? ", " + business.city : ""}` : undefined,
      phone: business.phone || undefined,
      loyaltyInfo,
    });
    automations.push(sendEmail({ to: email, subject: clientTemplate.subject, html: clientTemplate.html }));

    // 2. Email au PRO (nouveau RDV)
    const owner = await db.select().from(users).where(eq(users.id, business.ownerId)).limit(1);
    if (owner.length > 0 && owner[0].email) {
      const proTemplate = EmailTemplates.newBookingPro({
        proName: owner[0].firstName,
        clientName: `${firstName} ${lastName || ""}`.trim(),
        clientPhone: phone,
        clientEmail: email,
        date: dateFr,
        time: startTime,
        service: service || notes || undefined,
        dashboardLink: `${appUrl}/dashboard`,
      });
      automations.push(sendEmail({ to: owner[0].email, subject: proTemplate.subject, html: proTemplate.html }));

      // 3. Notification interne (cloche du dashboard)
      automations.push(
        db.insert(notifications).values({
          userId: business.ownerId,
          businessId: business.id,
          type: "new_appointment",
          title: "Nouveau rendez-vous 📅",
          message: `${firstName} ${lastName || ""} a réservé le ${dateFr} à ${startTime}${service ? ` — ${service}` : ""}`,
          data: { appointmentId: appointment.id },
        }).then(() => {})
      );
    }

    // 4. Notifier les membres d'équipe actifs (Premium)
    try {
      const team = await db.select().from(teamMembers)
        .where(eq(teamMembers.businessId, business.id));
      for (const member of team.filter(m => m.active)) {
        const teamTemplate = EmailTemplates.newBookingPro({
          proName: member.firstName,
          clientName: `${firstName} ${lastName || ""}`.trim(),
          clientPhone: phone,
          clientEmail: email,
          date: dateFr,
          time: startTime,
          service: service || notes || undefined,
          dashboardLink: `${appUrl}/dashboard`,
        });
        automations.push(sendEmail({ to: member.email, subject: teamTemplate.subject, html: teamTemplate.html }));
      }
    } catch { /* l'équipe ne doit jamais bloquer la réservation */ }

    // Exécuter toutes les automatisations sans bloquer la réponse
    await Promise.allSettled(automations);

    return NextResponse.json({
      success: true,
      message: "Rendez-vous confirmé ! Un email de confirmation vous a été envoyé.",
    });
  } catch (error: any) {
    console.error("Booking error:", error);
    return NextResponse.json({ error: error.message || "Erreur lors de la réservation" }, { status: 500 });
  }
}
