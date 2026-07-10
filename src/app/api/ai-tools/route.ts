import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { appointments, quotes, payments, pageVisits, reviews } from "@/db/schema";
import { and, eq, gte } from "drizzle-orm";
import { getCurrentBusiness, getCurrentUser } from "@/lib/session";
import { checkRateLimit } from "@/lib/rate-limit";
import { handleApiError, unauthorized, forbidden } from "@/lib/api-error";
import { validateBody } from "@/lib/api-helpers";
import { aiComplete, isAiConfigured } from "@/lib/ai/client";
import { monthlyReportSystemPrompt, socialPostSystemPrompt } from "@/lib/ai/prompts";
import { checkAiQuota, recordAiUsage } from "@/lib/ai/usage";
import type { SubscriptionPlan } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const RATE = { key: "ai-tools", limit: 15, windowSec: 3600 } as const;

const Schema = z.discriminatedUnion("tool", [
  z.object({ tool: z.literal("report") }),
  z.object({
    tool: z.literal("social-post"),
    description: z.string().trim().min(1).max(1000),
    platform: z.enum(["facebook", "instagram", "linkedin"]).default("instagram"),
  }),
]);

async function callAi(
  system: string,
  userMsg: string,
  userId: string,
  route: string
): Promise<string | null> {
  if (!isAiConfigured()) return null;
  const result = await aiComplete({
    messages: [
      { role: "system", content: system },
      { role: "user", content: userMsg },
    ],
    maxTokens: 800,
    temperature: 0.7,
  });
  if (!result.ok) return null;
  recordAiUsage({
    userId,
    route,
    promptTokens: result.usage.promptTokens,
    completionTokens: result.usage.completionTokens,
    totalTokens: result.usage.totalTokens,
    model: result.usage.model,
  });
  return result.content;
}

export async function POST(request: NextRequest) {
  const rl = checkRateLimit(request, RATE);
  if (!rl.ok) return rl.response;

  try {
    const user = await getCurrentUser();
    const business = await getCurrentBusiness();
    if (!user || !business) throw unauthorized();
    if (user.subscription !== "premium") {
      throw forbidden("Les outils IA sont réservés au plan Premium");
    }

    const quota = await checkAiQuota(user.id, user.subscription as SubscriptionPlan);
    if (!quota.allowed) throw forbidden(quota.reason ?? "Quota IA atteint");

    const data = await validateBody(request, Schema);

    if (data.tool === "report") {
      const monthAgo = new Date();
      monthAgo.setDate(monthAgo.getDate() - 30);
      const monthAgoStr = monthAgo.toISOString().split("T")[0];

      const [apts, qts, pmts, visits, rvws] = await Promise.all([
        db
          .select()
          .from(appointments)
          .where(
            and(eq(appointments.businessId, business.id), gte(appointments.createdAt, monthAgo))
          ),
        db
          .select()
          .from(quotes)
          .where(and(eq(quotes.businessId, business.id), gte(quotes.createdAt, monthAgo))),
        db
          .select()
          .from(payments)
          .where(and(eq(payments.businessId, business.id), gte(payments.createdAt, monthAgo))),
        db
          .select()
          .from(pageVisits)
          .where(and(eq(pageVisits.businessId, business.id), gte(pageVisits.date, monthAgoStr))),
        db.select().from(reviews).where(eq(reviews.businessId, business.id)),
      ]);

      const revenue = pmts
        .filter((p) => p.status === "completed")
        .reduce((s, p) => s + parseFloat(p.amount), 0);
      const quotesSigned = qts.filter(
        (q) => q.status === "signed" || q.status === "accepted"
      ).length;
      const conversionRate = qts.length > 0 ? Math.round((quotesSigned / qts.length) * 100) : 0;
      const sources: Record<string, number> = {};
      visits.forEach((v) => {
        sources[v.source || "direct"] = (sources[v.source || "direct"] || 0) + 1;
      });
      const topSource = Object.entries(sources).sort((a, b) => b[1] - a[1])[0]?.[0] || "aucune";
      const avgRating = rvws.length
        ? (rvws.reduce((s, r) => s + r.rating, 0) / rvws.length).toFixed(1)
        : "N/A";

      const dataText = `Activité (${business.category}) sur 30 jours : ${visits.length} visites (source principale : ${topSource}), ${apts.length} RDV, ${qts.length} devis dont ${quotesSigned} signés (${conversionRate}%), CA ${revenue.toFixed(0)}€, note moyenne ${avgRating}/5.`;

      const aiReport = await callAi(
        monthlyReportSystemPrompt(),
        dataText,
        user.id,
        "/api/ai-tools:report"
      );

      const report =
        aiReport ||
        `📊 **Rapport mensuel — ${business.name}**

📈 **Visibilité** : ${visits.length} visites ce mois-ci. Source principale : ${topSource}.
📅 **Activité** : ${apts.length} rendez-vous et ${qts.length} demandes de devis.
✍️ **Conversion** : ${conversionRate}% de vos devis sont signés (${quotesSigned}/${qts.length}).
💰 **Chiffre d'affaires** : ${revenue.toFixed(0)}€ encaissés.
⭐ **Réputation** : note moyenne de ${avgRating}/5.

**3 recommandations :**
1. ${visits.length < 50 ? "Partagez votre QR code et votre lien pour augmenter vos visites." : "Bonne visibilité ! Publiez un article de blog."}
2. ${conversionRate < 50 && qts.length > 0 ? "Répondez aux devis sous 24h : les devis rapides signent 3× plus." : "Continuez à répondre rapidement aux demandes."}
3. ${rvws.length < 5 ? "Activez la demande d'avis automatique après chaque RDV." : "Excellente réputation, mettez vos avis en avant !"}`;

      return NextResponse.json({ report, generatedByAI: !!aiReport });
    }

    // ===== social-post =====
    const aiPost = await callAi(
      socialPostSystemPrompt(business, data.platform),
      data.description,
      user.id,
      "/api/ai-tools:social-post"
    );

    const fallback =
      data.platform === "instagram"
        ? `✨ Nouvelle réalisation chez ${business.name} !\n\n${data.description}\n\nUn projet similaire ? Réservez en ligne, lien en bio. 📲\n\n#artisan #${(business.category || "artisanat").replace(/\s/g, "")} #${(business.city || "france").toLowerCase().replace(/\s/g, "")}`
        : `✨ Nouvelle réalisation signée ${business.name} !\n\n${data.description}\n\nUn projet similaire ? Nous serions ravis de vous accompagner. Prenez RDV en ligne — réponse rapide garantie ! 😊`;

    return NextResponse.json({ post: aiPost || fallback, generatedByAI: !!aiPost });
  } catch (err) {
    return handleApiError(err, { route: "POST /api/ai-tools" });
  }
}
