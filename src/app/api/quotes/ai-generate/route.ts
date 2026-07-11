/**
 * F8 (Lot 38) — POST /api/quotes/ai-generate
 *
 * Génère des lignes de devis à partir d'une description libre.
 * Retourne un JSON structuré que le pro VALIDE avant sauvegarde
 * (l'IA n'est qu'une proposition, jamais un devis final).
 *
 * Gates :
 *  - `quotes.enable` (Pro+) : le pro doit pouvoir faire des devis
 *  - `quotes.ai_generation` (Premium) : IA est Premium only
 *  - Quota mensuel IA (checkAiQuota)
 *
 * Rate-limit strict : 20/heure/IP (chaque call = coût OpenAI direct).
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { checkRateLimit } from "@/lib/rate-limit";
import { validateBody } from "@/lib/api-helpers";
import { handleApiError, badRequest, unauthorized } from "@/lib/api-error";
import { requireEntitlement } from "@/lib/require-entitlement";
import { aiComplete, isAiConfigured } from "@/lib/ai/client";
import { quoteGeneratorSystemPrompt, type BusinessContext } from "@/lib/ai/prompts";
import { checkAiQuota, recordAiUsage } from "@/lib/ai/usage";
import { getCurrentBusiness } from "@/lib/session";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const RATE = { key: "ai-quote-gen", limit: 20, windowSec: 3600 } as const;

const Schema = z.object({
  description: z.string().trim().min(10, "Description trop courte (10 chars min)").max(2000),
  /** Optionnel : titre à donner au devis. Défaut : dérivé de la description. */
  title: z.string().trim().max(200).optional(),
});

interface AiQuoteResponse {
  items: {
    description: string;
    quantity: number;
    unit_price: number;
    unit?: string;
  }[];
  notes: string | null;
  warning: string | null;
  estimated_days: number | null;
}

/**
 * Parse tolérante du JSON renvoyé par l'IA (parfois wrappé en markdown ```json…```).
 * Retourne null si non parseable → l'appelant renvoie 502.
 */
function safeParseAiJson(raw: string): AiQuoteResponse | null {
  // Nettoie les markdown fences éventuels
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
  try {
    const parsed = JSON.parse(cleaned) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const p = parsed as Record<string, unknown>;
    // Shape minimale attendue
    if (!Array.isArray(p.items)) return null;
    return {
      items: (p.items as unknown[])
        .filter((it): it is Record<string, unknown> => typeof it === "object" && it !== null)
        .map((it) => ({
          description: String(it.description ?? "").slice(0, 500),
          quantity: Number(it.quantity ?? 1) || 1,
          unit_price: Number(it.unit_price ?? 0) || 0,
          unit: typeof it.unit === "string" ? it.unit.slice(0, 20) : undefined,
        }))
        .filter((it) => it.description.length > 0),
      notes: typeof p.notes === "string" ? p.notes.slice(0, 2000) : null,
      warning: typeof p.warning === "string" ? p.warning.slice(0, 500) : null,
      estimated_days:
        typeof p.estimated_days === "number" && p.estimated_days > 0
          ? Math.round(p.estimated_days)
          : null,
    };
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const rl = checkRateLimit(request, RATE);
  if (!rl.ok) return rl.response;

  try {
    if (!isAiConfigured()) {
      throw badRequest("L'IA n'est pas configurée côté serveur.");
    }

    // Gate 1 : Pro minimum (feature devis)
    await requireEntitlement("quotes.enable");
    // Gate 2 : Premium (IA génération)
    const { user, plan } = await requireEntitlement("quotes.ai_generation");

    const business = await getCurrentBusiness();
    if (!business) throw unauthorized("Aucun business associé");

    const data = await validateBody(request, Schema);

    // Quota IA mensuel (partage avec les autres features IA)
    const quota = await checkAiQuota(user.id, plan);
    if (!quota.allowed) {
      throw badRequest(quota.reason ?? "Quota IA mensuel atteint");
    }

    // Contexte business pour le prompt (améliore la pertinence des prix)
    const bizCtx: BusinessContext = {
      name: business.name,
      category: business.category ?? "artisan",
      city: business.city,
      phone: business.phone,
      email: business.email,
      address: business.address,
      postalCode: business.postalCode,
    };

    const result = await aiComplete({
      messages: [
        { role: "system", content: quoteGeneratorSystemPrompt(bizCtx) },
        { role: "user", content: data.description },
      ],
      maxTokens: 1500,
      temperature: 0.3, // Bas → réponse plus déterministe (chiffrage)
    });

    if (!result.ok) {
      logger.warn("ai.quote-gen.failed", { error: result.error, code: result.code });
      return NextResponse.json(
        { error: "L'IA n'a pas pu générer le devis, réessayez." },
        { status: 502 }
      );
    }

    const parsed = safeParseAiJson(result.content);
    if (!parsed) {
      logger.warn("ai.quote-gen.parse_failed", {
        userId: user.id,
        rawFirst200: result.content.slice(0, 200),
      });
      return NextResponse.json(
        { error: "L'IA a renvoyé un format inattendu, réessayez." },
        { status: 502 }
      );
    }

    // Enregistrement quota IA (best-effort, non bloquant)
    recordAiUsage({
      userId: user.id,
      route: "quote_generation",
      promptTokens: result.usage.promptTokens,
      completionTokens: result.usage.completionTokens,
      totalTokens: result.usage.totalTokens,
      model: result.usage.model,
    });

    // Compute total suggéré (le pro pourra l'ajuster avant save)
    const suggestedTotal = parsed.items.reduce((sum, i) => sum + i.quantity * i.unit_price, 0);

    return NextResponse.json({
      title: data.title ?? data.description.slice(0, 100),
      items: parsed.items,
      notes: parsed.notes,
      warning: parsed.warning,
      estimatedDays: parsed.estimated_days,
      suggestedTotal,
      tokensUsed: result.usage.totalTokens,
    });
  } catch (err) {
    return handleApiError(err, { route: "POST /api/quotes/ai-generate" });
  }
}
