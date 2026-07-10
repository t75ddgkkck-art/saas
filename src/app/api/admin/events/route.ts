/**
 * GET /api/admin/events?limit=50&action=ban_user
 * Retourne les derniers événements admin (audit trail).
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { adminEvents, users } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { requireAdmin } from "@/lib/admin";
import { handleApiError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();

    const url = new URL(req.url);
    const limit = Math.max(1, Math.min(200, Number(url.searchParams.get("limit")) || 50));
    const action = url.searchParams.get("action")?.trim() || null;

    // Alias les users pour joindre 2 fois (actor + target)
    const actor = alias(users, "actor");
    const target = alias(users, "target");

    const base = db
      .select({
        id: adminEvents.id,
        action: adminEvents.action,
        payload: adminEvents.payload,
        ip: adminEvents.ip,
        createdAt: adminEvents.createdAt,
        actorEmail: actor.email,
        targetEmail: target.email,
      })
      .from(adminEvents)
      .leftJoin(actor, eq(actor.id, adminEvents.actorUserId))
      .leftJoin(target, eq(target.id, adminEvents.targetUserId));

    // On applique WHERE avant orderBy/limit pour respecter l'ordre SQL
    const filtered = action ? base.where(eq(adminEvents.action, action)) : base;
    const rows = await filtered.orderBy(desc(adminEvents.createdAt)).limit(limit);

    return NextResponse.json({ events: rows });
  } catch (err) {
    return handleApiError(err, { route: "GET /api/admin/events" });
  }
}
