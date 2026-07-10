/**
 * Test unitaire de la logique de décision `shouldRemind` du cron
 * de relance impayés (Lot 24).
 */

import { describe, it, expect } from "vitest";
import { __cronInternals } from "../../src/app/api/cron/payment-reminders/route";

const { shouldRemind } = __cronInternals;

const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY);

describe("shouldRemind — cron payment-reminders (Lot 24)", () => {
  it("ne relance pas si count=0 et facture jeune (<7j)", () => {
    const r = shouldRemind(0, daysAgo(3), null);
    expect(r.should).toBe(false);
  });

  it("1ère relance si count=0 et facture >= 7j", () => {
    const r = shouldRemind(0, daysAgo(7), null);
    expect(r.should).toBe(true);
    expect(r.step).toBe(1);
  });

  it("2ème relance si count=1 et lastReminder >= 8j", () => {
    const r = shouldRemind(1, daysAgo(20), daysAgo(9));
    expect(r.should).toBe(true);
    expect(r.step).toBe(2);
  });

  it("pas de 2ème si count=1 mais lastReminder trop récent", () => {
    const r = shouldRemind(1, daysAgo(20), daysAgo(3));
    expect(r.should).toBe(false);
  });

  it("3ème relance si count=2 et lastReminder >= 15j", () => {
    const r = shouldRemind(2, daysAgo(40), daysAgo(16));
    expect(r.should).toBe(true);
    expect(r.step).toBe(3);
  });

  it("stop après 3 relances (count>=3 → jamais)", () => {
    const r = shouldRemind(3, daysAgo(90), daysAgo(30));
    expect(r.should).toBe(false);
  });

  it("stop après 4 relances (safety net)", () => {
    const r = shouldRemind(4, daysAgo(90), daysAgo(30));
    expect(r.should).toBe(false);
  });
});
