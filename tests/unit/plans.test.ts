import { describe, it, expect } from "vitest";
import {
  PLANS,
  getDisplayPlans,
  getPriceCents,
  GRACE_PERIOD_DAYS,
  getStripePriceId,
  type PlanId,
} from "@/lib/plans";

describe("plans — définition canonique", () => {
  it("les 3 plans sont définis", () => {
    expect(PLANS.free).toBeDefined();
    expect(PLANS.pro).toBeDefined();
    expect(PLANS.premium).toBeDefined();
  });

  it("free est gratuit et sans trial", () => {
    expect(PLANS.free.monthlyPrice).toBe(0);
    expect(PLANS.free.yearlyPrice).toBe(0);
    expect(PLANS.free.trialDays).toBe(0);
  });

  it("pro et premium ont 14 jours de trial", () => {
    expect(PLANS.pro.trialDays).toBe(14);
    expect(PLANS.premium.trialDays).toBe(14);
  });

  it("annuel = 2 mois offerts (20% de rabais)", () => {
    // Pro : 29 * 12 = 348 → 278 = 348 * 0.799
    const proSavings = PLANS.pro.monthlyPrice * 12 - PLANS.pro.yearlyPrice;
    expect(proSavings).toBe(70); // 2 * 35 → ~2 mois
    // Premium : 79 * 12 = 948 → 758 = 190 économisés
    const prSavings = PLANS.premium.monthlyPrice * 12 - PLANS.premium.yearlyPrice;
    expect(prSavings).toBe(190);
  });

  it("pro est le plan mis en avant", () => {
    expect(PLANS.pro.highlight).toBe(true);
    expect(PLANS.premium.highlight).toBeFalsy();
  });
});

describe("plans — getPriceCents", () => {
  it("retourne les cents attendus par Stripe", () => {
    expect(getPriceCents("pro", "monthly")).toBe(2900);
    expect(getPriceCents("pro", "yearly")).toBe(27800);
    expect(getPriceCents("premium", "monthly")).toBe(7900);
    expect(getPriceCents("premium", "yearly")).toBe(75800);
    expect(getPriceCents("free", "monthly")).toBe(0);
  });
});

describe("plans — getDisplayPlans", () => {
  it("liste les plans dans l'ordre free/pro/premium", () => {
    const plans = getDisplayPlans();
    expect(plans.map((p) => p.id)).toEqual(["free", "pro", "premium"]);
  });

  it("calcule les économies annuelles", () => {
    const plans = getDisplayPlans();
    expect(plans[1].yearlySavings).toBe(70); // Pro
    expect(plans[2].yearlySavings).toBe(190); // Premium
  });

  it("effectiveMonthly = yearlyPrice / 12", () => {
    const plans = getDisplayPlans();
    expect(plans[1].effectiveMonthly).toBeCloseTo(23.17, 2);
    expect(plans[2].effectiveMonthly).toBeCloseTo(63.17, 2);
  });
});

describe("plans — getStripePriceId", () => {
  it("free retourne null (pas de prix Stripe)", () => {
    expect(getStripePriceId("free", "monthly")).toBeNull();
    expect(getStripePriceId("free", "yearly")).toBeNull();
  });

  it("lit les env vars", () => {
    process.env.STRIPE_PRICE_ID_PRO_MONTHLY = "price_test_pro_monthly";
    expect(getStripePriceId("pro", "monthly")).toBe("price_test_pro_monthly");
    delete process.env.STRIPE_PRICE_ID_PRO_MONTHLY;
  });

  it("retourne null si env vide", () => {
    delete process.env.STRIPE_PRICE_ID_PRO_YEARLY;
    expect(getStripePriceId("pro", "yearly")).toBeNull();
  });
});

describe("plans — GRACE_PERIOD_DAYS", () => {
  it("pro = 3 jours, premium = 7 jours", () => {
    expect(GRACE_PERIOD_DAYS.pro).toBe(3);
    expect(GRACE_PERIOD_DAYS.premium).toBe(7);
  });

  it("premium a une grace plus longue (churn plus douloureux)", () => {
    expect(GRACE_PERIOD_DAYS.premium).toBeGreaterThan(GRACE_PERIOD_DAYS.pro);
  });
});
