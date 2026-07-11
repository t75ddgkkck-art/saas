/**
 * F8 (Lot 38) — POST /api/quotes/[id]/send-signature
 *
 * Envoie le devis au client pour signature électronique.
 *  1. Génère un signature token (32 bytes hex, hash SHA-256 en DB)
 *  2. Envoie email au client avec magic-link `/devis/[token]`
 *  3. Passe le devis en status "sent" si "draft" (ou reste tel quel sinon)
 *
 * TTL du token : 30 jours (fenêtre confortable pour un client BTP).
 * Le token est régénéré si on renvoie → invalide l'ancien.
 *
 * Auth : requireTeamPermission("quotes.edit_any") — owner/admin/employee créateurs.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { quotes, clients, businesses } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { checkRateLimit } from "@/lib/rate-limit";
import { handleApiError, badRequest, notFound } from "@/lib/api-error";
import { requireTeamPermission } from "@/lib/team-context";
import {
  generateSignatureRawToken,
  hashSignatureToken,
  buildSignatureUrl,
  SIGNATURE_TOKEN_TTL_SEC,
} from "@/lib/quote-signature";
import { sendEmail } from "@/lib/email";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const RATE = { key: "quote-send-sig", limit: 30, windowSec: 3600 } as const;

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const rl = checkRateLimit(req, RATE);
  if (!rl.ok) return rl.response;

  const { id } = await ctx.params;

  try {
    const context = await requireTeamPermission("quotes.edit_any");

    // Charge devis + client + business (join pour email destination)
    const rows = await db
      .select({
        quote: quotes,
        clientEmail: clients.email,
        clientFirstName: clients.firstName,
        clientLastName: clients.lastName,
      })
      .from(quotes)
      .leftJoin(clients, eq(quotes.clientId, clients.id))
      .where(
        and(eq(quotes.id, id), eq(quotes.businessId, context.business.id), isNull(quotes.deletedAt))
      )
      .limit(1);

    const row = rows[0];
    if (!row) throw notFound("Devis introuvable");

    if (row.quote.status === "accepted") {
      throw badRequest("Ce devis a déjà été signé.");
    }
    if (!row.clientEmail) {
      throw badRequest("Le client n'a pas d'email — impossible d'envoyer le devis à signer.");
    }

    // Génère nouveau token (invalide l'ancien via UPDATE)
    const rawToken = generateSignatureRawToken();
    const tokenHash = hashSignatureToken(rawToken);
    const expiresAt = new Date(Date.now() + SIGNATURE_TOKEN_TTL_SEC * 1000);

    await db
      .update(quotes)
      .set({
        signatureTokenHash: tokenHash,
        signatureTokenExpiresAt: expiresAt,
        // Si draft → sent, sinon on garde le statut (déclined/expired peuvent renvoyer)
        status: row.quote.status === "draft" ? "sent" : row.quote.status,
        updatedAt: new Date(),
      })
      .where(eq(quotes.id, id));

    // Charge le nom du business pour l'email
    const [biz] = await db
      .select({ name: businesses.name })
      .from(businesses)
      .where(eq(businesses.id, context.business.id))
      .limit(1);

    const signatureUrl = buildSignatureUrl(rawToken);
    const clientName = [row.clientFirstName, row.clientLastName].filter(Boolean).join(" ");
    const bizName = biz?.name ?? "votre professionnel";

    await sendEmail(
      {
        to: row.clientEmail,
        subject: `Devis ${row.quote.quoteNumber} de ${bizName} — à signer`,
        html: buildSignatureEmail({
          clientName: clientName || "Bonjour",
          bizName,
          quoteNumber: row.quote.quoteNumber,
          total: row.quote.total ?? "0",
          signatureUrl,
          expiryDays: 30,
        }),
      },
      { category: "transactional" }
    );

    logger.info("quote.signature.sent", {
      quoteId: id,
      to: row.clientEmail,
      by: context.user.id,
    });

    return NextResponse.json({
      ok: true,
      signatureUrl,
      expiresAt: expiresAt.toISOString(),
      sentTo: row.clientEmail,
    });
  } catch (err) {
    return handleApiError(err, { route: `POST /api/quotes/${id}/send-signature` });
  }
}

function buildSignatureEmail(data: {
  clientName: string;
  bizName: string;
  quoteNumber: string;
  total: string;
  signatureUrl: string;
  expiryDays: number;
}): string {
  return `
    <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #0f172a;">
      <h1 style="font-size: 22px; margin: 0 0 16px;">Votre devis est prêt</h1>
      <p style="color: #334155; margin: 0 0 16px;">${data.clientName},</p>
      <p style="color: #334155; margin: 0 0 24px;">
        <strong>${data.bizName}</strong> vous a préparé un devis
        (<strong>N° ${data.quoteNumber}</strong>) d'un montant de <strong>${data.total} €</strong>.
      </p>
      <p style="color: #334155; margin: 0 0 24px;">
        Cliquez ci-dessous pour consulter le détail et signer électroniquement :
      </p>
      <div style="text-align: center; margin: 32px 0;">
        <a href="${data.signatureUrl}" style="display: inline-block; background: #0f172a; color: white; padding: 14px 28px; border-radius: 10px; text-decoration: none; font-weight: 600;">
          Consulter et signer
        </a>
      </div>
      <p style="color: #64748b; font-size: 13px;">
        Ce lien est valable ${data.expiryDays} jours. Signature électronique légale, aucun compte requis.
      </p>
      <p style="color: #94a3b8; font-size: 12px; margin: 24px 0 0; word-break: break-all;">
        Lien de secours :<br/>
        <a href="${data.signatureUrl}" style="color: #64748b;">${data.signatureUrl}</a>
      </p>
    </div>
  `;
}
