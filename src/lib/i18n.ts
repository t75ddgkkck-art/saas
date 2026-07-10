/**
 * i18n Vitrix — source unique de vérité pour toutes les traductions.
 *
 * Architecture :
 *  - `TRANSLATIONS.fr` = source de vérité (toutes les clés y existent obligatoirement)
 *  - Les autres langues sont typées `Partial<>` : si une clé manque en en/es/de,
 *    on retombe automatiquement sur la version FR (aucune clé littérale visible).
 *  - `t(lang, key, vars?)` supporte l'interpolation `{name}` → `Nathan`.
 *  - `td(lang, key)` = alias historique pour compat (dashboard).
 *
 * Ajouter une clé : mettre-la dans TRANSLATIONS.fr — TypeScript exigera de
 * mettre à jour Partial<> des autres langues si vous cherchez la complétude.
 */

export type Lang = "fr" | "en" | "es" | "de";
export const SUPPORTED_LANGS: readonly Lang[] = ["fr", "en", "es", "de"] as const;
export const DEFAULT_LANG: Lang = "fr";

const TRANSLATIONS = {
  fr: {
    // ============ Vitrine publique - CTA & boutons ============
    call: "Appeler",
    whatsapp: "WhatsApp",
    sms: "SMS",
    sendEmail: "Envoyer un email",
    email: "Email",
    book: "Prendre rendez-vous",
    quote: "Demander un devis",
    share: "Partager la page",
    back: "Retour",
    close: "Fermer",
    cancel: "Annuler",
    confirm: "Confirmer",
    send: "Envoyer",
    save: "Enregistrer",
    saved: "Enregistré",
    submit: "Valider",
    loading: "Chargement…",
    retry: "Réessayer",

    // ============ Vitrine publique - Sections ============
    hours: "Horaires d'ouverture",
    address: "Adresse & Zone",
    location: "Localisation",
    gallery: "Galerie",
    reviews: "Avis clients",
    faq: "Questions fréquentes",
    socials: "Réseaux sociaux",
    services: "Services & Tarifs",
    menu: "Notre carte",
    payment: "Paiement en ligne",
    blog: "Lire notre blog",

    // ============ Vitrine publique - Divers ============
    closed: "Fermé",
    zone: "Zone",
    poweredBy: "Propulsé par",
    emergency: "Urgence",
    qrTitle: "Scannez pour partager",
    chooseSlot: "Choisissez un créneau",
    confirmBooking: "Confirmer le RDV",
    scanToShare: "Scannez ce code pour enregistrer ou partager cette page.",
    noReviews: "Aucun avis pour le moment. Soyez le premier !",
    leaveReview: "Laisser un avis",
    reviewSubmitted: "Merci pour votre avis !",
    availableNow: "Disponible maintenant",
    openNow: "Ouvert maintenant",
    closedNow: "Fermé actuellement",

    // ============ Vitrine publique - Réservation ============
    bookingConfirmed: "Rendez-vous confirmé !",
    bookingEmailSent: "Un email de confirmation vous a été envoyé.",
    yourName: "Votre nom",
    yourFirstName: "Prénom",
    yourLastName: "Nom",
    yourPhone: "Téléphone",
    yourEmail: "Email",
    yourMessage: "Votre message",
    optionalNotes: "Notes complémentaires (facultatif)",
    noSlotsAvailable: "Aucun créneau disponible pour le moment.",
    slotAlreadyTaken: "Ce créneau vient d'être réservé, choisissez-en un autre.",

    // ============ Vitrine publique - Devis ============
    quoteRequest: "Demande de devis",
    describeYourNeed: "Décrivez votre besoin",
    attachFiles: "Joindre des photos ou documents (facultatif)",
    quoteSent: "Demande envoyée !",
    quoteConfirmationEmail: "Vous recevrez une confirmation par email.",

    // ============ Erreurs (générales) ============
    errorGeneric: "Une erreur est survenue. Réessayez.",
    errorNetwork: "Problème de connexion. Vérifiez votre réseau.",
    errorUnauthorized: "Vous devez être connecté.",
    errorForbidden: "Accès refusé.",
    errorNotFound: "Ressource introuvable.",
    errorTooManyRequests: "Trop de requêtes. Réessayez dans quelques minutes.",
    fieldRequired: "Ce champ est requis",
    invalidEmail: "Email invalide",
    invalidPhone: "Téléphone invalide",

    // ============ Dashboard - Navigation ============
    dashboard: "Tableau de bord",
    myVitrine: "Ma vitrine",
    blogNav: "Blog",
    qrCodeNav: "QR Code",
    toolsNav: "Outils",
    aiAssistant: "Assistant IA",
    settings: "Paramètres",
    logout: "Déconnexion",

    // ============ Dashboard - Header & Stats ============
    hello: "Bonjour",
    activitySubtitle: "Toute votre activité en un endroit",
    overview: "Aperçu",
    appointments: "Rendez-vous",
    quotes: "Devis",
    clientsTab: "Clients",
    paymentsTab: "Paiements",
    revenue: "Chiffre d'affaires",
    appointmentsFull: "Rendez-vous",
    quotesFull: "Devis",
    clientsFull: "Clients",
    visitors: "Visiteurs (14 j)",
    copyLink: "Copier le lien",
    copied: "Copié",
    view: "Voir",
    customize: "Personnaliser",
    launchActivity: "Lancez votre activité !",
    launchText:
      "Personnalisez votre vitrine, partagez votre lien et vos premiers rendez-vous, devis et clients apparaîtront ici.",
    customizeVitrine: "Personnaliser ma vitrine",
    myQrCode: "Mon QR Code",
    visitStats: "Visites de votre vitrine",
    sources: "Sources",
    noVisits: "Aucune visite pour le moment. Partagez votre lien !",

    // ============ Dashboard - Onglets Settings ============
    account: "Mon compte",
    languageTab: "Langue",
    subscription: "Abonnement",
    deletion: "Suppression",

    // ============ Dashboard - Éditeur vitrine ============
    designTab: "Design",
    infoTab: "Informations",
    hoursTab: "Horaires",
    servicesTab: "Services",
    paymentsTabEditor: "Paiements",
    loyaltyTab: "Fidélité",
    faqTab: "FAQ",
    automationsTab: "Automatisations",
    savedSuccess: "Modifications enregistrées !",

    // ============ Accessibilité (labels invisibles) ============
    a11yOpenMenu: "Ouvrir le menu",
    a11yCloseMenu: "Fermer le menu",
    a11yToggleTheme: "Changer de thème",
    a11yNotifications: "Notifications",
    a11ySearch: "Rechercher",
    a11ySkipToContent: "Aller au contenu principal",

    // ============ Emails ============
    emailFooterUnsubscribe: "Se désabonner",
    emailFooterLegal: "Cet email vous a été envoyé par {business} via Vitrix.",
  },

  en: {
    call: "Call",
    whatsapp: "WhatsApp",
    sms: "SMS",
    sendEmail: "Send an email",
    email: "Email",
    book: "Book an appointment",
    quote: "Request a quote",
    share: "Share this page",
    back: "Back",
    close: "Close",
    cancel: "Cancel",
    confirm: "Confirm",
    send: "Send",
    save: "Save",
    saved: "Saved",
    submit: "Submit",
    loading: "Loading…",
    retry: "Retry",

    hours: "Opening hours",
    address: "Address & Area",
    location: "Location",
    gallery: "Gallery",
    reviews: "Customer reviews",
    faq: "Frequently asked questions",
    socials: "Social media",
    services: "Services & Prices",
    menu: "Our menu",
    payment: "Online payment",
    blog: "Read our blog",

    closed: "Closed",
    zone: "Area",
    poweredBy: "Powered by",
    emergency: "Emergency",
    qrTitle: "Scan to share",
    chooseSlot: "Choose a time slot",
    confirmBooking: "Confirm booking",
    scanToShare: "Scan this code to save or share this page.",
    noReviews: "No reviews yet. Be the first!",
    leaveReview: "Leave a review",
    reviewSubmitted: "Thanks for your review!",
    availableNow: "Available now",
    openNow: "Open now",
    closedNow: "Currently closed",

    bookingConfirmed: "Booking confirmed!",
    bookingEmailSent: "A confirmation email has been sent to you.",
    yourName: "Your name",
    yourFirstName: "First name",
    yourLastName: "Last name",
    yourPhone: "Phone",
    yourEmail: "Email",
    yourMessage: "Your message",
    optionalNotes: "Additional notes (optional)",
    noSlotsAvailable: "No time slots available at the moment.",
    slotAlreadyTaken: "This slot has just been booked, please choose another.",

    quoteRequest: "Quote request",
    describeYourNeed: "Describe your needs",
    attachFiles: "Attach photos or documents (optional)",
    quoteSent: "Request sent!",
    quoteConfirmationEmail: "You will receive a confirmation email.",

    errorGeneric: "Something went wrong. Please try again.",
    errorNetwork: "Connection problem. Check your network.",
    errorUnauthorized: "You must be logged in.",
    errorForbidden: "Access denied.",
    errorNotFound: "Resource not found.",
    errorTooManyRequests: "Too many requests. Try again in a few minutes.",
    fieldRequired: "This field is required",
    invalidEmail: "Invalid email",
    invalidPhone: "Invalid phone number",

    dashboard: "Dashboard",
    myVitrine: "My storefront",
    blogNav: "Blog",
    qrCodeNav: "QR Code",
    toolsNav: "Tools",
    aiAssistant: "AI Assistant",
    settings: "Settings",
    logout: "Log out",

    hello: "Hello",
    activitySubtitle: "All your activity in one place",
    overview: "Overview",
    appointments: "Bookings",
    quotes: "Quotes",
    clientsTab: "Clients",
    paymentsTab: "Payments",
    revenue: "Revenue",
    appointmentsFull: "Appointments",
    quotesFull: "Quotes",
    clientsFull: "Clients",
    visitors: "Visitors (14d)",
    copyLink: "Copy link",
    copied: "Copied",
    view: "View",
    customize: "Customize",
    launchActivity: "Launch your business!",
    launchText:
      "Customize your storefront, share your link, and your first bookings, quotes and clients will appear here.",
    customizeVitrine: "Customize my storefront",
    myQrCode: "My QR Code",
    visitStats: "Storefront visits",
    sources: "Sources",
    noVisits: "No visits yet. Share your link!",

    account: "My account",
    languageTab: "Language",
    subscription: "Subscription",
    deletion: "Deletion",

    designTab: "Design",
    infoTab: "Information",
    hoursTab: "Hours",
    servicesTab: "Services",
    paymentsTabEditor: "Payments",
    loyaltyTab: "Loyalty",
    faqTab: "FAQ",
    automationsTab: "Automations",
    savedSuccess: "Changes saved!",

    a11yOpenMenu: "Open menu",
    a11yCloseMenu: "Close menu",
    a11yToggleTheme: "Toggle theme",
    a11yNotifications: "Notifications",
    a11ySearch: "Search",
    a11ySkipToContent: "Skip to main content",

    emailFooterUnsubscribe: "Unsubscribe",
    emailFooterLegal: "This email was sent to you by {business} via Vitrix.",
  },

  es: {
    call: "Llamar",
    whatsapp: "WhatsApp",
    sms: "SMS",
    sendEmail: "Enviar un correo",
    email: "Correo",
    book: "Reservar cita",
    quote: "Pedir presupuesto",
    share: "Compartir página",
    back: "Volver",
    close: "Cerrar",
    cancel: "Cancelar",
    confirm: "Confirmar",
    send: "Enviar",
    save: "Guardar",
    saved: "Guardado",
    submit: "Enviar",
    loading: "Cargando…",
    retry: "Reintentar",

    hours: "Horario de apertura",
    address: "Dirección y Zona",
    location: "Ubicación",
    gallery: "Galería",
    reviews: "Opiniones de clientes",
    faq: "Preguntas frecuentes",
    socials: "Redes sociales",
    services: "Servicios y Precios",
    menu: "Nuestra carta",
    payment: "Pago en línea",
    blog: "Leer nuestro blog",

    closed: "Cerrado",
    zone: "Zona",
    poweredBy: "Impulsado por",
    emergency: "Emergencia",
    qrTitle: "Escanea para compartir",
    chooseSlot: "Elige un horario",
    confirmBooking: "Confirmar cita",
    scanToShare: "Escanea este código para guardar o compartir esta página.",
    noReviews: "No hay opiniones todavía. ¡Sé el primero!",
    leaveReview: "Dejar una opinión",
    reviewSubmitted: "¡Gracias por tu opinión!",
    availableNow: "Disponible ahora",
    openNow: "Abierto ahora",
    closedNow: "Actualmente cerrado",

    bookingConfirmed: "¡Cita confirmada!",
    bookingEmailSent: "Se te ha enviado un correo de confirmación.",
    yourName: "Tu nombre",
    yourFirstName: "Nombre",
    yourLastName: "Apellido",
    yourPhone: "Teléfono",
    yourEmail: "Correo",
    yourMessage: "Tu mensaje",
    optionalNotes: "Notas adicionales (opcional)",
    noSlotsAvailable: "No hay horarios disponibles por el momento.",
    slotAlreadyTaken: "Este horario acaba de ser reservado, elige otro.",

    quoteRequest: "Solicitud de presupuesto",
    describeYourNeed: "Describe tu necesidad",
    attachFiles: "Adjuntar fotos o documentos (opcional)",
    quoteSent: "¡Solicitud enviada!",
    quoteConfirmationEmail: "Recibirás un correo de confirmación.",

    errorGeneric: "Ha ocurrido un error. Inténtalo de nuevo.",
    errorNetwork: "Problema de conexión. Verifica tu red.",
    errorUnauthorized: "Debes iniciar sesión.",
    errorForbidden: "Acceso denegado.",
    errorNotFound: "Recurso no encontrado.",
    errorTooManyRequests: "Demasiadas solicitudes. Reintenta en unos minutos.",
    fieldRequired: "Este campo es obligatorio",
    invalidEmail: "Correo inválido",
    invalidPhone: "Teléfono inválido",

    dashboard: "Panel",
    myVitrine: "Mi vitrina",
    blogNav: "Blog",
    qrCodeNav: "Código QR",
    toolsNav: "Herramientas",
    aiAssistant: "Asistente IA",
    settings: "Ajustes",
    logout: "Cerrar sesión",

    hello: "Hola",
    activitySubtitle: "Toda tu actividad en un solo lugar",
    overview: "Resumen",
    appointments: "Citas",
    quotes: "Presupuestos",
    clientsTab: "Clientes",
    paymentsTab: "Pagos",
    revenue: "Ingresos",
    appointmentsFull: "Citas",
    quotesFull: "Presupuestos",
    clientsFull: "Clientes",
    visitors: "Visitantes (14 d)",
    copyLink: "Copiar enlace",
    copied: "Copiado",
    view: "Ver",
    customize: "Personalizar",
    launchActivity: "¡Lanza tu actividad!",
    launchText:
      "Personaliza tu vitrina, comparte tu enlace, y tus primeras citas, presupuestos y clientes aparecerán aquí.",
    customizeVitrine: "Personalizar mi vitrina",
    myQrCode: "Mi código QR",
    visitStats: "Visitas de tu vitrina",
    sources: "Fuentes",
    noVisits: "No hay visitas todavía. ¡Comparte tu enlace!",

    account: "Mi cuenta",
    languageTab: "Idioma",
    subscription: "Suscripción",
    deletion: "Eliminación",

    designTab: "Diseño",
    infoTab: "Información",
    hoursTab: "Horarios",
    servicesTab: "Servicios",
    paymentsTabEditor: "Pagos",
    loyaltyTab: "Fidelidad",
    faqTab: "FAQ",
    automationsTab: "Automatizaciones",
    savedSuccess: "¡Cambios guardados!",

    a11yOpenMenu: "Abrir menú",
    a11yCloseMenu: "Cerrar menú",
    a11yToggleTheme: "Cambiar tema",
    a11yNotifications: "Notificaciones",
    a11ySearch: "Buscar",
    a11ySkipToContent: "Saltar al contenido principal",

    emailFooterUnsubscribe: "Cancelar suscripción",
    emailFooterLegal: "Este correo te lo ha enviado {business} a través de Vitrix.",
  },

  de: {
    call: "Anrufen",
    whatsapp: "WhatsApp",
    sms: "SMS",
    sendEmail: "E-Mail senden",
    email: "E-Mail",
    book: "Termin buchen",
    quote: "Angebot anfordern",
    share: "Seite teilen",
    back: "Zurück",
    close: "Schließen",
    cancel: "Abbrechen",
    confirm: "Bestätigen",
    send: "Senden",
    save: "Speichern",
    saved: "Gespeichert",
    submit: "Absenden",
    loading: "Laden…",
    retry: "Erneut versuchen",

    hours: "Öffnungszeiten",
    address: "Adresse & Gebiet",
    location: "Standort",
    gallery: "Galerie",
    reviews: "Kundenbewertungen",
    faq: "Häufige Fragen",
    socials: "Soziale Netzwerke",
    services: "Leistungen & Preise",
    menu: "Unsere Karte",
    payment: "Online-Zahlung",
    blog: "Zum Blog",

    closed: "Geschlossen",
    zone: "Gebiet",
    poweredBy: "Bereitgestellt von",
    emergency: "Notfall",
    qrTitle: "Zum Teilen scannen",
    chooseSlot: "Wählen Sie einen Termin",
    confirmBooking: "Termin bestätigen",
    scanToShare: "Scannen Sie diesen Code, um die Seite zu speichern oder zu teilen.",
    noReviews: "Noch keine Bewertungen. Seien Sie die erste Person!",
    leaveReview: "Bewertung abgeben",
    reviewSubmitted: "Danke für Ihre Bewertung!",
    availableNow: "Jetzt verfügbar",
    openNow: "Jetzt geöffnet",
    closedNow: "Derzeit geschlossen",

    bookingConfirmed: "Termin bestätigt!",
    bookingEmailSent: "Eine Bestätigungs-E-Mail wurde Ihnen zugesandt.",
    yourName: "Ihr Name",
    yourFirstName: "Vorname",
    yourLastName: "Nachname",
    yourPhone: "Telefon",
    yourEmail: "E-Mail",
    yourMessage: "Ihre Nachricht",
    optionalNotes: "Zusätzliche Notizen (optional)",
    noSlotsAvailable: "Zurzeit keine Termine verfügbar.",
    slotAlreadyTaken: "Dieser Termin wurde gerade gebucht, wählen Sie einen anderen.",

    quoteRequest: "Angebotsanfrage",
    describeYourNeed: "Beschreiben Sie Ihren Bedarf",
    attachFiles: "Fotos oder Dokumente anhängen (optional)",
    quoteSent: "Anfrage gesendet!",
    quoteConfirmationEmail: "Sie erhalten eine Bestätigungs-E-Mail.",

    errorGeneric: "Ein Fehler ist aufgetreten. Bitte erneut versuchen.",
    errorNetwork: "Verbindungsproblem. Prüfen Sie Ihr Netzwerk.",
    errorUnauthorized: "Sie müssen angemeldet sein.",
    errorForbidden: "Zugriff verweigert.",
    errorNotFound: "Ressource nicht gefunden.",
    errorTooManyRequests: "Zu viele Anfragen. Erneut in einigen Minuten versuchen.",
    fieldRequired: "Dieses Feld ist erforderlich",
    invalidEmail: "Ungültige E-Mail",
    invalidPhone: "Ungültige Telefonnummer",

    dashboard: "Übersicht",
    myVitrine: "Meine Vitrine",
    blogNav: "Blog",
    qrCodeNav: "QR-Code",
    toolsNav: "Werkzeuge",
    aiAssistant: "KI-Assistent",
    settings: "Einstellungen",
    logout: "Abmelden",

    hello: "Hallo",
    activitySubtitle: "Ihre gesamte Aktivität an einem Ort",
    overview: "Übersicht",
    appointments: "Termine",
    quotes: "Angebote",
    clientsTab: "Kunden",
    paymentsTab: "Zahlungen",
    revenue: "Umsatz",
    appointmentsFull: "Termine",
    quotesFull: "Angebote",
    clientsFull: "Kunden",
    visitors: "Besucher (14 T)",
    copyLink: "Link kopieren",
    copied: "Kopiert",
    view: "Ansehen",
    customize: "Anpassen",
    launchActivity: "Starten Sie Ihr Geschäft!",
    launchText:
      "Passen Sie Ihre Vitrine an, teilen Sie Ihren Link, und Ihre ersten Termine, Angebote und Kunden erscheinen hier.",
    customizeVitrine: "Meine Vitrine anpassen",
    myQrCode: "Mein QR-Code",
    visitStats: "Besuche Ihrer Vitrine",
    sources: "Quellen",
    noVisits: "Noch keine Besuche. Teilen Sie Ihren Link!",

    account: "Mein Konto",
    languageTab: "Sprache",
    subscription: "Abonnement",
    deletion: "Löschung",

    designTab: "Design",
    infoTab: "Informationen",
    hoursTab: "Öffnungszeiten",
    servicesTab: "Leistungen",
    paymentsTabEditor: "Zahlungen",
    loyaltyTab: "Treueprogramm",
    faqTab: "FAQ",
    automationsTab: "Automatisierungen",
    savedSuccess: "Änderungen gespeichert!",

    a11yOpenMenu: "Menü öffnen",
    a11yCloseMenu: "Menü schließen",
    a11yToggleTheme: "Design wechseln",
    a11yNotifications: "Benachrichtigungen",
    a11ySearch: "Suchen",
    a11ySkipToContent: "Zum Hauptinhalt springen",

    emailFooterUnsubscribe: "Abbestellen",
    emailFooterLegal: "Diese E-Mail wurde Ihnen von {business} über Vitrix zugesandt.",
  },
} as const satisfies Record<Lang, Record<string, string>>;

