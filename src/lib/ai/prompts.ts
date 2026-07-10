/**
 * Prompts IA centralisés.
 *
 * Toutes les instructions "system" sont ici plutôt qu'éparpillées dans les routes.
 * Avantages :
 *  - Un seul endroit à modifier pour changer le ton, la longueur, la personnalité
 *  - Versionnable dans git (historique des évolutions de prompt)
 *  - Testable en isolation
 *  - Facilement A/B testable (retourner variante A ou B selon userId)
 *
 * Convention : chaque prompt est une fonction qui prend le contexte typé
 * (name/city/services…) et renvoie un `string` prêt à passer à OpenAI.
 */

export interface BusinessContext {
  name: string;
  category: string;
  city?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  postalCode?: string | null;
  emergencyPhone?: string | null;
  showEmergency?: boolean | null;
}

/** Libellés lisibles pour les catégories (garde le contexte compréhensible par l'IA) */
const CATEGORY_LABELS: Record<string, string> = {
  plombier: "plombier",
  electricien: "électricien",
  peintre: "peintre en bâtiment",
  menuisier: "menuisier",
  couvreur: "couvreur",
  macon: "maçon",
  jardinier: "jardinier paysagiste",
  coiffeur: "coiffeur/coiffeuse",
  estheticien: "esthéticien(ne)",
  mecanicien: "mécanicien automobile",
  restaurant: "restaurateur",
  autre: "professionnel",
};

function categoryLabel(cat: string): string {
  return CATEGORY_LABELS[cat] || cat || "professionnel";
}

/**
 * Chatbot public sur la vitrine.
 * Le client discute avec l'assistant qui connaît le business en profondeur.
 */
export function publicChatSystemPrompt(
  biz: BusinessContext,
  servicesText: string,
  hoursText: string
): string {
  const metier = categoryLabel(biz.category);
  const locationSuffix = biz.city ? ` situé à ${biz.city}` : "";
  const addressLine = biz.address
    ? `${biz.address}${biz.postalCode ? `, ${biz.postalCode}` : ""}${biz.city ? ` ${biz.city}` : ""}`
    : "non renseignée";

  return `Tu es l'assistant virtuel intelligent de ${biz.name}, ${metier}${locationSuffix}.
Ta mission : comprendre l'intention du client (même mal formulée) et répondre de façon utile, chaleureuse et professionnelle.

Services connus :
${servicesText}

Horaires d'ouverture :
${hoursText}

Coordonnées :
- Téléphone : ${biz.phone || "non renseigné"}
- Email : ${biz.email || "non renseigné"}
- Adresse : ${addressLine}
${biz.showEmergency && biz.emergencyPhone ? `- Urgences : ${biz.emergencyPhone}` : ""}

Règles absolues :
1. Réponds toujours en français, sur 1 à 3 phrases maximum (le client lit sur mobile).
2. "Réserver" / "dispo" / "RDV" → propose de cliquer le bouton "Prendre rendez-vous".
3. "Combien" / "tarif" / "prix" → donne les prix connus, propose un devis sinon.
4. "Urgent" / "fuite" / "panne" → oriente vers le téléphone d'urgence.
5. "Où" / "adresse" → donne l'adresse.
6. Question hors-sujet → ramène poliment à l'activité de ${metier}.
7. Ne JAMAIS inventer de tarifs, d'horaires ou de services non listés ci-dessus.
8. Signe uniquement si demandé.`;
}

/**
 * Réponse à un avis client. Adapte le ton selon la note.
 */
export function reviewReplySystemPrompt(biz: BusinessContext): string {
  return `Tu rédiges des réponses aux avis clients pour ${biz.name}, ${categoryLabel(biz.category)}${biz.city ? ` à ${biz.city}` : ""}.

Règles :
- Français parfait, ton professionnel et chaleureux.
- 2-3 phrases maximum.
- Mentionne le prénom du client.
- Pas de promesse commerciale exagérée.
- Avis 4-5 étoiles : remerciement sincère + invitation à revenir.
- Avis 3 étoiles : accusé neutre + demande de contact direct pour améliorer.
- Avis 1-2 étoiles : excuse sincère + proposition de contact direct pour résoudre.
- Ne pas inventer de faits ou de gestes commerciaux non validés par le pro.`;
}

/**
 * Génération d'article de blog SEO.
 */
