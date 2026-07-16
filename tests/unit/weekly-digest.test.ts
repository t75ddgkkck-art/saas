/**
 * Lot 53 (F15) — Tests helpers digest hebdomadaire.
 *
 * Focus PURE fonctions : segments, action items, décision d'envoi, template.
 */

import { describe, expect, it } from "vitest";
import {
  computeDigestSegment,
  computeActionItems,
  shouldSendDigest,
  buildDigestHtml,
  buildDigestSubject,
  type WeekStats,
} from "@/lib/weekly-digest";

// ---------------------------------------------------------------------------
// Segments
// ---------------------------------------------------------------------------

function stats(overrides: Partial<WeekStats> = {}): WeekStats {
  return {
    visitors: 0,
    appointments: 0,
    quotes: 0,
    reviews: 0,
    revenueEur: 0,
    weeksSinceActivity: 0,
    ...overrides,
  };
}

describe("computeDigestSegment", () => {
  it("dormant : ≥ 3 semaines sans login (priorité absolue)", () => {
    expect(computeDigestSegment(stats({ weeksSinceActivity: 3, appointments: 50 }))).toBe(
      "dormant"
    );
    expect(computeDigestSegment(stats({ weeksSinceActivity: 5 }))).toBe("dormant");
  });

  it("power : 10+ RDV OU 1000€+", () => {
    expect(computeDigestSegment(stats({ appointments: 10 }))).toBe("power");
    expect(computeDigestSegment(stats({ appointments: 25 }))).toBe("power");
    expect(computeDigestSegment(stats({ revenueEur: 1000 }))).toBe("power");
    expect(computeDigestSegment(stats({ revenueEur: 5000 }))).toBe("power");
    // 9 RDV et 999€ ne suffit PAS
    expect(computeDigestSegment(stats({ appointments: 9, revenueEur: 999 }))).toBe("active");
  });

  it("active : 1+ RDV OU 1+ devis OU 5+ visites", () => {
    expect(computeDigestSegment(stats({ appointments: 1 }))).toBe("active");
    expect(computeDigestSegment(stats({ quotes: 1 }))).toBe("active");
    expect(computeDigestSegment(stats({ visitors: 5 }))).toBe("active");
    expect(computeDigestSegment(stats({ visitors: 20, appointments: 3 }))).toBe("active");
  });

  it("quiet : peu d'activité mais pas dormant", () => {
    expect(computeDigestSegment(stats({ visitors: 2, weeksSinceActivity: 1 }))).toBe("quiet");
    expect(computeDigestSegment(stats({}))).toBe("quiet");
    expect(computeDigestSegment(stats({ reviews: 1 }))).toBe("quiet"); // review sans autre activité
  });
});

// ---------------------------------------------------------------------------
// Action items
// ---------------------------------------------------------------------------

