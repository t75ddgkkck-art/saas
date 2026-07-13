/**
 * Lot 42 (F9) — Actions individuelles sur une facture.
 *
 * GET    /api/invoices/[id] → détail (incl. pdfUrl à télécharger)
 * PATCH  /api/invoices/[id] → { status: "paid" | "cancelled", notes?: string }
 *                            (on ne permet PAS de modifier total/items — immuable
 *                             conformément à l'obligation légale FR)
 *
 * Auth : owner OU membre équipe avec cap "invoices.manage" (fallback owner-only pour l'instant).
 */

import { NextRequest, NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { invoices } from "@/db/schema";
import { getCurrentBusiness } from "@/lib/session";
import { handleApiError, notFound, unauthorized } from "@/lib/api-error";
import { validateBody } from "@/lib/api-helpers";
import { checkRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const RATE = { key: "invoice-detail", limit: 60, windowSec: 60 } as const;

async function loadInvoice(id: string, businessId: string) {
  const [row] = await db
    .select()
    .from(invoices)
    .where(
      and(eq(invoices.id, id), eq(invoices.businessId, businessId), isNull(invoices.deletedAt))
    )
    .limit(1);
  return row ?? null;
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const rl = checkRateLimit(req, RATE);
  if (!rl.ok) return rl.response;

  try {
    const biz = await getCurrentBusiness();
    if (!biz) throw unauthorized();

    const { id } = await ctx.params;
    const row = await loadInvoice(id, biz.id);
    if (!row) throw notFound("Facture introuvable");

    return NextResponse.json({ ok: true, invoice: row });
  } catch (err) {
    return handleApiError(err, { route: "GET /api/invoices/[id]" });
  }
}

// -----------------------------------------------------------------------------
// PATCH : update statut/notes UNIQUEMENT
// -----------------------------------------------------------------------------
const PatchSchema = z.object({
  status: z.enum(["paid", "cancelled"]).optional(),
  notes: z.string().max(2000).optional(),
});

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const rl = checkRateLimit(req, RATE);
  if (!rl.ok) return rl.response;

  try {
    const biz = await getCurrentBusiness();
    if (!biz) throw unauthorized();

    const { id } = await ctx.params;
    const existing = await loadInvoice(id, biz.id);
    if (!existing) throw notFound("Facture introuvable");

    const data = await validateBody(req, PatchSchema);

    // Défensif : on ne laisse jamais repasser une facture "cancelled" à un autre statut
    // (obligation légale — une facture annulée doit rester annulée, l'artisan doit
    //  émettre un avoir).
    if (existing.status === "cancelled") {
      return NextResponse.json(
        { ok: false, error: "Une facture annulée ne peut être modifiée (émettre un avoir)." },
        { status: 400 }
      );
    }

    const updates: Partial<typeof invoices.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (data.status === "paid") {
      updates.status = "paid";
      updates.paidAt = new Date();
    } else if (data.status === "cancelled") {
      updates.status = "cancelled";
    }
    if (data.notes !== undefined) {
      updates.notes = data.notes;
    }

    const [updated] = await db
      .update(invoices)
      .set(updates)
      .where(and(eq(invoices.id, id), eq(invoices.businessId, biz.id)))
      .returning();

    return NextResponse.json({ ok: true, invoice: updated });
  } catch (err) {
    return handleApiError(err, { route: "PATCH /api/invoices/[id]" });
  }
}
