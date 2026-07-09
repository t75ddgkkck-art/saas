import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { reviews } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { getCurrentBusiness, getCurrentUser } from "@/lib/session";
import { checkRateLimit } from "@/lib/rate-limit";
import { handleApiError, forbidden, notFound, unauthorized } from "@/lib/api-error";
import { validateBody } from "@/lib/api-helpers";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// Cette route consomme OpenAI : cap 20/heure/utilisateur (via IP).
const RATE = { key: "reviews:ai-reply", limit: 20, windowSec: 3600 } as const;

const Schema = z.object({
  reviewId: z.string().uuid("reviewId invalide"),
});

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
    if (process.env.OPENAI_API_KEY) {
      try {
        const res = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: process.env.OPENAI_MODEL || "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content: `Tu rédiges des réponses aux avis clients pour ${business.name}, ${business.category} à ${business.city || "France"}. Règles : français parfait, ton professionnel et chaleureux, 2-3 phrases maximum, personnalisé (mentionne le prénom du client), sans promesse commerciale exagérée. Pour les avis négatifs : excuse sincère + proposition de contact direct pour résoudre le problème.`,
              },
              {
                role: "user",
                content: `Avis de ${review.clientName} (${review.rating}/5 étoiles) : "${review.comment || "Aucun commentaire"}"`,
              },
            ],
            max_tokens: 200,
            temperature: 0.7,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          reply = data.choices?.[0]?.message?.content || null;
        } else {
          logger.warn("reviews.ai-reply.openai.http_error", { status: res.status });
        }
      } catch (openAiErr) {
        logger.warn("reviews.ai-reply.openai.fetch_failed", {
          message: openAiErr instanceof Error ? openAiErr.message : String(openAiErr),
        });
      }
    }

    if (!reply) {
      const firstName = review.clientName.split(" ")[0];
      if (isPositive) {
        reply = `Merci beaucoup ${firstName} pour ce retour chaleureux ! C'est un plaisir de savoir que notre intervention vous a donné entière satisfaction. Au plaisir de vous accompagner à nouveau. — L'équipe ${business.name}`;
      } else if (isNeutral) {
        reply = `Merci ${firstName} pour votre retour. Nous prenons note de vos remarques pour nous améliorer. N'hésitez pas à nous contacter directement pour nous en dire plus : votre satisfaction est notre priorité. — L'équipe ${business.name}`;
      } else {
        reply = `Bonjour ${firstName}, nous sommes sincèrement désolés que votre expérience n'ait pas été à la hauteur de vos attentes. Nous aimerions comprendre ce qui s'est passé et trouver une solution : contactez-nous directement${business.phone ? ` au ${business.phone}` : ""}. — L'équipe ${business.name}`;
      }
    }

    return NextResponse.json({ reply, generatedByAI: !!process.env.OPENAI_API_KEY });
  } catch (err) {
    return handleApiError(err, { route: "POST /api/reviews/ai-reply" });
  }
}
