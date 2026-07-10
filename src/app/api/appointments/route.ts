/**
 * GET  /api/appointments — liste RDV du business courant (filtre soft delete)
 * POST /api/appointments — crée un RDV + upsert client à la volée
 *
 * Auth : session dashboard (getCurrentBusiness). Pour l'API publique v1
 * voir /api/v1/appointments (Lot 16).
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { appointments, clients } from "@/db/schema";
import { and, asc, eq, gte, isNull, lte } from "drizzle-orm";
import { getCurrentBusiness, getCurrentUser } from "@/lib/session";
import { checkRateLimit } from "@/lib/rate-limit";
import { validateBody } from "@/lib/api-helpers";
import { handleApiError, badRequest, unauthorized } from "@/lib/api-error";
import { dispatchWebhook } from "@/lib/webhooks-out";
// F4 (Lot 33) : push sync Google Calendar (best-effort, non-throwing)
import { pushCreateGoogleEvent } from "@/lib/google-calendar";

export const dynamic = "force-dynamic";

const StatusEnum = z.enum(["pending", "confirmed", "cancelled", "completed"]);

const CreateSchema = z.object({
  clientId: z.string().uuid().optional(),
  client: z
    .object({
      firstName: z.string().min(1).max(100),
      lastName: z.string().min(1).max(100),
      phone: z.string().min(4).max(20),
      email: z.string().email().max(255).optional(),
    })
    .optional(),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format attendu YYYY-MM-DD"),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Format attendu HH:MM"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "Format attendu HH:MM"),
  status: StatusEnum.default("confirmed"),
  // F4 (Lot 33) : assignation à un membre d'équipe (optionnel)
  assignedToUserId: z.string().uuid().nullable().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const business = await getCurrentBusiness();
    if (!business) throw unauthorized();

    // Filtres optionnels : ?from=YYYY-MM-DD&to=YYYY-MM-DD&status=...
    const url = new URL(req.url);
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const status = url.searchParams.get("status");

    const filters = [eq(appointments.businessId, business.id), isNull(appointments.deletedAt)];
    if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) filters.push(gte(appointments.date, from));
    if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) filters.push(lte(appointments.date, to));
    if (status && ["pending", "confirmed", "cancelled", "completed"].includes(status)) {
      filters.push(
        eq(appointments.status, status as "pending" | "confirmed" | "cancelled" | "completed")
      );
    }

    // On joint clients pour éviter N+1 côté UI
    const rows = await db
      .select({
        id: appointments.id,
        title: appointments.title,
        description: appointments.description,
        date: appointments.date,
        startTime: appointments.startTime,
        endTime: appointments.endTime,
        status: appointments.status,
        createdAt: appointments.createdAt,
        clientId: appointments.clientId,
        clientFirstName: clients.firstName,
        clientLastName: clients.lastName,
        clientPhone: clients.phone,
        // F4 : assignation et googleCalendarId pour la vue calendrier
        assignedToUserId: appointments.assignedToUserId,
        googleCalendarId: appointments.googleCalendarId,
      })
      .from(appointments)
      .leftJoin(clients, eq(clients.id, appointments.clientId))
      .where(and(...filters))
      // Tri chronologique croissant (calendrier + liste "à venir")
      .orderBy(asc(appointments.date), asc(appointments.startTime));

    return NextResponse.json({ appointments: rows });
  } catch (err) {
    return handleApiError(err, { route: "GET /api/appointments" });
  }
}

export async function POST(req: NextRequest) {
  const rl = checkRateLimit(req, {
    key: "appointments:create",
    limit: 60,
    windowSec: 3600,
  });
  if (!rl.ok) return rl.response;

  try {
    const user = await getCurrentUser();
    if (!user) throw unauthorized();
    const business = await getCurrentBusiness();
    if (!business) throw badRequest("Aucun business associé");

    const data = await validateBody(req, CreateSchema);

    // Résolution du client (id existant OU upsert par phone)
    let clientId: string | null = data.clientId ?? null;
    if (!clientId && data.client) {
      const [existing] = await db
        .select({ id: clients.id })
        .from(clients)
        .where(
          and(
            eq(clients.businessId, business.id),
            eq(clients.phone, data.client.phone),
            isNull(clients.deletedAt)
          )
        )
        .limit(1);
      if (existing) {
        clientId = existing.id;
      } else {
        const [created] = await db
          .insert(clients)
          .values({
            businessId: business.id,
            firstName: data.client.firstName,
            lastName: data.client.lastName,
            phone: data.client.phone,
            email: data.client.email ?? null,
            source: "other",
          })
          .returning({ id: clients.id });
        clientId = created.id;
      }
    }
    if (!clientId) throw badRequest("clientId ou client requis");

    // Anti-IDOR : le clientId doit appartenir au business
    if (data.clientId) {
      const [owned] = await db
        .select({ id: clients.id })
        .from(clients)
        .where(
          and(
            eq(clients.id, data.clientId),
            eq(clients.businessId, business.id),
            isNull(clients.deletedAt)
          )
        )
        .limit(1);
      if (!owned) throw badRequest("Client introuvable");
    }

    // Cohérence horaire minimale (endTime > startTime)
    if (data.endTime <= data.startTime) {
      throw badRequest("L'heure de fin doit être après l'heure de début");
    }

    const [created] = await db
      .insert(appointments)
      .values({
        businessId: business.id,
        clientId,
        createdBy: user.id,
        title: data.title,
        description: data.description ?? null,
        date: data.date,
        startTime: data.startTime,
        endTime: data.endTime,
        status: data.status,
        assignedToUserId: data.assignedToUserId ?? null,
      })
      .returning();

    // F4 (Lot 33) : push best-effort vers Google Calendar si connecté.
    // On stocke l'eventId dans googleCalendarId pour permettre update/delete plus tard.
    // Fire-and-forget : ne bloque pas la réponse ni ne throw si Google refuse.
    void (async () => {
      try {
        const gEventId = await pushCreateGoogleEvent(business.id, {
          summary: created.title,
          description: created.description ?? undefined,
          location: business.address
            ? `${business.address}${business.city ? ", " + business.city : ""}`
            : undefined,
          start: `${created.date}T${created.startTime}:00`,
          end: `${created.date}T${created.endTime}:00`,
          timeZone: "Europe/Paris",
        });
        if (gEventId) {
          await db
            .update(appointments)
            .set({ googleCalendarId: gEventId })
            .where(eq(appointments.id, created.id));
        }
      } catch {
        // Silencieux : Google sync est best-effort
      }
    })();

    dispatchWebhook("appointment.created", business.id, {
      id: created.id,
      title: created.title,
      date: created.date,
      startTime: created.startTime,
      endTime: created.endTime,
      status: created.status,
      clientId: created.clientId,
    });

    return NextResponse.json({ appointment: created }, { status: 201 });
  } catch (err) {
    return handleApiError(err, { route: "POST /api/appointments" });
  }
}
