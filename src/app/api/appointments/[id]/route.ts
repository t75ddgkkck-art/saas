/**
 * PATCH /api/appointments/[id]  — update partiel (statut principalement)
 * DELETE /api/appointments/[id] — soft delete (Lot 14.3)
 *
 * Ownership check via businessId (anti-IDOR). Dispatch webhook update/cancel.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { appointments, clients } from "@/db/schema";
import { and, eq, isNull, sql } from "drizzle-orm";
import { getCurrentBusiness } from "@/lib/session";
import { validateBody } from "@/lib/api-helpers";
import { handleApiError, notFound, unauthorized } from "@/lib/api-error";
import { dispatchWebhook } from "@/lib/webhooks-out";
// F4 (Lot 33) : push sync Google Calendar (best-effort)
import { pushUpdateGoogleEvent, pushDeleteGoogleEvent } from "@/lib/google-calendar";
import { businesses } from "@/db/schema";
import { checkRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// Lot 24 : ajout `no_show` — quand un pro le sélectionne, on incrémente le compteur client
const StatusEnum = z.enum(["pending", "confirmed", "cancelled", "completed", "no_show"]);

const UpdateSchema = z.object({
  status: StatusEnum.optional(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  startTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
  endTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
  // F4 (Lot 33) : reprogrammation via drag&drop change date + startTime + endTime.
  // Assignation à un membre (nullable pour désassigner).
  assignedToUserId: z.string().uuid().nullable().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    // Rate-limit : 60/min sur PATCH (drag&drop calendar peut chainer plusieurs updates).
    const rl = checkRateLimit(req, { key: "appointments-patch", limit: 60, windowSec: 60 });
    if (!rl.ok) return rl.response;

    const business = await getCurrentBusiness();
    if (!business) throw unauthorized();

    const data = await validateBody(req, UpdateSchema);
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ ok: true, changed: 0 });
    }

    // Update conditionné à l'ownership business
    const [updated] = await db
      .update(appointments)
      .set({ ...data, updatedAt: new Date() })
      .where(
        and(
          eq(appointments.id, id),
          eq(appointments.businessId, business.id),
          isNull(appointments.deletedAt)
        )
      )
      .returning();

    if (!updated) throw notFound("RDV introuvable");

    // Lot 24 : incrément no_shows_count du client si passage à no_show.
    // Fire-and-forget côté client — l'update RDV réussit même si l'incrément échoue.
    if (data.status === "no_show" && updated.clientId) {
      void db
        .update(clients)
        .set({
          noShowsCount: sql`${clients.noShowsCount} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(clients.id, updated.clientId))
        .catch(() => {
          /* silent — l'audit trail reste dans les logs webhook */
        });
    }

    // Webhook selon type de changement
    if (data.status === "cancelled") {
      dispatchWebhook("appointment.cancelled", business.id, {
        id: updated.id,
        title: updated.title,
        date: updated.date,
      });
    } else {
      dispatchWebhook("appointment.updated", business.id, {
        id: updated.id,
        status: updated.status,
      });
    }

    // F4 (Lot 33) : sync Google Calendar best-effort
    // - Si statut = cancelled → DELETE côté Google
    // - Sinon → PATCH côté Google (nouveau date/heure/titre)
    if (updated.googleCalendarId) {
      void (async () => {
        try {
          if (data.status === "cancelled") {
            await pushDeleteGoogleEvent(business.id, updated.googleCalendarId!);
          } else {
            // Charge l'adresse du business (location Google) — via query rapide
            const [biz] = await db
              .select({ address: businesses.address, city: businesses.city })
              .from(businesses)
              .where(eq(businesses.id, business.id))
              .limit(1);
            await pushUpdateGoogleEvent(business.id, updated.googleCalendarId!, {
              summary: updated.title,
              description: updated.description ?? undefined,
              location: biz?.address
                ? `${biz.address}${biz.city ? ", " + biz.city : ""}`
                : undefined,
              start: `${updated.date}T${updated.startTime}:00`,
              end: `${updated.date}T${updated.endTime}:00`,
              timeZone: "Europe/Paris",
            });
          }
        } catch {
          // Best effort — silent
        }
      })();
    }

    return NextResponse.json({ appointment: updated });
  } catch (err) {
    return handleApiError(err, { route: `PATCH /api/appointments/${id}` });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    // Rate-limit DELETE : 30/min (Google Calendar sync + webhook dispatch derrière, coûteux).
    const rl = checkRateLimit(req, { key: "appointments-delete", limit: 30, windowSec: 60 });
    if (!rl.ok) return rl.response;

    const business = await getCurrentBusiness();
    if (!business) throw unauthorized();

    // Soft delete (Lot 14.3) — restauration possible 30j via cron purge
    const [updated] = await db
      .update(appointments)
      .set({ deletedAt: new Date() })
      .where(
        and(
          eq(appointments.id, id),
          eq(appointments.businessId, business.id),
          isNull(appointments.deletedAt)
        )
      )
      .returning({ id: appointments.id, googleCalendarId: appointments.googleCalendarId });

    if (!updated) throw notFound("RDV introuvable");

    // F4 (Lot 33) : suppression Google Calendar best-effort
    if (updated.googleCalendarId) {
      void pushDeleteGoogleEvent(business.id, updated.googleCalendarId).catch(() => {});
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err, { route: `DELETE /api/appointments/${id}` });
  }
}
