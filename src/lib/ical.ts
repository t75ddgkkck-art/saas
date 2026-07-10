/**
 * F4 (Lot 33) — Génération iCalendar (RFC 5545) sans dépendance externe.
 *
 * Objectifs :
 *  - Export d'un calendrier complet (URL secrète abonnable dans Apple/Outlook/Google)
 *  - Export d'un event unique (fichier joint à l'email de confirmation RDV)
 *
 * On ne supporte pas les récurrences (RRULE) en v1 — les RDV Vitrix sont
 * one-shot. À ajouter en v2 si on introduit les prestations récurrentes.
 *
 * Conformité RFC 5545 :
 *  - Fin de ligne CRLF obligatoire
 *  - Lignes limitées à 75 octets → line folding (CRLF + espace)
 *  - Escape des chars spéciaux dans TEXT (`\`, `;`, `,`, retour ligne)
 *  - UID unique + stable (utile pour update/delete côté client CalDAV)
 *  - DTSTAMP en UTC obligatoire
 */

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface ICalEvent {
  /** UID unique et stable (ex : `<appointmentId>@vitrix.fr`). */
  uid: string;
  /** Date+heure début (Date JS). */
  start: Date;
  /** Date+heure fin (Date JS). */
  end: Date;
  /** Titre affiché dans le calendrier client. */
  summary: string;
  /** Description longue (multi-lignes autorisées). */
  description?: string;
  /** Lieu (adresse). */
  location?: string;
  /** Organisateur (email + nom optionnel). */
  organizer?: { email: string; name?: string };
  /** Statut (TENTATIVE = pending, CONFIRMED = confirmed, CANCELLED = cancelled). */
  status?: "TENTATIVE" | "CONFIRMED" | "CANCELLED";
  /** URL vers le RDV (dashboard ou espace client). */
  url?: string;
  /** Date de dernière modification (utile aux clients pour détecter les updates). */
  lastModified?: Date;
}

export interface ICalOptions {
  /** Nom du calendrier affiché côté client (Apple/Outlook). */
  calendarName?: string;
  /** Timezone lisible (informatif — les dates sont exportées en UTC). */
  timezone?: string;
}

// -----------------------------------------------------------------------------
// Helpers de formatage
// -----------------------------------------------------------------------------

/**
 * Formate une Date en `YYYYMMDDTHHMMSSZ` (UTC, RFC 5545 form 2 "UTC time").
 * On force UTC pour éviter les surprises de fuseau côté client.
 */
export function formatIcsUtc(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return (
    date.getUTCFullYear().toString() +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate()) +
    "T" +
    pad(date.getUTCHours()) +
    pad(date.getUTCMinutes()) +
    pad(date.getUTCSeconds()) +
    "Z"
  );
}

/**
 * Escape des chars spéciaux dans un TEXT iCal (RFC 5545 §3.3.11).
 * Ordre important : `\` en premier pour éviter la double-escape.
 */
export function escapeIcsText(input: string): string {
  return input
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

/**
 * Line folding : les lignes > 75 octets doivent être coupées avec CRLF + espace
 * (le client reconstruit en concaténant les lignes qui commencent par un espace).
 */
export function foldIcsLine(line: string): string {
  if (line.length <= 75) return line;
  // Simple fold à 74 caractères (marge sécurité pour multi-byte)
  const parts: string[] = [];
  let remaining = line;
  parts.push(remaining.slice(0, 75));
  remaining = remaining.slice(75);
  while (remaining.length > 0) {
    parts.push(" " + remaining.slice(0, 74));
    remaining = remaining.slice(74);
  }
  return parts.join("\r\n");
}

// -----------------------------------------------------------------------------
// Génération d'un event VEVENT
// -----------------------------------------------------------------------------

export function buildIcsEvent(event: ICalEvent): string {
  const lines: string[] = [];
  lines.push("BEGIN:VEVENT");
  lines.push(`UID:${event.uid}`);
  lines.push(`DTSTAMP:${formatIcsUtc(event.lastModified ?? new Date())}`);
  lines.push(`DTSTART:${formatIcsUtc(event.start)}`);
  lines.push(`DTEND:${formatIcsUtc(event.end)}`);
  lines.push(`SUMMARY:${escapeIcsText(event.summary)}`);
  if (event.description) {
    lines.push(`DESCRIPTION:${escapeIcsText(event.description)}`);
  }
  if (event.location) {
    lines.push(`LOCATION:${escapeIcsText(event.location)}`);
  }
  if (event.organizer) {
    const cn = event.organizer.name ? `;CN=${escapeIcsText(event.organizer.name)}` : "";
    lines.push(`ORGANIZER${cn}:mailto:${event.organizer.email}`);
  }
  if (event.url) {
    lines.push(`URL:${event.url}`);
  }
  if (event.status) {
    lines.push(`STATUS:${event.status}`);
  }
  if (event.lastModified) {
    lines.push(`LAST-MODIFIED:${formatIcsUtc(event.lastModified)}`);
  }
  lines.push("END:VEVENT");
  return lines.map(foldIcsLine).join("\r\n");
}

// -----------------------------------------------------------------------------
// Génération d'un calendrier complet
// -----------------------------------------------------------------------------

export function buildIcsCalendar(events: ICalEvent[], opts: ICalOptions = {}): string {
  const lines: string[] = [];
  lines.push("BEGIN:VCALENDAR");
  lines.push("VERSION:2.0");
  // PRODID : identifie le producteur (Vitrix). Format libre.
  lines.push("PRODID:-//Vitrix//Calendar 1.0//FR");
  lines.push("CALSCALE:GREGORIAN");
  lines.push("METHOD:PUBLISH");
  if (opts.calendarName) {
    lines.push(`X-WR-CALNAME:${escapeIcsText(opts.calendarName)}`);
  }
  if (opts.timezone) {
    lines.push(`X-WR-TIMEZONE:${opts.timezone}`);
  }
  const header = lines.map(foldIcsLine).join("\r\n");
  const body = events.map(buildIcsEvent).join("\r\n");
  return `${header}\r\n${body}\r\nEND:VCALENDAR\r\n`;
}

// -----------------------------------------------------------------------------
// Helper : convertit un RDV Vitrix (date+startTime) en Date UTC
// -----------------------------------------------------------------------------

/**
 * Compose un objet Date depuis :
 *  - `date` YYYY-MM-DD (format DB legacy)
 *  - `time` HH:MM
 *  - `tzOffsetHours` (défaut 0 = UTC ; en pratique Europe/Paris = +1 hiver / +2 été)
 *
 * NOTE : pour v1 on stocke les RDV en TZ serveur (Europe/Paris implicite via
 * `new Date("YYYY-MM-DDTHH:MM:00")`). Le calcul exact TZ (DST) est complexe :
 * on passe par le constructeur natif qui interprète la string sans "Z" comme
 * heure LOCALE serveur. Sur Vercel EU (cdg1), c'est Europe/Paris.
 */
export function composeDateTime(date: string, time: string): Date {
  // Format YYYY-MM-DDTHH:MM:00 sans "Z" → parse en TZ serveur
  return new Date(`${date}T${time}:00`);
}
