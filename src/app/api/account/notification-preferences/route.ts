/**
 * F6 (Lot 34) — GET / PUT /api/account/notification-preferences
 *
 * Gère les préférences de notification du user courant :
 *  - disabled_types  : liste des event types que l'user ne veut pas recevoir
 *  - disabled_channels : ["push"] ou ["db"] — mute un canal entier
 *  - dnd_start / dnd_end : fenêtre "Do Not Disturb" en HH:MM
 *
 * Modèle opt-out : par défaut tout est activé, l'user coche ce qu'il veut couper.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { notificationPreferences } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/session";
import { handleApiError, unauthorized } from "@/lib/api-error";
import { validateBody } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

const HHMM = /^\d{2}:\d{2}$/;

const UpdateSchema = z.object({
  disabledTypes: z.array(z.string().max(60)).max(50).optional(),
  disabledChannels: z
    .array(z.enum(["db", "push"]))
    .max(2)
    .optional(),
  dndStart: z.string().regex(HHMM, "Format HH:MM").nullable().optional(),
  dndEnd: z.string().regex(HHMM, "Format HH:MM").nullable().optional(),
});

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) throw unauthorized();

    const [row] = await db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, user.id))
      .limit(1);

    return NextResponse.json({
      disabledTypes: row?.disabledTypes ?? [],
      disabledChannels: row?.disabledChannels ?? [],
      dndStart: row?.dndStart ?? null,
      dndEnd: row?.dndEnd ?? null,
    });
  } catch (err) {
    return handleApiError(err, { route: "GET /api/account/notification-preferences" });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) throw unauthorized();

    const data = await validateBody(request, UpdateSchema);

    // Cohérence : DND partiel (start sans end ou inverse) → on remet les 2 à null
    let dndStart = data.dndStart ?? null;
    let dndEnd = data.dndEnd ?? null;
    if ((dndStart && !dndEnd) || (!dndStart && dndEnd)) {
      dndStart = null;
      dndEnd = null;
    }

    await db
      .insert(notificationPreferences)
      .values({
        userId: user.id,
        disabledTypes: data.disabledTypes ?? [],
        disabledChannels: data.disabledChannels ?? [],
        dndStart,
        dndEnd,
      })
      .onConflictDoUpdate({
        target: notificationPreferences.userId,
        set: {
          disabledTypes: data.disabledTypes ?? [],
          disabledChannels: data.disabledChannels ?? [],
          dndStart,
          dndEnd,
          updatedAt: new Date(),
        },
      });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err, { route: "PUT /api/account/notification-preferences" });
  }
}
