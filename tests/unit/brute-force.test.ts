/**
 * Tests du détecteur brute-force (Lot 26).
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  recordLoginFailure,
  recordLoginSuccess,
  getFailureCount,
  __resetBruteForceStore,
} from "../../src/lib/brute-force-detector";

// Mock les alertes (sinon on tape des vraies APIs Sentry/webhook)
vi.mock("@/lib/monitoring", () => ({
  captureMessage: vi.fn(),
}));
vi.mock("@/lib/alerts", () => ({
  sendAlert: vi.fn().mockResolvedValue(true),
}));

describe("brute-force detector (Lot 26)", () => {
  beforeEach(() => {
    __resetBruteForceStore();
    delete process.env.BRUTE_FORCE_THRESHOLD;
  });

  it("compte les échecs par IP", () => {
    recordLoginFailure("1.2.3.4");
    recordLoginFailure("1.2.3.4");
    recordLoginFailure("1.2.3.4");
    expect(getFailureCount("1.2.3.4")).toBe(3);
    expect(getFailureCount("5.6.7.8")).toBe(0);
  });

  it("ignore IP null/unknown (pas de tracking possible)", () => {
    recordLoginFailure(null);
    recordLoginFailure("unknown");
    expect(getFailureCount("unknown")).toBe(0);
  });

  it("recordLoginSuccess reset le compteur pour l'IP", () => {
    recordLoginFailure("1.2.3.4");
    recordLoginFailure("1.2.3.4");
    expect(getFailureCount("1.2.3.4")).toBe(2);
    recordLoginSuccess("1.2.3.4");
    expect(getFailureCount("1.2.3.4")).toBe(0);
  });

  it("recordLoginSuccess sur IP inconnue = no-op", () => {
    expect(() => recordLoginSuccess("9.9.9.9")).not.toThrow();
  });

  it("respecte le threshold via env BRUTE_FORCE_THRESHOLD", async () => {
    process.env.BRUTE_FORCE_THRESHOLD = "5";
    // On tape 5 échecs — le 5ème doit déclencher l'alerte
    for (let i = 0; i < 5; i++) recordLoginFailure("2.2.2.2");
    // Vérification que sendAlert a été appelée
    const { sendAlert } = await import("@/lib/alerts");
    expect(sendAlert).toHaveBeenCalledTimes(1);
  });

  it("cooldown : 2ème alerte pour la même IP dans la même heure = pas d'appel supplémentaire", async () => {
    process.env.BRUTE_FORCE_THRESHOLD = "2";
    const { sendAlert } = await import("@/lib/alerts");
    vi.mocked(sendAlert).mockClear();
    recordLoginFailure("3.3.3.3");
    recordLoginFailure("3.3.3.3"); // atteint le seuil → alerte
    recordLoginFailure("3.3.3.3"); // 3ème échec, mais cooldown → pas d'alerte
    recordLoginFailure("3.3.3.3");
    expect(sendAlert).toHaveBeenCalledTimes(1);
  });

  it("plusieurs IPs sont indépendantes", () => {
    for (let i = 0; i < 10; i++) recordLoginFailure("4.4.4.4");
    for (let i = 0; i < 3; i++) recordLoginFailure("5.5.5.5");
    expect(getFailureCount("4.4.4.4")).toBe(10);
    expect(getFailureCount("5.5.5.5")).toBe(3);
  });
});
