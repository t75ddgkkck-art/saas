/**
 * Lot 49 (F13) — POST /api/reactivation/generate
 *
 * Layer 2 (Premium) : appel IA pour générer les messages personnalisés.
 *
 * Body: { clientIds: string[] } (max 10 pour maîtriser coût OpenAI ~0.02$/batch)
 * Response: { suggestions: [{ clientId, reason, suggestedChannel, suggestedMessage }] }
 *
 * Gates :
 *  - `crm.reactivation_ai` (Premium)
 *  - Quota AI mensuel (checkAiQuota)
 *  - Rate-limit strict : 10 batches / heure / IP
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import { clients, businesses, users } from "@/db/schema";
import { getCurrentBusiness } from "@/lib/session";
import { handleApiError, badRequest, unauthorized } from "@/lib/api-error";
import { validateBody } from "@/lib/api-helpers";
import { checkRateLimit } from "@/lib/rate-limit";
import { requireEntitlement } from "@/lib/require-entitlement";
import { aiComplete, isAiConfigured } from "@/lib/ai/client";
import { checkAiQuota, recordAiUsage } from "@/lib/ai/usage";
import { reactivationSuggestionSystemPrompt } from "@/lib/ai/prompts";
import { computePriorityScore, type ClientScoringInput } from "@/lib/client-reactivation";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// Rate strict — chaque call coûte du token OpenAI
const RATE = { key: "reactivation-generate", limit: 10, windowSec: 3600 } as const;

const Schema = z.object({
  clientIds: z.array(z.string().uuid()).min(1).max(10),
});

// -----------------------------------------------------------------------------
// Parsing tolérant du JSON IA (l'IA wrap parfois en ```json ... ```)
// -----------------------------------------------------------------------------
interface AiSuggestion {
  clientId: string;
  reason: string;
  suggestedChannel: "email" | "sms";
  suggestedMessage: string;
}

function safeParseAiSuggestions(raw: string): AiSuggestion[] | null {
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();

  try {
    const parsed = JSON.parse(cleaned) as unknown;
    if (!Array.isArray(parsed)) return null;

    return parsed
      .filter((s): s is Record<string, unknown> => typeof s === "object" && s !== null)
      .map((s) => {
        const channel = s.suggestedChannel === "sms" ? "sms" : "email";
        return {
          clientId: String(s.clientId ?? ""),
          reason: String(s.reason ?? "").slice(0, 300),
          suggestedChannel: channel as "email" | "sms",
          // Cap message : SMS 160 chars strict, email 2000 chars
          suggestedMessage: String(s.suggestedMessage ?? "").slice(
            0,
            channel === "sms" ? 160 : 2000
          ),
        };
      })
      .filter((s) => s.clientId.length > 0 && s.suggestedMessage.length > 0);
  } catch {
    return null;
  }
}

// -----------------------------------------------------------------------------
// POST
// -----------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  const rl = checkRateLimit(req, RATE);
  if (!rl.ok) return rl.response;

  try {
    const biz = await getCurrentBusiness();
    if (!biz) throw unauthorized();

    // Gate stricte Premium — requireEntitlement throw 402 si plan insuffisant
    await requireEntitlement("crm.reactivation_ai");

    if (!isAiConfigured()) {
      throw badRequest("Le service IA n'est pas configuré côté serveur.");
    }

    const data = await validateBody(req, Schema);

    // Charge l'owner + son plan pour checkAiQuota
    const [owner] = await db
      .select({ id: users.id, subscription: users.subscription })
      .from(users)
      .where(eq(users.id, biz.ownerId))
      .limit(1);
    if (!owner) throw unauthorized();

    const quota = await checkAiQuota(owner.id, owner.subscription);
    if (!quota.allowed) {
      return NextResponse.json(
        {
          error: `Quota IA mensuel atteint (${quota.used}/${quota.limit}). Réessayez le mois prochain.`,
          quotaExceeded: true,
          used: quota.used,
          limit: quota.limit,
        },
        { status: 429 }
      );
    }

    // Charge les clients ciblés (anti-IDOR : filtre business)
    const rows = await db
      .select({
        clientId: clients.id,
        firstName: clients.firstName,
        lastName: clients.lastName,
        email: clients.email,
        phone: clients.phone,
        lastContact: clients.lastContact,
        appointmentsCount: clients.appointmentsCount,
        noShowsCount: clients.noShowsCount,
        quotesCount: clients.quotesCount,
        totalSpent: clients.totalSpent,
      })
      .from(clients)
      .where(
        and(
          eq(clients.businessId, biz.id),
          isNull(clients.deletedAt),
          inArray(clients.id, data.clientIds)
        )
      );

    if (rows.length === 0) {
      return NextResponse.json({ ok: true, suggestions: [] });
    }

    // Enrichit avec les factors Layer 1 pour donner le contexte à l'IA
    const enrichedClients = rows.map((r) => {
      const input: ClientScoringInput = {
        clientId: r.clientId,
        firstName: r.firstName,
        lastName: r.lastName,
        email: r.email,
        phone: r.phone,
        lastContact: r.lastContact,
        appointmentsCount: r.appointmentsCount ?? 0,
        noShowsCount: r.noShowsCount ?? 0,
        quotesCount: r.quotesCount ?? 0,
        totalSpent: r.totalSpent,
      };
      const scoring = computePriorityScore(input);
      return {
        clientId: r.clientId,
        name: `${r.firstName} ${r.lastName}`.trim(),
        hasEmail: Boolean(r.email),
        appointmentsCount: r.appointmentsCount ?? 0,
        totalSpent: r.totalSpent,
        daysSinceLastContact: scoring.daysSinceLastContact,
        factors: scoring.factors.map((f) => f.label),
      };
    });

    // Charge business complet pour le prompt
    const [bizFull] = await db
      .select()
      .from(businesses)
      .where(eq(businesses.id, biz.id))
      .limit(1);
    if (!bizFull) throw unauthorized();

    const systemPrompt = reactivationSuggestionSystemPrompt({
      name: bizFull.name,
      category: bizFull.category,
      city: bizFull.city,
      phone: bizFull.phone,
      email: bizFull.email,
    });

    // Payload user : la liste des clients enrichis
    const userPrompt = `Clients à réactiver (JSON) :\n\n${JSON.stringify(enrichedClients, null, 2)}\n\nRenvoie UNIQUEMENT le tableau JSON de suggestions.`;

    const result = await aiComplete({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      model: "gpt-4o-mini",
      maxTokens: 2000,
      temperature: 0.5,
    });

    if (!result.ok) {
      logger.warn("reactivation.ai.failed", { code: result.code, error: result.error });
      return NextResponse.json(
        { error: "L'IA n'a pas pu générer les messages. Réessayez dans quelques instants." },
        { status: 502 }
      );
    }

    const suggestions = safeParseAiSuggestions(result.content);
    if (!suggestions || suggestions.length === 0) {
      logger.warn("reactivation.ai.invalid_json", { raw: result.content.slice(0, 200) });
      return NextResponse.json(
        { error: "Réponse IA malformée. Réessayez." },
        { status: 502 }
      );
    }

    // Track usage tokens pour quota mensuel
    recordAiUsage({
      userId: owner.id,
      route: "reactivation",
      promptTokens: result.usage.promptTokens,
      completionTokens: result.usage.completionTokens,
      totalTokens: result.usage.totalTokens,
      model: result.usage.model,
    });

    return NextResponse.json({
      ok: true,
      suggestions,
      tokensUsed: result.usage.totalTokens,
    });
  } catch (err) {
    return handleApiError(err, { route: "POST /api/reactivation/generate" });
  }
}
