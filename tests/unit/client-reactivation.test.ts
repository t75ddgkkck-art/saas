/**
 * Lot 49 (F13) — Tests scoring déterministe des candidats à réactivation.
 *
 * Focus sur logique PURE (pas de mock DB, pas d'IA).
 * Le module `computePriorityScore` est le cœur du système Layer 1 —
 * son comportement doit être 100% déterministe et prévisible.
 */

import { describe, expect, it } from "vitest";
import {
  computePriorityScore,
  rankCandidates,
  type ClientScoringInput,
} from "@/lib/client-reactivation";

// Date fixe pour reproductibilité
const NOW = new Date("2026-07-16T12:00:00Z");

function baseClient(overrides: Partial<ClientScoringInput> = {}): ClientScoringInput {
  return {
    clientId: "client-1",
    firstName: "Jean",
    lastName: "Dupont",
    email: "jean@example.com",
    phone: "+33612345678",
    lastContact: null,
    appointmentsCount: 3,
    noShowsCount: 0,
    quotesCount: 0,
    totalSpent: "0",
    ...overrides,
  };
}

function daysAgo(n: number): Date {
  const d = new Date(NOW);
  d.setDate(d.getDate() - n);
  return d;
}

// ---------------------------------------------------------------------------
// Cas triviaux (score 0)
// ---------------------------------------------------------------------------

