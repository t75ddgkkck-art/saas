/**
 * DELETE /api/account/api-keys/[id]
 * Révoque une clé (soft : on set revokedAt, on ne la supprime pas → audit).
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { apiKeys } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/session";
import { handleApiError, notFound, unauthorized } from "@/lib/api-error";

export const dynamic = "force-dynamic";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const user = await getCurrentUser();
    if (!user) throw unauthorized();

    // Ownership check : la clé doit appartenir à ce user (anti-IDOR)
    const result = await db
      .update(apiKeys)
      .set({ revokedAt: new Date() })
      .where(and(eq(apiKeys.id, id), eq(apiKeys.userId, user.id)))
      .returning({ id: apiKeys.id });

    if (result.length === 0) throw notFound("Clé introuvable");

    return NextResponse.json({ success: true });
  } catch (err) {
    return handleApiError(err, { route: `DELETE /api/account/api-keys/${id}` });
  }
}
