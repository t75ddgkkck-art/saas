/**
 * GET  /api/payments — liste des paiements du business + jointure client/devis
 * POST /api/payments — enregistrement manuel d'un paiement (espèces, virement,
 *                     chèque) NON traité par Stripe → juste une trace comptable
 *
 * Le paiement automatique via Stripe est géré par le webhook Stripe (Lot 11)
 * qui insère directement dans `payments`. Cette route sert au pro qui
 * encaisse en main propre et veut logger dans son CRM.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { payments, clients, quotes } from "@/db/schema";
import { and, desc, eq, gte, isNull } from "drizzle-orm";
import { getCurrentBusiness } from "@/lib/session";
import { checkRateLimit } from "@/lib/rate-limit";
import { validateBody } from "@/lib/api-helpers";
import { handleApiError, badRequest, unauthorized } from "@/lib/api-error";
import { dispatchWebhook } from "@/lib/webhooks-out";

export const dynamic = "force-dynamic";

const CreateSchema = z.object({
  clientId: z.string().uuid().optional().nullable(),
  quoteId: z.string().uuid().optional().nullable(),
  amount: z.number().positive("Montant doit être positif").max(999999.99),
  currency: z.string().length(3).default("EUR"),
  type: z.enum(["deposit", "full", "subscription"]),
  status: z.enum(["pending", "completed", "failed", "refunded"]).default("completed"),
  // Méthode texte libre (espèces, virement, chèque, CB terminal...) — stocké en meta
  method: z.string().max(50).optional(),
  note: z.string().max(500).optional(),
});

export async function GET(req: NextRequest) {
  try {
    const business = await getCurrentBusiness();
    if (!business) throw unauthorized();

    // Filtre optionnel : ?fromDays=30 → paiements des 30 derniers jours
    const url = new URL(req.url);
    const fromDays = Number(url.searchParams.get("fromDays"));

    const filters = [eq(payments.businessId, business.id)];
    if (Number.isFinite(fromDays) && fromDays > 0 && fromDays <= 365) {
      const since = new Date(Date.now() - fromDays * 24 * 60 * 60 * 1000);
      filters.push(gte(payments.createdAt, since));
    }

    const rows = await db
      .select({
        id: payments.id,
        amount: payments.amount,
        currency: payments.currency,
        type: payments.type,
        status: payments.status,
        stripePaymentId: payments.stripePaymentId,
        invoiceGenerated: payments.invoiceGenerated,
        invoiceUrl: payments.invoiceUrl,
        metadata: payments.metadata,
        createdAt: payments.createdAt,
        clientId: payments.clientId,
        clientFirstName: clients.firstName,
        clientLastName: clients.lastName,
        quoteId: payments.quoteId,
        quoteNumber: quotes.quoteNumber,
      })
      .from(payments)
      .leftJoin(clients, eq(clients.id, payments.clientId))
      .leftJoin(quotes, eq(quotes.id, payments.quoteId))
      .where(and(...filters))
      .orderBy(desc(payments.createdAt));

    return NextResponse.json({ payments: rows });
  } catch (err) {
    return handleApiError(err, { route: "GET /api/payments" });
  }
}

export async function POST(req: NextRequest) {
  const rl = checkRateLimit(req, {
    key: "payments:create",
    limit: 60,
    windowSec: 3600,
  });
  if (!rl.ok) return rl.response;

  try {
    const business = await getCurrentBusiness();
    if (!business) throw unauthorized();

    const data = await validateBody(req, CreateSchema);

    // Anti-IDOR clientId / quoteId
    if (data.clientId) {
      const [owned] = await db
        .select({ id: clients.id })
        .from(clients)
        .where(
          and(
            eq(clients.id, data.clientId),
            eq(clients.businessId, business.id),
            isNull(clients.deletedAt)
          )
        )
        .limit(1);
      if (!owned) throw badRequest("Client introuvable");
    }
    if (data.quoteId) {
      const [owned] = await db
        .select({ id: quotes.id })
        .from(quotes)
        .where(
          and(
            eq(quotes.id, data.quoteId),
            eq(quotes.businessId, business.id),
            isNull(quotes.deletedAt)
          )
        )
        .limit(1);
      if (!owned) throw badRequest("Devis introuvable");
    }

    const [created] = await db
      .insert(payments)
      .values({
        businessId: business.id,
        clientId: data.clientId ?? null,
        quoteId: data.quoteId ?? null,
        amount: data.amount.toFixed(2),
        currency: data.currency,
        type: data.type,
        status: data.status,
        // Méthode + note stockées en meta (colonne jsonb existante)
        metadata: {
          method: data.method ?? "manual",
          note: data.note ?? null,
          recordedAt: new Date().toISOString(),
        },
      })
      .returning();

    // Webhook sortant vers les endpoints du business
    dispatchWebhook("payment.received", business.id, {
      id: created.id,
      amount: created.amount,
      currency: created.currency,
      type: created.type,
      status: created.status,
      clientId: created.clientId,
      quoteId: created.quoteId,
    });

    return NextResponse.json({ payment: created }, { status: 201 });
  } catch (err) {
    return handleApiError(err, { route: "POST /api/payments" });
  }
}
