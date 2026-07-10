/**
 * POST /api/auth/verify-email/confirm
 * Consomme le token email_verify et marque `emailVerified = true` (Lot 19).
 *
 * Utilisé par la page `/verify-email?token=...` (elle POST au chargement).
 * On garde ça en POST pour éviter les prefetch/bots qui feraient GET et
 * consommeraient le token accidentellement.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { checkRateLimit } from "@/lib/rate-limit";
import { consumeAuthToken } from "@/lib/auth-tokens";
import { handleApiError, badRequest } from "@/lib/api-error";
import { validateBody } from "@/lib/api-helpers";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const Schema = z.object({
  token: z.string().length(64),
});

export async function POST(req: NextRequest) {
  const rl = checkRateLimit(req, {
    key: "auth:verify-email-confirm",
    limit: 20,
    windowSec: 3600,
  });
  if (!rl.ok) return rl.response;

  try {
    const data = await validateBody(req, Schema);
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      req.headers.get("x-real-ip") ||
      null;

    const result = await consumeAuthToken(data.token, "email_verify", { ip });
    if (!result.ok || !result.userId) {
      logger.warn("[auth/verify] token invalide", { reason: result.reason });
      throw badRequest("Lien de vérification invalide ou expiré.");
    }

    await db
      .update(users)
      .set({ emailVerified: true })
      .where(eq(users.id, result.userId));

    logger.info("[auth/verify] email vérifié", { userId: result.userId });
    return NextResponse.json({ ok: true, message: "Email vérifié avec succès." });
  } catch (err) {
    return handleApiError(err, { route: "POST /api/auth/verify-email/confirm" });
  }
}
