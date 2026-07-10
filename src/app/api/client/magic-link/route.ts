/**
 * F3 (Lot 31) — POST /api/client/magic-link
 *
 * Demande d'envoi d'un magic-link à un email client.
 *
 * SÉCURITÉ :
 *  - Rate-limit strict : 3 demandes / 10 min / IP (anti-flood boîte mail)
 *  - Anti-énumération : renvoie TOUJOURS le même message succès, même si
 *    l'email n'a jamais réservé chez aucun pro (évite de révéler la présence
 *    d'un email dans notre base).
 *  - On envoie l'email UNIQUEMENT si l'email existe dans `clients` (au moins
 *    un business), sinon on ne fait rien mais on répond OK.
 *  - TTL 15 min, single-use, max 3 tokens actifs par email.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { clients } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { checkRateLimit } from "@/lib/rate-limit";
import { handleApiError } from "@/lib/api-error";
import { validateBody } from "@/lib/api-helpers";
import { createClientAuthToken, CLIENT_TOKEN_TTL_SEC } from "@/lib/client-auth";
import { sendEmail, EmailTemplates } from "@/lib/email";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// Rate strict : la génération de tokens + envoi email a un coût réel
const RATE = { key: "client-magic-link", limit: 3, windowSec: 600 } as const;

const Schema = z.object({
  email: z.string().trim().toLowerCase().email("Email invalide").max(255),
});

// Message générique renvoyé dans TOUS les cas (anti-énumération)
const GENERIC_RESPONSE = {
  ok: true,
  message: "Si un compte existe pour cet email, un lien de connexion vient de vous être envoyé.",
};

export async function POST(request: NextRequest) {
  const rl = checkRateLimit(request, RATE);
  if (!rl.ok) return rl.response;

  try {
    const { email } = await validateBody(request, Schema);
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

    // Vérifier que l'email existe dans au moins un business (sinon on ne
    // spamme personne). Comparaison case-insensitive via lower().
    const rows = await db
      .select({ id: clients.id })
      .from(clients)
      .where(sql`lower(${clients.email}) = ${email}`)
      .limit(1);

    if (rows.length === 0) {
      // Réponse générique + délai fake pour uniformiser les temps de réponse
      // (empêche timing-attack style d'énumération)
      await new Promise((r) => setTimeout(r, 250 + Math.random() * 250));
      logger.info("[client-magic-link] email inconnu, réponse générique", { email });
      return NextResponse.json(GENERIC_RESPONSE);
    }

    // On trouve au moins un business — génère un token
    let rawToken: string;
    try {
      const created = await createClientAuthToken({ email, ip });
      rawToken = created.rawToken;
    } catch (err) {
      if (err instanceof Error && err.message === "TOO_MANY_ACTIVE_TOKENS") {
        // Anti-spam interne : on ne dit rien de particulier au client,
        // même réponse générique. Log le pattern pour audit.
        logger.warn("[client-magic-link] trop de tokens actifs — réponse générique", { email });
        return NextResponse.json(GENERIC_RESPONSE);
      }
      throw err;
    }

    // URL de connexion
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.vitrix.fr";
    const magicUrl = `${appUrl}/mon-compte/verify?token=${rawToken}`;

    // Envoi email (fire-and-forget mais on attend pour pouvoir logger l'échec)
    const template = EmailTemplates.clientMagicLink({
      magicUrl,
      expiryMinutes: Math.round(CLIENT_TOKEN_TTL_SEC / 60),
      ip,
    });

    // sendEmail sans `sync` = enqueue (dispatch async par le worker email)
    // On ne fait donc pas échouer la requête si l'email échoue plus tard —
    // c'est le comportement voulu pour l'anti-énumération de toute façon.
    await sendEmail(
      { to: email, subject: template.subject, html: template.html },
      { category: "transactional" }
    );

    return NextResponse.json(GENERIC_RESPONSE);
  } catch (err) {
    return handleApiError(err, { route: "POST /api/client/magic-link" });
  }
}
