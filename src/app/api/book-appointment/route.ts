import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import {
  clients,
  appointments,
  availabilitySlots,
  businesses,
  users,
  notifications,
  teamMembers,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { sendEmail, EmailTemplates } from "@/lib/email";
import { formatLocaleDate, type Lang } from "@/lib/i18n";
import { checkRateLimit } from "@/lib/rate-limit";
import { badRequest, handleApiError, notFound } from "@/lib/api-error";
import { validateBody } from "@/lib/api-helpers";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// Anti-spam : 5 réservations / 10min / IP.
// (Une vraie personne ne réserve jamais 5 RDV en 10 min.)
const RATE = { key: "book-appointment", limit: 5, windowSec: 600 } as const;

const Schema = z
  .object({
    businessId: z.string().uuid().optional(),
    businessSlug: z.string().trim().max(150).optional(),
    firstName: z.string().trim().min(1).max(100),
    lastName: z.string().trim().max(100).optional().default(""),
    phone: z.string().trim().min(6).max(30),
    email: z.string().trim().toLowerCase().email("Email invalide"),
    notes: z.string().trim().max(2000).optional().default(""),
    service: z.string().trim().max(200).optional().default(""),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date attendue au format YYYY-MM-DD"),
    startTime: z.string().regex(/^\d{2}:\d{2}$/, "Heure attendue au format HH:MM"),
    endTime: z
      .string()
      .regex(/^\d{2}:\d{2}$/, "Heure attendue au format HH:MM")
      .optional(),
  })
  .refine((v) => v.businessId || v.businessSlug, {
    message: "businessId ou businessSlug requis",
    path: ["businessId"],
  });

export async function POST(request: NextRequest) {
  const rl = checkRateLimit(request, RATE);
  if (!rl.ok) return rl.response;

  try {
    const data = await validateBody(request, Schema);

    // Résoudre le business (par ID ou slug)
    const [business] = data.businessId
      ? await db.select().from(businesses).where(eq(businesses.id, data.businessId)).limit(1)
      : await db
          .select()
          .from(businesses)
          .where(eq(businesses.slug, data.businessSlug!))
          .limit(1);
    if (!business) throw notFound("Professionnel introuvable");

    // Vérif date pas dans le passé (basique, en TZ serveur)
    const now = new Date();
    const target = new Date(`${data.date}T${data.startTime}:00`);
    if (target.getTime() < now.getTime() - 60_000) {
      throw badRequest("Impossible de réserver un créneau passé.");
    }

    // Client : upsert par (phone, businessId)
    const [existing] = await db
      .select()
      .from(clients)
      .where(and(eq(clients.phone, data.phone), eq(clients.businessId, business.id)))
      .limit(1);

    let clientId: string;
    if (!existing) {
      const [c] = await db
        .insert(clients)
        .values({
          businessId: business.id,
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          phone: data.phone,
          source: "website",
          appointmentsCount: 1,
          lastContact: new Date(),
        })
        .returning();
      clientId = c.id;
    } else {
      clientId = existing.id;
      await db
        .update(clients)
        .set({
          firstName: data.firstName,
          lastName: data.lastName || existing.lastName,
          email: data.email || existing.email,
          appointmentsCount: (existing.appointmentsCount || 0) + 1,
          lastContact: new Date(),
        })
        .where(eq(clients.id, clientId));
    }

    // Marquer le créneau comme réservé si trouvé
    const [slot] = await db
      .select()
      .from(availabilitySlots)
      .where(
        and(
          eq(availabilitySlots.businessId, business.id),
          eq(availabilitySlots.date, data.date),
          eq(availabilitySlots.startTime, data.startTime)
        )
      )
      .limit(1);
    if (slot) {
      // Éviter les doubles réservations du même créneau (race condition minimale)
      if (slot.isBooked) throw badRequest("Ce créneau vient d'être réservé, choisissez-en un autre.");
      await db.update(availabilitySlots).set({ isBooked: true }).where(eq(availabilitySlots.id, slot.id));
    }

    // Créer le RDV
    const title = data.service || data.notes || `Rendez-vous — ${data.firstName} ${data.lastName}`.trim();
    const [startH, startM] = data.startTime.split(":").map(Number);
    const computedEnd =
      data.endTime ||
      `${String(startH + 1).padStart(2, "0")}:${String(startM).padStart(2, "0")}`;

    const [appointment] = await db
      .insert(appointments)
      .values({
        businessId: business.id,
        clientId,
        title,
        description: data.notes || data.service || null,
        date: data.date,
        startTime: data.startTime,
        endTime: computedEnd,
        status: "confirmed",
      })
      .returning();

    // ==== Automatisations (non bloquantes) ====
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.vitrix.fr";
    // Formatage de la date dans la langue configurée par le pro
    const dateLocalized = formatLocaleDate(
      `${data.date}T00:00:00`,
      (business.language as Lang | null) || "fr",
      { weekday: "long", day: "numeric", month: "long", year: "numeric" }
    );

    const jobs: Promise<unknown>[] = [];

    const loyaltyInfo = business.loyaltyEnabled
      ? `Programme fidélité : vous cumulez ${business.loyaltyPointsPerEuro || 1} point(s) par euro dépensé. ${business.loyaltyReward || ""}`
      : undefined;

    // Langue du client : celle configurée par le pro sur sa vitrine (fallback fr).
    // Ainsi une vitrine anglophone envoie ses confirmations en anglais.
    const emailLang = (business.language as "fr" | "en" | "es" | "de" | null) || "fr";

    const clientTemplate = EmailTemplates.bookingConfirmationClient({
      clientName: data.firstName,
      businessName: business.name,
      date: dateLocalized,
      time: data.startTime,
      service: data.service || data.notes || undefined,
      address: business.address
        ? `${business.address}${business.city ? ", " + business.city : ""}`
        : undefined,
      phone: business.phone || undefined,
      loyaltyInfo,
      lang: emailLang,
    });
    jobs.push(
      sendEmail({ to: data.email, subject: clientTemplate.subject, html: clientTemplate.html })
    );

    const [owner] = await db
      .select()
      .from(users)
      .where(eq(users.id, business.ownerId))
      .limit(1);
    if (owner?.email) {
      const proTemplate = EmailTemplates.newBookingPro({
        proName: owner.firstName,
        clientName: `${data.firstName} ${data.lastName}`.trim(),
        clientPhone: data.phone,
        clientEmail: data.email,
        date: dateLocalized,
        time: data.startTime,
        service: data.service || data.notes || undefined,
        dashboardLink: `${appUrl}/dashboard`,
      });
      jobs.push(
        sendEmail({ to: owner.email, subject: proTemplate.subject, html: proTemplate.html })
      );
      jobs.push(
        db.insert(notifications).values({
          userId: business.ownerId,
          businessId: business.id,
          type: "new_appointment",
          title: "Nouveau rendez-vous 📅",
          message: `${data.firstName} ${data.lastName} a réservé le ${dateLocalized} à ${data.startTime}${data.service ? ` — ${data.service}` : ""}`,
          data: { appointmentId: appointment.id },
        })
      );
    }

    const team = await db
      .select()
      .from(teamMembers)
      .where(eq(teamMembers.businessId, business.id));
    for (const member of team.filter((m) => m.active)) {
      const t = EmailTemplates.newBookingPro({
        proName: member.firstName,
        clientName: `${data.firstName} ${data.lastName}`.trim(),
        clientPhone: data.phone,
        clientEmail: data.email,
        date: dateLocalized,
        time: data.startTime,
        service: data.service || data.notes || undefined,
        dashboardLink: `${appUrl}/dashboard`,
      });
      jobs.push(sendEmail({ to: member.email, subject: t.subject, html: t.html }));
    }

    await Promise.allSettled(jobs);

    logger.info("booking.created", {
      appointmentId: appointment.id,
      businessId: business.id,
    });

    return NextResponse.json({
      success: true,
      message: "Rendez-vous confirmé ! Un email de confirmation vous a été envoyé.",
    });
  } catch (err) {
    return handleApiError(err, { route: "POST /api/book-appointment" });
  }
}
