/**
 * POST /api/auth/verify-email/send
 * (Re)envoie un email de vérification à l'user connecté (Lot 19).
 *
 * Cas d'usage :
 *  - Bannière "vérifiez votre email" dans dashboard → bouton "renvoyer"
 *  - User qui a perdu le premier email
 *
 * Idempotent au sens fonctionnel : plusieurs demandes sont OK (rate-limit
 * gère l'abus), mais chaque demande génère un nouveau token single-use.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { checkRateLimit } from "@/lib/rate-limit";
import { sendVerifyEmail } from "@/lib/send-verify-email";
import { handleApiError, unauthorized, badRequest } from "@/lib/api-error";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  // 5 envois / heure / IP (aligné sur MAX_ACTIVE_PER_USER email_verify)
  const rl = checkRateLimit(req, {
    key: "auth:verify-email-send",
    limit: 5,
    windowSec: 3600,
  });
  if (!rl.ok) return rl.response;

  try {
    const user = await getCurrentUser();
    if (!user) throw unauthorized();

    if (user.emailVerified) {
      // Pas d'erreur mais on ne re-envoie pas inutilement
      return NextResponse.json({ ok: true, alreadyVerified: true });
    }

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      req.headers.get("x-real-ip") ||
      null;

    const result = await sendVerifyEmail({
      userId: user.id,
      email: user.email,
      firstName: user.firstName,
      ip,
    });

    if (!result.ok) {
      // Si TOO_MANY_ACTIVE_TOKENS → 429 friendly (l'user a déjà 5 tokens actifs)
      if (result.reason?.includes("TOO_MANY_ACTIVE")) {
        throw badRequest("Trop d'emails envoyés récemment. Attendez avant de redemander.");
      }
      throw badRequest("Impossible d'envoyer l'email. Réessayez plus tard.");
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err, { route: "POST /api/auth/verify-email/send" });
  }
}
