/**
 * Lot 47 (F12) — DELETE /api/qr-codes/[id]
 *
 * Soft delete d'un QR code. Les scans historiques sont préservés dans
 * `page_visits` (source pas nettoyée) → analytics reste intactes.
 *
 * L'unicité `(business_id, source)` étant sur qr_codes uniquement, un soft
 * delete PERMET de recréer un QR avec la même source ensuite (index partiel ?
 * non — l'index actuel n'est pas partiel, donc un DELETE hard serait requis
 * pour réutiliser la même source. On documente : le pro doit choisir une
 * nouvelle source s'il veut recréer un tracking sur le même support).
 *
 * NB : pour éviter d'avoir des soft-deleted qui bloquent l'unique, on pourrait
 * transformer l'index en partiel `WHERE deleted_at IS NULL` en Lot ultérieur.
 * Pour l'instant on garde simple.
 */

import { NextRequest, NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { qrCodes } from "@/db/schema";
import { getCurrentBusiness } from "@/lib/session";
import { handleApiError, notFound, unauthorized } from "@/lib/api-error";
import { checkRateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const RATE = { key: "qr-code-delete", limit: 20, windowSec: 60 } as const;

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const rl = checkRateLimit(req, RATE);
  if (!rl.ok) return rl.response;

  try {
    const biz = await getCurrentBusiness();
    if (!biz) throw unauthorized();

    const { id } = await ctx.params;

    // Anti-IDOR : le QR doit appartenir au business courant
    const [existing] = await db
      .select({ id: qrCodes.id })
      .from(qrCodes)
      .where(and(eq(qrCodes.id, id), eq(qrCodes.businessId, biz.id), isNull(qrCodes.deletedAt)))
      .limit(1);

    if (!existing) throw notFound("QR code introuvable");

    await db
      .update(qrCodes)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(qrCodes.id, id));

    logger.info("qr-code.deleted", { qrId: id, businessId: biz.id });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err, { route: "DELETE /api/qr-codes/[id]" });
  }
}
