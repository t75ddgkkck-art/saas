import { getCurrentBusiness } from "@/lib/session";

export async function generateSocialPost(params: {
  topic: string;
  platform: "facebook" | "instagram" | "linkedin";
}) {
  const business = await getCurrentBusiness();
  if (!business) throw new Error("Non authentifié");

  const prompt = `Génère un post ${params.platform} pour ${business.name}, ${business.category} à ${business.city || "France"}.
Sujet: ${params.topic}
Ton: professionnel mais engageant
Longueur: ${params.platform === "instagram" ? "court avec hashtags" : "moyen"}
Inclure un appel à l'action`;

  if (!process.env.OPENAI_API_KEY) {
    return {
      content: `Post généré pour ${business.name} sur ${params.platform}:\n\n${params.topic}\n\nContactez-nous pour en savoir plus !`,
      generatedByAI: false,
    };
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 300,
    }),
  });

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content || "";

  return {
    content,
    generatedByAI: true,
  };
}

export async function generateMonthlyReport() {
  const business = await getCurrentBusiness();
  if (!business) throw new Error("Non authentifié");

  const prompt = `Génère un rapport mensuel pour ${business.name} (${business.category}).
Inclure:
- Résumé de l'activité
- Points forts
- Recommandations pour le mois prochain
- Objectifs suggérés`;

  if (!process.env.OPENAI_API_KEY) {
    return {
      report: `Rapport mensuel pour ${business.name}\n\nActivité stable ce mois-ci. Continuez sur cette lancée !`,
      generatedByAI: false,
    };
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 500,
    }),
  });

  const data = await res.json();
  const report = data.choices?.[0]?.message?.content || "";

  return {
    report,
    generatedByAI: true,
  };
}
