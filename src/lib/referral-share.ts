/**
 * Lot 52 (F14) — Helpers pour partage du code parrain.
 *
 * Pure fonctions, aucun accès DB / réseau. Utilisées par :
 *  - <ReferralHero> (boutons "Partager par…" WhatsApp/SMS/Email)
 *  - Tests unitaires (référence stable, templates FR figés)
 *
 * Design :
 *  - `buildShareUrl(baseUrl, code)` : construit l'URL de partage canonique
 *  - `buildEmailShareLink(...)` : mailto: avec sujet + body pré-remplis
 *  - `buildWhatsappShareLink(...)` : wa.me/?text=... URL-encodé
 *  - `buildSmsShareLink(...)` : sms:?&body=... (universel iOS + Android)
 *  - Templates FR figés — trad EN/ES/DE en v2 si besoin
 */

// -----------------------------------------------------------------------------
// URL builders
// -----------------------------------------------------------------------------

/**
 * Construit l'URL de partage : `<baseUrl>/register?ref=<code>`.
 * Le paramètre `?ref=` est déjà lu par POST /api/auth/register (Lot 16.3).
 */
export function buildShareUrl(baseUrl: string, code: string): string {
  const cleanBase = baseUrl.replace(/\/+$/, "");
  return `${cleanBase}/register?ref=${encodeURIComponent(code)}`;
}

// -----------------------------------------------------------------------------
// Templates de messages — FR uniquement en v1
// -----------------------------------------------------------------------------

export interface ShareTemplates {
  /** Sujet email (max ~50 chars pour éviter la coupure Gmail) */
  emailSubject: string;
  /** Corps email (formaté texte, saut de ligne \n → converti en %0A pour mailto) */
  emailBody: string;
  /** Message WhatsApp/SMS court (150 chars max pour rentrer SMS) */
  shortMessage: string;
}

/**
 * Génère les 3 templates de partage à partir de l'URL et du prénom optionnel.
 * On personnalise le "message envoyé PAR" si le firstName est fourni.
 */
export function buildShareTemplates(url: string, firstName?: string | null): ShareTemplates {
  const signature = firstName ? `\n\n${firstName}` : "";

  return {
    emailSubject: "Un outil qui pourrait t'intéresser pour ton activité",
    emailBody:
      `Salut,\n\n` +
      `J'utilise Vitrix pour gérer mon activité (vitrine, RDV, devis, paiements en ligne).\n` +
      `C'est vraiment simple et ça m'a fait gagner un temps fou.\n\n` +
      `Si tu veux tester, voici mon lien : ${url}\n\n` +
      `Créer un compte est gratuit, tu peux essayer sans engagement.` +
      signature,
    shortMessage: `Salut ! J'utilise Vitrix pour mon activité, c'est top. Teste avec mon lien : ${url}`,
  };
}

// -----------------------------------------------------------------------------
// Deep links vers apps natives (WhatsApp, Mail, SMS)
// -----------------------------------------------------------------------------

/** mailto: pré-rempli — ouvre le client mail par défaut. */
export function buildEmailShareLink(templates: ShareTemplates, to = ""): string {
  const subject = encodeURIComponent(templates.emailSubject);
  const body = encodeURIComponent(templates.emailBody);
  return `mailto:${to}?subject=${subject}&body=${body}`;
}

/**
 * https://wa.me/?text=... — universel WhatsApp Web + mobile.
 * Marche même sans numéro (l'user choisit le destinataire dans WhatsApp).
 */
export function buildWhatsappShareLink(templates: ShareTemplates): string {
  return `https://wa.me/?text=${encodeURIComponent(templates.shortMessage)}`;
}

/**
 * sms:?&body=... — iOS et Android acceptent tous les deux.
 * Note : le sms: sans destinataire ouvre l'app SMS avec le body pré-rempli,
 * l'user sélectionne le contact avant d'envoyer.
 */
export function buildSmsShareLink(templates: ShareTemplates): string {
  // iOS préfère `?body=`, Android `&body=` — le & universel fonctionne pour les deux
  return `sms:?&body=${encodeURIComponent(templates.shortMessage)}`;
}
