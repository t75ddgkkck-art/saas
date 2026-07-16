/**
 * Lot 46 (F11) — POST /api/my-businesses/switch
 *
 * Change la vitrine active (persistée sur `users.active_business_id`).
 * Utilisé par le sélecteur en haut de la sidebar dashboard.
 *
 * Sécurité :
 *  - Vérifie que le business appartient bien à l'user courant (anti-IDOR)
 *  - Rate-limit modéré (10/min, suffit largement pour l'UX humaine)
 *
 * Pas de gate `business.multi` ici : un user Free/Pro peut avoir 1 seule
 * vitrine mais peut quand même "switcher" dessus (idempotent). La gate
 * s'applique uniquement à la CRÉATION d'une 2e vitrine.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { users, businesses } from "@/db/schema";
import { getCurrentUser } from "@/lib/session";
import { handleApiError, notFound, unauthorized } from "@/lib/api-error";
import { validateBody } from "@/lib/api-helpers";
import { checkRateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const RATE = { key: "business-switch", limit: 10, windowSec: 60 } as const;

const Schema = z.object({
  businessId: z.string().uuid("businessId invalide"),
});

export async function POST(req: NextRequest) {
  const rl = checkRateLimit(req, RATE);
  if (!rl.ok) return rl.response;

  try {
    const user = await getCurrentUser();
    if (!user) throw unauthorized();

    const { businessId } = await validateBody(req, Schema);

    // Anti-IDOR : le business doit appartenir à l'user (pas d'accès aux vitrines d'autrui)
    const [target] = await db
      .select({ id: businesses.id, name: businesses.name })
      .from(businesses)
      .where(and(eq(businesses.id, businessId), eq(businesses.ownerId, user.id)))
      .limit(1);

    if (!target) {
      throw notFound("Vitrine introuvable ou vous n'y avez pas accès");
    }

    // Update persistant — sera lu au prochain getCurrentBusiness()
    await db
      .update(users)
      .set({ activeBusinessId: businessId, updatedAt: new Date() })
      .where(eq(users.id, user.id));

    logger.info("business.switched", {
      userId: user.id,
      businessId,
    });

    return NextResponse.json({
      ok: true,
      businessId,
      name: target.name,
    });
  } catch (err) {
    return handleApiError(err, { route: "POST /api/my-businesses/switch" });
  }
}
