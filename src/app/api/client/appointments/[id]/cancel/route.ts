/**
 * F3 (Lot 31) — POST /api/client/appointments/[id]/cancel
 *
 * Le client annule un de ses RDV.
 *
 * Règles :
 *  1. Le RDV doit appartenir à un `clients` avec l'email de la session
 *  2. Le RDV ne doit pas déjà être annulé/complété/no_show
 *  3. Si un acompte a été payé → application de la politique de remboursement
 *     du business (`depositRefundHours`) via `decideRefundOnCancel` (F2)
 *  4. Statut → "cancelled", `deletedAt` NON défini (garde trace côté pro)
 *  5. Slot libéré
 *  6. Si refund dû → appel Stripe `refunds.create` sur le compte connect
 *     + update `depositStatus = "refunded"` — SINON `depositStatus = "forfeited"`
 *
 * Rate-limit 5/heure/IP (une annulation n'est pas fréquente).
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { appointments, clients, businesses, availabilitySlots, payments } from "@/db/schema";
import { and, eq, sql, isNull } from "drizzle-orm";
import { checkRateLimit } from "@/lib/rate-limit";
import { getCurrentClient } from "@/lib/client-session";
import { handleApiError, unauthorized, notFound, badRequest, forbidden } from "@/lib/api-error";
import { decideRefundOnCancel } from "@/lib/deposit";
import { refundDeposit, isStripeConfigured } from "@/lib/stripe";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const RATE = { key: "client-cancel", limit: 5, windowSec: 3600 } as const;

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const rl = checkRateLimit(request, RATE);
  if (!rl.ok) return rl.response;

  try {
    const clientSession = await getCurrentClient();
    if (!clientSession) throw unauthorized();

    const { id: appointmentId } = await ctx.params;

    // Charger RDV + client + business (join pour vérifier ownership par email)
    const rows = await db
      .select({
        apt: appointments,
        client: clients,
        business: businesses,
      })
      .from(appointments)
      .innerJoin(clients, eq(appointments.clientId, clients.id))
      .innerJoin(businesses, eq(appointments.businessId, businesses.id))
      .where(
        and(
          eq(appointments.id, appointmentId),
          sql`lower(${clients.email}) = ${clientSession.email}`,
          isNull(appointments.deletedAt)
        )
      )
      .limit(1);

    const row = rows[0];
    if (!row) throw notFound("RDV introuvable");

    const apt = row.apt;
    const business = row.business;

    if (apt.status === "cancelled" || apt.status === "completed" || apt.status === "no_show") {
      throw badRequest(`Ce rendez-vous ne peut plus être annulé (statut : ${apt.status}).`);
    }

    // Refuser l'annulation d'un RDV passé (au niveau date+heure)
    const startAt = new Date(`${apt.date}T${apt.startTime}:00`);
    if (startAt.getTime() < Date.now()) {
      throw forbidden("Impossible d'annuler un rendez-vous passé.");
    }

    // Politique refund : décide "refunded" vs "forfeited" en fonction du délai
    let refundDecision: "refunded" | "forfeited" | null = null;
    if (apt.depositStatus === "paid") {
      refundDecision = decideRefundOnCancel({
        refundHours: business.depositRefundHours,
        appointmentStart: startAt,
      });
    }

    // Update RDV : cancelled, garder la trace (pas de soft-delete côté pro)
    await db
      .update(appointments)
      .set({
        status: "cancelled",
        depositStatus: refundDecision ?? apt.depositStatus,
        updatedAt: new Date(),
      })
      .where(eq(appointments.id, appointmentId));

    // Libérer le slot si existant
    await db
      .update(availabilitySlots)
      .set({ isBooked: false })
      .where(
        and(
          eq(availabilitySlots.businessId, apt.businessId),
          eq(availabilitySlots.date, apt.date),
          eq(availabilitySlots.startTime, apt.startTime)
        )
      );

    // Remboursement Stripe si refund décidé + acompte réellement payé
    if (refundDecision === "refunded" && isStripeConfigured() && business.stripeAccountId) {
      try {
        // Retrouver le PaymentIntent depuis la ligne payments (type=deposit)
        const [depositPayment] = await db
          .select({ stripePaymentId: payments.stripePaymentId })
          .from(payments)
          .where(
            and(
              eq(payments.businessId, apt.businessId),
              eq(payments.clientId, apt.clientId),
              eq(payments.type, "deposit"),
              eq(payments.status, "completed")
            )
          )
          .limit(1);

        if (depositPayment?.stripePaymentId) {
          await refundDeposit({
            businessStripeAccountId: business.stripeAccountId,
            paymentIntentId: depositPayment.stripePaymentId,
          });
          logger.info("[client-cancel] refund Stripe effectué", {
            appointmentId,
            pi: depositPayment.stripePaymentId,
          });
        } else {
          logger.warn("[client-cancel] refund décidé mais paiement Stripe introuvable", {
            appointmentId,
          });
        }
      } catch (err) {
        // On loggue mais on ne throw pas — l'annulation est déjà actée côté DB,
        // le refund pourra être traité manuellement par le pro depuis Stripe.
        logger.error("[client-cancel] refund Stripe échoué", {
          appointmentId,
          err: err instanceof Error ? err.message : String(err),
        });
      }
    }

    logger.info("[client-cancel] RDV annulé", {
      appointmentId,
      email: clientSession.email,
      refundDecision,
    });

    return NextResponse.json({
      ok: true,
      status: "cancelled",
      depositStatus: refundDecision ?? apt.depositStatus,
      refundAttempted: refundDecision === "refunded",
    });
  } catch (err) {
    return handleApiError(err, {
      route: "POST /api/client/appointments/[id]/cancel",
    });
  }
}