// Type dérivé de FR (source de vérité) : autocomplétion + erreur si clé absente.
export type TranslationKey = keyof (typeof TRANSLATIONS)["fr"];

type Vars = Record<string, string | number>;

/**
 * Interpolation "{name}" → valeur, avec échappement HTML basique pour éviter
 * les injections si vars vient d'un input utilisateur.
 */
function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (m, key) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : m
  );
}

/**
 * Traduit une clé. Fallback FR si la clé manque dans la langue demandée
 * (mieux qu'afficher la clé littérale à l'utilisateur).
 *
 *   t("en", "book")                  → "Book an appointment"
 *   t("fr", "emailFooterLegal", { business: "Nathan" })
 *   t("xx" as Lang, "hours")         → français (fallback)
 */
export function t(lang: Lang | string | null | undefined, key: TranslationKey, vars?: Vars): string {
  const l: Lang = (SUPPORTED_LANGS.includes(lang as Lang) ? lang : DEFAULT_LANG) as Lang;
  const raw = TRANSLATIONS[l]?.[key] ?? TRANSLATIONS[DEFAULT_LANG][key] ?? key;
  return interpolate(raw, vars);
}

/**
 * Alias historique — utilisé par le dashboard (LangContext.td).
 * Identique à `t()` sauf que la langue par défaut est "fr" si null.
 */
