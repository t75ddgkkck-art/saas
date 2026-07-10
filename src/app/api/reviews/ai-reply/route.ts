import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { reviews } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { getCurrentBusiness, getCurrentUser } from "@/lib/session";
import { checkRateLimit } from "@/lib/rate-limit";
import { handleApiError, forbidden, notFound, unauthorized } from "@/lib/api-error";
import { validateBody } from "@/lib/api-helpers";
import { aiComplete, isAiConfigured } from "@/lib/ai/client";
import { reviewReplySystemPrompt } from "@/lib/ai/prompts";
import { checkAiQuota, recordAiUsage } from "@/lib/ai/usage";
import type { SubscriptionPlan } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const RATE = { key: "reviews:ai-reply", limit: 20, windowSec: 3600 } as const;
const Schema = z.object({ reviewId: z.string().uuid("reviewId invalide") });

export async function POST(request: NextRequest) {
  const rl = checkRateLimit(request, RATE);
  if (!rl.ok) return rl.response;

  try {
    const user = await getCurrentUser();
    const business = await getCurrentBusiness();
    if (!user || !business) throw unauthorized();

    if (user.subscription === "free") {
      throw forbidden("La réponse aux avis par IA est réservée aux plans Pro et Premium");
    }

    const quota = await checkAiQuota(user.id, user.subscription as SubscriptionPlan);
    if (!quota.allowed) throw forbidden(quota.reason ?? "Quota IA atteint");

    const { reviewId } = await validateBody(request, Schema);
    const [review] = await db
      .select()
      .from(reviews)
      .where(and(eq(reviews.id, reviewId), eq(reviews.businessId, business.id)))
      .limit(1);
    if (!review) throw notFound("Avis introuvable");

    const isPositive = review.rating >= 4;
    const isNeutral = review.rating === 3;
    let reply: string | null = null;

    if (isAiConfigured()) {
      const result = await aiComplete({
        messages: [
          { role: "system", content: reviewReplySystemPrompt(business) },
          {
            role: "user",
            content: `Avis de ${review.clientName} (${review.rating}/5 étoiles) : "${review.comment || "Aucun commentaire"}"`,
          },
        ],
        maxTokens: 200,
        temperature: 0.7,
      });
      if (result.ok) {
        reply = result.content;
        recordAiUsage({
          userId: user.id,
          route: "/api/reviews/ai-reply",
          promptTokens: result.usage.promptTokens,
          completionTokens: result.usage.completionTokens,
          totalTokens: result.usage.totalTokens,
          model: result.usage.model,
        });
      }
    }

    // Fallback si IA absente/en erreur (règles par note)
    if (!reply) {
      const firstName = review.clientName.split(" ")[0];
      if (isPositive) {
        reply = `Merci beaucoup ${firstName} pour ce retour chaleureux ! Au plaisir de vous accompagner à nouveau. — L'équipe ${business.name}`;
      } else if (isNeutral) {
        reply = `Merci ${firstName} pour votre retour. N'hésitez pas à nous contacter directement pour nous en dire plus : votre satisfaction est notre priorité. — L'équipe ${business.name}`;
      } else {
        reply = `Bonjour ${firstName}, nous sommes sincèrement désolés que votre expérience n'ait pas été à la hauteur. Contactez-nous directement${business.phone ? ` au ${business.phone}` : ""} pour trouver une solution. — L'équipe ${business.name}`;
      }
    }

    return NextResponse.json({ reply, generatedByAI: isAiConfigured() });
  } catch (err) {
    return handleApiError(err, { route: "POST /api/reviews/ai-reply" });
  }
}
