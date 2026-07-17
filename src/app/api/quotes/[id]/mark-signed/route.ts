/**
 * Lot 58 MAJ2 — POST /api/quotes/[id]/mark-signed
 *
 * Marque un devis comme signé EN PRÉSENTIEL par le pro.
 * Cas d'usage : le pro visite le client, celui-ci signe sur la tablette du pro.
 *
 * Différence avec `/api/quotes/sign` :
 *  - `/api/quotes/sign` : signature distante via token magic-link envoyé au client
 *  - `/api/quotes/[id]/mark-signed` : signature en présentiel, auth via session pro
 *
 * Sécurité :
 *  - Auth requise (session pro) + permission équipe `quotes.edit_any`
 *  - Ownership check : le devis doit appartenir au business du pro
 *  - Anti-double-signature : WHERE isNull(signedAt) au moment du UPDATE
 *  - Le nom tapé + signature dessinée sont OBLIGATOIRES (preuve légale)
 *
 * Effets de bord identiques à /api/quotes/sign :
 *  - status → "accepted"
 *  - notif au pro (traçabilité "qui a signé quoi")
 *  - facture auto générée (fire-and-forget)
 *  - PAS d'acompte Stripe déclenché ici (le pro encaisse en direct en présentiel,
 *    généralement chèque ou virement immédiat)
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { quotes, quoteItems, businesses } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { checkRateLimit } from "@/lib/rate-limit";
import { validateBody } from "@/lib/api-helpers";
import { handleApiError, badRequest, notFound } from "@/lib/api-error";
import { requireTeamPermission } from "@/lib/team-context";
import { computeSignatureHash, computeItemsFingerprint } from "@/lib/quote-signature";
import { notifyAsync } from "@/lib/notify";
import { logger } from "@/lib/logger";
// Facture auto post-signature (identique à /api/quotes/sign) — fire-and-forget
import { generateInvoiceForSignedQuote } from "@/lib/invoice-generator";

export const dynamic = "force-dynamic";

// Rate-limit strict : signature = action rare et lourde (write + notif + PDF facture).
// 20/h par pro suffit largement (un pro fait max ~5 signatures/jour en moyenne).
const RATE = { key: "quote-mark-signed", limit: 20, windowSec: 3600 } as const;

const Schema = z.object({
  // Nom tapé par le client dans le formulaire — usage légal FR (identifie qui a signé)
  typedName: z.string().trim().min(2, "Nom requis").max(100),
  // Email du client (pour la trace) — optionnel car le client peut ne pas en avoir
  email: z.string().email().max(200).optional(),
  // Signature dessinée en data URL (base64 PNG) — OBLIGATOIRE côté présentiel :
  // c'est la seule preuve visuelle qu'on a. Sur /sign public, elle est optionnelle
  // car le token + IP + user-agent + nom tapé fournissent déjà la preuve.
  signatureDataUrl: z
    .string()
    .startsWith("data:image/", "Format signature invalide")
    .max(500_000, "Signature trop lourde"),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const rl = checkRateLimit(req, RATE);
  if (!rl.ok) return rl.response;

  const { id } = await ctx.params;

  try {
    // Permission équipe : owner/admin/employee peuvent signer un devis en présentiel.
    // viewer ne peut PAS (lecture seule). requireTeamPermission throw unauthorized/forbidden
    // si l'user n'a pas la capability → catch remonté par handleApiError.
    const ctxTeam = await requireTeamPermission("quotes.edit_any");

    const data = await validateBody(req, Schema);

    // Ownership check via businessId (anti-IDOR) + non déjà signé
    const [row] = await db
      .select({
        quote: quotes,
        ownerId: businesses.ownerId,
      })
      .from(quotes)
      .innerJoin(businesses, eq(quotes.businessId, businesses.id))
      .where(
        and(
          eq(quotes.id, id),
          eq(quotes.businessId, ctxTeam.business.id),
          isNull(quotes.deletedAt)
        )
      )
      .limit(1);

    if (!row) throw notFound("Devis introuvable");
    if (row.quote.signedAt) {
      throw badRequest("Ce devis est déjà signé.");
    }

    // Items pour l'empreinte d'intégrité (identique à /api/quotes/sign)
    const items = await db
      .select({
        description: quoteItems.description,
        quantity: quoteItems.quantity,
        unitPrice: quoteItems.unitPrice,
      })
      .from(quoteItems)
      .where(eq(quoteItems.quoteId, id));

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
    const userAgent = req.headers.get("user-agent") ?? "";
    const signedAt = new Date();
    const signedByEmail = data.email ?? "presentiel@vitrix.local";

    // Hash de preuve — mêmes inputs que la signature distante pour cohérence audit
    const signatureHash = computeSignatureHash({
      quoteId: row.quote.id,
      total: row.quote.total ?? "0",
      itemsFingerprint: computeItemsFingerprint(items),
      signedByEmail,
      signedAt: signedAt.toISOString(),
      signedIp: ip,
      signedUserAgent: userAgent,
    });

    // Update atomique : WHERE isNull(signedAt) protège contre le double-clic
    const updated = await db
      .update(quotes)
      .set({
        status: "accepted",
        signedAt,
        signature: data.typedName,
        signatureUrl: data.signatureDataUrl,
        signatureHash,
        signedByEmail,
        signedIp: ip.slice(0, 45),
        signedUserAgent: userAgent.slice(0, 500),
        // Le token de signature à distance devient caduc — on l'invalide
        signatureTokenHash: null,
        signatureTokenExpiresAt: null,
        updatedAt: signedAt,
      })
      .where(and(eq(quotes.id, id), isNull(quotes.signedAt)))
      .returning({ id: quotes.id });

    if (updated.length === 0) {
      // Race condition : quelqu'un vient de signer entre le SELECT et l'UPDATE
      throw badRequest("Ce devis vient d'être signé, rechargez la page.");
    }

    logger.info("quote.mark_signed_presentiel", {
      quoteId: id,
      businessId: ctxTeam.business.id,
      signedBy: ctxTeam.user.id,
    });

    // Notif interne au pro (utile pour l'historique : "signé par X en présentiel")
    notifyAsync({
      userId: row.ownerId,
      businessId: row.quote.businessId,
      type: "quote.accepted",
      title: "Devis signé en présentiel ✍️",
      message: `${data.typedName} a signé le devis ${row.quote.quoteNumber} (${row.quote.total} €)`,
      data: { quoteId: id, presentiel: true },
      url: `/dashboard/quotes/${id}`,
      priority: "normal",
      tag: `quote-signed-${id}`,
    });

    // Facture auto (fire-and-forget, comme dans /api/quotes/sign)
    generateInvoiceForSignedQuote(id).catch((err) => {
      logger.error("quote.mark_signed.invoice_failed", {
        quoteId: id,
        message: err instanceof Error ? err.message : String(err),
      });
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err, { route: `POST /api/quotes/${id}/mark-signed` });
  }
}
