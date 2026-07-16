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
// Lot 43 (F2+F8 fusion) : acompte Stripe à la signature. Contrairement à la
// facture, celui-ci EST attendu (await) car on doit renvoyer l'URL Checkout
// au client dans la réponse pour redirection immédiate.
import { createQuoteDepositCheckoutSession } from "@/lib/stripe";
import { isStripeConfigured } from "@/lib/stripe";
import { canUse } from "@/lib/entitlements";
import { users } from "@/db/schema";
import { DEPOSIT_CHECKOUT_EXPIRY_SEC } from "@/lib/deposit";

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

    // Charge le devis en atomique via WHERE token valide + non signé.
    // Lot 43 : on ramène aussi le stripeAccountId + slug + plan owner pour
    // décider si on propose l'acompte à la signature sans faire un 2e round-trip DB.
    const rows = await db
      .select({
        quote: quotes,
        ownerId: businesses.ownerId,
        bizSlug: businesses.slug,
        bizStripeAccountId: businesses.stripeAccountId,
        bizEnableStripe: businesses.enableStripe,
        ownerPlan: users.subscription,
      })
      .from(quotes)
      .innerJoin(businesses, eq(quotes.businessId, businesses.id))
      .innerJoin(users, eq(businesses.ownerId, users.id))
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

    // Lot 43 (F2+F8 fusion) — Acompte Stripe à la signature.
    //
    // Conditions cumulatives pour proposer le Checkout :
    //  1. Le devis A un acompte configuré (depositAmount > 0)
    //  2. Le business a Stripe Connect actif (enableStripe + stripeAccountId)
    //  3. Le pro (owner) a l'entitlement `payments.stripe` (plan Pro+)
    //  4. Stripe est configuré côté serveur (clé secrète en env)
    //  5. Le montant en centimes est ≥ 50 (minimum charge Stripe EUR)
    //
    // Si l'une de ces conditions manque → on renvoie juste la signature confirmée
    // sans checkoutUrl. Le client verra "Merci, devis signé !" comme avant.
    //
    // Si tout est OK → checkoutUrl inclus dans la réponse, le client sera
    // redirigé vers Stripe côté <QuoteSignFlow>.
    let checkoutUrl: string | undefined;
    let depositCents: number | undefined;

    try {
      const depositEuros = Number(row.quote.depositAmount ?? "0");
      const cents = Math.round(depositEuros * 100);

      const canOfferDeposit =
        cents >= 50 &&
        isStripeConfigured() &&
        !!row.bizStripeAccountId &&
        !!row.bizEnableStripe &&
        canUse(row.ownerPlan, "payments.stripe");

      if (canOfferDeposit && row.bizStripeAccountId) {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.vitrix.fr";
        // Success/cancel renvoient sur la MÊME page /devis/[token] avec un flag
        // → QuoteSignFlow détecte le retour et affiche l'écran "Merci, acompte reçu"
        //   OU "Signé mais acompte non payé, contactez le pro directement"
        const successUrl = `${appUrl}/devis/paye?quote=${row.quote.id}`;
        const cancelUrl = `${appUrl}/devis/paye?quote=${row.quote.id}&canceled=1`;

        const session = await createQuoteDepositCheckoutSession({
          businessStripeAccountId: row.bizStripeAccountId,
          businessId: row.quote.businessId,
          quoteId: row.quote.id,
          quoteNumber: row.quote.quoteNumber,
          amountCents: cents,
          clientEmail: data.email,
          successUrl,
          cancelUrl,
          expiresInSec: DEPOSIT_CHECKOUT_EXPIRY_SEC,
        });

        if (session.url) {
          checkoutUrl = session.url;
          depositCents = cents;
          // Lie la session au devis pour le webhook (idempotence via index partiel)
          await db
            .update(quotes)
            .set({
              stripeDepositSessionId: session.id,
              depositAmountCents: cents,
              updatedAt: new Date(),
            })
            .where(eq(quotes.id, row.quote.id));

          logger.info("quote.deposit.session_created", {
            quoteId: row.quote.id,
            sessionId: session.id,
            amountCents: cents,
          });
        }
      }
    } catch (err) {
      // ⚠️ ÉCHEC Stripe = LOG + CONTINUE. La signature EST déjà persistée,
      // on ne rollback JAMAIS pour un problème de paiement. Le pro pourra
      // relancer manuellement pour l'acompte.
      logger.error("quote.deposit.session_failed", {
        quoteId: row.quote.id,
        err: err instanceof Error ? err.message : String(err),
      });
    }

    return NextResponse.json({
      ok: true,
      quoteId: row.quote.id,
      signedAt: signedAt.toISOString(),
      // Optionnels — présents SEULEMENT si l'acompte peut être encaissé
      checkoutUrl,
      depositAmountCents: depositCents,
    });
  } catch (err) {
    return handleApiError(err, { route: "POST /api/quotes/sign" });
  }
}