describe("computePriorityScore — cas score 0", () => {
  it("client sans RDV historique → score 0", () => {
    const r = computePriorityScore(baseClient({ appointmentsCount: 0 }), NOW);
    expect(r.score).toBe(0);
    expect(r.factors[0].key).toBe("no_history");
  });

  it("client vu il y a 30j (< 60j seuil) → score 0", () => {
    const r = computePriorityScore(baseClient({ lastContact: daysAgo(30) }), NOW);
    expect(r.score).toBe(0);
    expect(r.factors[0].key).toBe("too_recent");
    expect(r.daysSinceLastContact).toBe(30);
  });

  it("client vu il y a 45j → toujours trop récent", () => {
    const r = computePriorityScore(baseClient({ lastContact: daysAgo(45) }), NOW);
    expect(r.score).toBe(0);
  });

  it("client sans email ni tel valide → score 0 (impossible à contacter)", () => {
    const r = computePriorityScore(
      baseClient({ lastContact: daysAgo(180), email: null, phone: "" }),
      NOW
    );
    expect(r.score).toBe(0);
    expect(r.factors.some((f) => f.key === "no_contact")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Scoring de base : ancienneté
// ---------------------------------------------------------------------------

describe("computePriorityScore — ancienneté", () => {
  it("client vu il y a 60j (seuil bas) → score minimum de ~20", () => {
    const r = computePriorityScore(baseClient({ lastContact: daysAgo(60) }), NOW);
    expect(r.score).toBeGreaterThanOrEqual(20);
    expect(r.score).toBeLessThan(40);
    expect(r.factors.some((f) => f.key === "sweet_spot")).toBe(true);
  });

  it("client vu il y a 180j (sweet spot) → score peak ~60", () => {
    const r = computePriorityScore(baseClient({ lastContact: daysAgo(180) }), NOW);
    expect(r.score).toBeGreaterThanOrEqual(50);
    expect(r.score).toBeLessThanOrEqual(70);
  });

  it("client vu il y a 12 mois (365j) → score en décroissance (max 60)", () => {
    const r = computePriorityScore(baseClient({ lastContact: daysAgo(365) }), NOW);
    expect(r.score).toBeGreaterThan(30);
    expect(r.score).toBeLessThanOrEqual(70); // 60 base + 10 repeat_client boost
    expect(r.factors.some((f) => f.key === "long_silence")).toBe(true);
  });

  it("client vu il y a 3 ans (>730j) → score très bas (perdu)", () => {
    const r = computePriorityScore(baseClient({ lastContact: daysAgo(1100) }), NOW);
    // Score = 10 (lost_cause) + 10 (repeat_client 3 RDV base) = 20
    expect(r.score).toBeLessThanOrEqual(25);
    expect(r.factors.some((f) => f.key === "lost_cause")).toBe(true);
  });

  it("client avec lastContact null mais RDV historiques → score modéré", () => {
    const r = computePriorityScore(
      baseClient({ lastContact: null, appointmentsCount: 2 }),
      NOW
    );
    expect(r.score).toBeGreaterThan(0);
    expect(r.factors.some((f) => f.key === "unknown_last_contact")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Boosts : fidélité + LTV
// ---------------------------------------------------------------------------

describe("computePriorityScore — boosts fidélité + LTV", () => {
  it("client fidèle (5+ RDV) → boost significatif", () => {
    const withFidelity = computePriorityScore(
      baseClient({ lastContact: daysAgo(180), appointmentsCount: 6 }),
      NOW
    );
    const withoutFidelity = computePriorityScore(
      baseClient({ lastContact: daysAgo(180), appointmentsCount: 1 }),
      NOW
    );
    expect(withFidelity.score).toBeGreaterThan(withoutFidelity.score);
    expect(withFidelity.factors.some((f) => f.key === "loyal_client")).toBe(true);
  });

  it("client récurrent 3 RDV → boost modéré", () => {
    const r = computePriorityScore(
      baseClient({ lastContact: daysAgo(180), appointmentsCount: 3 }),
      NOW
    );
    expect(r.factors.some((f) => f.key === "repeat_client")).toBe(true);
  });

  it("client haute LTV (>1000€) → boost +15", () => {
    const withLtv = computePriorityScore(
      baseClient({ lastContact: daysAgo(180), totalSpent: "1500" }),
      NOW
    );
    const withoutLtv = computePriorityScore(
      baseClient({ lastContact: daysAgo(180), totalSpent: "0" }),
      NOW
    );
    expect(withLtv.score - withoutLtv.score).toBe(15);
    expect(withLtv.factors.some((f) => f.key === "high_ltv")).toBe(true);
  });

  it("client LTV moyenne (300-999€) → boost +8", () => {
    const r = computePriorityScore(
      baseClient({ lastContact: daysAgo(180), totalSpent: "500" }),
      NOW
    );
    expect(r.factors.some((f) => f.key === "medium_ltv")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Pénalités : no-shows
// ---------------------------------------------------------------------------

describe("computePriorityScore — pénalités no-shows", () => {
  it("client avec 3+ no-shows → pénalité -30 + badge warning", () => {
    const withNoShows = computePriorityScore(
      baseClient({ lastContact: daysAgo(180), noShowsCount: 3 }),
      NOW
    );
    const withoutNoShows = computePriorityScore(
      baseClient({ lastContact: daysAgo(180), noShowsCount: 0 }),
      NOW
    );
    expect(withNoShows.score).toBeLessThan(withoutNoShows.score);
    expect(withNoShows.factors.some((f) => f.key === "many_no_shows")).toBe(true);
  });

  it("client avec 1 ou 2 no-shows → pénalité -5", () => {
    const r = computePriorityScore(
      baseClient({ lastContact: daysAgo(180), noShowsCount: 2 }),
      NOW
    );
    expect(r.factors.some((f) => f.key === "some_no_shows")).toBe(true);
  });

  it("score minimum clamp à 0 (client no-shows extrêmes)", () => {
    const r = computePriorityScore(
      baseClient({
        lastContact: daysAgo(1100), // score déjà bas
        noShowsCount: 10,
      }),
      NOW
    );
    expect(r.score).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// Score max clamp
// ---------------------------------------------------------------------------

describe("computePriorityScore — clamp 0-100", () => {
  it("score maximum plafonné à 100", () => {
    const r = computePriorityScore(
      baseClient({
        lastContact: daysAgo(180),
        appointmentsCount: 20,
        totalSpent: "5000",
        quotesCount: 20,
      }),
      NOW
    );
    expect(r.score).toBeLessThanOrEqual(100);
  });
});

// ---------------------------------------------------------------------------
// rankCandidates : tri + limite
// ---------------------------------------------------------------------------

describe("rankCandidates", () => {
  it("tri par score décroissant", () => {
    const clients = [
      baseClient({ clientId: "low", lastContact: daysAgo(60), appointmentsCount: 1 }),
      baseClient({
        clientId: "high",
        lastContact: daysAgo(180),
        appointmentsCount: 8,
        totalSpent: "2000",
      }),
      baseClient({ clientId: "medium", lastContact: daysAgo(180), appointmentsCount: 2 }),
    ];
    const ranked = rankCandidates(clients, 10, NOW);
    expect(ranked.length).toBe(3);
    expect(ranked[0].clientId).toBe("high");
    expect(ranked[2].clientId).toBe("low");
  });

  it("filtre les clients avec score 0", () => {
    const clients = [
      baseClient({ clientId: "eligible", lastContact: daysAgo(180) }),
      baseClient({ clientId: "no-history", appointmentsCount: 0 }),
      baseClient({ clientId: "too-recent", lastContact: daysAgo(30) }),
    ];
    const ranked = rankCandidates(clients, 10, NOW);
    expect(ranked.length).toBe(1);
    expect(ranked[0].clientId).toBe("eligible");
  });

  it("respecte la limite passée", () => {
    const clients = Array.from({ length: 20 }, (_, i) =>
      baseClient({
        clientId: `client-${i}`,
        lastContact: daysAgo(180),
        appointmentsCount: 2,
      })
    );
    const ranked = rankCandidates(clients, 5, NOW);
    expect(ranked.length).toBe(5);
  });

  it("cap limite max à 50 (défensif)", () => {
    const clients = Array.from({ length: 100 }, (_, i) =>
      baseClient({
        clientId: `client-${i}`,
        lastContact: daysAgo(180),
        appointmentsCount: 2,
      })
    );
    const ranked = rankCandidates(clients, 1000, NOW);
    expect(ranked.length).toBeLessThanOrEqual(50);
  });

  it("limite min à 1 (défensif)", () => {
    const clients = [baseClient({ lastContact: daysAgo(180) })];
    const ranked = rankCandidates(clients, 0, NOW);
    expect(ranked.length).toBe(1);
  });

  it("liste vide → array vide", () => {
    const ranked = rankCandidates([], 10, NOW);
    expect(ranked).toEqual([]);
  });
});
