/**
 * Version STREAMING du chat public.
 *
 * Le client reçoit le texte token par token → rendu instantané au lieu
 * d'attendre 3-8 secondes la fin de la génération.
 *
 * Format : text/plain (chunks bruts). Le client concatène simplement.
 * Alternative : SSE si on veut envoyer des metadata (usage, done…).
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { businesses, services, workingHours } from "@/db/schema";
import { eq } from "drizzle-orm";
import { checkRateLimit } from "@/lib/rate-limit";
import { handleApiError } from "@/lib/api-error";
import { validateBody } from "@/lib/api-helpers";
import { aiCompleteStream, isAiConfigured } from "@/lib/ai/client";
import { publicChatSystemPrompt, publicChatFallback } from "@/lib/ai/prompts";

export const dynamic = "force-dynamic";

const RATE = { key: "ai-chat-stream", limit: 15, windowSec: 300 } as const;

const Schema = z.object({
  businessId: z.string().uuid(),
  message: z.string().trim().min(1).max(1000),
});

const DAYS = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

export async function POST(request: NextRequest) {
  const rl = checkRateLimit(request, RATE);
  if (!rl.ok) return rl.response;

  try {
    const { businessId, message } = await validateBody(request, Schema);

    const [business] = await db
      .select()
      .from(businesses)
      .where(eq(businesses.id, businessId))
      .limit(1);
    if (!business) {
      return new Response("Business introuvable", { status: 404 });
    }

    const [bizServices, bizHours] = await Promise.all([
      db.select().from(services).where(eq(services.businessId, businessId)),
      db.select().from(workingHours).where(eq(workingHours.businessId, businessId)),
    ]);

    const servicesText =
      bizServices.length > 0
        ? bizServices
            .map((s) => `- ${s.name}: ${s.price || "Sur devis"}`)
            .join("\n")
        : "Aucun service renseigné.";

    const hoursText =
      bizHours.length > 0
        ? bizHours
            .map((h) => `${DAYS[h.dayOfWeek]}: ${h.isClosed ? "Fermé" : `${h.startTime} - ${h.endTime}`}`)
            .join("\n")
        : "Horaires non renseignés.";

    // Fallback : si pas d'IA, on renvoie une réponse simple (non-streamée)
    if (!isAiConfigured()) {
      const fallback = publicChatFallback(message, business, bizServices, hoursText);
      return new Response(fallback, {
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    const streamRes = await aiCompleteStream({
      messages: [
        { role: "system", content: publicChatSystemPrompt(business, servicesText, hoursText) },
        { role: "user", content: message },
      ],
      maxTokens: 300,
      temperature: 0.7,
    });

    if (!streamRes.ok) {
      // Fallback en cas d'échec (timeout, quota OpenAI…)
      const fallback = publicChatFallback(message, business, bizServices, hoursText);
      return new Response(fallback, {
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    return new Response(streamRes.stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        // Anti-buffering nginx/Vercel : force le flush au fil de l'eau
        "X-Accel-Buffering": "no",
        "Cache-Control": "no-cache, no-transform",
      },
    });
  } catch (err) {
    return handleApiError(err, { route: "POST /api/ai-chat/stream" });
  }
}
