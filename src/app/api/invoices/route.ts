/**
 * Lot 42 (F9) — GET /api/invoices
 * Liste des factures du business courant, du + récent au + ancien.
 *
 * Filtres query :
 *  - status : draft|issued|paid|cancelled (optionnel)
 *  - limit  : cap 100, défaut 50
 *
 * Filtre `deleted_at IS NULL` cohérent avec le reste (soft delete Lot 14).
 * Jointure clients + quotes pour éviter le N+1 côté dashboard.
 */

import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { invoices, clients, quotes } from "@/db/schema";
import { getCurrentBusiness } from "@/lib/session";
import { handleApiError, unauthorized } from "@/lib/api-error";
import { checkRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const RATE = { key: "invoices-list", limit: 60, windowSec: 60 } as const;

export async function GET(req: NextRequest) {
  const rl = checkRateLimit(req, RATE);
  if (!rl.ok) return rl.response;

  try {
    const biz = await getCurrentBusiness();
    if (!biz) throw unauthorized();

    const url = new URL(req.url);
    const statusParam = url.searchParams.get("status");
    const limitParam = url.searchParams.get("limit");
    // Cap à 100 pour éviter les gros pulls accidentels
    const limit = Math.min(100, Math.max(1, Number(limitParam) || 50));

    const conds = [eq(invoices.businessId, biz.id), isNull(invoices.deletedAt)];
    if (
      statusParam === "draft" ||
      statusParam === "issued" ||
      statusParam === "paid" ||
      statusParam === "cancelled"
    ) {
      conds.push(eq(invoices.status, statusParam));
    }

    const rows = await db
      .select({
        id: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        issueDate: invoices.issueDate,
        dueDate: invoices.dueDate,
        total: invoices.total,
        currency: invoices.currency,
        status: invoices.status,
        pdfUrl: invoices.pdfUrl,
        sentAt: invoices.sentAt,
        paidAt: invoices.paidAt,
        quoteNumber: quotes.quoteNumber,
        clientFirstName: clients.firstName,
        clientLastName: clients.lastName,
        clientEmail: clients.email,
        createdAt: invoices.createdAt,
      })
      .from(invoices)
      .leftJoin(quotes, eq(invoices.quoteId, quotes.id))
      .leftJoin(clients, eq(invoices.clientId, clients.id))
      .where(and(...conds))
      .orderBy(desc(invoices.createdAt))
      .limit(limit);

    return NextResponse.json({ ok: true, invoices: rows });
  } catch (err) {
    return handleApiError(err, { route: "GET /api/invoices" });
  }
}
