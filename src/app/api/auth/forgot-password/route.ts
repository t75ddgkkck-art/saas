/**
 * POST /api/auth/forgot-password
 * Envoi d'un email de réinitialisation de mot de passe (Lot 19).
 *
 * SÉCURITÉ :
 * - Réponse IDENTIQUE que l'email existe ou non (anti-énumération de comptes)
 * - Rate limit strict : 3 demandes / heure / IP + 3 tokens actifs / user max (voir lib)
 * - Captcha Turnstile obligatoire en prod (skip auto en dev sans secret)
 * - IP loggée dans le token pour audit
 *
 * On NE dit JAMAIS à l'utilisateur "cet email n'existe pas" ni "email envoyé
 * avec succès" spécifiquement — juste "si un compte existe, un email arrive".
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq, isNull, and } from "drizzle-orm";
import { checkRateLimit } from "@/lib/rate-limit";
import { verifyCaptcha } from "@/lib/captcha";
import { createAuthToken } from "@/lib/auth-tokens";
import { sendEmail, EmailTemplates } from "@/lib/email";
import { handleApiError, badRequest } from "@/lib/api-error";
import { validateBody } from "@/lib/api-helpers";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const Schema = z.object({
  email: z.string().trim().toLowerCase().email("Email invalide").max(255),
  // Token Turnstile (optionnel en dev, obligatoire si TURNSTILE_SECRET_KEY défini)
  captchaToken: z.string().optional(),
});

// Message générique retourné dans TOUS les cas (succès, email inconnu, banni…)
// L'attaquant ne peut PAS distinguer si un email est enregistré.
const GENERIC_RESPONSE = {
  ok: true,
  message:
    "Si un compte existe avec cet email, un lien de réinitialisation vient d'être envoyé.",
};

export async function POST(req: NextRequest) {
  // 3 tentatives / heure / IP — protège contre le spam mail massif
  const rl = checkRateLimit(req, {
    key: "auth:forgot-password",
    limit: 3,
    windowSec: 3600,
  });
  if (!rl.ok) return rl.response;

  try {
    const data = await validateBody(req, Schema);

    // Captcha (skip auto si TURNSTILE_SECRET_KEY absent — dev friendly)
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      req.headers.get("x-real-ip") ||
      null;
    const captcha = await verifyCaptcha(data.captchaToken, { ip });
    if (!captcha.ok && captcha.reason !== "no_secret") {
      throw badRequest("Vérification captcha échouée. Réessayez.");
    }

    // Lookup user par email lowercase
    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        bannedAt: users.bannedAt,
        deletedAt: users.deletedAt,
      })
      .from(users)
      .where(and(eq(users.email, data.email), isNull(users.deletedAt)))
      .limit(1);

    // User non trouvé OU banni : on ne fait RIEN mais on retourne la même
    // réponse générique. L'énumération devient impossible.
    if (!user || user.bannedAt) {
      logger.info("[auth/forgot] demande pour email inconnu ou banni (silent)", {
        email: data.email,
      });
      return NextResponse.json(GENERIC_RESPONSE);
    }

    // Création token + envoi email. Le "TOO_MANY_ACTIVE_TOKENS" est catché
    // silencieusement pour garder la réponse générique.
    try {
      const { rawToken } = await createAuthToken({
        userId: user.id,
        type: "password_reset",
        ip,
      });

      const appUrl = (
        process.env.NEXT_PUBLIC_APP_URL || "https://www.vitrix.fr"
      ).replace(/\/$/, "");
      const resetUrl = `${appUrl}/reset-password?token=${rawToken}`;

      const template = EmailTemplates.passwordReset({
        firstName: user.firstName,
        resetUrl,
        ip,
        expiryMinutes: 60,
      });

      await sendEmail(
        {
          to: user.email,
          subject: template.subject,
          html: template.html,
        },
        { category: "transactional" }
      );

      logger.info("[auth/forgot] email envoyé", { userId: user.id });
    } catch (err) {
      // On ne remonte pas à l'user : réponse générique de toute façon.
      logger.warn("[auth/forgot] échec création/envoi token", {
        userId: user.id,
        err: err instanceof Error ? err.message : String(err),
      });
    }

    return NextResponse.json(GENERIC_RESPONSE);
  } catch (err) {
    return handleApiError(err, { route: "POST /api/auth/forgot-password" });
  }
}
