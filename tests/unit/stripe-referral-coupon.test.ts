/**
 * Tests auto-application coupons Stripe pour crédits parrainage.
 *
 * On mocke Stripe API + db pour tester chaque branche de la logique métier :
 *  - Parrain sans sub → skip proprement (crédit reste en DB)
 *  - Parrain sans crédit → skip
 *  - Idempotence : coupon appliqué il y a < 60s → skip
 *  - Happy path : coupon créé, attaché, credit décrémenté
 *  - Erreurs Stripe capturées gracieusement
 */

import { describe, expect, it, vi, beforeEach } from "vitest";

// -----------------------------------------------------------------------------
// Mocks
// -----------------------------------------------------------------------------

const dbState = {
  selectResult: null as {
    id: string;
    subscription: string;
    stripeSubscriptionId: string | null;
    stripeCustomerId: string | null;
    referralCreditMonths: number;
  } | null,
  updates: [] as unknown[],
};

vi.mock("@/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => (dbState.selectResult ? [dbState.selectResult] : []),
        }),
      }),
    }),
    update: () => ({
      set: (values: unknown) => ({
        where: async () => {
          dbState.updates.push(values);
        },
      }),
    }),
  },
}));

const stripeState = {
  subscription: {
    id: "sub_test",
    metadata: {} as Record<string, string>,
  } as { id: string; metadata: Record<string, string> },
  couponCreated: null as { id: string; amount_off: number; currency: string } | null,
  subscriptionUpdated: null as {
    discounts: { coupon: string }[];
    metadata: Record<string, string>;
  } | null,
  retrieveShouldFail: false,
  createCouponShouldFail: false,
  attachShouldFail: false,
};

vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({
    subscriptions: {
      retrieve: vi.fn(async () => {
        if (stripeState.retrieveShouldFail) {
          throw new Error("Stripe: subscription not found");
        }
        return stripeState.subscription;
      }),
      update: vi.fn(async (_id: string, params: Record<string, unknown>) => {
        if (stripeState.attachShouldFail) {
          throw new Error("Stripe: update failed");
        }
        stripeState.subscriptionUpdated = params as {
          discounts: { coupon: string }[];
          metadata: Record<string, string>;
        };
        return {};
      }),
    },
    coupons: {
      create: vi.fn(async (params: Record<string, unknown>) => {
        if (stripeState.createCouponShouldFail) {
          throw new Error("Stripe: coupon create failed");
        }
        const coupon = {
          id: `coupon_${Math.random().toString(36).slice(2, 8)}`,
          amount_off: params.amount_off as number,
          currency: params.currency as string,
        };
        stripeState.couponCreated = coupon;
        return coupon;
      }),
    },
  }),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { applyReferralCreditsAsStripeCoupon } from "@/lib/stripe-referral-coupon";

beforeEach(() => {
  dbState.selectResult = null;
  dbState.updates = [];
  stripeState.subscription = { id: "sub_test", metadata: {} };
  stripeState.couponCreated = null;
  stripeState.subscriptionUpdated = null;
  stripeState.retrieveShouldFail = false;
  stripeState.createCouponShouldFail = false;
  stripeState.attachShouldFail = false;
});

// -----------------------------------------------------------------------------
// Skip cases
// -----------------------------------------------------------------------------

describe("applyReferralCreditsAsStripeCoupon — skip cases", () => {
  it("user introuvable → ok:false, reason:no_subscription", async () => {
    dbState.selectResult = null;
    const r = await applyReferralCreditsAsStripeCoupon("missing-user");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("no_subscription");
  });

  it("user sans stripeSubscriptionId → skip (crédit préservé DB)", async () => {
    dbState.selectResult = {
      id: "user-1",
      subscription: "free",
      stripeSubscriptionId: null,
      stripeCustomerId: null,
      referralCreditMonths: 3,
    };
    const r = await applyReferralCreditsAsStripeCoupon("user-1");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("no_subscription");
    // Aucun update DB — crédit préservé
    expect(dbState.updates).toHaveLength(0);
  });

  it("user avec 0 crédit → skip", async () => {
    dbState.selectResult = {
      id: "user-1",
      subscription: "pro",
      stripeSubscriptionId: "sub_test",
      stripeCustomerId: "cus_test",
      referralCreditMonths: 0,
    };
    const r = await applyReferralCreditsAsStripeCoupon("user-1");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("no_credits");
  });

  it("user sur plan free (edge case avec sub) → invalid_plan", async () => {
    dbState.selectResult = {
      id: "user-1",
      subscription: "free",
      stripeSubscriptionId: "sub_test",
      stripeCustomerId: "cus_test",
      referralCreditMonths: 2,
    };
    const r = await applyReferralCreditsAsStripeCoupon("user-1");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("invalid_plan");
  });
});

// -----------------------------------------------------------------------------
// Idempotence
// -----------------------------------------------------------------------------

