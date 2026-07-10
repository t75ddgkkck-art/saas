import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentBusiness, getCurrentUser } from "@/lib/session";
import { requirePermission } from "@/lib/validation";
import { checkRateLimit } from "@/lib/rate-limit";
import { handleApiError, forbidden, unauthorized } from "@/lib/api-error";
import { validateBody } from "@/lib/api-helpers";
import { aiComplete, isAiConfigured } from "@/lib/ai/client";
import { blogArticleSystemPrompt } from "@/lib/ai/prompts";
import { checkAiQuota, recordAiUsage } from "@/lib/ai/usage";
import type { SubscriptionPlan } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const RATE = { key: "ai:blog", limit: 10, windowSec: 3600 } as const;
const Schema = z.object({
  topic: z.string().trim().min(1).max(300),
});

export async function POST(request: NextRequest) {
  const perm = await requirePermission("canAiBlog");
  if (perm.error) return perm.error;

  const rl = checkRateLimit(request, RATE);
  if (!rl.ok) return rl.response;

  try {
    const user = await getCurrentUser();
    const business = await getCurrentBusiness();
    if (!user || !business) throw unauthorized();

    // Quota mensuel avant l'appel : évite de payer OpenAI pour un user
    // qui a déjà dépassé sa limite.
    const quota = await checkAiQuota(user.id, user.subscription as SubscriptionPlan);
    if (!quota.allowed) {
      throw forbidden(quota.reason ?? "Quota IA atteint");
    }

    const { topic } = await validateBody(request, Schema);

    let content = "";
    if (isAiConfigured()) {
      const result = await aiComplete({
        messages: [{ role: "system", content: blogArticleSystemPrompt(business, topic) }],
        maxTokens: 1000,
      });
      if (result.ok) {
        content = result.content;
        // Enregistre l'usage (fire-and-forget)
        recordAiUsage({
          userId: user.id,
          route: "/api/ai-blog",
          promptTokens: result.usage.promptTokens,
          completionTokens: result.usage.completionTokens,
          totalTokens: result.usage.totalTokens,
          model: result.usage.model,
        });
      }
    }

    // Fallback si IA indisponible
    if (!content) {
      content = `<h2>Introduction sur ${topic}</h2><p>Article à personnaliser pour ${business.name}. Éditez ce contenu depuis votre dashboard.</p>`;
    }

    return NextResponse.json({ content });
  } catch (err) {
    return handleApiError(err, { route: "POST /api/ai-blog" });
  }
}
