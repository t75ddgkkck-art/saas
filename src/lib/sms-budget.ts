/**
 * Contrôle du budget SMS/WhatsApp Twilio par business.
 *
 * Objectif : éviter qu'un bug (boucle infinie de rappels) génère 4 chiffres
 * de facture Twilio. Chaque envoi passe par `checkAndRecord()` qui :
 *   1. Compte les envois du business sur les dernières 24h (via loyaltyTransactions
 *      détournée temporairement — mieux : nouvelle table sms_usage à créer)
 *   2. Refuse si limite quotidienne atteinte
 *   3. Log le coût estimé (Twilio : ~0.07 € / SMS, ~0.005 € / WhatsApp)
 *
 * Version actuelle : compteur en mémoire par instance (suffisant pour <1000 pros).
 * Migration Redis recommandée à l'échelle.
 */

import { logger } from "@/lib/logger";

// Prix indicatifs Twilio 2026 (FR)
const COST_PER_SMS_EUR = 0.075;
const COST_PER_WHATSAPP_EUR = 0.005;

// Limites par défaut (peuvent être surchargées par env)
const DEFAULT_DAILY_LIMIT_SMS = parseInt(process.env.SMS_DAILY_LIMIT || "100", 10);
const DEFAULT_DAILY_LIMIT_WA = parseInt(process.env.WHATSAPP_DAILY_LIMIT || "500", 10);

// Compteur en mémoire : { "businessId:channel:YYYY-MM-DD" → count }
const counters = new Map<string, number>();

function todayKey(): string {
  return new Date().toISOString().split("T")[0];
}

function counterKey(businessId: string, channel: "sms" | "whatsapp"): string {
  return `${businessId}:${channel}:${todayKey()}`;
}

/** Purge les compteurs de plus de 2 jours (économie mémoire). */
function purgeOld() {
  if (counters.size < 10_000) return;
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 2);
  const cutoff = yesterday.toISOString().split("T")[0];
  for (const key of counters.keys()) {
    const parts = key.split(":");
    const date = parts[parts.length - 1];
    if (date < cutoff) counters.delete(key);
  }
}

export interface BudgetResult {
  allowed: boolean;
  used: number;
  limit: number;
  estimatedCostEur: number;
  reason?: string;
}

/**
 * Vérifie si un envoi est autorisé et l'enregistre (increment atomique).
 * Retourne `allowed: false` si la limite quotidienne est atteinte.
 *
 * @param businessId ID du pro qui envoie
 * @param channel "sms" ou "whatsapp"
 * @param customLimit limite quotidienne custom (défaut = env)
 */
export function checkAndRecordSmsSend(
  businessId: string,
  channel: "sms" | "whatsapp",
  customLimit?: number
): BudgetResult {
  purgeOld();

  const limit =
    customLimit ??
    (channel === "sms" ? DEFAULT_DAILY_LIMIT_SMS : DEFAULT_DAILY_LIMIT_WA);
  const key = counterKey(businessId, channel);
  const used = counters.get(key) ?? 0;

  if (used >= limit) {
    logger.warn("sms-budget.limit_reached", {
      businessId,
      channel,
      used,
      limit,
    });
    return {
      allowed: false,
      used,
      limit,
      estimatedCostEur: used * (channel === "sms" ? COST_PER_SMS_EUR : COST_PER_WHATSAPP_EUR),
      reason: `Limite quotidienne atteinte (${limit} envois/jour). Réessayez demain ou augmentez la limite via env SMS_DAILY_LIMIT.`,
    };
  }

  counters.set(key, used + 1);
  const cost = (used + 1) * (channel === "sms" ? COST_PER_SMS_EUR : COST_PER_WHATSAPP_EUR);

  // Alerte quand on approche la limite (>80 %) — visible dans logs prod
  if (used + 1 >= limit * 0.8 && used < limit * 0.8) {
    logger.warn("sms-budget.approaching_limit", {
      businessId,
      channel,
      used: used + 1,
      limit,
      percent: Math.round(((used + 1) / limit) * 100),
    });
  }

  logger.info("sms-budget.sent", {
    businessId,
    channel,
    used: used + 1,
    limit,
    estimatedCostEur: cost.toFixed(3),
  });

  return {
    allowed: true,
    used: used + 1,
    limit,
    estimatedCostEur: cost,
  };
}

/**
 * Renvoie l'usage courant sans incrémenter (utile pour affichage dashboard).
 */
export function getSmsUsage(businessId: string, channel: "sms" | "whatsapp"): {
  used: number;
  limit: number;
  estimatedCostEur: number;
} {
  const limit = channel === "sms" ? DEFAULT_DAILY_LIMIT_SMS : DEFAULT_DAILY_LIMIT_WA;
  const used = counters.get(counterKey(businessId, channel)) ?? 0;
  const cost = used * (channel === "sms" ? COST_PER_SMS_EUR : COST_PER_WHATSAPP_EUR);
  return { used, limit, estimatedCostEur: cost };
}
