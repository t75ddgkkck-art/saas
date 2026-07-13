/**
 * F8 (Lot 38) — Routes publiques signature devis.
 *
 * GET  /api/quotes/sign?token=<raw>  → peek du devis + items (aperçu client)
 * POST /api/quotes/sign              → applique la signature (transition state)
 *
 * Sécurité : le token EST le secret. Aucune auth cookie. Toujours 404 si
 * token invalide/expiré (jamais 401 → pas de leak).
 *
 * Anti-replay : passage en status "accepted" invalide le token (SET signatureTokenHash = null).
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { quotes, quoteItems, clients, businesses } from "@/db/schema";
import { and, eq, gt, isNull } from "drizzle-orm";
import { checkRateLimit } from "@/lib/rate-limit";
import { validateBody } from "@/lib/api-helpers";
import { handleApiError, badRequest } from "@/lib/api-error";
import {
  hashSignatureToken,
  computeSignatureHash,
  computeItemsFingerprint,
} from "@/lib/quote-signature";
import { notifyAsync } from "@/lib/notify";
import { logger } from "@/lib/logger";
// Lot 42 (F9) : facture auto post-signature. Fire-and-forget → n'attend pas
// la génération PDF/email pour répondre au client (< 3 s garantis pour l'UX signature).
import { generateInvoiceForSignedQuote } from "@/lib/invoice-generator";

export const dynamic = "force-dynamic";

const PEEK_RATE = { key: "quote-sign-peek", limit: 30, windowSec: 60 } as const;
const SIGN_RATE = { key: "quote-sign-post", limit: 10, windowSec: 3600 } as const;

// -----------------------------------------------------------------------------
// GET → peek public (aperçu du devis)
// -----------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  const rl = checkRateLimit(req, PEEK_RATE);
  if (!rl.ok) return rl.response;

  const token = new URL(req.url).searchParams.get("token") ?? "";
  if (!token || token.length !== 64) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  try {
    const tokenHash = hashSignatureToken(token);
    const rows = await db
      .select({
        quote: quotes,
        clientFirstName: clients.firstName,
        clientLastName: clients.lastName,
        clientEmail: clients.email,
        bizName: businesses.name,
        bizAddress: businesses.address,
        bizCity: businesses.city,
        bizPostalCode: businesses.postalCode,
        bizPhone: businesses.phone,
        bizEmail: businesses.email,
        bizSiret: businesses.siret,
      })
      .from(quotes)
      .leftJoin(clients, eq(quotes.clientId, clients.id))
      .innerJoin(businesses, eq(quotes.businessId, businesses.id))
      .where(
        and(
          eq(quotes.signatureTokenHash, tokenHash),
          gt(quotes.signatureTokenExpiresAt, new Date()),
          isNull(quotes.deletedAt)
        )
      )
      .limit(1);

    const row = rows[0];
    if (!row) return NextResponse.json({ ok: false }, { status: 404 });

    // Charge les items du devis
    const items = await db.select().from(quoteItems).where(eq(quoteItems.quoteId, row.quote.id));

    return NextResponse.json({
      ok: true,
      quote: {
        id: row.quote.id,
        number: row.quote.quoteNumber,
        title: row.quote.title,
        description: row.quote.description,
        subtotal: row.quote.subtotal,
        tax: row.quote.tax,
        total: row.quote.total,
        depositAmount: row.quote.depositAmount,
        validUntil: row.quote.validUntil,
        termsAndConditions: row.quote.termsAndConditions,
        status: row.quote.status,
        alreadySigned: row.quote.signedAt !== null,
        signedAt: row.quote.signedAt,
      },
      items,
      client: {
        firstName: row.clientFirstName,
        lastName: row.clientLastName,
        email: row.clientEmail,
      },
      business: {
        name: row.bizName,
        address: row.bizAddress,
        city: row.bizCity,
        postalCode: row.bizPostalCode,
        phone: row.bizPhone,
        email: row.bizEmail,
        siret: row.bizSiret,
      },
    });
  } catch (err) {
    return handleApiError(err, { route: "GET /api/quotes/sign" });
  }
}

// -----------------------------------------------------------------------------
// POST → applique la signature
// -----------------------------------------------------------------------------

const SignSchema = z.object({
  token: z.string().length(64),
  /** Data URL base64 du canvas de signature (optionnel — sinon "typed name" seul) */
  signatureDataUrl: z.string().max(200_000).optional(),
  /** Nom tapé du signataire (obligatoire si pas de dessin, sinon complément) */
  typedName: z.string().trim().min(2).max(100),
  /** Email de confirmation (pré-rempli côté client depuis clients.email) */
  email: z.string().trim().toLowerCase().email(),
  /** Accepte les CGV (obligatoire) */
  acceptTerms: z.literal(true),
});