describe("computeActionItems", () => {
  it("aucune action → tableau vide", () => {
    expect(
      computeActionItems({
        quotesAwaitingSignature: 0,
        negativeReviewsUnreplied: 0,
        appointmentsTomorrow: 0,
        invoicesOverdue: 0,
      })
    ).toEqual([]);
  });

  it("ordre priorité : high (reviews + factures) → medium (devis) → low (RDV demain)", () => {
    const items = computeActionItems({
      quotesAwaitingSignature: 2,
      negativeReviewsUnreplied: 1,
      appointmentsTomorrow: 3,
      invoicesOverdue: 1,
    });
    expect(items.length).toBe(4);
    // 2 items high (reviews + factures) doivent être en premier
    expect(items[0].priority).toBe("high");
    expect(items[1].priority).toBe("high");
    expect(items[2].priority).toBe("medium");
    expect(items[3].priority).toBe("low");
  });

  it("filtre les items count=0 (pas de spam '0 factures à relancer')", () => {
    const items = computeActionItems({
      quotesAwaitingSignature: 0,
      negativeReviewsUnreplied: 3,
      appointmentsTomorrow: 0,
      invoicesOverdue: 0,
    });
    expect(items.length).toBe(1);
    expect(items[0].count).toBe(3);
  });

  it("pluralisation FR correcte", () => {
    const single = computeActionItems({
      quotesAwaitingSignature: 1,
      negativeReviewsUnreplied: 0,
      appointmentsTomorrow: 0,
      invoicesOverdue: 0,
    });
    expect(single[0].label).toContain("1 devis en attente");
    // Pluriel
    const multi = computeActionItems({
      quotesAwaitingSignature: 5,
      negativeReviewsUnreplied: 0,
      appointmentsTomorrow: 0,
      invoicesOverdue: 0,
    });
    expect(multi[0].label).toContain("5 devis");
    // Accord pluriel sur "s" (signature ne s'accorde PAS en pluriel — validé)
    expect(multi[0].label).toContain("devis en attente");
  });

  it("URLs cibles correctes", () => {
    const items = computeActionItems({
      quotesAwaitingSignature: 1,
      negativeReviewsUnreplied: 1,
      appointmentsTomorrow: 1,
      invoicesOverdue: 1,
    });
    const urls = items.map((i) => i.url);
    expect(urls).toContain("/dashboard/reviews");
    expect(urls).toContain("/dashboard/invoices?status=issued");
    expect(urls).toContain("/dashboard/quotes");
    expect(urls).toContain("/dashboard/today");
  });
});

// ---------------------------------------------------------------------------
// shouldSendDigest — décision d'envoi
// ---------------------------------------------------------------------------

