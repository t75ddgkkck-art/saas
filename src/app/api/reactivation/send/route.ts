/**
 * Lot 49 (F13) — POST /api/reactivation/send
 *
 * Envoie un message de réactivation à un client (email uniquement pour l'instant).
 * SMS ajoutable ultérieurement via Twilio si config présente.
 *
 * Body: { clientId, channel: "email" | "sms", message, subject? }
 * Response: { ok, sentAt }
 *
 * Gates :
 *  - Le pro doit être owner du business qui possède le client (anti-IDOR)
 *  - Le message est envoyé via Resend (canal email fiabilité déjà en place)
 *  - Un `lastContact` est mis à jour sur le client pour éviter le double envoi
 *
 * PAS de gate stricte Premium ici — un pro peut avoir généré son message
 * manuellement (edit dans la UI) sans avoir utilisé l'IA. L'envoi lui-même
 * est un feature basique CRM.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { clients, businesses } from "@/db/schema";
import { getCurrentBusiness } from "@/lib/session";
import { handleApiError, badRequest, notFound, unauthorized } from "@/lib/api-error";
import { validateBody } from "@/lib/api-helpers";
import { checkRateLimit } from "@/lib/rate-limit";
import { sendEmailRaw } from "@/lib/email-core";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// Rate strict — anti-spam ; le pro peut envoyer max 20 messages/heure
const RATE = { key: "reactivation-send", limit: 20, windowSec: 3600 } as const;

const Schema = z.object({
  clientId: z.string().uuid(),
  channel: z.enum(["email", "sms"]),
  message: z.string().trim().min(10, "Message trop court").max(2000),
  subject: z.string().trim().max(200).optional(),
});

export async function POST(req: NextRequest) {
  const rl = checkRateLimit(req, RATE);
  if (!rl.ok) return rl.response;

  try {
    const biz = await getCurrentBusiness();
    if (!biz) throw unauthorized();

    const data = await validateBody(req, Schema);

    // Anti-IDOR : le client doit appartenir au business courant
    const [client] = await db
      .select()
      .from(clients)
      .where(
        and(
          eq(clients.id, data.clientId),
          eq(clients.businessId, biz.id),
          isNull(clients.deletedAt)
        )
      )
      .limit(1);

    if (!client) throw notFound("Client introuvable");

    // Vérif canal disponible
    if (data.channel === "email" && !client.email) {
      throw badRequest("Ce client n'a pas d'email renseigné.");
    }
    if (data.channel === "sms") {
      // Pour l'instant, SMS non implémenté — Twilio à câbler en Lot ultérieur
      return NextResponse.json(
        {
          error: "L'envoi SMS n'est pas encore disponible. Utilisez l'email.",
          notImplemented: true,
        },
        { status: 501 }
      );
    }

    // Charge business complet pour le reply-to + signature
    const [bizFull] = await db
      .select({ name: businesses.name, email: businesses.email })
      .from(businesses)
      .where(eq(businesses.id, biz.id))
      .limit(1);

    // Email HTML minimal — le message est déjà rédigé par le pro (potentiellement IA)
    // On l'échappe en HTML basique + on préserve les retours à la ligne
    const escapedMessage = data.message
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\n/g, "<br />");

    const html = `<!doctype html>
<html lang="fr"><body style="margin:0;padding:24px;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;padding:32px;border:1px solid #e2e8f0">
    <div style="font-size:15px;line-height:1.6">${escapedMessage}</div>
  </div>
</body></html>`;

    const subject =
      data.subject?.trim() ||
      `Un message de ${bizFull?.name ?? "votre professionnel"}`;

    const result = await sendEmailRaw({
      to: client.email!,
      subject,
      html,
      replyTo: bizFull?.email
        ? `${bizFull.name} <${bizFull.email}>`
        : undefined,
    });

    if (!result.success) {
      logger.error("reactivation.send.failed", {
        clientId: client.id,
        error: result.error,
      });
      return NextResponse.json(
        { error: "L'email n'a pas pu être envoyé. Vérifiez l'adresse du client." },
        { status: 500 }
      );
    }

    // Update lastContact — évite de re-relancer le même client trop tôt
    await db
      .update(clients)
      .set({ lastContact: new Date(), updatedAt: new Date() })
      .where(eq(clients.id, client.id));

    logger.info("reactivation.send.success", {
      clientId: client.id,
      channel: data.channel,
      businessId: biz.id,
    });

    return NextResponse.json({
      ok: true,
      sentAt: new Date().toISOString(),
      channel: data.channel,
    });
  } catch (err) {
    return handleApiError(err, { route: "POST /api/reactivation/send" });
  }
}
