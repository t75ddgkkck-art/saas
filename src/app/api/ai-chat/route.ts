import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { businesses, services, workingHours } from "@/db/schema";
import { eq } from "drizzle-orm";
import { checkRateLimit } from "@/lib/rate-limit";
import { handleApiError } from "@/lib/api-error";
import { validateBody } from "@/lib/api-helpers";
import { aiComplete, isAiConfigured } from "@/lib/ai/client";
import { publicChatSystemPrompt, publicChatFallback } from "@/lib/ai/prompts";

export const dynamic = "force-dynamic";

// Rate-limit STRICT (route publique, coût OpenAI direct)
const RATE = { key: "ai-chat", limit: 15, windowSec: 300 } as const;

const Schema = z.object({
  businessId: z.string().uuid("businessId invalide"),
  message: z.string().trim().min(1, "Message vide").max(1000, "Message trop long"),
  sessionId: z.string().max(100).optional(),
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
      return NextResponse.json({ error: "Business introuvable" }, { status: 404 });
    }

    const [bizServices, bizHours] = await Promise.all([
      db.select().from(services).where(eq(services.businessId, businessId)),
      db.select().from(workingHours).where(eq(workingHours.businessId, businessId)),
    ]);

    const servicesText =
      bizServices.length > 0
        ? bizServices
            .map((s) => `- ${s.name}: ${s.price || "Sur devis"} (${s.description || "pas de description"})`)
            .join("\n")
        : "Aucun service renseigné pour le moment.";

    const hoursText =
      bizHours.length > 0
        ? bizHours
            .map((h) => `${DAYS[h.dayOfWeek]}: ${h.isClosed ? "Fermé" : `${h.startTime} - ${h.endTime}`}`)
            .join("\n")
        : "Horaires non renseignés.";

    let reply: string | null = null;

    if (isAiConfigured()) {
      const result = await aiComplete({
        messages: [
          { role: "system", content: publicChatSystemPrompt(business, servicesText, hoursText) },
          { role: "user", content: message },
        ],
        maxTokens: 300,
        temperature: 0.7,
      });
      if (result.ok) reply = result.content;
    }

    // Fallback intelligent (règles) si OpenAI absent ou en échec
    if (!reply) {
      reply = publicChatFallback(message, business, bizServices, hoursText);
    }

    return NextResponse.json({ reply });
  } catch (err) {
    return handleApiError(err, { route: "POST /api/ai-chat" });
  }
}
