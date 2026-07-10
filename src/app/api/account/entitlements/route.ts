/**
 * F1 (Lot 29) — GET /api/account/entitlements
 *
 * Renvoie la matrice complète des features accessibles au user courant.
 * Utilisé par le hook `useEntitlement()` côté client — 1 seul fetch au montage
 * du dashboard, plutôt qu'un fetch par gate.
 *
 * Réponse :
 *   {
 *     plan: "free" | "pro" | "premium",
 *     features: { "ai.chat": false, "quotes.enable": false, ... }
 *   }
 *
 * Cache : `no-store` (le plan peut changer sur upgrade Stripe, on veut du frais).
 * Rate-limit : 60/min/IP (léger — appelé souvent au montage).
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { handleApiError, unauthorized } from "@/lib/api-error";
import { checkRateLimit } from "@/lib/rate-limit";
import { buildEntitlementsSnapshot } from "@/lib/entitlements";
import type { SubscriptionPlan } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const rl = checkRateLimit(req, { key: "entitlements", limit: 60, windowSec: 60 });
    if (!rl.ok) return rl.response;

    const user = await getCurrentUser();
    if (!user) throw unauthorized();

    const plan = (user.subscription || "free") as SubscriptionPlan;
    const snapshot = buildEntitlementsSnapshot(plan);

    return NextResponse.json(snapshot, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    return handleApiError(err, { route: "GET /api/account/entitlements" });
  }
}