describe("applyReferralCreditsAsStripeCoupon — idempotence", () => {
  beforeEach(() => {
    dbState.selectResult = {
      id: "user-1",
      subscription: "pro",
      stripeSubscriptionId: "sub_test",
      stripeCustomerId: "cus_test",
      referralCreditMonths: 2,
    };
  });

  it("coupon appliqué il y a < 60s → skip", async () => {
    stripeState.subscription = {
      id: "sub_test",
      metadata: {
        referral_coupon_last_applied_at: new Date(Date.now() - 30_000).toISOString(),
      },
    };
    const r = await applyReferralCreditsAsStripeCoupon("user-1");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("already_applied_recently");
    expect(stripeState.couponCreated).toBeNull();
  });

  it("coupon appliqué il y a > 60s → OK on peut re-appliquer", async () => {
    stripeState.subscription = {
      id: "sub_test",
      metadata: {
        referral_coupon_last_applied_at: new Date(Date.now() - 120_000).toISOString(),
      },
    };
    const r = await applyReferralCreditsAsStripeCoupon("user-1");
    expect(r.ok).toBe(true);
    expect(r.reason).toBe("applied");
  });

  it("timestamp invalide dans metadata → passe (protection défensive)", async () => {
    stripeState.subscription = {
      id: "sub_test",
      metadata: { referral_coupon_last_applied_at: "not-a-date" },
    };
    const r = await applyReferralCreditsAsStripeCoupon("user-1");
    expect(r.ok).toBe(true);
  });
});

// -----------------------------------------------------------------------------
// Happy path
// -----------------------------------------------------------------------------

describe("applyReferralCreditsAsStripeCoupon — happy path", () => {
  it("Pro + 1 crédit → coupon 29€ créé, attaché, credit décrémenté", async () => {
    dbState.selectResult = {
      id: "user-1",
      subscription: "pro",
      stripeSubscriptionId: "sub_test",
      stripeCustomerId: "cus_test",
      referralCreditMonths: 1,
    };
    const r = await applyReferralCreditsAsStripeCoupon("user-1");

    expect(r.ok).toBe(true);
    expect(r.reason).toBe("applied");
    expect(r.amountOffCents).toBe(2900); // 29€ Pro
    expect(r.monthsConsumed).toBe(1);
    expect(r.couponId).toMatch(/^coupon_/);

    // Coupon créé
    expect(stripeState.couponCreated).not.toBeNull();
    expect(stripeState.couponCreated?.amount_off).toBe(2900);
    expect(stripeState.couponCreated?.currency).toBe("eur");

    // Sub mise à jour avec discount + metadata (Stripe SDK v22+ format)
    expect(stripeState.subscriptionUpdated?.discounts[0].coupon).toBe(
      stripeState.couponCreated?.id
    );
    expect(stripeState.subscriptionUpdated?.metadata.referral_coupon_last_applied_at).toBeDefined();

    // DB update (décrémentation)
    expect(dbState.updates).toHaveLength(1);
  });

  it("Premium → coupon 79€", async () => {
    dbState.selectResult = {
      id: "user-1",
      subscription: "premium",
      stripeSubscriptionId: "sub_test",
      stripeCustomerId: "cus_test",
      referralCreditMonths: 3,
    };
    const r = await applyReferralCreditsAsStripeCoupon("user-1");
    expect(r.ok).toBe(true);
    expect(r.amountOffCents).toBe(7900);
  });
});

// -----------------------------------------------------------------------------
// Erreurs Stripe
// -----------------------------------------------------------------------------

describe("applyReferralCreditsAsStripeCoupon — erreurs Stripe", () => {
  beforeEach(() => {
    dbState.selectResult = {
      id: "user-1",
      subscription: "pro",
      stripeSubscriptionId: "sub_test",
      stripeCustomerId: "cus_test",
      referralCreditMonths: 2,
    };
  });

  it("subscription.retrieve fail → stripe_error, aucun coupon créé", async () => {
    stripeState.retrieveShouldFail = true;
    const r = await applyReferralCreditsAsStripeCoupon("user-1");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("stripe_error");
    expect(stripeState.couponCreated).toBeNull();
    expect(dbState.updates).toHaveLength(0); // crédit préservé
  });

  it("coupon.create fail → stripe_error, sub pas modifiée", async () => {
    stripeState.createCouponShouldFail = true;
    const r = await applyReferralCreditsAsStripeCoupon("user-1");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("stripe_error");
    expect(stripeState.subscriptionUpdated).toBeNull();
    expect(dbState.updates).toHaveLength(0);
  });

  it("subscription.update fail → stripe_error, crédit préservé pour retry", async () => {
    stripeState.attachShouldFail = true;
    const r = await applyReferralCreditsAsStripeCoupon("user-1");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("stripe_error");
    // Coupon a été créé mais pas attaché — crédit reste en DB pour retenter
    expect(stripeState.couponCreated).not.toBeNull();
    expect(dbState.updates).toHaveLength(0);
  });

  it("jamais throw même si Stripe explose", async () => {
    stripeState.retrieveShouldFail = true;
    stripeState.createCouponShouldFail = true;
    await expect(applyReferralCreditsAsStripeCoupon("user-1")).resolves.toBeDefined();
  });
});
