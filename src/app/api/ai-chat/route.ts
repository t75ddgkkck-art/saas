import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { businesses, services, workingHours } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

// Chatbot IA public sur la vitrine - connaît le métier, les services, les horaires du pro
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { businessId, message, sessionId } = body;

    if (!businessId || !message) {
      return NextResponse.json({ error: "businessId et message requis" }, { status: 400 });
    }

    const businessResult = await db.select().from(businesses).where(eq(businesses.id, businessId)).limit(1);
    const business = businessResult[0];
    if (!business) {
      return NextResponse.json({ error: "Business introuvable" }, { status: 404 });
    }

    // Récupérer les services et horaires pour le contexte
    const [bizServices, bizHours] = await Promise.all([
      db.select().from(services).where(eq(services.businessId, businessId)),
      db.select().from(workingHours).where(eq(workingHours.businessId, businessId)),
    ]);

    const servicesText = bizServices.length > 0
      ? bizServices.map(s => `- ${s.name}: ${s.price || "Sur devis"} (${s.description || "pas de description"})`).join("\n")
      : "Aucun service renseigné pour le moment.";

    const days = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
    const hoursText = bizHours.length > 0
      ? bizHours.map(h => `${days[h.dayOfWeek]}: ${h.isClosed ? "Fermé" : `${h.startTime} - ${h.endTime}`}`).join("\n")
      : "Horaires non renseignés.";

    const categoryLabels: Record<string, string> = {
      "plombier": "plombier",
      "electricien": "électricien",
      "peintre": "peintre en bâtiment",
      "menuisier": "menuisier",
      "couvreur": "couvreur",
      "macon": "maçon",
      "jardinier": "jardinier paysagiste",
      "coiffeur": "coiffeur/coiffeuse",
      "estheticien": "esthéticien(ne)",
      "mecanicien": "mécanicien automobile",
      "autre": "professionnel",
    };
    const metier = categoryLabels[business.category] || business.category || "professionnel";

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
                content: `Tu es l'assistant virtuel intelligent de ${business.name}, ${metier} situé${business.city ? ` à ${business.city}` : ""}. 
Ta mission est de comprendre l'intention du client (même mal formulée) et de répondre de façon utile, chaleureuse et professionnelle.
Tu connais ces services :
${servicesText}

Horaires d'ouverture :
${hoursText}

Téléphone : ${business.phone || "non renseigné"}
Email : ${business.email || "non renseigné"}
Adresse : ${business.address || "non renseignée"}${business.postalCode ? `, ${business.postalCode}` : ""}${business.city ? ` ${business.city}` : ""}

Règles de compréhension :
- "Je veux réserver" / "dispo demain" -> Propose RDV.
- "C'est combien ?" / "tarif" -> Donne les prix.
- "Urgent" / "fuite" / "panne" -> Donne le téléphone ou numéro urgence.
- "Où vous êtes ?" -> Donne l'adresse.
- Si la question est hors sujet, ramène poliment à l'activité de ${metier}.
- Réponds toujours en français, de manière conversationnelle (pas de robot).`,
              },
              { role: "user", content: message },
            ],
            max_tokens: 300,
            temperature: 0.7,
          }),
        });
        const data = await res.json();
        reply = data.choices?.[0]?.message?.content || null;
      } catch { /* fallback ci-dessous */ }
    }

    // Fallback intelligent sans OpenAI
    if (!reply) {
      const msg = message.toLowerCase();
      if (msg.includes("rdv") || msg.includes("rendez-vous") || msg.includes("réserver")) {
        reply = `Pour prendre rendez-vous avec ${business.name}, vous pouvez utiliser le bouton "Prendre rendez-vous" sur cette page${business.phone ? `, ou nous appeler au ${business.phone}` : ""}. Nous serons ravis de vous accueillir !`;
      } else if (msg.includes("tarif") || msg.includes("prix") || msg.includes("combien")) {
        if (bizServices.length > 0) {
          reply = `Voici nos tarifs : ${bizServices.map(s => `${s.name} (${s.price || "Sur devis"})`).join(", ")}. N'hésitez pas à nous contacter pour un devis personnalisé !`;
        } else {
          reply = `Nos tarifs varient selon la prestation. Contactez ${business.name} pour obtenir un devis gratuit et personnalisé.`;
        }
      } else if (msg.includes("urgence") || msg.includes("dépannage")) {
        reply = business.showEmergency && business.emergencyPhone
          ? `Pour les urgences, appelez directement le ${business.emergencyPhone}. Nous intervenons rapidement !`
          : `Pour toute urgence, contactez ${business.name} au ${business.phone || "numéro indiqué sur la page"}.`;
      } else if (msg.includes("horaire") || msg.includes("ouvert")) {
        reply = `Nos horaires : ${hoursText}. N'hésitez pas à prendre rendez-vous en ligne !`;
      } else if (msg.includes("adresse") || msg.includes("où")) {
        reply = business.address
          ? `Nous sommes situés au ${business.address}${business.postalCode ? `, ${business.postalCode}` : ""}${business.city ? ` ${business.city}` : ""}. Au plaisir de vous accueillir !`
          : `Retrouvez notre adresse complète sur cette page. N'hésitez pas à nous contacter !`;
      } else {
        reply = `Bonjour ! Je suis l'assistant de ${business.name}, ${metier}${business.city ? ` à ${business.city}` : ""}. Comment puis-je vous aider ? Vous pouvez me poser des questions sur nos tarifs, horaires, ou prendre rendez-vous.`;
      }
    }

    return NextResponse.json({ reply });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
