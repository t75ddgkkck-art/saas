import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { handleApiError, unauthorized } from "@/lib/api-error";
import { getMonthlyUsage, checkAiQuota, AI_TOKEN_LIMITS } from "@/lib/ai/usage";
import type { SubscriptionPlan } from "@/lib/permissions";
import { checkRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * GET /api/ai/usage
 *
 * Renvoie l'usage IA du user courant sur les 30 derniers jours + quotas.
 * Utilisé par le dashboard pour afficher une barre de progression.
 *
 * Réponse :
 *   {
 *     used: 42350,
 *     limit: 300000,
 *     remaining: 257650,
 *     percentUsed: 14,
 *     requests: 87,
 *     estimatedCostUsd: 0.023,
 *     plan: "pro"
 *   }
 */
export async function GET(req: NextRequest) {
  try {
    // Rate-limit lecture standard (60/min).
    const rl = checkRateLimit(req, { key: "ai-usage-get", limit: 60, windowSec: 60 });
    if (!rl.ok) return rl.response;

    const user = await getCurrentUser();
    if (!user) throw unauthorized();

    const plan = (user.subscription || "free") as SubscriptionPlan;
    const [usage, quota] = await Promise.all([
      getMonthlyUsage(user.id),
      checkAiQuota(user.id, plan),
    ]);

    const limit = AI_TOKEN_LIMITS[plan];
    const percentUsed = limit > 0 ? Math.round((usage.totalTokens / limit) * 100) : 0;

    return NextResponse.json({
      used: usage.totalTokens,
      limit,
      remaining: quota.remaining,
      percentUsed,
      requests: usage.requests,
      estimatedCostUsd: Number(usage.estimatedCostUsd.toFixed(4)),
      plan,
      allowed: quota.allowed,
    });
  } catch (err) {
    return handleApiError(err, { route: "GET /api/ai/usage" });
  }
}
