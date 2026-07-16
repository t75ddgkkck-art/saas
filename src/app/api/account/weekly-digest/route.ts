/**
 * Lot 53 (F15) — GET + PATCH /api/account/weekly-digest
 *
 * Endpoint léger pour lire/modifier le flag `users.weekly_digest_enabled`.
 * Alternative in-app à l'unsubscribe email one-click.
 *
 * Note : le flag DB est checked par le cron AVANT l'envoi. Un opt-out via
 * email (RGPD list-unsubscribe) va dans `email_optouts` (deux mécanismes,
 * les deux sont respectés indépendamment).
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getCurrentUser } from "@/lib/session";
import { handleApiError, unauthorized } from "@/lib/api-error";
import { validateBody } from "@/lib/api-helpers";
import { checkRateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const RATE = { key: "weekly-digest-prefs", limit: 20, windowSec: 60 } as const;

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) throw unauthorized();

    return NextResponse.json({
      ok: true,
      enabled: user.weeklyDigestEnabled,
      lastSentAt: user.weeklyDigestSentAt,
    });
  } catch (err) {
    return handleApiError(err, { route: "GET /api/account/weekly-digest" });
  }
}

const PatchSchema = z.object({
  enabled: z.boolean(),
});

export async function PATCH(req: NextRequest) {
  const rl = checkRateLimit(req, RATE);
  if (!rl.ok) return rl.response;

  try {
    const user = await getCurrentUser();
    if (!user) throw unauthorized();

    const data = await validateBody(req, PatchSchema);

    await db
      .update(users)
      .set({
        weeklyDigestEnabled: data.enabled,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    logger.info("weekly-digest.pref_updated", {
      userId: user.id,
      enabled: data.enabled,
    });

    return NextResponse.json({ ok: true, enabled: data.enabled });
  } catch (err) {
    return handleApiError(err, { route: "PATCH /api/account/weekly-digest" });
  }
}
