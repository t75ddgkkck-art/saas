/**
 * Helper unifié : génère un token email_verify + envoie l'email (Lot 19).
 *
 * Utilisé à 2 endroits :
 *  - Register (juste après création du user)
 *  - Route "renvoyer" (settings ou banner "vérifiez votre email")
 *
 * Non-bloquant côté appelant : on catch les erreurs et on log, la route
 * appelante n'échoue pas à cause d'un mail raté.
 */

import { createAuthToken } from "@/lib/auth-tokens";
import { sendEmail, EmailTemplates } from "@/lib/email";
import { logger } from "@/lib/logger";

export async function sendVerifyEmail(params: {
  userId: string;
  email: string;
  firstName: string;
  ip?: string | null;
}): Promise<{ ok: boolean; reason?: string }> {
  try {
    const { rawToken } = await createAuthToken({
      userId: params.userId,
      type: "email_verify",
      ip: params.ip,
    });

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://www.vitrix.fr").replace(/\/$/, "");
    const verifyUrl = `${appUrl}/verify-email?token=${rawToken}`;

    const template = EmailTemplates.emailVerify({
      firstName: params.firstName,
      verifyUrl,
      expiryHours: 24,
    });

    await sendEmail(
      {
        to: params.email,
        subject: template.subject,
        html: template.html,
      },
      { category: "transactional" }
    );

    return { ok: true };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    logger.warn("[send-verify-email] échec", { userId: params.userId, reason });
    return { ok: false, reason };
  }
}
