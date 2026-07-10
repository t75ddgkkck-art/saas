/**
 * GET   /api/clients/[id] — fiche client complète (historique RDV+devis+paiements+notes)
 * PATCH /api/clients/[id] — édition (partiel, tout optionnel)
 * DELETE /api/clients/[id] — soft delete (Lot 14.3)
 *
 * Toutes vérifient l'ownership business (anti-IDOR).
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { clients, appointments, quotes, payments, notes } from "@/db/schema";
import { and, desc, eq, isNull } from "drizzle-orm";
import { getCurrentBusiness } from "@/lib/session";
import { handleApiError, notFound, unauthorized } from "@/lib/api-error";
import { validateBody } from "@/lib/api-helpers";
import { normalizePhone } from "@/lib/validation";

export const dynamic = "force-dynamic";

const UpdateSchema = z.object({
  firstName: z.string().trim().max(100).optional(),
  lastName: z.string().trim().max(100).optional(),
  email: z.string().trim().toLowerCase().email().max(255).optional().nullable(),
  // `phone` est NOT NULL en DB (Lot 1-2 schéma) → on n'autorise pas null,
  // juste une chaîne (éventuellement vide côté client → on garde l'ancien).
  phone: z.string().trim().max(30).optional(),
  address: z.string().trim().max(500).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  source: z.enum(["website", "google", "referral", "social", "other"]).optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const business = await getCurrentBusiness();
    if (!business) throw unauthorized();

    // Fiche + soft delete check
    const [client] = await db
      .select()
      .from(clients)
      .where(
        and(
          eq(clients.id, id),
          eq(clients.businessId, business.id),
          isNull(clients.deletedAt)
        )
      )
      .limit(1);
    if (!client) throw notFound("Client introuvable");

    // Historique en parallèle (RDV, devis, paiements, notes) — filtre soft delete
    const [apts, qts, pmts, nts] = await Promise.all([
      db
        .select({
          id: appointments.id,
          title: appointments.title,
          date: appointments.date,
          startTime: appointments.startTime,
          endTime: appointments.endTime,
          status: appointments.status,
          createdAt: appointments.createdAt,
        })
        .from(appointments)
        .where(
          and(
            eq(appointments.clientId, id),
            eq(appointments.businessId, business.id),
            isNull(appointments.deletedAt)
          )
        )
        .orderBy(desc(appointments.date), desc(appointments.startTime)),
      db
        .select({
          id: quotes.id,
          quoteNumber: quotes.quoteNumber,
          title: quotes.title,
          status: quotes.status,
          total: quotes.total,
          signedAt: quotes.signedAt,
          createdAt: quotes.createdAt,
        })
        .from(quotes)
        .where(
          and(
            eq(quotes.clientId, id),
            eq(quotes.businessId, business.id),
            isNull(quotes.deletedAt)
          )
        )
        .orderBy(desc(quotes.createdAt)),
      db
        .select({
          id: payments.id,
          amount: payments.amount,
          currency: payments.currency,
          type: payments.type,
          status: payments.status,
          createdAt: payments.createdAt,
        })
        .from(payments)
        .where(
          and(
            eq(payments.clientId, id),
            eq(payments.businessId, business.id)
          )
        )
        .orderBy(desc(payments.createdAt)),
      db
        .select({
          id: notes.id,
          content: notes.content,
          createdAt: notes.createdAt,
        })
        .from(notes)
        .where(and(eq(notes.clientId, id), eq(notes.businessId, business.id)))
        .orderBy(desc(notes.createdAt)),
    ]);

    // Agrégats calculés à la volée (source de vérité DB, plus fiable que les
    // compteurs dénormalisés `appointmentsCount` qui peuvent dériver)
    const totalRevenue = pmts
      .filter((p) => p.status === "completed")
      .reduce((s, p) => s + Number(p.amount), 0);
    const noShows = apts.filter((a) => a.status === "no_show").length;
    const completedRdvs = apts.filter((a) => a.status === "completed").length;

    return NextResponse.json({
      client,
      appointments: apts,
      quotes: qts,
      payments: pmts,
      notes: nts,
      aggregates: {
        totalRevenue,
        noShows,
        completedAppointments: completedRdvs,
        totalAppointments: apts.length,
        totalQuotes: qts.length,
      },
    });
  } catch (err) {
    return handleApiError(err, { route: `GET /api/clients/${id}` });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const business = await getCurrentBusiness();
    if (!business) throw unauthorized();

    const data = await validateBody(req, UpdateSchema);
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ ok: true, changed: 0 });
    }

    // Normalise phone si fourni
    const patch: Partial<typeof data> & { updatedAt?: Date } = { ...data };
    if (typeof data.phone === "string") {
      patch.phone = normalizePhone(data.phone);
    }

    const [updated] = await db
      .update(clients)
      .set({ ...patch, updatedAt: new Date() })
      .where(
        and(
          eq(clients.id, id),
          eq(clients.businessId, business.id),
          isNull(clients.deletedAt)
        )
      )
      .returning();

    if (!updated) throw notFound("Client introuvable");
    return NextResponse.json({ client: updated });
  } catch (err) {
    return handleApiError(err, { route: `PATCH /api/clients/${id}` });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const business = await getCurrentBusiness();
    if (!business) throw unauthorized();

    const [updated] = await db
      .update(clients)
      .set({ deletedAt: new Date() })
      .where(
        and(
          eq(clients.id, id),
          eq(clients.businessId, business.id),
          isNull(clients.deletedAt)
        )
      )
      .returning({ id: clients.id });

    if (!updated) throw notFound("Client introuvable");
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err, { route: `DELETE /api/clients/${id}` });
  }
}
