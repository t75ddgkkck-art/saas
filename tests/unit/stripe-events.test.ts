import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock du logger et sendEmail avant l'import du module testé
vi.mock("@/lib/logger", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/lib/email", () => ({
  sendEmail: vi.fn().mockResolvedValue({ success: true }),
}));

// Mock de la DB — on capture les UPDATE pour vérifier les side-effects
const dbUpdate = vi.fn().mockReturnThis();
const dbSet = vi.fn().mockReturnThis();
const dbWhere = vi.fn().mockResolvedValue(undefined);
const dbSelect = vi.fn().mockReturnThis();
const dbFrom = vi.fn().mockReturnThis();
const dbSelectWhere = vi.fn().mockReturnThis();
const dbLimit = vi.fn();

vi.mock("@/db", () => ({
  db: {
    update: (...a: unknown[]) => {
      dbUpdate(...a);
      return { set: dbSet };
    },
    select: () => {
      dbSelect();
      return { from: dbFrom };
    },
  },
}));

// On configure les chaînes fluent
dbSet.mockReturnValue({ where: dbWhere });
dbFrom.mockReturnValue({ where: dbSelectWhere });
dbSelectWhere.mockReturnValue({ limit: dbLimit });

process.env.NEXT_PUBLIC_APP_URL = "https://www.vitrix.fr";

const {
  handleCheckoutCompleted,
  handleSubscriptionUpdated,
  handleSubscriptionDeleted,
} = await import("@/lib/stripe-events");

describe("stripe-events — handleCheckoutCompleted", () => {
  beforeEach(() => {
    dbUpdate.mockClear();
    dbSet.mockClear();
    dbWhere.mockClear();
  });

  it("active le plan pro sur session complétée", async () => {
    await handleCheckoutCompleted({
      type: "checkout.session.completed",
      data: {
        object: {
          metadata: { userId: "user-123", plan: "pro" },
          subscription: "sub_test_abc",
        },
      },
    } as never);

    expect(dbSet).toHaveBeenCalledWith(
      expect.objectContaining({
        subscription: "pro",
        subscriptionStatus: "active",
        stripeSubscriptionId: "sub_test_abc",
        subscriptionExpiresAt: null,
      })
    );
  });

  it("ignore si metadata manque", async () => {
    await handleCheckoutCompleted({
      type: "checkout.session.completed",
      data: { object: { metadata: {} } },
    } as never);

    expect(dbSet).not.toHaveBeenCalled();
  });

  it("ignore si plan invalide", async () => {
    await handleCheckoutCompleted({
      type: "checkout.session.completed",
      data: { object: { metadata: { userId: "user-1", plan: "enterprise" } } },
    } as never);

    expect(dbSet).not.toHaveBeenCalled();
  });
});

describe("stripe-events — handleSubscriptionUpdated (grace period)", () => {
  beforeEach(() => {
    dbUpdate.mockClear();
    dbSet.mockClear();
    dbLimit.mockClear();
  });

  it("past_due → active grace period 3 jours pour Pro", async () => {
    dbLimit.mockResolvedValueOnce([
      { id: "user-1", email: "u@test.com", firstName: "Jean", subscription: "pro" },
    ]);

    const before = Date.now();
    await handleSubscriptionUpdated({
      type: "customer.subscription.updated",
      data: {
        object: {
          status: "past_due",
          metadata: { userId: "user-1" },
        },
      },
    } as never);

    expect(dbSet).toHaveBeenCalled();
    const call = dbSet.mock.calls[0][0] as {
      subscriptionStatus: string;
      subscriptionExpiresAt: Date;
    };
    expect(call.subscriptionStatus).toBe("past_due");
    // La grace period expire ~3 jours plus tard (Pro)
    const graceMs = call.subscriptionExpiresAt.getTime() - before;
    expect(graceMs).toBeGreaterThan(2.9 * 24 * 3600 * 1000);
    expect(graceMs).toBeLessThan(3.1 * 24 * 3600 * 1000);
  });

  it("past_due Premium → grace period 7 jours", async () => {
    dbLimit.mockResolvedValueOnce([
      { id: "user-2", email: "u2@test.com", firstName: "Marie", subscription: "premium" },
    ]);

    const before = Date.now();
    await handleSubscriptionUpdated({
      type: "customer.subscription.updated",
      data: {
        object: {
          status: "past_due",
          metadata: { userId: "user-2" },
        },
      },
    } as never);

    const call = dbSet.mock.calls[0][0] as { subscriptionExpiresAt: Date };
    const graceMs = call.subscriptionExpiresAt.getTime() - before;
    expect(graceMs).toBeGreaterThan(6.9 * 24 * 3600 * 1000);
    expect(graceMs).toBeLessThan(7.1 * 24 * 3600 * 1000);
  });

  it("status active → nettoie l'expiration", async () => {
    dbLimit.mockResolvedValueOnce([
      { id: "user-3", email: "u@test.com", firstName: "Jean", subscription: "pro" },
    ]);

    await handleSubscriptionUpdated({
      type: "customer.subscription.updated",
      data: { object: { status: "active", metadata: { userId: "user-3" } } },
    } as never);

    expect(dbSet).toHaveBeenCalledWith(
      expect.objectContaining({
        subscriptionStatus: "active",
        subscriptionExpiresAt: null,
      })
    );
  });

  it("free user en past_due → ne fait rien (déjà au minimum)", async () => {
    dbLimit.mockResolvedValueOnce([
      { id: "user-4", email: "u@test.com", firstName: "X", subscription: "free" },
    ]);

    await handleSubscriptionUpdated({
      type: "customer.subscription.updated",
      data: { object: { status: "past_due", metadata: { userId: "user-4" } } },
    } as never);

    expect(dbSet).not.toHaveBeenCalled();
  });
});

describe("stripe-events — handleSubscriptionDeleted", () => {
  beforeEach(() => {
    dbSet.mockClear();
  });

  it("downgrade immédiat vers free", async () => {
    await handleSubscriptionDeleted({
      type: "customer.subscription.deleted",
      data: { object: { metadata: { userId: "user-99" } } },
    } as never);

    expect(dbSet).toHaveBeenCalledWith(
      expect.objectContaining({
        subscription: "free",
        subscriptionStatus: "canceled",
        stripeSubscriptionId: null,
        subscriptionExpiresAt: null,
      })
    );
  });
});