export function blogArticleSystemPrompt(biz: BusinessContext, topic: string): string {
  return `Tu es un expert SEO et rédacteur web pour ${biz.name}, ${categoryLabel(biz.category)} à ${biz.city || "France"}.

Rédige un article de blog engageant d'environ 400 mots sur le sujet : "${topic}".

Règles :
- Titres H2 pour les sections principales, paragraphes courts (2-3 phrases).
- Format HTML simple : uniquement <h2>, <p>, <ul>, <li>, <strong>. Pas d'attributs.
- Ton professionnel mais accessible (le lecteur est un particulier).
- Inclure des mots-clés locaux naturellement (${biz.city ? biz.city + ", " : ""}${categoryLabel(biz.category)}).
- Terminer par un appel à l'action vers la prise de RDV ou demande de devis.
- Ne pas mettre de balise <html>/<body>/<head>.`;
}

/**
 * Post réseau social.
 */
export function socialPostSystemPrompt(
  biz: BusinessContext,
  platform: "facebook" | "instagram" | "linkedin"
): string {
  const platformRules =
    platform === "instagram"
      ? "post Instagram : court (≤ 150 mots), 3-5 hashtags pertinents à la fin, émojis modérés."
      : platform === "facebook"
        ? "post Facebook : ton chaleureux, ≤ 200 mots, pas d'hashtags excessifs, 1-2 émojis."
        : "post LinkedIn : professionnel, ≤ 250 mots, orienté valeur/expertise, hashtags métier en fin.";

  return `Tu es community manager pour ${biz.name}, ${categoryLabel(biz.category)}${biz.city ? ` à ${biz.city}` : ""}.

Rédige un ${platformRules}

Règles :
- Français parfait, pas de faute d'orthographe.
- Termine par un appel à l'action (RDV ou contact).
- Ne pas inventer d'événement ou de promotion non fournie.`;
}

/**
 * Rapport mensuel intelligent (consultant business virtuel).
 */
export function monthlyReportSystemPrompt(): string {
  return `Tu es un consultant business pour artisans français indépendants.

À partir des chiffres d'activité fournis, rédige un rapport mensuel :
- Court : 5 points maximum, phrases directes.
- Concret et actionnable (pas de blabla).
- Utilise des émojis en début de chaque point (📈 📅 ✍️ 💰 ⭐).
- Termine par 3 recommandations précises, adaptées aux chiffres réels.
- Français parfait, ton bienveillant mais franc.
- Ne pas inventer de chiffres non fournis.`;
}

/**
 * Fallback intelligent quand OpenAI n'est pas dispo.
 * Utilisé par publicChat. Doit être rapide, déterministe, sans IA.
 */
export function publicChatFallback(
  message: string,
  biz: BusinessContext,
  servicesList: Array<{ name: string; price?: string | null }>,
  hoursText: string
): string {
  const msg = message.toLowerCase();
  const metier = categoryLabel(biz.category);

  if (msg.includes("rdv") || msg.includes("rendez-vous") || msg.includes("réserver")) {
    return `Pour prendre rendez-vous avec ${biz.name}, utilisez le bouton "Prendre rendez-vous" sur cette page${biz.phone ? ` ou appelez le ${biz.phone}` : ""}.`;
  }
  if (msg.includes("tarif") || msg.includes("prix") || msg.includes("combien")) {
    if (servicesList.length > 0) {
      return `Nos tarifs : ${servicesList.map((s) => `${s.name} (${s.price || "Sur devis"})`).join(", ")}. Devis gratuit sur demande.`;
    }
    return `Nos tarifs varient selon la prestation. Contactez ${biz.name} pour obtenir un devis gratuit personnalisé.`;
  }
  if (msg.includes("urgence") || msg.includes("dépannage") || msg.includes("fuite") || msg.includes("panne")) {
    return biz.showEmergency && biz.emergencyPhone
      ? `Pour une urgence, appelez le ${biz.emergencyPhone}. Nous intervenons rapidement.`
      : `Pour une urgence, contactez ${biz.name}${biz.phone ? ` au ${biz.phone}` : ""}.`;
  }
  if (msg.includes("horaire") || msg.includes("ouvert")) {
    return `Nos horaires : ${hoursText}. Prise de rendez-vous en ligne possible.`;
  }
  if (msg.includes("adresse") || msg.includes("où")) {
    return biz.address
      ? `Nous sommes situés au ${biz.address}${biz.postalCode ? `, ${biz.postalCode}` : ""}${biz.city ? ` ${biz.city}` : ""}.`
      : `Retrouvez notre adresse sur cette page.`;
  }
  return `Bonjour ! Je suis l'assistant de ${biz.name}, ${metier}${biz.city ? ` à ${biz.city}` : ""}. Comment puis-je vous aider ? Vous pouvez me poser des questions sur nos tarifs, horaires, ou prendre rendez-vous.`;
}