export function td(lang: Lang | string | null | undefined, key: string): string {
  return t(lang, key as TranslationKey);
}

/**
 * Détection de langue depuis un header `Accept-Language`.
 * Renvoie la première langue supportée trouvée, ou "fr" par défaut.
 *
 *   detectLangFromAcceptLanguage("en-US,en;q=0.9,fr;q=0.8") → "en"
 *   detectLangFromAcceptLanguage("es-ES,es;q=0.9")          → "es"
 *   detectLangFromAcceptLanguage(null)                       → "fr"
 */
export function detectLangFromAcceptLanguage(header: string | null | undefined): Lang {
  if (!header) return DEFAULT_LANG;
  try {
    const parsed = header
      .split(",")
      .map((entry) => {
        const [tag, q] = entry.trim().split(";q=");
        return { tag: tag.trim().toLowerCase(), q: q ? parseFloat(q) : 1 };
      })
      .filter((e) => Number.isFinite(e.q))
      .sort((a, b) => b.q - a.q);

    for (const { tag } of parsed) {
      const base = tag.split("-")[0] as Lang;
      if (SUPPORTED_LANGS.includes(base)) return base;
    }
  } catch {
    // ignore
  }
  return DEFAULT_LANG;
}

/**
 * Formatte une date dans la locale demandée.
 *   formatLocaleDate("2026-07-15", "en", { dateStyle: "full" })
 *   → "Wednesday, July 15, 2026"
 */
