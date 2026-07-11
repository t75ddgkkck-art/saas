/**
 * Lot 36 — Tests logique shouldSendReactivation.
 * Fonction pure, testable sans mock DB.
 */

import { describe, expect, it } from "vitest";
import { __cronInternals } from "@/app/api/cron/reactivation/route";

const { shouldSendReactivation } = __cronInternals;

const NOW = new Date("2026-08-15T12:00:00Z");
const days = (n: number) => new Date(NOW.getTime() - n * 86_400_000);

const baseUser = {
  lastLoginAt: days(45),
  reactivationEmailAt: null,
  emailVerified: true,
  bannedAt: null,
  deletedAt: null,
};

describe("shouldSendReactivation", () => {
  it("true si conditions idéales (45j inactif, verify OK, jamais relancé)", () => {
    expect(shouldSendReactivation(baseUser, NOW)).toBe(true);
  });

  it("false si banni", () => {
    expect(shouldSendReactivation({ ...baseUser, bannedAt: new Date() }, NOW)).toBe(false);
  });

  it("false si soft-deleted", () => {
    expect(shouldSendReactivation({ ...baseUser, deletedAt: new Date() }, NOW)).toBe(false);
  });

  it("false si email non vérifié (évite spam les non-verify)", () => {
    expect(shouldSendReactivation({ ...baseUser, emailVerified: false }, NOW)).toBe(false);
  });

  it("false si jamais connecté (aucun signal d'engagement)", () => {
    expect(shouldSendReactivation({ ...baseUser, lastLoginAt: null }, NOW)).toBe(false);
  });

  it("false si login < 30j (encore actif)", () => {
    expect(shouldSendReactivation({ ...baseUser, lastLoginAt: days(15) }, NOW)).toBe(false);
    // Bord 30j — inclusif (>=)
    expect(shouldSendReactivation({ ...baseUser, lastLoginAt: days(29) }, NOW)).toBe(false);
  });

  it("true à 30j pile", () => {
    expect(shouldSendReactivation({ ...baseUser, lastLoginAt: days(30) }, NOW)).toBe(true);
  });

  it("false si login > 90j (churn considéré définitif)", () => {
    expect(shouldSendReactivation({ ...baseUser, lastLoginAt: days(100) }, NOW)).toBe(false);
    // Bord 90j — inclusif
    expect(shouldSendReactivation({ ...baseUser, lastLoginAt: days(91) }, NOW)).toBe(false);
  });

  it("true à 90j pile", () => {
    expect(shouldSendReactivation({ ...baseUser, lastLoginAt: days(90) }, NOW)).toBe(true);
  });

  it("false si email de réactivation envoyé il y a < 30j (anti-spam)", () => {
    expect(shouldSendReactivation({ ...baseUser, reactivationEmailAt: days(10) }, NOW)).toBe(false);
  });

  it("true si email de réactivation envoyé il y a >= 30j (nouvelle tentative)", () => {
    expect(shouldSendReactivation({ ...baseUser, reactivationEmailAt: days(35) }, NOW)).toBe(true);
  });
});
