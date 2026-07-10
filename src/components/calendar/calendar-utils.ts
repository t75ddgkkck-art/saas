/**
 * F4 (Lot 33) — Utilitaires calendrier purs (testables).
 *
 * Aucune dépendance externe (0 date-fns / dayjs / luxon).
 * On garde tout en local time (Europe/Paris), pas d'UTC juggling.
 */

// -----------------------------------------------------------------------------
// Constantes
// -----------------------------------------------------------------------------

export const DAYS_FR = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
export const DAYS_FR_LONG = [
  "Lundi",
  "Mardi",
  "Mercredi",
  "Jeudi",
  "Vendredi",
  "Samedi",
  "Dimanche",
];
export const MONTHS_FR = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
];

// -----------------------------------------------------------------------------
// Helpers de dates (pures)
// -----------------------------------------------------------------------------

/** Format YYYY-MM-DD (aligné DB `appointments.date`). */
export function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Format HH:MM. */
export function toIsoTime(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/**
 * Retourne le lundi de la semaine contenant `d` (Europe = lundi first).
 * getDay() : 0=dim, 1=lun...6=sam → décalage pour ISO week
 */
export function startOfWeek(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  const day = copy.getDay(); // 0=dim
  const offset = day === 0 ? -6 : 1 - day; // lundi
  copy.setDate(copy.getDate() + offset);
  return copy;
}

/** Retourne le premier jour du mois (à 00:00). */
export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/** Retourne le dernier jour du mois. */
export function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

/** Ajoute N jours (immutable). */
export function addDays(d: Date, n: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}

/** Ajoute N mois (immutable). */
export function addMonths(d: Date, n: number): Date {
  const copy = new Date(d);
  copy.setMonth(copy.getMonth() + n);
  return copy;
}

/** Ajoute N minutes (immutable). */
export function addMinutes(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 60_000);
}

/** True si les deux dates sont le même jour calendaire. */
export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** True si `d` est aujourd'hui. */
export function isToday(d: Date): boolean {
  return isSameDay(d, new Date());
}

/** Retourne les 7 dates de la semaine contenant `d`. */
export function weekDays(d: Date): Date[] {
  const start = startOfWeek(d);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/**
 * Retourne les 42 dates (6 semaines) de la grille mensuelle standard.
 * Utile pour la vue mois (toujours 6 lignes pour éviter les jumps UI).
 */
export function monthGrid(d: Date): Date[] {
  const gridStart = startOfWeek(startOfMonth(d));
  return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
}

/**
 * Label court d'un range affiché dans le header calendrier.
 * - Jour : "Lundi 15 août 2026"
 * - Semaine : "15 – 21 août 2026"
 * - Mois : "Août 2026"
 */
export function rangeLabel(view: "day" | "week" | "month", anchor: Date): string {
  if (view === "day") {
    const dayName = DAYS_FR_LONG[(anchor.getDay() + 6) % 7];
    return `${dayName} ${anchor.getDate()} ${MONTHS_FR[anchor.getMonth()].toLowerCase()} ${anchor.getFullYear()}`;
  }
  if (view === "week") {
    const start = startOfWeek(anchor);
    const end = addDays(start, 6);
    const sameMonth = start.getMonth() === end.getMonth();
    if (sameMonth) {
      return `${start.getDate()} – ${end.getDate()} ${MONTHS_FR[end.getMonth()].toLowerCase()} ${end.getFullYear()}`;
    }
    return `${start.getDate()} ${MONTHS_FR[start.getMonth()].toLowerCase()} – ${end.getDate()} ${MONTHS_FR[end.getMonth()].toLowerCase()} ${end.getFullYear()}`;
  }
  return `${MONTHS_FR[anchor.getMonth()]} ${anchor.getFullYear()}`;
}

// -----------------------------------------------------------------------------
// Couleurs par service/membre (déterministe hashing)
// -----------------------------------------------------------------------------

const CALENDAR_COLORS = [
  "#3b82f6", // blue
  "#10b981", // emerald
  "#f59e0b", // amber
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#06b6d4", // cyan
  "#f97316", // orange
  "#84cc16", // lime
];

/**
 * Renvoie une couleur stable pour une clé (userId, serviceName...).
 * Simple hash string → index dans la palette. Pas d'aléatoire, cohérent
 * d'un render à l'autre.
 */
export function colorForKey(key: string | null | undefined): string {
  if (!key) return "#94a3b8"; // slate — "non assigné"
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) | 0;
  }
  return CALENDAR_COLORS[Math.abs(hash) % CALENDAR_COLORS.length];
}

// -----------------------------------------------------------------------------
// Grille horaire pour vues jour/semaine
// -----------------------------------------------------------------------------

/**
 * Renvoie les slots [7:00, 7:30, 8:00, ...] entre `startHour` et `endHour`.
 * Utilisé pour dessiner les lignes horaires + calculer la position d'un event.
 */
export function hourSlots(startHour = 7, endHour = 21, stepMin = 60): string[] {
  const slots: string[] = [];
  for (let h = startHour; h <= endHour; h++) {
    for (let m = 0; m < 60; m += stepMin) {
      slots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }
  return slots;
}

/**
 * Convertit une heure HH:MM en offset PX depuis le top de la grille.
 * `pxPerHour` = hauteur d'un slot de 1 heure (défaut 48px).
 */
export function timeToPx(time: string, startHour = 7, pxPerHour = 48): number {
  const [h, m] = time.split(":").map(Number);
  const total = (h - startHour) * 60 + m;
  return (total / 60) * pxPerHour;
}

/** Hauteur en px pour une durée entre 2 heures HH:MM. */
export function durationToPx(startTime: string, endTime: string, pxPerHour = 48): number {
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  const min = (eh - sh) * 60 + (em - sm);
  return (min / 60) * pxPerHour;
}