export async function POST(req: NextRequest) {
  const rl = checkRateLimit(req, SIGN_RATE);
  if (!rl.ok) return rl.response;

  try {
    const data = await validateBody(req, SignSchema);
    const tokenHash = hashSignatureToken(data.token);

    // Charge le devis en atomique via WHERE token valide + non signé
    const rows = await db
      .select({ quote: quotes, ownerId: businesses.ownerId })
      .from(quotes)
      .innerJoin(businesses, eq(quotes.businessId, businesses.id))
      .where(
        and(
          eq(quotes.signatureTokenHash, tokenHash),
          gt(quotes.signatureTokenExpiresAt, new Date()),
          isNull(quotes.deletedAt),
          isNull(quotes.signedAt)
        )
      )
      .limit(1);

    const row = rows[0];
    if (!row) throw badRequest("Ce lien n'est plus valide (expiré ou déjà signé).");

    // Récupère items pour l'empreinte d'intégrité
    const items = await db
      .select({
        description: quoteItems.description,
        quantity: quoteItems.quantity,
        unitPrice: quoteItems.unitPrice,
      })
      .from(quoteItems)
      .where(eq(quoteItems.quoteId, row.quote.id));

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
    const userAgent = req.headers.get("user-agent") ?? "";
    const signedAt = new Date();

    // Calcul du hash de preuve
    const signatureHash = computeSignatureHash({
      quoteId: row.quote.id,
      total: row.quote.total ?? "0",
      itemsFingerprint: computeItemsFingerprint(items),
      signedByEmail: data.email,
      signedAt: signedAt.toISOString(),
      signedIp: ip,
      signedUserAgent: userAgent,
    });

    // Update atomique : ne signe que si signedAt IS NULL (double-clic safe)
    const updated = await db
      .update(quotes)
      .set({
        status: "accepted",
        signedAt,
        signature: data.typedName, // nom tapé stocké en clair (usage légal FR)
        signatureUrl: data.signatureDataUrl ?? null, // dessin optionnel
        signatureHash,
        signedByEmail: data.email,
        signedIp: ip.slice(0, 45),
        signedUserAgent: userAgent.slice(0, 500),
        // Invalide le token — un lien de signature ne sert qu'une fois
        signatureTokenHash: null,
        signatureTokenExpiresAt: null,
        updatedAt: signedAt,
      })
      .where(and(eq(quotes.id, row.quote.id), isNull(quotes.signedAt)))
      .returning({ id: quotes.id });

    if (updated.length === 0) {
      // Race condition : quelqu'un a signé entre le select et l'update
      throw badRequest("Ce devis vient d'être signé, rechargez la page.");
    }

    logger.info("quote.signed", {
      quoteId: row.quote.id,
      email: data.email,
      ip: ip.slice(0, 20),
    });

    // Notif au pro (owner + créateur si différent)
    notifyAsync({
      userId: row.ownerId,
      businessId: row.quote.businessId,
      type: "quote.accepted",
      title: "Devis signé ✍️",
      message: `${data.typedName} a signé le devis ${row.quote.quoteNumber} (${row.quote.total} €)`,
      data: { quoteId: row.quote.id },
      url: `/dashboard/quotes/${row.quote.id}`,
      priority: "high",
      tag: `quote-signed-${row.quote.id}`,
    });

    // Lot 42 (F9) : génération facture PDF auto FIRE-AND-FORGET.
    // On ne fait PAS `await` : la signature est déjà persistée en DB, l'UX
    // du client doit renvoyer OK immédiatement. La facture arrive < 5 s
    // dans la boîte mail (email async) + apparait dans /dashboard/invoices.
    // Si le plan n'a pas l'entitlement, la fonction est un no-op silencieux.
    // Toutes les exceptions sont catchées côté generateInvoiceForSignedQuote.
    void generateInvoiceForSignedQuote(row.quote.id);

    return NextResponse.json({
      ok: true,
      quoteId: row.quote.id,
      signedAt: signedAt.toISOString(),
    });
  } catch (err) {
    return handleApiError(err, { route: "POST /api/quotes/sign" });
  }
}
