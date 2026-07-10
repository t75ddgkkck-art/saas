/**
 * F2 (Lot 30) — Tests des handlers webhook Stripe pour l'acompte.
 *
 * On mocke `db` pour éviter toute connexion réelle.
 * Focus sur la logique de dispatch (`handleCheckoutCompleted` → deposit vs sub)
 * et sur l'idempotence (rejouer un event ne double pas l'action).
 */

import { describe, expect, it, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Chaîne fluide select().from().where().limit() → thenable qui renvoie []
function makeSelectChain(returnValue: unknown[]) {
  const chain: {
    from: () => typeof chain;
    where: () => typeof chain;
    limit: () => Promise<unknown[]>;
  } = {
    from: () => chain,
    where: () => chain,
    limit: () => Promise.resolve(returnValue),
  };
  return chain;
}

const dbState = {
  selectResult: [] as unknown[],
  updates: [] as unknown[],
  inserts: [] as unknown[],
};

vi.mock("@/db", () => ({
  db: {
    select: () => makeSelectChain(dbState.selectResult),
    update: () => ({
      set: (values: unknown) => ({
        where: () => {
          dbState.updates.push(values);
          return Promise.resolve();
        },
      }),
    }),
    insert: () => ({
      values: (values: unknown) => {
        dbState.inserts.push(values);
        return Promise.resolve();
      },
    }),
  },
}));

// Silence des logs pendant les tests
vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Email stubbé
vi.mock("@/lib/email", () => ({
  sendEmail: vi.fn(async () => ({ success: true })),
}));

import { handleCheckoutCompleted, handleBookingDepositCompleted } from "@/lib/stripe-events";

beforeEach(() => {
  dbState.selectResult = [];
  dbState.updates = [];
  dbState.inserts = [];
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeDepositEvent(overrides?: Partial<{ appointmentId: string; sessionId: string }>) {
  return {
    id: "evt_test_dep",
    type: "checkout.session.completed",
    data: {
      object: {
        id: overrides?.sessionId ?? "cs_test_123",
        amount_total: 2000, // 20€
        currency: "eur",
        payment_intent: "pi_test",
        customer: "cus_test",
        metadata: {
          type: "booking_deposit",
          appointmentId: overrides?.appointmentId ?? "11111111-1111-4111-8111-111111111111",
          businessId: "22222222-2222-4222-8222-222222222222",
          businessSlug: "test-slug",
        },
      },
    },
  } as never;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("handleCheckoutCompleted — dispatch", () => {
  it("route vers handleBookingDepositCompleted si metadata.type = booking_deposit", async () => {
    // Le RDV est trouvé, pending → doit être updated
    dbState.selectResult = [
      {
        id: "11111111-1111-4111-8111-111111111111",
        businessId: "22222222-2222-4222-8222-222222222222",
        clientId: "33333333-3333-4333-8333-333333333333",
        depositStatus: "pending",
        stripeCheckoutSessionId: "cs_test_123",
      },
    ];
    await handleCheckoutCompleted(makeDepositEvent());
    // Update du RDV (status + depositStatus) + insert payment
    expect(dbState.updates.length).toBeGreaterThanOrEqual(1);
    expect(dbState.inserts.length).toBe(1);
    // On vérifie la shape du update
    const aptUpdate = dbState.updates.find(
      (u) => (u as { depositStatus?: string }).depositStatus === "paid"
    );
    expect(aptUpdate).toBeDefined();
    expect((aptUpdate as { status?: string })?.status).toBe("confirmed");
  });

  it("route vers subscription si metadata.type = null (flow classique)", async () => {
    // Pas de metadata.type + userId+plan présents = flow subscription
    dbState.selectResult = [{ referredBy: null }];
    const subEvent = {
      id: "evt_sub_1",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_sub_1",
          subscription: "sub_1",
          metadata: { userId: "user-1", plan: "pro" },
        },
      },
    } as never;
    await handleCheckoutCompleted(subEvent);
    // Update users (subscription active)
    const userUpdate = dbState.updates.find(
      (u) => (u as { subscription?: string }).subscription === "pro"
    );
    expect(userUpdate).toBeDefined();
  });

  it("ignore silencieusement si metadata absent (log warn)", async () => {
    const ghost = {
      id: "evt_ghost",
      type: "checkout.session.completed",
      data: { object: { id: "cs_ghost", metadata: {} } },
    } as never;
    await handleCheckoutCompleted(ghost);
    expect(dbState.updates.length).toBe(0);
    expect(dbState.inserts.length).toBe(0);
  });
});

describe("handleBookingDepositCompleted — cas nominal + idempotence", () => {
  it("update status + insert payment", async () => {
    dbState.selectResult = [
      {
        id: "aid-1",
        businessId: "biz-1",
        clientId: "cli-1",
        depositStatus: "pending",
        stripeCheckoutSessionId: "cs_test_123",
      },
    ];
    await handleBookingDepositCompleted(makeDepositEvent());
    expect(dbState.updates.length).toBe(1);
    expect(dbState.inserts.length).toBe(1);
    const payment = dbState.inserts[0] as { amount: string; type: string; status: string };
    expect(payment.type).toBe("deposit");
    expect(payment.status).toBe("completed");
    expect(payment.amount).toBe("20.00");
  });

  it("idempotent : rejouer un event déjà traité (depositStatus=paid) → no-op", async () => {
    dbState.selectResult = [
      {
        id: "aid-1",
        businessId: "biz-1",
        clientId: "cli-1",
        depositStatus: "paid", // déjà payé
        stripeCheckoutSessionId: "cs_test_123",
      },
    ];
    await handleBookingDepositCompleted(makeDepositEvent());
    expect(dbState.updates.length).toBe(0);
    expect(dbState.inserts.length).toBe(0);
  });

  it("RDV introuvable → warn + no-op", async () => {
    dbState.selectResult = []; // rien en DB
    await handleBookingDepositCompleted(makeDepositEvent());
    expect(dbState.updates.length).toBe(0);
    expect(dbState.inserts.length).toBe(0);
  });

  it("metadata incomplet → warn + no-op", async () => {
    const bad = {
      id: "evt_x",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_x",
          metadata: { type: "booking_deposit" }, // pas d'appointmentId
        },
      },
    } as never;
    await handleBookingDepositCompleted(bad);
    expect(dbState.updates.length).toBe(0);
  });
});
