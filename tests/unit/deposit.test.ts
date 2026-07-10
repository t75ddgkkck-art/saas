/**
 * F2 (Lot 30) — Tests deposit.
 *
 * Couvre :
 *  - computeDepositCents (fixed, percent, edge cases, arrondis)
 *  - requiresDeposit
 *  - decideRefundOnCancel (fenêtres, cas limites)
 *  - formatCentsEur (locale fr)
 *  - describeDeposit
 */

import { describe, expect, it } from "vitest";
import {
  computeDepositCents,
  requiresDeposit,
  decideRefundOnCancel,
  formatCentsEur,
  describeDeposit,
} from "@/lib/deposit";

describe("computeDepositCents()", () => {
  it("null depositType → 0", () => {
    expect(computeDepositCents({})).toBe(0);
    expect(computeDepositCents({ depositType: null })).toBe(0);
  });

  it("depositAmount = 0 → 0", () => {
    expect(computeDepositCents({ depositType: "fixed", depositAmount: 0 })).toBe(0);
    expect(
      computeDepositCents({ depositType: "percent", depositAmount: 0, priceCents: 10000 })
    ).toBe(0);
  });

  it("fixed : retourne le montant tel quel", () => {
    expect(computeDepositCents({ depositType: "fixed", depositAmount: 1000 })).toBe(1000);
  });

  it("fixed : ne dépasse pas le prix total si priceCents connu", () => {
    // Acompte 5000 mais prix seulement 3000 → cap à 3000
    expect(
      computeDepositCents({ depositType: "fixed", depositAmount: 5000, priceCents: 3000 })
    ).toBe(3000);
  });

  it("fixed : pas de cap si priceCents null (service sur devis)", () => {
    expect(
      computeDepositCents({ depositType: "fixed", depositAmount: 5000, priceCents: null })
    ).toBe(5000);
  });

  it("percent : calcule correctement (arrondi entier)", () => {
    // 30€ × 20% = 6€ = 600 centimes
    expect(
      computeDepositCents({ depositType: "percent", depositAmount: 20, priceCents: 3000 })
    ).toBe(600);
    // 27€ × 20% = 5.4€ = 540 centimes
    expect(
      computeDepositCents({ depositType: "percent", depositAmount: 20, priceCents: 2700 })
    ).toBe(540);
  });

  it("percent : arrondi correct sur cas glissants", () => {
    // 33.33€ × 33% = 10.9989€ → 1100 centimes (arrondi banquier standard)
    expect(
      computeDepositCents({ depositType: "percent", depositAmount: 33, priceCents: 3333 })
    ).toBe(1100);
  });

  it("percent : priceCents null → 0 (impossible de calculer)", () => {
    expect(
      computeDepositCents({ depositType: "percent", depositAmount: 20, priceCents: null })
    ).toBe(0);
    expect(computeDepositCents({ depositType: "percent", depositAmount: 20, priceCents: 0 })).toBe(
      0
    );
  });

  it("percent : ne dépasse jamais priceCents (ceinture-bretelles)", () => {
    // Even si depositAmount=150% par accident (bypass du CHECK SQL)
    expect(
      computeDepositCents({ depositType: "percent", depositAmount: 150, priceCents: 1000 })
    ).toBe(1000);
  });

  it("percent 100% = prix total", () => {
    expect(
      computeDepositCents({ depositType: "percent", depositAmount: 100, priceCents: 5000 })
    ).toBe(5000);
  });
});

describe("requiresDeposit()", () => {
  it("false si pas de config", () => {
    expect(requiresDeposit({})).toBe(false);
  });
  it("false si type sans amount", () => {
    expect(requiresDeposit({ depositType: "fixed" })).toBe(false);
  });
  it("true si acompte calculé > 0", () => {
    expect(requiresDeposit({ depositType: "fixed", depositAmount: 500 })).toBe(true);
    expect(requiresDeposit({ depositType: "percent", depositAmount: 10, priceCents: 5000 })).toBe(
      true
    );
  });
  it("false si percent sans priceCents", () => {
    expect(requiresDeposit({ depositType: "percent", depositAmount: 20 })).toBe(false);
  });
});

describe("decideRefundOnCancel()", () => {
  const start = new Date("2026-08-15T10:00:00Z");

  it("refundHours null → forfeited (le pro décide manuellement)", () => {
    expect(
      decideRefundOnCancel({
        refundHours: null,
        appointmentStart: start,
        cancelledAt: new Date("2026-08-01T10:00:00Z"),
      })
    ).toBe("forfeited");
  });

  it("refundHours 0 → toujours refunded", () => {
    expect(
      decideRefundOnCancel({
        refundHours: 0,
        appointmentStart: start,
        cancelledAt: new Date("2026-08-15T09:59:00Z"), // 1 min avant
      })
    ).toBe("refunded");
  });

  it("annulation exactement à la fenêtre → refunded (inclusif)", () => {
    // Fenêtre 48h. Annulation à 48h pile → OK.
    expect(
      decideRefundOnCancel({
        refundHours: 48,
        appointmentStart: start,
        cancelledAt: new Date("2026-08-13T10:00:00Z"), // 48h avant
      })
    ).toBe("refunded");
  });

  it("annulation dans la fenêtre → refunded", () => {
    expect(
      decideRefundOnCancel({
        refundHours: 48,
        appointmentStart: start,
        cancelledAt: new Date("2026-08-12T10:00:00Z"), // 72h avant
      })
    ).toBe("refunded");
  });

  it("annulation hors fenêtre → forfeited (anti no-show)", () => {
    expect(
      decideRefundOnCancel({
        refundHours: 48,
        appointmentStart: start,
        cancelledAt: new Date("2026-08-14T10:00:00Z"), // 24h avant
      })
    ).toBe("forfeited");
  });

  it("accepte string ISO en appointmentStart", () => {
    expect(
      decideRefundOnCancel({
        refundHours: 24,
        appointmentStart: "2026-08-15T10:00:00Z",
        cancelledAt: new Date("2026-08-13T10:00:00Z"),
      })
    ).toBe("refunded");
  });

  it("cancelledAt par défaut = now", () => {
    // Avec un RDV très loin dans le futur, fenêtre 24h → OK
    const farFuture = new Date(Date.now() + 30 * 24 * 3600 * 1000);
    expect(
      decideRefundOnCancel({
        refundHours: 24,
        appointmentStart: farFuture,
      })
    ).toBe("refunded");
  });
});

describe("formatCentsEur()", () => {
  it("formate en fr-FR avec €", () => {
    // Le NBSP fr entre montant et € est difficile à écrire → on teste avec regex
    expect(formatCentsEur(1050)).toMatch(/10,50\s?€/);
    expect(formatCentsEur(100)).toMatch(/1,00\s?€/);
    expect(formatCentsEur(0)).toMatch(/0,00\s?€/);
  });

  it("gère les grands montants", () => {
    // 12 345,67 € (avec NBSP séparateur milliers en fr)
    expect(formatCentsEur(1_234_567)).toMatch(/12.345,67\s?€/);
  });
});

describe("describeDeposit()", () => {
  it("aucun acompte", () => {
    expect(describeDeposit({})).toBe("Aucun acompte");
  });
  it("fixed", () => {
    expect(describeDeposit({ depositType: "fixed", depositAmount: 1500 })).toMatch(
      /15,00\s?€ fixe/
    );
  });
  it("percent", () => {
    expect(
      describeDeposit({ depositType: "percent", depositAmount: 20, priceCents: 5000 })
    ).toMatch(/20 % soit 10,00\s?€/);
  });
});
