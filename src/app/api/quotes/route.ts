/**
 * GET /api/quotes
 * Liste les devis du business courant, du + récent au + ancien.
 *
 * Filtre `deleted_at IS NULL` (Lot 14) pour respecter le soft delete.
 * Jointure clients pour renvoyer directement les noms au dashboard
 * → évite N+1 côté client.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { quotes, quoteItems, clients } from "@/db/schema";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { getCurrentBusiness, getCurrentUser } from "@/lib/session";
import { handleApiError, badRequest, unauthorized } from "@/lib/api-error";
import { validateBody } from "@/lib/api-helpers";
import { checkRateLimit } from "@/lib/rate-limit";
import { dispatchWebhook } from "@/lib/webhooks-out";

export const dynamic = "force-dynamic";

/**
 * Génère un numéro de devis lisible : DEV-YYYY-NNNN.
 * NNNN = compteur incrémenté par business et par année (0001, 0002…).
 * On requête directement en SQL avec COUNT pour éviter d'ajouter une séquence
 * dédiée par business — suffit tant qu'on est < 10k devis/an/business.
 */
async function generateQuoteNumber(businessId: string): Promise<string> {
  const year = new Date().getFullYear();
  const rows = await db
    .select({ count: sql<string>`count(*)::text` })
    .from(quotes)
    .where(
      and(eq(quotes.businessId, businessId), sql`extract(year from ${quotes.createdAt}) = ${year}`)
    );
  const next = (Number(rows[0]?.count ?? "0") + 1).toString().padStart(4, "0");
  return `DEV-${year}-${next}`;
}

const CreateQuoteSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional(),
  category: z.string().trim().max(100).optional(),
  clientId: z.string().uuid().optional(),
  // Client création à la volée (si pas d'ID)
  client: z
    .object({
      firstName: z.string().min(1).max(100),
      lastName: z.string().min(1).max(100),
      phone: z.string().min(4).max(20),
      email: z.string().email().max(255).optional(),
    })
    .optional(),
  items: z
    .array(
      z.object({
        description: z.string().min(1).max(500),
        quantity: z.number().int().min(1).max(9999),
        unitPrice: z.number().min(0).max(999999),
      })
    )
    .min(1, "Au moins une ligne requise")
    .max(50, "Maximum 50 lignes"),
  taxRate: z.number().min(0).max(100).default(20),
  depositAmount: z.number().min(0).max(999999).optional(),
  validityDays: z.number().int().min(1).max(365).default(30),
  termsAndConditions: z.string().max(3000).optional(),
});

export async function GET() {
  try {
    const business = await getCurrentBusiness();
    if (!business) throw unauthorized();

    const rows = await db
      .select({
        id: quotes.id,
        quoteNumber: quotes.quoteNumber,
        title: quotes.title,
        status: quotes.status,
        subtotal: quotes.subtotal,
        tax: quotes.tax,
        total: quotes.total,
        depositAmount: quotes.depositAmount,
        validUntil: quotes.validUntil,
        signedAt: quotes.signedAt,
        createdAt: quotes.createdAt,
        clientFirstName: clients.firstName,
        clientLastName: clients.lastName,
      })
      .from(quotes)
      .leftJoin(clients, eq(clients.id, quotes.clientId))
      .where(and(eq(quotes.businessId, business.id), isNull(quotes.deletedAt)))
      .orderBy(desc(quotes.createdAt));

    return NextResponse.json({ quotes: rows });
  } catch (err) {
    return handleApiError(err, { route: "GET /api/quotes" });
  }
}

/**
 * POST /api/quotes
 * Crée un devis + ses items dans une transaction.
 * Résout ou crée le client (par phone si createur à la volée).
 * Dispatch webhook `quote.sent` si le devis est créé en statut "sent" plus tard.
 * Ici on force le statut "draft" à la création → l'envoi se fera via une
 * route `POST /api/quotes/[id]/send` dédiée (à ajouter au Lot 20).
 */
export async function POST(req: NextRequest) {
  // 20 devis / heure / IP : anti-flood raisonnable, laisse largement travailler
  const rl = checkRateLimit(req, { key: "quotes:create", limit: 20, windowSec: 3600 });
  if (!rl.ok) return rl.response;

  try {
    const user = await getCurrentUser();
    if (!user) throw unauthorized();
    const business = await getCurrentBusiness();
    if (!business) throw badRequest("Aucun business associé à votre compte");

    const data = await validateBody(req, CreateQuoteSchema);

    // Calculs côté serveur (jamais confiance aux valeurs client)
    const subtotal = data.items.reduce((s, it) => s + it.quantity * it.unitPrice, 0);
    const tax = subtotal * (data.taxRate / 100);
    const total = subtotal + tax;

    // Validity date
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + data.validityDays);
    const validUntilStr = validUntil.toISOString().slice(0, 10);

    // Résolution client
    let clientId: string | null = data.clientId ?? null;
    if (!clientId && data.client) {
      // Upsert par (business, phone)
      const [existing] = await db
        .select({ id: clients.id })
        .from(clients)
        .where(
          and(
            eq(clients.businessId, business.id),
            eq(clients.phone, data.client.phone),
            isNull(clients.deletedAt)
          )
        )
        .limit(1);
      if (existing) {
        clientId = existing.id;
      } else {
        const [created] = await db
          .insert(clients)
          .values({
            businessId: business.id,
            firstName: data.client.firstName,
            lastName: data.client.lastName,
            phone: data.client.phone,
            email: data.client.email ?? null,
            source: "other",
          })
          .returning({ id: clients.id });
        clientId = created.id;
      }
    }

    // Anti-IDOR : le clientId fourni doit appartenir au même business
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
      if (!owned) throw badRequest("Client inconnu");
    }

    const quoteNumber = await generateQuoteNumber(business.id);

    // Transaction : quote + items en atomique
    const created = await db.transaction(async (tx) => {
      const [q] = await tx
        .insert(quotes)
        .values({
          businessId: business.id,
          clientId,
          createdBy: user.id,
          quoteNumber,
          title: data.title,
          description: data.description ?? null,
          category: data.category ?? null,
          subtotal: subtotal.toFixed(2),
          tax: tax.toFixed(2),
          total: total.toFixed(2),
          depositAmount: data.depositAmount ? data.depositAmount.toFixed(2) : null,
          status: "draft",
          validUntil: validUntilStr,
          termsAndConditions: data.termsAndConditions ?? null,
        })
        .returning();

      // Insert items
      await tx.insert(quoteItems).values(
        data.items.map((it) => ({
          quoteId: q.id,
          description: it.description,
          quantity: it.quantity,
          unitPrice: it.unitPrice.toFixed(2),
          total: (it.quantity * it.unitPrice).toFixed(2),
        }))
      );

      return q;
    });

    // Webhook sortant (draft ne déclenche pas quote.sent — juste log info)
    dispatchWebhook("quote.sent", business.id, {
      id: created.id,
      quoteNumber: created.quoteNumber,
      title: created.title,
      total: created.total,
      status: created.status,
      clientId: created.clientId,
    });

    return NextResponse.json({ quote: created }, { status: 201 });
  } catch (err) {
    return handleApiError(err, { route: "POST /api/quotes" });
  }
}
