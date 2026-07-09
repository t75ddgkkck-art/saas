import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { reviews } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentBusiness, getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

// L'IA propose une réponse professionnelle à un avis client (Pro/Premium)
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    const business = await getCurrentBusiness();
    if (!user || !business) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }
    if (user.subscription === "free") {
      return NextResponse.json({ error: "La réponse aux avis par IA est réservée aux plans Pro et Premium" }, { status: 403 });
    }

    const body = await request.json();
    const { reviewId } = body;
    if (!reviewId) return NextResponse.json({ error: "reviewId requis" }, { status: 400 });

    const reviewResult = await db.select().from(reviews).where(eq(reviews.id, reviewId)).limit(1);
    const review = reviewResult[0];
    if (!review || review.businessId !== business.id) {
      return NextResponse.json({ error: "Avis introuvable" }, { status: 404 });
    }

    const isPositive = review.rating >= 4;
    const isNeutral = review.rating === 3;

    // Tentative IA (OpenAI)
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
            model: "gpt-4o-mini",
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
        const data = await res.json();
        reply = data.choices?.[0]?.message?.content || null;
      } catch { /* fallback ci-dessous */ }
    }

    // Fallback sans OpenAI : réponses professionnelles pré-rédigées selon la note
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
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
