/**
 * F6 (Lot 35) — POST /api/appointments/[id]/status
 *
 * Route dédiée à la transition de statut avec state machine.
 * Utilisée par les actions rapides de la Today view : "En route", "Arrivé",
 * "Terminé", "No-show".
 *
 * Séparée de `PATCH /api/appointments/[id]` (qui accepte tout patch libre)
 * pour :
 *  - Valider la transition via `canTransition` (bloque cancelled → confirmed)
 *  - Poser AUTOMATIQUEMENT les timestamps timeline (checkedInAt/startedAt/finishedAt)
 *  - Rate-limit spécifique (les actions terrain sont rapides et répétées)
 *
 * Rate-limit : 60/min/IP (un pro peut cliquer plusieurs statuts en série)
 * Auth : requireTeamPermission("appointments.edit_any") — pas les viewers.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { appointments } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { checkRateLimit } from "@/lib/rate-limit";
import { validateBody } from "@/lib/api-helpers";
import { handleApiError, badRequest, notFound } from "@/lib/api-error";
import { requireTeamPermission } from "@/lib/team-context";
import {
  canTransition,
  resolveTimelineFields,
  type AppointmentStatus,
} from "@/lib/appointment-status";

export const dynamic = "force-dynamic";

const RATE = { key: "appointments-status", limit: 60, windowSec: 60 } as const;

const Schema = z.object({
  status: z.enum([
    "pending",
    "confirmed",
    "en_route",
    "in_progress",
    "completed",
    "no_show",
    "cancelled",
  ]),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const rl = checkRateLimit(req, RATE);
  if (!rl.ok) return rl.response;

  const { id } = await ctx.params;
  try {
    const context = await requireTeamPermission("appointments.edit_any");
    const { status: nextStatus } = await validateBody(req, Schema);

    // Charge le RDV + vérifie ownership + récupère l'état courant pour la state machine
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

    const currentStatus = apt.status as AppointmentStatus;

    if (!canTransition(currentStatus, nextStatus)) {
      throw badRequest(
        `Transition invalide : ${currentStatus} → ${nextStatus}. Un RDV terminé/annulé/no-show ne peut pas être rouvert.`
      );
    }

    // Idempotence : même statut = no-op OK (renvoie l'existant)
    if (currentStatus === nextStatus) {
      return NextResponse.json({ appointment: apt, unchanged: true });
    }

    // Calcule les timestamps à poser automatiquement
    const timelinePatch = resolveTimelineFields(nextStatus, {
      checkedInAt: apt.checkedInAt,
      startedAt: apt.startedAt,
      finishedAt: apt.finishedAt,
    });

    const [updated] = await db
      .update(appointments)
      .set({
        status: nextStatus,
        ...timelinePatch,
        updatedAt: new Date(),
      })
      .where(eq(appointments.id, id))
      .returning();

    return NextResponse.json({ appointment: updated });
  } catch (err) {
    return handleApiError(err, { route: `POST /api/appointments/${id}/status` });
  }
}
