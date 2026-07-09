import { NextRequest, NextResponse } from "next/server";
import { getCurrentBusiness } from "@/lib/session";
import { requirePermission } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const { error } = await requirePermission("canAiBlog");
  if (error) return error;

  try {
    const business = await getCurrentBusiness();
    if (!business) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

    const body = await request.json();
    const { topic } = body;

    if (!topic) return NextResponse.json({ error: "Sujet requis" }, { status: 400 });

    let content = "";
    if (process.env.OPENAI_API_KEY) {
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
              content: `Tu es un expert SEO et rédacteur web pour ${business.name}, ${business.category} à ${business.city || "France"}. Rédige un article de blog engageant, optimisé SEO (titres H2, paragraphes courts), d'environ 400 mots sur le sujet : "${topic}". Ton professionnel et chaleureux. Format HTML simple (h2, p, ul, li).`,
            },
          ],
          max_tokens: 1000,
        }),
      });
      const data = await res.json();
      content = data.choices?.[0]?.message?.content || "";
    } else {
      content = `<h2>Introduction sur ${topic}</h2><p>Ceci est un article généré automatiquement pour ${business.name}. L'IA n'est pas configurée (clé OpenAI manquante), mais voici un contenu placeholder sur ${topic}.</p><p>N'hésitez pas à nous contacter pour plus d'informations !</p>`;
    }

    return NextResponse.json({ content });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