export function formatLocaleDate(
  date: Date | string | number,
  lang: Lang = DEFAULT_LANG,
  opts: Intl.DateTimeFormatOptions = { dateStyle: "long" }
): string {
  const localeMap: Record<Lang, string> = {
    fr: "fr-FR",
    en: "en-US",
    es: "es-ES",
    de: "de-DE",
  };
  try {
    return new Intl.DateTimeFormat(localeMap[lang], opts).format(new Date(date));
  } catch {
    return String(date);
  }
}

/**
 * Formatte une somme en devise selon la locale.
 *   formatLocaleCurrency(29.9, "en") → "€29.90"
 *   formatLocaleCurrency(29.9, "de") → "29,90 €"
 */
export function formatLocaleCurrency(
  amount: number,
  lang: Lang = DEFAULT_LANG,
  currency = "EUR"
): string {
  const localeMap: Record<Lang, string> = {
    fr: "fr-FR",
    en: "en-US",
    es: "es-ES",
    de: "de-DE",
  };
  try {
    return new Intl.NumberFormat(localeMap[lang], {
      style: "currency",
      currency,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

/** Utile pour les tests / outils qui veulent lister toutes les clés. */
export function allKeys(): TranslationKey[] {
  return Object.keys(TRANSLATIONS.fr) as TranslationKey[];
}
