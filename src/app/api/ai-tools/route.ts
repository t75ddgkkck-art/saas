import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { appointments, quotes, payments, pageVisits, reviews } from "@/db/schema";
import { eq, and, gte } from "drizzle-orm";
import { getCurrentBusiness, getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

async function callOpenAI(system: string, prompt: string): Promise<string | null> {
  if (!process.env.OPENAI_API_KEY) return null;
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: system },
          { role: "user", content: prompt },
        ],
        max_tokens: 800,
        temperature: 0.7,
      }),
    });
    const data = await res.json();
    return data.choices?.[0]?.message?.content || null;
  } catch {
    return null;
  }
}

// Outils IA Premium : rapport mensuel intelligent + générateur de posts réseaux sociaux
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    const business = await getCurrentBusiness();
    if (!user || !business) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }
    if (user.subscription !== "premium") {
      return NextResponse.json({ error: "Les outils IA sont réservés au plan Premium" }, { status: 403 });
    }

    const body = await request.json();
    const { tool } = body;

    // ===== RAPPORT MENSUEL INTELLIGENT =====
    if (tool === "report") {
      const monthAgo = new Date();
      monthAgo.setDate(monthAgo.getDate() - 30);
      const monthAgoStr = monthAgo.toISOString().split("T")[0];

      const [apts, qts, pmts, visits, rvws] = await Promise.all([
        db.select().from(appointments).where(and(eq(appointments.businessId, business.id), gte(appointments.createdAt, monthAgo))),
        db.select().from(quotes).where(and(eq(quotes.businessId, business.id), gte(quotes.createdAt, monthAgo))),
        db.select().from(payments).where(and(eq(payments.businessId, business.id), gte(payments.createdAt, monthAgo))),
        db.select().from(pageVisits).where(and(eq(pageVisits.businessId, business.id), gte(pageVisits.date, monthAgoStr))),
        db.select().from(reviews).where(eq(reviews.businessId, business.id)),
      ]);

      const revenue = pmts.filter(p => p.status === "completed").reduce((s, p) => s + parseFloat(p.amount), 0);
      const quotesSigned = qts.filter(q => q.status === "signed" || q.status === "accepted").length;
      const conversionRate = qts.length > 0 ? Math.round((quotesSigned / qts.length) * 100) : 0;
      const sources: Record<string, number> = {};
      visits.forEach(v => { sources[v.source || "direct"] = (sources[v.source || "direct"] || 0) + 1; });
      const topSource = Object.entries(sources).sort((a, b) => b[1] - a[1])[0]?.[0] || "aucune";
      const avgRating = rvws.length ? (rvws.reduce((s, r) => s + r.rating, 0) / rvws.length).toFixed(1) : "N/A";

      const dataText = `Activité (${business.category}) sur 30 jours : ${visits.length} visites (source principale : ${topSource}), ${apts.length} RDV, ${qts.length} devis dont ${quotesSigned} signés (${conversionRate}%), CA ${revenue.toFixed(0)}€, note moyenne ${avgRating}/5.`;

      const aiReport = await callOpenAI(
        "Tu es un consultant business pour artisans français. Rédige un rapport mensuel court (5 points max), concret et actionnable, en français parfait. Utilise des émojis. Termine par 3 recommandations précises.",
        dataText
      );

      const report = aiReport || `📊 **Rapport mensuel — ${business.name}**

📈 **Visibilité** : ${visits.length} visites ce mois-ci. Source principale : ${topSource}.
📅 **Activité** : ${apts.length} rendez-vous et ${qts.length} demandes de devis.
✍️ **Conversion** : ${conversionRate}% de vos devis sont signés (${quotesSigned}/${qts.length}).
💰 **Chiffre d'affaires** : ${revenue.toFixed(0)}€ encaissés.
⭐ **Réputation** : note moyenne de ${avgRating}/5.

**3 recommandations :**
1. ${visits.length < 50 ? "Partagez votre QR code et votre lien sur vos réseaux pour augmenter vos visites." : "Bonne visibilité ! Publiez un article de blog pour renforcer votre référencement Google."}
2. ${conversionRate < 50 && qts.length > 0 ? "Répondez aux devis sous 24h : les devis rapides signent 3x plus." : "Continuez à répondre rapidement à vos demandes de devis."}
3. ${rvws.length < 5 ? "Activez la demande d'avis automatique après chaque RDV pour renforcer votre réputation." : "Excellente réputation, mettez vos avis en avant !"}`;

      return NextResponse.json({ report, generatedByAI: !!aiReport });
    }

    // ===== GÉNÉRATEUR DE POSTS RÉSEAUX SOCIAUX =====
    if (tool === "social-post") {
      const { description, platform } = body;
      if (!description) {
        return NextResponse.json({ error: "Décrivez votre réalisation" }, { status: 400 });
      }

      const aiPost = await callOpenAI(
        `Tu es community manager pour artisans français. Rédige un post ${platform === "instagram" ? "Instagram (avec hashtags pertinents)" : "Facebook (ton chaleureux, sans hashtags excessifs)"} court et engageant, en français parfait, pour promouvoir le travail d'un(e) ${business.category} nommé(e) ${business.name} à ${business.city || "France"}. Termine par un appel à l'action vers la prise de rendez-vous.`,
        description
      );

      const fallback = platform === "instagram"
        ? `✨ Nouvelle réalisation chez ${business.name} !\n\n${description}\n\nVous avez un projet similaire ? Réservez votre créneau en ligne, lien dans la bio. 📲\n\n#artisan #${(business.category || "artisanat").replace(/\s/g, "")} #${(business.city || "france").toLowerCase().replace(/\s/g, "")} #faitmain #qualité #avantapres`
        : `✨ Nouvelle réalisation signée ${business.name} !\n\n${description}\n\nVous avez un projet similaire ? Nous serions ravis de vous accompagner. Prenez rendez-vous directement en ligne sur notre page — réponse rapide garantie ! 😊`;

      return NextResponse.json({ post: aiPost || fallback, generatedByAI: !!aiPost });
    }

    return NextResponse.json({ error: "Outil inconnu (report ou social-post)" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
