/**
 * POST /api/auth/reset-password
 * Consomme un token password_reset et change le mot de passe (Lot 19).
 *
 * SÉCURITÉ :
 * - Token single-use via `consumeAuthToken` (atomique DB)
 * - Nouveau password validé (min 8 chars, comme au register)
 * - Log en warn si token invalide (audit brute-force)
 * - Rate limit 10 tentatives / heure / IP (contre brute-force du token)
 * - Après reset : on marque emailVerified=true si ce n'était pas encore fait
 *   (avoir cliqué sur le lien email prouve la possession de la boîte)
 *
 * On NE loggue PAS l'utilisateur automatiquement : après reset, il doit se
 * reconnecter avec son nouveau mdp. C'est un choix de sécurité classique
 * (évite qu'un token volé permette une prise de compte sans re-auth explicite).
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { checkRateLimit } from "@/lib/rate-limit";
import { consumeAuthToken } from "@/lib/auth-tokens";
import { hashPassword } from "@/lib/auth";
import { handleApiError, badRequest } from "@/lib/api-error";
import { validateBody } from "@/lib/api-helpers";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const Schema = z.object({
  token: z.string().length(64, "Token invalide"),
  password: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères").max(200),
});

export async function POST(req: NextRequest) {
  const rl = checkRateLimit(req, {
    key: "auth:reset-password",
    limit: 10,
    windowSec: 3600,
  });
  if (!rl.ok) return rl.response;

  try {
    const data = await validateBody(req, Schema);
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      req.headers.get("x-real-ip") ||
      null;

    const result = await consumeAuthToken(data.token, "password_reset", { ip });
    if (!result.ok || !result.userId) {
      // Message générique pour l'user (ne dit pas si le token est expiré ou déjà utilisé).
      // Le reason exact est loggé côté serveur pour debug.
      logger.warn("[auth/reset] token invalide", { reason: result.reason });
      throw badRequest(
        "Ce lien de réinitialisation est invalide ou expiré. Redemandez-en un nouveau."
      );
    }

    const passwordHash = await hashPassword(data.password);

    await db
      .update(users)
      .set({
        passwordHash,
        // Bonus : avoir cliqué le lien = preuve de possession email → verify auto
        emailVerified: true,
      })
      .where(eq(users.id, result.userId));

    logger.info("[auth/reset] password changé", { userId: result.userId });

    return NextResponse.json({
      ok: true,
      message: "Mot de passe mis à jour. Vous pouvez vous reconnecter.",
    });
  } catch (err) {
    return handleApiError(err, { route: "POST /api/auth/reset-password" });
  }
}
