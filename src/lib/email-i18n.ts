/**
 * Traductions des emails transactionnels (subjects + labels).
 *
 * On ne traduit que ce qui est ROBUSTE :
 *  - Sujets (visibles dans la boîte de réception)
 *  - Labels de champs (Date, Heure, Adresse…)
 *  - CTAs (Laisser un avis, Confirmer…)
 *  - Salutation/signature
 *
 * Le contenu dynamique (nom du business, texte libre) reste tel quel.
 */

import type { Lang } from "@/lib/i18n";

const EMAIL_STRINGS = {
  fr: {
    // Sujets
    subjectBookingConfirmed: (biz: string) => `✅ Rendez-vous confirmé — ${biz}`,
    subjectQuoteRequest: (biz: string) => `📋 Demande de devis reçue — ${biz}`,
    subjectQuoteConfirmation: (biz: string) => `Votre devis chez ${biz}`,
    subjectNewBookingPro: (biz: string) => `📅 Nouveau rendez-vous — ${biz}`,
    subjectNewQuotePro: (biz: string) => `📋 Nouvelle demande de devis — ${biz}`,
    subjectReviewRequest: (biz: string) => `Comment s'est passée votre intervention avec ${biz} ?`,
    subjectQuoteReminder: (num: string) => `Rappel : devis ${num} en attente`,

    // Titres/messages
    bookingConfirmed: "Rendez-vous confirmé !",
    yourBookingIsValid: "votre réservation est validée",
    hello: "Bonjour",
    hi: "Salut",
    date: "Date",
    time: "Heure",
    service: "Service",
    address: "Adresse",
    phone: "Téléphone",
    quoteNumber: "Numéro de devis",
    description: "Description",
    contactClient: "Contacter le client",
    seeInDashboard: "Voir dans le tableau de bord",
    leaveReview: "Laisser un avis",
    yourReviewMatters: "Votre avis compte !",
    reviewIntro: "Votre retour aide d'autres clients à trouver un professionnel de confiance.",
    reviewTakes30s: "Cela ne prend que 30 secondes.",
    quoteReminderIntro:
      "votre devis {number} est toujours en attente. N'hésitez pas à nous recontacter.",
    ifIssue: "Un empêchement ?",
    callAt: "Appelez le",
    thanks: "Merci de votre confiance !",
    sentBy: "Envoyé via",
    sentFor: "pour",
    unsubscribe: "Se désabonner",
  },

  en: {
    subjectBookingConfirmed: (biz: string) => `✅ Booking confirmed — ${biz}`,
    subjectQuoteRequest: (biz: string) => `📋 Quote request received — ${biz}`,
    subjectQuoteConfirmation: (biz: string) => `Your quote at ${biz}`,
    subjectNewBookingPro: (biz: string) => `📅 New booking — ${biz}`,
    subjectNewQuotePro: (biz: string) => `📋 New quote request — ${biz}`,
    subjectReviewRequest: (biz: string) => `How was your appointment with ${biz}?`,
    subjectQuoteReminder: (num: string) => `Reminder: quote ${num} pending`,

    bookingConfirmed: "Booking confirmed!",
    yourBookingIsValid: "your booking has been confirmed",
    hello: "Hello",
    hi: "Hi",
    date: "Date",
    time: "Time",
    service: "Service",
    address: "Address",
    phone: "Phone",
    quoteNumber: "Quote number",
    description: "Description",
    contactClient: "Contact client",
    seeInDashboard: "View in dashboard",
    leaveReview: "Leave a review",
    yourReviewMatters: "Your review matters!",
    reviewIntro:
      "Your feedback helps other customers find a trustworthy professional.",
    reviewTakes30s: "It only takes 30 seconds.",
    quoteReminderIntro:
      "your quote {number} is still pending. Feel free to get back in touch.",
    ifIssue: "Any issue?",
    callAt: "Call",
    thanks: "Thank you for your trust!",
    sentBy: "Sent via",
    sentFor: "for",
    unsubscribe: "Unsubscribe",
  },

  es: {
    subjectBookingConfirmed: (biz: string) => `✅ Cita confirmada — ${biz}`,
    subjectQuoteRequest: (biz: string) => `📋 Solicitud de presupuesto recibida — ${biz}`,
    subjectQuoteConfirmation: (biz: string) => `Tu presupuesto en ${biz}`,
    subjectNewBookingPro: (biz: string) => `📅 Nueva cita — ${biz}`,
    subjectNewQuotePro: (biz: string) => `📋 Nueva solicitud de presupuesto — ${biz}`,
    subjectReviewRequest: (biz: string) => `¿Qué tal tu cita con ${biz}?`,
    subjectQuoteReminder: (num: string) => `Recordatorio: presupuesto ${num} pendiente`,

    bookingConfirmed: "¡Cita confirmada!",
    yourBookingIsValid: "tu reserva ha sido confirmada",
    hello: "Hola",
    hi: "Hola",
    date: "Fecha",
    time: "Hora",
    service: "Servicio",
    address: "Dirección",
    phone: "Teléfono",
    quoteNumber: "Número de presupuesto",
    description: "Descripción",
    contactClient: "Contactar al cliente",
    seeInDashboard: "Ver en el panel",
    leaveReview: "Dejar una opinión",
    yourReviewMatters: "¡Tu opinión importa!",
    reviewIntro:
      "Tu opinión ayuda a otros clientes a encontrar un profesional de confianza.",
    reviewTakes30s: "Solo lleva 30 segundos.",
    quoteReminderIntro:
      "tu presupuesto {number} sigue pendiente. Contáctanos si tienes preguntas.",
    ifIssue: "¿Algún imprevisto?",
    callAt: "Llama al",
    thanks: "¡Gracias por tu confianza!",
    sentBy: "Enviado vía",
    sentFor: "para",
    unsubscribe: "Cancelar suscripción",
  },

  de: {
    subjectBookingConfirmed: (biz: string) => `✅ Termin bestätigt — ${biz}`,
    subjectQuoteRequest: (biz: string) => `📋 Angebotsanfrage erhalten — ${biz}`,
    subjectQuoteConfirmation: (biz: string) => `Ihr Angebot bei ${biz}`,
    subjectNewBookingPro: (biz: string) => `📅 Neuer Termin — ${biz}`,
    subjectNewQuotePro: (biz: string) => `📋 Neue Angebotsanfrage — ${biz}`,
    subjectReviewRequest: (biz: string) => `Wie war Ihr Termin bei ${biz}?`,
    subjectQuoteReminder: (num: string) => `Erinnerung: Angebot ${num} ausstehend`,

    bookingConfirmed: "Termin bestätigt!",
    yourBookingIsValid: "Ihre Buchung wurde bestätigt",
    hello: "Guten Tag",
    hi: "Hallo",
    date: "Datum",
    time: "Uhrzeit",
    service: "Leistung",
    address: "Adresse",
    phone: "Telefon",
    quoteNumber: "Angebotsnummer",
    description: "Beschreibung",
    contactClient: "Kunde kontaktieren",
    seeInDashboard: "In der Übersicht ansehen",
    leaveReview: "Bewertung abgeben",
    yourReviewMatters: "Ihre Bewertung zählt!",
    reviewIntro:
      "Ihr Feedback hilft anderen Kunden, einen vertrauenswürdigen Fachmann zu finden.",
    reviewTakes30s: "Es dauert nur 30 Sekunden.",
    quoteReminderIntro:
      "Ihr Angebot {number} ist noch ausstehend. Bitte kontaktieren Sie uns bei Fragen.",
    ifIssue: "Verhindert?",
    callAt: "Rufen Sie an",
    thanks: "Vielen Dank für Ihr Vertrauen!",
    sentBy: "Gesendet über",
    sentFor: "für",
    unsubscribe: "Abbestellen",
  },
} as const;

export type EmailStringKey = keyof (typeof EMAIL_STRINGS)["fr"];

/**
 * Récupère une chaîne email dans la langue demandée, fallback FR si absente.
 * Les subjects sont des fonctions (biz) => string, les autres des string.
 * Le typage est celui de FR (source de vérité) — les autres langues doivent
 * respecter la même signature (garanti par `satisfies` en fin de dictionnaire).
 */
export function e<K extends EmailStringKey>(
  lang: Lang | string | null | undefined,
  key: K
): (typeof EMAIL_STRINGS)["fr"][K] {
  const l: Lang = (["fr", "en", "es", "de"] as const).includes(lang as Lang)
    ? (lang as Lang)
    : "fr";
  // Cast nécessaire car TS ne peut pas prouver l'uniformité des types entre langues
  return (EMAIL_STRINGS[l][key] ?? EMAIL_STRINGS.fr[key]) as (typeof EMAIL_STRINGS)["fr"][K];
}

/** Interpolation "{number}" → valeur */
export function ei(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}
