/**
 * POST /api/admin/users/[id]/plan
 * Override manuel du plan (free/pro/premium). Utilisé pour :
 *  - Comps offerts (VIP, partenaires)
 *  - Fix d'un webhook Stripe raté
 *  - Downgrade forcé après litige
 *
 * ⚠ Ne touche PAS à la subscription Stripe : c'est un override côté DB.
 * Le webhook Stripe (source de vérité) écrasera ça au prochain event si actif.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAdmin, logAdminEvent } from "@/lib/admin";
import { handleApiError, notFound } from "@/lib/api-error";
import { validateBody } from "@/lib/api-helpers";
import { checkRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const PlanSchema = z.object({
  plan: z.enum(["free", "pro", "premium"]),
  expiresAt: z.string().datetime().nullable().optional(),
  reason: z.string().max(500).optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // Lot 64 : 30 overrides/h — action rare (comps VIP, fix webhook Stripe raté)
  const rl = checkRateLimit(req, { key: "admin-plan-override", limit: 30, windowSec: 3600 });
  if (!rl.ok) return rl.response;

  const { id } = await params;
  try {
    const admin = await requireAdmin();
    const { plan, expiresAt, reason } = await validateBody(req, PlanSchema);

    const existing = await db
      .select({ id: users.id, subscription: users.subscription })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    if (existing.length === 0) throw notFound("Utilisateur introuvable");

    const previousPlan = existing[0].subscription;

    await db
      .update(users)
      .set({
        subscription: plan,
        subscriptionExpiresAt: expiresAt ? new Date(expiresAt) : null,
      })
      .where(eq(users.id, id));

    await logAdminEvent({
      actorUserId: admin.id,
      targetUserId: id,
      action: "override_plan",
      payload: { previousPlan, newPlan: plan, expiresAt, reason },
    });

    return NextResponse.json({ success: true, previousPlan, newPlan: plan });
  } catch (err) {
    return handleApiError(err, { route: `POST /api/admin/users/${id}/plan` });
  }
}
