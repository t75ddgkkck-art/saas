/**
 * POST /api/admin/users/[id]/restore
 * Restaure un user soft-deleted (annule le `deletedAt`).
 * N'a d'effet QUE sur le user — les businesses possédés doivent être
 * restaurés séparément si besoin (endpoint dédié à ajouter si nécessaire).
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAdmin, logAdminEvent } from "@/lib/admin";
import { handleApiError, notFound } from "@/lib/api-error";
import { markRestored } from "@/lib/soft-delete";
import { checkRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // Lot 64 : 30 restaurations/h — action rare (support qui répond à un ticket
  // "je me suis trompé, remettez mon compte") aligné avec ban/unban.
  const rl = checkRateLimit(req, { key: "admin-restore", limit: 30, windowSec: 3600 });
  if (!rl.ok) return rl.response;

  const { id } = await params;
  try {
    const admin = await requireAdmin();

    const existing = await db
      .select({ id: users.id, deletedAt: users.deletedAt })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    if (existing.length === 0) throw notFound("Utilisateur introuvable");

    await db.update(users).set({ deletedAt: markRestored() }).where(eq(users.id, id));

    await logAdminEvent({
      actorUserId: admin.id,
      targetUserId: id,
      action: "restore_user",
      payload: { previousDeletedAt: existing[0].deletedAt?.toISOString() ?? null },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return handleApiError(err, { route: `POST /api/admin/users/${id}/restore` });
  }
}
