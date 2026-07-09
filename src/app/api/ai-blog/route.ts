import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentBusiness } from "@/lib/session";
import { requirePermission } from "@/lib/validation";
import { checkRateLimit } from "@/lib/rate-limit";
import { handleApiError, unauthorized } from "@/lib/api-error";
import { validateBody } from "@/lib/api-helpers";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// Génération lourde IA (max_tokens 1000) : 10/heure suffit.
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
    const business = await getCurrentBusiness();
    if (!business) throw unauthorized();

    const { topic } = await validateBody(request, Schema);

    let content = "";
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
                content: `Tu es un expert SEO et rédacteur web pour ${business.name}, ${business.category} à ${business.city || "France"}. Rédige un article de blog engageant, optimisé SEO (titres H2, paragraphes courts), d'environ 400 mots sur le sujet : "${topic}". Ton professionnel et chaleureux. Format HTML simple (h2, p, ul, li).`,
              },
            ],
            max_tokens: 1000,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          content = data.choices?.[0]?.message?.content || "";
        } else {
          logger.warn("ai-blog.openai.http_error", { status: res.status });
        }
      } catch (openAiErr) {
        logger.warn("ai-blog.openai.fetch_failed", {
          message: openAiErr instanceof Error ? openAiErr.message : String(openAiErr),
        });
      }
    }

    // Fallback si OpenAI indisponible/absent
    if (!content) {
      content = `<h2>Introduction sur ${topic}</h2><p>Ceci est un article généré automatiquement pour ${business.name}. L'IA n'est pas disponible pour le moment. Vous pouvez modifier ce contenu depuis votre tableau de bord.</p><p>N'hésitez pas à nous contacter pour plus d'informations !</p>`;
    }

    return NextResponse.json({ content });
  } catch (err) {
    return handleApiError(err, { route: "POST /api/ai-blog" });
  }
}
