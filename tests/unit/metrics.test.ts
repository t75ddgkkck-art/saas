import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Test des metrics business. On mock `@/db` pour éviter toute connexion réelle.
 * Chaque appel à `db.execute` renvoie un mock configurable via `dbExecuteMock`.
 */

const dbExecuteMock = vi.fn();

vi.mock("@/db", () => ({
  db: {
    execute: (...args: unknown[]) => dbExecuteMock(...args),
  },
}));

import {
  getBusinessMetrics,
  getConversionRate30d,
  formatEurCents,
  __resetMetricsCache,
} from "../../src/lib/metrics";

describe("metrics business", () => {
  beforeEach(() => {
    __resetMetricsCache();
    dbExecuteMock.mockReset();
  });

  it("formatEurCents formate correctement en euros FR", () => {
    // Regex-based check: contient bien 12,34 (séparateur virgule FR) et le symbole €
    const out = formatEurCents(1234);
    expect(out).toContain("12,34");
    expect(out).toContain("€");
  });

  it("getBusinessMetrics agrège les résultats SQL", async () => {
    // 6 SELECTs dans l'ordre : users, subscriptions, appointments, businesses, ai, canceled
    dbExecuteMock
      .mockResolvedValueOnce({
        rows: [{ total: "100", new_7d: "5", new_30d: "20", verified: "80" }],
      })
      .mockResolvedValueOnce({
        rows: [{ free: "60", pro: "30", premium: "10", trialing: "3", past_due: "1" }],
      })
      .mockResolvedValueOnce({
        rows: [{ total: "500", last_7d: "50", last_30d: "200", upcoming: "40" }],
      })
      .mockResolvedValueOnce({ rows: [{ total: "45", active_30d: "30" }] })
      .mockResolvedValueOnce({ rows: [{ calls: "1000", cost_usd: "12.5" }] })
      .mockResolvedValueOnce({ rows: [{ canceled: "2" }] });

    const m = await getBusinessMetrics();
    expect(m.users.total).toBe(100);
    expect(m.users.verified).toBe(80);
    expect(m.subscriptions.pro).toBe(30);
    expect(m.subscriptions.premium).toBe(10);
    // MRR = 30 * 2900 + 10 * 7900 = 87000 + 79000 = 166000 cents
    expect(m.subscriptions.mrrEurCents).toBe(30 * 2900 + 10 * 7900);
    expect(m.appointments.upcoming).toBe(40);
    expect(m.businesses.activeLast30d).toBe(30);
    expect(m.ai.totalCallsLast30d).toBe(1000);
    expect(m.ai.totalCostUsd).toBe(12.5);
    expect(m.subscriptions.canceledLast30d).toBe(2);
  });

  it("getBusinessMetrics est cache (60s) : 2e appel = 0 requête", async () => {
    dbExecuteMock
      .mockResolvedValueOnce({ rows: [{ total: "1", new_7d: "0", new_30d: "0", verified: "0" }] })
      .mockResolvedValueOnce({
        rows: [{ free: "0", pro: "0", premium: "0", trialing: "0", past_due: "0" }],
      })
      .mockResolvedValueOnce({ rows: [{ total: "0", last_7d: "0", last_30d: "0", upcoming: "0" }] })
      .mockResolvedValueOnce({ rows: [{ total: "0", active_30d: "0" }] })
      .mockResolvedValueOnce({ rows: [{ calls: "0", cost_usd: "0" }] })
      .mockResolvedValueOnce({ rows: [{ canceled: "0" }] });

    await getBusinessMetrics();
    const callsAfterFirst = dbExecuteMock.mock.calls.length;
    await getBusinessMetrics();
    expect(dbExecuteMock.mock.calls.length).toBe(callsAfterFirst);
  });

  it("safe wrapper : si une requête échoue, on retombe sur fallback 0", async () => {
    dbExecuteMock
      .mockRejectedValueOnce(new Error("users table missing"))
      .mockResolvedValueOnce({
        rows: [{ free: "10", pro: "0", premium: "0", trialing: "0", past_due: "0" }],
      })
      .mockResolvedValueOnce({ rows: [{ total: "0", last_7d: "0", last_30d: "0", upcoming: "0" }] })
      .mockResolvedValueOnce({ rows: [{ total: "0", active_30d: "0" }] })
      .mockResolvedValueOnce({ rows: [{ calls: "0", cost_usd: "0" }] })
      .mockResolvedValueOnce({ rows: [{ canceled: "0" }] });

    const m = await getBusinessMetrics();
    expect(m.users.total).toBe(0); // fallback appliqué
    expect(m.subscriptions.free).toBe(10);
  });

  it("getConversionRate30d retourne 0 si aucun user", async () => {
    dbExecuteMock.mockResolvedValueOnce({ rows: [{ registered: "0", paid: "0" }] });
    const c = await getConversionRate30d();
    expect(c.ratio).toBe(0);
  });

  it("getConversionRate30d calcule le ratio paid/registered", async () => {
    dbExecuteMock.mockResolvedValueOnce({ rows: [{ registered: "100", paid: "12" }] });
    const c = await getConversionRate30d();
    expect(c.registered).toBe(100);
    expect(c.paid).toBe(12);
    expect(c.ratio).toBeCloseTo(0.12);
  });
});
