/**
 * Lot 49 (F13) — Détection & scoring des clients à recontacter.
 *
 * DEUX LAYERS distincts :
 *
 * === Layer 1 : SCORING déterministe (tous plans) ===
 * `computePriorityScore(input)` → { score 0-100, factors[] }
 *
 * Pure fonction, testable sans DB. Calcule un score basé sur :
 *  - Ancienneté dernière interaction (poids fort)
 *  - Nombre de RDV historiques (client fidèle > one-shot)
 *  - Montant dépensé (LTV)
 *  - No-shows (pénalité — un client no-show 3× n'est PAS à relancer)
 *  - Devis signés/en attente
 *
 * Retourne aussi une liste de `factors` pour l'affichage UI + prompt IA.
 *
 * === Layer 2 : GÉNÉRATION MESSAGE IA (Premium gated) ===
 * `generateReactivationMessages(candidates, businessContext)` → appel OpenAI
 * qui renvoie pour chaque candidat un message personnalisé prêt à envoyer.
 *
 * Isolé dans /api/reactivation/generate — cette lib ne fait QUE le scoring pur.
 */

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface ClientScoringInput {
  clientId: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string;
  /** Timestamp du dernier contact (RDV, paiement, devis). Null = jamais recontacté. */
  lastContact: Date | null;
  /** Nombre total de RDV historiques (tous statuts). */
  appointmentsCount: number;
  /** Nombre de no-shows — pénalise le score. */
  noShowsCount: number;
  /** Nombre de devis créés pour ce client (signé ou non). */
  quotesCount: number;
  /** Montant total dépensé en EUR (chaîne decimal Drizzle → parseFloat). */
  totalSpent: string | null;
}

export interface ScoringFactor {
  /** Clé courte (pour tests + badges UI) */
  key: string;
  /** Libellé humain affiché en badge */
  label: string;
  /** Signal positif (+) ou négatif (-) sur le score */
  impact: "positive" | "negative" | "neutral";
}

export interface ScoringResult {
  /** Score 0-100 — plus haut = candidat prioritaire à recontacter */
  score: number;
  /** Facteurs contribuant au score, ordonnés par pertinence */
  factors: ScoringFactor[];
  /** Nombre de jours depuis dernier contact (null si jamais) */
  daysSinceLastContact: number | null;
}

// -----------------------------------------------------------------------------
// Constantes du modèle de scoring
// -----------------------------------------------------------------------------

/**
 * Seuils de "dormance" en jours. Un client vu dans les 30j n'a pas besoin d'être
 * relancé, un client silencieux depuis 24 mois est probablement parti définitivement.
 */
const DORMANT_MIN_DAYS = 60; // avant, pas de score de réactivation
const SWEET_SPOT_DAYS = 180; // ~6 mois : moment optimal de rappel
const LOST_CAUSE_DAYS = 730; // > 24 mois : probablement parti

/** Un client jamais recontacté (0 RDV) n'a pas de sens à réactiver. */
const MIN_APPOINTMENTS_FOR_SCORING = 1;

// -----------------------------------------------------------------------------
// Public : scoring
// -----------------------------------------------------------------------------

/**
 * Calcule le score de priorité d'un client pour la réactivation.
 * Pure fonction : mêmes inputs → même score. Zéro appel réseau.
 */
