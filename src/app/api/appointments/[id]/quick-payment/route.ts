/**
 * F6 (Lot 35) — POST /api/appointments/[id]/quick-payment
 *
 * Encaisse un paiement en 1 clic depuis la Today view :
 *  - Crée une ligne `payments` type=full/deposit, status=completed
 *  - Lie le paiement au RDV (via metadata.appointmentId) et au client
 *  - Optionnel : passe le RDV en status `completed` si `alsoComplete=true`
 *  - Notifie le pro via notify() ("Paiement encaissé")
 *
 * Contrairement à `POST /api/payments` (formulaire complet), cette route est
 * pensée pour l'usage TERRAIN : minimum de champs, actions groupées.
 *
 * Auth : requireTeamPermission("payments.create")
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { appointments, payments } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { checkRateLimit } from "@/lib/rate-limit";
import { validateBody } from "@/lib/api-helpers";
import { handleApiError, notFound, badRequest } from "@/lib/api-error";
import { requireTeamPermission } from "@/lib/team-context";
import { resolveTimelineFields } from "@/lib/appointment-status";
import { notifyAsync } from "@/lib/notify";

export const dynamic = "force-dynamic";

const RATE = { key: "quick-payment", limit: 30, windowSec: 3600 } as const;

const Schema = z.object({
  amount: z.number().positive().max(1_000_000),
  method: z.enum(["cash", "transfer", "cheque", "card_terminal", "card_online"]).default("cash"),
  type: z.enum(["deposit", "full"]).default("full"),
  note: z.string().max(500).optional(),
  /** Si true, passe le RDV en status "completed" en même temps. Défaut : true (usage terrain). */
  alsoComplete: z.boolean().default(true),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const rl = checkRateLimit(req, RATE);
  if (!rl.ok) return rl.response;

  const { id } = await ctx.params;
  try {
    const context = await requireTeamPermission("payments.create");
    const data = await validateBody(req, Schema);

    // Charge le RDV + ownership check
    const [apt] = await db
      .select()
      .from(appointments)
      .where(
        and(
          eq(appointments.id, id),
          eq(appointments.businessId, context.business.id),
          isNull(appointments.deletedAt)
        )
      )
      .limit(1);

    if (!apt) throw notFound("RDV introuvable");
    if (apt.status === "cancelled") {
      throw badRequest("Impossible d'encaisser sur un RDV annulé.");
    }

    // 1. Insert paiement
    const [payment] = await db
      .insert(payments)
      .values({
        businessId: context.business.id,
        clientId: apt.clientId,
        amount: data.amount.toFixed(2),
        currency: "EUR",
        type: data.type,
        status: "completed",
        metadata: {
          method: data.method,
          note: data.note ?? null,
          appointmentId: apt.id,
          source: "quick_payment",
          recordedAt: new Date().toISOString(),
        },
      })
      .returning();

    // 2. Optionnel : passe le RDV en completed (avec timeline posée automatiquement)
    if (data.alsoComplete && apt.status !== "completed") {
      const timelinePatch = resolveTimelineFields("completed", {
        checkedInAt: apt.checkedInAt,
        startedAt: apt.startedAt,
        finishedAt: apt.finishedAt,
      });
      await db
        .update(appointments)
        .set({
          status: "completed",
          ...timelinePatch,
          updatedAt: new Date(),
        })
        .where(eq(appointments.id, id));
    }

    // 3. Notif au pro (owner) — utile si un employé a encaissé
    notifyAsync({
      userId: context.business.ownerId,
      businessId: context.business.id,
      type: "payment.received",
      title: "Paiement encaissé 💰",
      message: `${data.amount.toFixed(2)} € via ${data.method} — RDV ${apt.title}`,
      data: { paymentId: payment.id, appointmentId: apt.id },
      url: "/dashboard/payments",
      tag: `payment-${payment.id}`,
    });

    return NextResponse.json({
      payment,
      completedAppointment: data.alsoComplete,
    });
  } catch (err) {
    return handleApiError(err, { route: `POST /api/appointments/${id}/quick-payment` });
  }
}
