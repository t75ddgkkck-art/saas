/**
 * F2 (Lot 30) — Cron sanity : expiration des acomptes en attente.
 *
 * Normalement, Stripe envoie `checkout.session.expired` automatiquement à
 * l'expiration (30 min après création). Ce cron est une CEINTURE-BRETELLES
 * pour les cas où :
 *  - Le webhook Stripe échoue silencieusement
 *  - Notre endpoint webhook a été down au moment de l'event
 *  - Le webhook a été rejeté (signature invalide temporaire, etc.)
 *
 * Politique : tout RDV avec `depositStatus='pending'` et `createdAt < now - 45min`
 * est considéré comme abandonné → libéré + soft-deleted.
 *
 * Marge de 15 min (30 Stripe + 15 buffer) pour ne pas doubler l'action du webhook.
 *
 * Sécurité : accès via `CRON_SECRET` header (comme les autres crons Vercel).
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { appointments, availabilitySlots } from "@/db/schema";
import { and, eq, lt, isNull } from "drizzle-orm";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  // Auth cron : header envoyé par Vercel cron (secret partagé)
  const auth = request.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET || ""}`;
  if (!process.env.CRON_SECRET || auth !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - 45 * 60 * 1000); // 45 min

  try {
    // Sélectionne les RDV pending trop vieux
    const stale = await db
      .select()
      .from(appointments)
      .where(
        and(
          eq(appointments.depositStatus, "pending"),
          lt(appointments.createdAt, cutoff),
          isNull(appointments.deletedAt)
        )
      );

    if (stale.length === 0) {
      return NextResponse.json({ scanned: 0, released: 0 });
    }

    let released = 0;
    for (const apt of stale) {
      // Libérer le slot correspondant si trouvé
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

      // Soft-delete + status canceled
      await db
        .update(appointments)
        .set({
          status: "cancelled",
          deletedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(appointments.id, apt.id));

      released++;
    }

    logger.info("cron.expire-deposits.done", { scanned: stale.length, released });

    return NextResponse.json({ scanned: stale.length, released });
  } catch (err) {
    logger.error("cron.expire-deposits.failed", {
      err: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