export function computePriorityScore(
  input: ClientScoringInput,
  now: Date = new Date()
): ScoringResult {
  const factors: ScoringFactor[] = [];

  // 1) Calcule le nombre de jours depuis dernier contact
  const daysSince = input.lastContact
    ? Math.floor((now.getTime() - input.lastContact.getTime()) / (1000 * 60 * 60 * 24))
    : null;

  // 2) Client sans RDV historique → score 0 (rien à réactiver)
  if (input.appointmentsCount < MIN_APPOINTMENTS_FOR_SCORING) {
    return {
      score: 0,
      factors: [
        {
          key: "no_history",
          label: "Aucun RDV historique",
          impact: "neutral",
        },
      ],
      daysSinceLastContact: daysSince,
    };
  }

  // 3) Client trop récent → pas encore la peine
  if (daysSince !== null && daysSince < DORMANT_MIN_DAYS) {
    return {
      score: 0,
      factors: [
        {
          key: "too_recent",
          label: `Vu il y a ${daysSince}j (< ${DORMANT_MIN_DAYS}j)`,
          impact: "neutral",
        },
      ],
      daysSinceLastContact: daysSince,
    };
  }

  let score = 0;

  // === CALCUL BASE : ancienneté ===
  // Fonction en cloche : peak à SWEET_SPOT_DAYS, décroît si trop vieux
  if (daysSince !== null) {
    if (daysSince <= SWEET_SPOT_DAYS) {
      // Rampe montante 60→180j : de 20 à 60 points
      const rampProgress = (daysSince - DORMANT_MIN_DAYS) / (SWEET_SPOT_DAYS - DORMANT_MIN_DAYS);
      score += 20 + Math.round(rampProgress * 40);
      factors.push({
        key: "sweet_spot",
        label: `Silence depuis ${daysSince}j`,
        impact: "positive",
      });
    } else if (daysSince <= LOST_CAUSE_DAYS) {
      // Décroît lentement de 60 à 30 points entre 180j et 730j
      const decayProgress = (daysSince - SWEET_SPOT_DAYS) / (LOST_CAUSE_DAYS - SWEET_SPOT_DAYS);
      score += 60 - Math.round(decayProgress * 30);
      factors.push({
        key: "long_silence",
        label: `Silence depuis ${Math.round(daysSince / 30)} mois`,
        impact: "positive",
      });
    } else {
      // > 24 mois : probablement parti — score très faible
      score += 10;
      factors.push({
        key: "lost_cause",
        label: `Absent depuis > 2 ans`,
        impact: "negative",
      });
    }
  } else {
    // Aucun lastContact renseigné mais RDV historiques → cas edge, score modéré
    score += 30;
    factors.push({
      key: "unknown_last_contact",
      label: "Dernier contact inconnu",
      impact: "neutral",
    });
  }

  // === BOOSTS : fidélité + valeur ===
  if (input.appointmentsCount >= 5) {
    score += 20;
    factors.push({
      key: "loyal_client",
      label: `Client fidèle (${input.appointmentsCount} RDV)`,
      impact: "positive",
    });
  } else if (input.appointmentsCount >= 3) {
    score += 10;
    factors.push({
      key: "repeat_client",
      label: `Client récurrent (${input.appointmentsCount} RDV)`,
      impact: "positive",
    });
  }

  const totalSpent = parseFloat(input.totalSpent ?? "0");
  if (totalSpent >= 1000) {
    score += 15;
    factors.push({
      key: "high_ltv",
      label: `LTV élevée (${totalSpent.toFixed(0)}€)`,
      impact: "positive",
    });
  } else if (totalSpent >= 300) {
    score += 8;
    factors.push({
      key: "medium_ltv",
      label: `${totalSpent.toFixed(0)}€ dépensés`,
      impact: "positive",
    });
  }

  if (input.quotesCount > 0 && input.appointmentsCount === input.quotesCount) {
    // Tous les devis se sont convertis → client "sérieux"
    score += 5;
    factors.push({
      key: "high_conversion",
      label: "100% devis convertis",
      impact: "positive",
    });
  }

  // === PÉNALITÉS ===
  if (input.noShowsCount >= 3) {
    // 3 no-shows = client à risque, ne pas relancer agressivement
    score -= 30;
    factors.push({
      key: "many_no_shows",
      label: `⚠️ ${input.noShowsCount} no-shows`,
      impact: "negative",
    });
  } else if (input.noShowsCount === 1 || input.noShowsCount === 2) {
    score -= 5;
    factors.push({
      key: "some_no_shows",
      label: `${input.noShowsCount} no-show${input.noShowsCount > 1 ? "s" : ""}`,
      impact: "negative",
    });
  }

  // Pas d'email ET pas de tel valide → impossible à recontacter → score 0
  const hasContact = Boolean(input.email) || Boolean(input.phone);
  if (!hasContact) {
    return {
      score: 0,
      factors: [
        {
          key: "no_contact",
          label: "Aucune coordonnée",
          impact: "negative",
        },
      ],
      daysSinceLastContact: daysSince,
    };
  }

  // Clamp final entre 0 et 100
  const finalScore = Math.max(0, Math.min(100, score));

  return {
    score: finalScore,
    factors,
    daysSinceLastContact: daysSince,
  };
}

// -----------------------------------------------------------------------------
// Ranking : combine scoring + tri + limit
// -----------------------------------------------------------------------------

export interface ReactivationCandidate extends ScoringResult {
  clientId: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string;
  lastContact: Date | null;
  appointmentsCount: number;
  totalSpent: string | null;
}

/**
 * Applique `computePriorityScore` à toute une liste de clients, filtre score > 0,
 * trie desc, retourne le top N.
 *
 * Utilisé par GET /api/reactivation/candidates.
 */
export function rankCandidates(
  clients: ClientScoringInput[],
  limit: number = 10,
  now: Date = new Date()
): ReactivationCandidate[] {
  const scored: ReactivationCandidate[] = [];
  for (const c of clients) {
    const result = computePriorityScore(c, now);
    if (result.score <= 0) continue; // Skip les non-pertinents
    scored.push({
      clientId: c.clientId,
      firstName: c.firstName,
      lastName: c.lastName,
      email: c.email,
      phone: c.phone,
      lastContact: c.lastContact,
      appointmentsCount: c.appointmentsCount,
      totalSpent: c.totalSpent,
      ...result,
    });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, Math.max(1, Math.min(50, limit)));
}
