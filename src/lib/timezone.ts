/**
 * Utilitaires fuseau horaire pour les bookings.
 *
 * Convention retenue :
 *  - date + startTime + endTime stockés en heure LOCALE du business (varchar simple).
 *  - Le business a un champ `timezone` (défaut "Europe/Paris") côté profil.
 *  - Le client de la vitrine voit les créneaux dans la TZ du business, avec
 *    optionnellement une indication "Heure locale à Paris (UTC+1)".
 *
 * Ces helpers permettent d'afficher un slot dans une TZ donnée sans dépendance externe.
 */

export const DEFAULT_TIMEZONE = "Europe/Paris";

/**
 * Liste des TZ supportées côté UI (limitée à celles pertinentes pour la France
 * métropolitaine + DOM/TOM les plus courants).
 */
export const SUPPORTED_TIMEZONES: { value: string; label: string; offset: string }[] = [
  { value: "Europe/Paris", label: "France métropolitaine (Paris)", offset: "UTC+1/+2" },
  { value: "Indian/Reunion", label: "La Réunion", offset: "UTC+4" },
  { value: "Indian/Mayotte", label: "Mayotte", offset: "UTC+3" },
  { value: "America/Guadeloupe", label: "Guadeloupe", offset: "UTC-4" },
  { value: "America/Martinique", label: "Martinique", offset: "UTC-4" },
  { value: "America/Cayenne", label: "Guyane française", offset: "UTC-3" },
  { value: "Pacific/Noumea", label: "Nouvelle-Calédonie", offset: "UTC+11" },
  { value: "Pacific/Tahiti", label: "Polynésie française", offset: "UTC-10" },
  { value: "Europe/Brussels", label: "Belgique (Bruxelles)", offset: "UTC+1/+2" },
  { value: "Europe/Zurich", label: "Suisse (Zurich)", offset: "UTC+1/+2" },
  { value: "Europe/Luxembourg", label: "Luxembourg", offset: "UTC+1/+2" },
  { value: "Africa/Casablanca", label: "Maroc", offset: "UTC+1" },
];

/**
 * Renvoie l'offset en minutes d'une TZ IANA à une date donnée.
 * Utilise l'API Intl.DateTimeFormat pour être exact sur DST.
 */
export function tzOffsetMinutes(tz: string, at: Date = new Date()): number {
  try {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      timeZoneName: "shortOffset",
    });
    const parts = fmt.formatToParts(at);
    const off = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT";
    // Format ex: "GMT+2", "GMT-04:30"
    const m = off.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
    if (!m) return 0;
    const sign = m[1] === "-" ? -1 : 1;
    const h = parseInt(m[2], 10);
    const mm = m[3] ? parseInt(m[3], 10) : 0;
    return sign * (h * 60 + mm);
  } catch {
    return 0;
  }
}

/**
 * Formate un couple (YYYY-MM-DD, HH:mm) dans une TZ donnée.
 * Exemple : formatSlot("2026-07-15", "14:30", "Europe/Paris", "fr-FR", { withTz: true })
 * → "mardi 15 juillet 2026 à 14:30 (heure de Paris)"
 */
export function formatSlot(
  date: string,
  time: string,
  tz: string = DEFAULT_TIMEZONE,
  locale: string = "fr-FR",
  opts: { withTz?: boolean; short?: boolean } = {}
): string {
  try {
    // date + time sont déjà "en heure locale de la TZ business" : on veut donc
    // les afficher tels quels, en ajoutant seulement le libellé de zone.
    // On formatte la date via une Date UTC équivalente pour ne pas subir
    // de conversion parasite selon la TZ du serveur.
    const [y, m, d] = date.split("-").map((n) => parseInt(n, 10));
    const [hh, mm] = time.split(":").map((n) => parseInt(n, 10));
    if (
      !Number.isFinite(y) ||
      !Number.isFinite(m) ||
      !Number.isFinite(d) ||
      !Number.isFinite(hh) ||
      !Number.isFinite(mm)
    ) {
      return `${date} ${time}`;
    }

    // Date UTC "naïve" représentant les composantes locales choisies
    const asUtc = new Date(Date.UTC(y, m - 1, d, hh, mm));

    const dateFmt = new Intl.DateTimeFormat(locale, {
      timeZone: "UTC",
      dateStyle: opts.short ? "short" : "full",
    });
    const timeFmt = new Intl.DateTimeFormat(locale, {
      timeZone: "UTC",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    const base = `${dateFmt.format(asUtc)} à ${timeFmt.format(asUtc)}`;
    if (!opts.withTz) return base;

    const tzLabel = tz === "Europe/Paris" ? "heure de Paris" : tz.replace(/_/g, " ");
    return `${base} (${tzLabel})`;
  } catch {
    return `${date} ${time}`;
  }
}

/**
 * Renvoie le nom court de la TZ du navigateur (ex: "Europe/Paris").
 */
export function browserTimezone(): string {
  if (typeof Intl === "undefined") return DEFAULT_TIMEZONE;
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TIMEZONE;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

/**
 * Renvoie true si la TZ client diffère de la TZ business (pour afficher un warning).
 */
export function shouldWarnTimezoneMismatch(businessTz: string, clientTz: string): boolean {
  if (!businessTz || !clientTz) return false;
  if (businessTz === clientTz) return false;
  // On tolère les alias équivalents (offset actuel identique).
  return tzOffsetMinutes(businessTz) !== tzOffsetMinutes(clientTz);
}
