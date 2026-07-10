/**
 * Quotas & tracking d'usage IA par utilisateur.
 *
 * Design :
 *  - Chaque appel IA loggue les tokens consommés dans `ai_usage`
 *  - Avant chaque appel on somme les tokens des 30 derniers jours
 *  - Si dépasse le quota du plan → refus 429 avec message clair
 *
 * Quotas mensuels par plan (tokens totaux OpenAI, prompt + completion) :
 *   - free    : 0 (pas d'IA)
 *   - pro     : 300 000 tokens/mois (~= 200 conversations moyennes)
 *   - premium : 2 000 000 tokens/mois (~= 1300 conversations moyennes)
 *
 * Coût estimé (gpt-4o-mini) : 0.15 $ / 1M input, 0.60 $ / 1M output
 *   → même à 2M tokens/mois : max 1 $ par pro premium
 */

import { db } from "@/db";
import { aiUsage } from "@/db/schema";
import { and, eq, gte, sql } from "drizzle-orm";
import { logger } from "@/lib/logger";
import type { SubscriptionPlan } from "@/lib/permissions";

export const AI_TOKEN_LIMITS: Record<SubscriptionPlan, number> = {
  free: 0,
  pro: 300_000,
  premium: 2_000_000,
};

// Prix indicatif gpt-4o-mini (USD) — utilisé pour l'estimation coût
const COST_PER_1M_INPUT_USD = 0.15;
const COST_PER_1M_OUTPUT_USD = 0.6;

export function estimateCostUsd(promptTokens: number, completionTokens: number): number {
  return (
    (promptTokens / 1_000_000) * COST_PER_1M_INPUT_USD +
    (completionTokens / 1_000_000) * COST_PER_1M_OUTPUT_USD
  );
}

/**
 * Renvoie l'usage cumulé (tokens totaux) sur les 30 derniers jours pour un user.
 * Utilise l'index (user_id, created_at) pour être O(log n).
 */
export async function getMonthlyUsage(userId: string): Promise<{
  totalTokens: number;
  requests: number;
  estimatedCostUsd: number;
}> {
  try {
    const since = new Date();
    since.setDate(since.getDate() - 30);

    const [row] = await db
      .select({
        totalTokens: sql<number>`coalesce(sum(${aiUsage.totalTokens}), 0)::int`,
        totalPrompt: sql<number>`coalesce(sum(${aiUsage.promptTokens}), 0)::int`,
        totalCompletion: sql<number>`coalesce(sum(${aiUsage.completionTokens}), 0)::int`,
        requests: sql<number>`count(*)::int`,
      })
      .from(aiUsage)
      .where(and(eq(aiUsage.userId, userId), gte(aiUsage.createdAt, since)));

    const totalTokens = Number(row?.totalTokens) || 0;
    const totalPrompt = Number(row?.totalPrompt) || 0;
    const totalCompletion = Number(row?.totalCompletion) || 0;
    const requests = Number(row?.requests) || 0;

    return {
      totalTokens,
      requests,
      estimatedCostUsd: estimateCostUsd(totalPrompt, totalCompletion),
    };
  } catch (err) {
    logger.warn("ai-usage.query_failed", {
      userId,
      message: err instanceof Error ? err.message : String(err),
    });
    return { totalTokens: 0, requests: 0, estimatedCostUsd: 0 };
  }
}

export interface QuotaCheck {
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
  reason?: string;
}

/**
 * Vérifie si l'user peut faire un nouvel appel IA en fonction de son plan.
 * NE consomme pas de quota : uniquement une vérification.
 */
export async function checkAiQuota(
  userId: string,
  plan: SubscriptionPlan
): Promise<QuotaCheck> {
  const limit = AI_TOKEN_LIMITS[plan];

  if (limit === 0) {
    return {
      allowed: false,
      used: 0,
      limit: 0,
      remaining: 0,
      reason: "L'assistant IA est réservé aux plans Pro et Premium.",
    };
  }

  const { totalTokens } = await getMonthlyUsage(userId);
  const remaining = Math.max(0, limit - totalTokens);
  const allowed = totalTokens < limit;

  return {
    allowed,
    used: totalTokens,
    limit,
    remaining,
    reason: allowed
      ? undefined
      : `Quota IA mensuel atteint (${limit.toLocaleString("fr-FR")} tokens). Il sera réinitialisé dans quelques jours.`,
  };
}

/**
 * Enregistre un usage IA en base après un appel réussi.
 * Fire-and-forget (ne bloque pas la réponse au user).
 */
export function recordAiUsage(params: {
  userId: string;
  route: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  model: string;
}): void {
  const cost = estimateCostUsd(params.promptTokens, params.completionTokens);
  db.insert(aiUsage)
    .values({
      userId: params.userId,
      route: params.route,
      promptTokens: params.promptTokens,
      completionTokens: params.completionTokens,
      totalTokens: params.totalTokens,
      model: params.model,
      estimatedCostUsd: cost.toFixed(6),
    })
    .then(() => undefined)
    .catch((err) => {
      logger.warn("ai-usage.insert_failed", {
        userId: params.userId,
        route: params.route,
        message: err instanceof Error ? err.message : String(err),
      });
    });
}
