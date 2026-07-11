/**
 * F6 (Lot 35) — State machine des statuts de rendez-vous.
 *
 * Bug B23 identifié dans PROPOSITIONS_V3 : les transitions n'étaient nulle part
 * validées. On pouvait passer de `cancelled` à `confirmed` sans contrainte.
 * Résultat : incohérence + risque de fraude (un pro qui "rouvre" un no-show
 * annulé pour re-facturer).
 *
 * Cette lib définit les transitions AUTORISÉES et pose les timestamps timeline
 * (checkedInAt / startedAt / finishedAt) au bon moment.
 *
 * Design :
 *  - `canTransition(from, to)` — pure, testable
 *  - `resolveTimelineFields(newStatus, current)` — quels timestamps set/reset
 *  - Utilisé par les routes /api/appointments/[id] PATCH + /status
 */

export type AppointmentStatus =
  "pending" | "confirmed" | "en_route" | "in_progress" | "completed" | "no_show" | "cancelled";

/**
 * Graphe des transitions valides.
 * Depuis chaque statut, la liste des statuts qu'on peut atteindre.
 *
 * Règles métier :
 *  - `pending` → confirmed / cancelled (avant que le pro accepte)
 *  - `confirmed` → en_route / in_progress / no_show / cancelled / completed
 *    (completed direct = usage "je note un RDV passé après coup")
 *  - `en_route` → in_progress / completed / cancelled (annulation dernière minute)
 *  - `in_progress` → completed / cancelled (rare : pb pendant intervention)
 *  - `completed` / `no_show` / `cancelled` = ÉTATS FINAUX (aucune transition)
 *    Un pro qui s'est trompé doit passer par un admin (audit).
 *
 * Cette matrice ferme B23 : impossible de rouvrir un état final via API user.
 */
const TRANSITIONS: Record<AppointmentStatus, readonly AppointmentStatus[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["en_route", "in_progress", "completed", "no_show", "cancelled"],
  en_route: ["in_progress", "completed", "cancelled"],
  in_progress: ["completed", "cancelled"],
  completed: [],
  no_show: [],
  cancelled: [],
};

/**
 * True si la transition `from → to` est autorisée.
 * `from === to` renvoie true (idempotence : PATCH qui pose le même statut = no-op OK).
 */
export function canTransition(from: AppointmentStatus, to: AppointmentStatus): boolean {
  if (from === to) return true;
  return TRANSITIONS[from].includes(to);
}

/**
 * Liste des statuts atteignables depuis `from` (utile pour construire l'UI).
 */
export function allowedNextStatuses(from: AppointmentStatus): AppointmentStatus[] {
  return [...TRANSITIONS[from]];
}

/**
 * Calcule les timestamps à SET automatiquement selon le nouveau statut.
 * Ne les set QUE s'ils sont encore null (idempotent : si un pro clique
 * "En route" deux fois de suite, checkedInAt garde la 1re valeur).
 *
 * Retourne un patch partiel à merger dans le UPDATE Drizzle.
 */
export interface TimelinePatch {
  checkedInAt?: Date | null;
  startedAt?: Date | null;
  finishedAt?: Date | null;
}

export interface CurrentTimestamps {
  checkedInAt: Date | null;
  startedAt: Date | null;
  finishedAt: Date | null;
}

export function resolveTimelineFields(
  newStatus: AppointmentStatus,
  current: CurrentTimestamps,
  now: Date = new Date()
): TimelinePatch {
  const patch: TimelinePatch = {};

  // "En route" pose checkedInAt (départ vers le client)
  if (newStatus === "en_route" && !current.checkedInAt) {
    patch.checkedInAt = now;
  }

  // "In progress" = arrivé/démarré → pose checkedInAt (si sauté "en_route") + startedAt
  if (newStatus === "in_progress") {
    if (!current.checkedInAt) patch.checkedInAt = now;
    if (!current.startedAt) patch.startedAt = now;
  }

  // "Completed" → pose finishedAt (+ startedAt si "je marque terminé sans avoir cliqué démarré")
  if (newStatus === "completed") {
    if (!current.startedAt) patch.startedAt = now;
    if (!current.finishedAt) patch.finishedAt = now;
    if (!current.checkedInAt) patch.checkedInAt = now;
  }

  // no_show / cancelled : on ne pose rien (l'event est un non-lieu)
  // pending / confirmed : idem (avant terrain)

  return patch;
}

/**
 * Renvoie la durée d'intervention en minutes (startedAt → finishedAt).
 * Null si les 2 timestamps ne sont pas posés.
 */
export function computeDurationMinutes(current: CurrentTimestamps): number | null {
  if (!current.startedAt || !current.finishedAt) return null;
  const ms = current.finishedAt.getTime() - current.startedAt.getTime();
  if (ms < 0) return null;
  return Math.round(ms / 60000);
}

/**
 * Renvoie le temps de trajet en minutes (checkedInAt → startedAt).
 * Null si non applicable.
 */
export function computeTravelMinutes(current: CurrentTimestamps): number | null {
  if (!current.checkedInAt || !current.startedAt) return null;
  const ms = current.startedAt.getTime() - current.checkedInAt.getTime();
  if (ms < 0) return null;
  return Math.round(ms / 60000);
}

/**
 * Libellé français court pour un statut (utile UI + emails).
 */
export const STATUS_LABELS: Record<AppointmentStatus, string> = {
  pending: "En attente",
  confirmed: "Confirmé",
  en_route: "En route",
  in_progress: "En cours",
  completed: "Terminé",
  no_show: "Absent",
  cancelled: "Annulé",
};
