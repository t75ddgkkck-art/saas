/**
 * POST /api/admin/users/[id]/ban   → ban un user
 * DELETE /api/admin/users/[id]/ban → unban
 *
 * Toute opération est loggée dans admin_events (audit trail).
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAdmin, logAdminEvent } from "@/lib/admin";
import { handleApiError, badRequest, notFound } from "@/lib/api-error";
import { validateBody } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

const BanSchema = z.object({
  reason: z.string().min(3).max(500),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const admin = await requireAdmin();
    const { reason } = await validateBody(req, BanSchema);

    if (id === admin.id) {
      throw badRequest("Vous ne pouvez pas vous bannir vous-même");
    }

    const existing = await db.select({ id: users.id }).from(users).where(eq(users.id, id)).limit(1);
    if (existing.length === 0) throw notFound("Utilisateur introuvable");

    await db
      .update(users)
      .set({ bannedAt: new Date(), banReason: reason })
      .where(eq(users.id, id));

    await logAdminEvent({
      actorUserId: admin.id,
      targetUserId: id,
      action: "ban_user",
      payload: { reason },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return handleApiError(err, { route: `POST /api/admin/users/${id}/ban` });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const admin = await requireAdmin();

    const existing = await db.select({ id: users.id }).from(users).where(eq(users.id, id)).limit(1);
    if (existing.length === 0) throw notFound("Utilisateur introuvable");

    await db
      .update(users)
      .set({ bannedAt: null, banReason: null })
      .where(eq(users.id, id));

    await logAdminEvent({
      actorUserId: admin.id,
      targetUserId: id,
      action: "unban_user",
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return handleApiError(err, { route: `DELETE /api/admin/users/${id}/ban` });
  }
}
