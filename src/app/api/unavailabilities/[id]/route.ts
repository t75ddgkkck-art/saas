/**
 * F4 (Lot 33) — DELETE /api/unavailabilities/[id]
 * Suppression physique (pas de soft-delete — les blocs sont éphémères).
 * Auth : appointments.delete (owner/admin uniquement dans la matrice F5).
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { unavailabilities } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { handleApiError, notFound } from "@/lib/api-error";
import { requireTeamPermission } from "@/lib/team-context";

export const dynamic = "force-dynamic";

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    const context = await requireTeamPermission("appointments.delete");
    const result = await db
      .delete(unavailabilities)
      .where(and(eq(unavailabilities.id, id), eq(unavailabilities.businessId, context.business.id)))
      .returning({ id: unavailabilities.id });
    if (result.length === 0) throw notFound("Bloc introuvable");
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err, { route: `DELETE /api/unavailabilities/${id}` });
  }
}
