/**
 * DELETE /api/account/webhooks/[id]
 * Supprime définitivement un endpoint (hard delete OK : audit assuré par
 * la table webhook_deliveries qui garde l'historique).
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { webhookEndpoints } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/session";
import { handleApiError, notFound, unauthorized } from "@/lib/api-error";

export const dynamic = "force-dynamic";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const user = await getCurrentUser();
    if (!user) throw unauthorized();

    const result = await db
      .delete(webhookEndpoints)
      .where(and(eq(webhookEndpoints.id, id), eq(webhookEndpoints.userId, user.id)))
      .returning({ id: webhookEndpoints.id });

    if (result.length === 0) throw notFound("Endpoint introuvable");
    return NextResponse.json({ success: true });
  } catch (err) {
    return handleApiError(err, { route: `DELETE /api/account/webhooks/${id}` });
  }
}