const NOW = new Date("2026-07-19T18:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

describe("shouldSendDigest", () => {
  it("opt-out explicite → jamais envoyer", () => {
    const r = shouldSendDigest({
      optIn: false,
      lastDigestSentAt: null,
      lastReactivationSentAt: null,
      segment: "power",
      actionItemsCount: 5,
      now: NOW,
    });
    expect(r.send).toBe(false);
    expect(r.reason).toBe("opted_out");
  });

  it("digest envoyé il y a 3j → skip (< 6j)", () => {
    const r = shouldSendDigest({
      optIn: true,
      lastDigestSentAt: new Date(NOW.getTime() - 3 * DAY),
      lastReactivationSentAt: null,
      segment: "active",
      actionItemsCount: 2,
      now: NOW,
    });
    expect(r.send).toBe(false);
    expect(r.reason).toBe("sent_recently");
  });

  it("digest envoyé il y a 7j → OK (> 6j)", () => {
    const r = shouldSendDigest({
      optIn: true,
      lastDigestSentAt: new Date(NOW.getTime() - 7 * DAY),
      lastReactivationSentAt: null,
      segment: "active",
      actionItemsCount: 2,
      now: NOW,
    });
    expect(r.send).toBe(true);
    expect(r.reason).toBe("ok");
  });

  it("quiet + 0 actions → skip (pas de contenu utile)", () => {
    const r = shouldSendDigest({
      optIn: true,
      lastDigestSentAt: null,
      lastReactivationSentAt: null,
      segment: "quiet",
      actionItemsCount: 0,
      now: NOW,
    });
    expect(r.send).toBe(false);
    expect(r.reason).toBe("quiet_no_actions");
  });

  it("quiet + 1 action → OK (au moins un truc à dire)", () => {
    const r = shouldSendDigest({
      optIn: true,
      lastDigestSentAt: null,
      lastReactivationSentAt: null,
      segment: "quiet",
      actionItemsCount: 1,
      now: NOW,
    });
    expect(r.send).toBe(true);
  });

  it("dormant + reactivation < 30j → skip (anti double email)", () => {
    const r = shouldSendDigest({
      optIn: true,
      lastDigestSentAt: null,
      lastReactivationSentAt: new Date(NOW.getTime() - 10 * DAY),
      segment: "dormant",
      actionItemsCount: 0,
      now: NOW,
    });
    expect(r.send).toBe(false);
    expect(r.reason).toBe("dormant_recent_relance");
  });

  it("dormant + reactivation ancienne → OK", () => {
    const r = shouldSendDigest({
      optIn: true,
      lastDigestSentAt: null,
      lastReactivationSentAt: new Date(NOW.getTime() - 60 * DAY),
      segment: "dormant",
      actionItemsCount: 0,
      now: NOW,
    });
    expect(r.send).toBe(true);
  });

  it("power avec tout OK → toujours envoyé", () => {
    const r = shouldSendDigest({
      optIn: true,
      lastDigestSentAt: null,
      lastReactivationSentAt: null,
      segment: "power",
      actionItemsCount: 0,
      now: NOW,
    });
    expect(r.send).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Sujet email
// ---------------------------------------------------------------------------

describe("buildDigestSubject", () => {
  it("power → sujet avec chiffres (curiosité)", () => {
    const s = buildDigestSubject(
      "power",
      stats({ appointments: 15, revenueEur: 2500 }),
      "Dupont Plomberie"
    );
    expect(s).toContain("15");
    expect(s).toContain("2500");
    expect(s).toContain("🚀");
  });

  it("active → nom business + KPI clé", () => {
    const s = buildDigestSubject(
      "active",
      stats({ visitors: 45, appointments: 3 }),
      "Coif Salon"
    );
    expect(s).toContain("Coif Salon");
    expect(s).toContain("45");
    expect(s).toContain("3");
  });

  it("dormant → sujet doux sans guilt-trip", () => {
    const s = buildDigestSubject("dormant", stats(), "Test Biz");
    expect(s.toLowerCase()).not.toContain("dernière fois");
    expect(s.toLowerCase()).not.toContain("relancez");
  });

  it("business name > 40 chars tronqué", () => {
    const longName = "A".repeat(80);
    const s = buildDigestSubject("active", stats(), longName);
    // Le nom n'apparait pas en entier
    expect(s).not.toContain("A".repeat(80));
  });
});

// ---------------------------------------------------------------------------
// buildDigestHtml — smoke tests
// ---------------------------------------------------------------------------

describe("buildDigestHtml", () => {
  const base = {
    firstName: "Jean",
    businessName: "Dupont Plomberie",
    segment: "active" as const,
    stats: stats({ visitors: 45, appointments: 3, quotes: 2, revenueEur: 850 }),
    actionItems: [],
    appUrl: "https://vitrix.fr",
    unsubscribeUrl: "https://vitrix.fr/api/unsubscribe?token=XYZ",
  };

  it("contient toutes les infos essentielles", () => {
    const html = buildDigestHtml(base);
    expect(html).toContain("Jean");
    expect(html).toContain("Dupont Plomberie");
    expect(html).toContain("45");
    expect(html).toContain("850");
    expect(html).toContain("Ouvrir mon tableau de bord");
  });

  it("échappe le business name (défense XSS)", () => {
    const html = buildDigestHtml({
      ...base,
      businessName: "<script>alert('xss')</script>",
    });
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
  });

  it("inclut le lien unsubscribe", () => {
    const html = buildDigestHtml(base);
    expect(html).toContain("api/unsubscribe?token=XYZ");
    expect(html).toContain("désabonner");
  });

  it("preheader présent (masqué)", () => {
    const html = buildDigestHtml(base);
    expect(html).toContain("display: none");
  });

  it("action items rendus si présents", () => {
    const html = buildDigestHtml({
      ...base,
      actionItems: [
        {
          label: "Répondre à 1 avis négatif",
          count: 1,
          url: "/dashboard/reviews",
          priority: "high",
        },
      ],
    });
    expect(html).toContain("Répondre à 1 avis");
    expect(html).toContain("À faire cette semaine");
  });

  it("PAS de section 'À faire' si actionItems vide", () => {
    const html = buildDigestHtml({ ...base, actionItems: [] });
    expect(html).not.toContain("À faire cette semaine");
  });

  it("meta color-scheme pour support dark mode", () => {
    const html = buildDigestHtml(base);
    expect(html).toContain('name="color-scheme"');
  });
});
