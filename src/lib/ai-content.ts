import { getCurrentBusiness, getCurrentUser } from "@/lib/session";
import { aiComplete, isAiConfigured } from "@/lib/ai/client";
import { socialPostSystemPrompt, monthlyReportSystemPrompt } from "@/lib/ai/prompts";
import { checkAiQuota, recordAiUsage } from "@/lib/ai/usage";
import type { SubscriptionPlan } from "@/lib/permissions";

/**
 * Génère un post réseau social. Utilise le client centralisé + quotas.
 * NB : les vraies routes API (`/api/ai/social-post`, `/api/ai/monthly-report`)
 * ré-implémentent la vérif de plan/permission. Ce module est un helper.
 */
export async function generateSocialPost(params: {
  topic: string;
  platform: "facebook" | "instagram" | "linkedin";
}) {
  const business = await getCurrentBusiness();
  const user = await getCurrentUser();
  if (!business || !user) throw new Error("Non authentifié");

  const quota = await checkAiQuota(user.id, user.subscription as SubscriptionPlan);
  if (!quota.allowed) {
    return {
      content: `Quota IA mensuel atteint. Réessayez le mois prochain.`,
      generatedByAI: false,
    };
  }

  if (!isAiConfigured()) {
    return {
      content: `Post généré pour ${business.name} sur ${params.platform}:\n\n${params.topic}\n\nContactez-nous pour en savoir plus !`,
      generatedByAI: false,
    };
  }

  const result = await aiComplete({
    messages: [
      { role: "system", content: socialPostSystemPrompt(business, params.platform) },
      { role: "user", content: params.topic },
    ],
    maxTokens: 300,
  });

  if (!result.ok) {
    return {
      content: `Post à personnaliser pour ${business.name} : ${params.topic}`,
      generatedByAI: false,
    };
  }

  recordAiUsage({
    userId: user.id,
    route: "/lib/ai-content:generateSocialPost",
    promptTokens: result.usage.promptTokens,
    completionTokens: result.usage.completionTokens,
    totalTokens: result.usage.totalTokens,
    model: result.usage.model,
  });

  return { content: result.content, generatedByAI: true };
}

export async function generateMonthlyReport() {
  const business = await getCurrentBusiness();
  const user = await getCurrentUser();
  if (!business || !user) throw new Error("Non authentifié");

  const quota = await checkAiQuota(user.id, user.subscription as SubscriptionPlan);
  if (!quota.allowed) {
    return {
      report: `Quota IA mensuel atteint. Réessayez le mois prochain.`,
      generatedByAI: false,
    };
  }

  if (!isAiConfigured()) {
    return {
      report: `Rapport mensuel pour ${business.name}\n\nActivité stable ce mois-ci. Continuez sur cette lancée !`,
      generatedByAI: false,
    };
  }

  const result = await aiComplete({
    messages: [
      { role: "system", content: monthlyReportSystemPrompt() },
      {
        role: "user",
        content: `Génère un rapport mensuel pour ${business.name} (${business.category}). Inclus résumé activité, points forts, recommandations, objectifs.`,
      },
    ],
    maxTokens: 500,
  });

  if (!result.ok) {
    return {
      report: `Rapport pour ${business.name} : indisponible temporairement.`,
      generatedByAI: false,
    };
  }

  recordAiUsage({
    userId: user.id,
    route: "/lib/ai-content:generateMonthlyReport",
    promptTokens: result.usage.promptTokens,
    completionTokens: result.usage.completionTokens,
    totalTokens: result.usage.totalTokens,
    model: result.usage.model,
  });

  return { report: result.content, generatedByAI: true };
}
