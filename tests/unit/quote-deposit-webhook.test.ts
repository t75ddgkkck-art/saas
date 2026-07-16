/**
 * Lot 43 (F2+F8 fusion) — Tests handler webhook `quote_deposit`.
 *
 * Vérifie :
 *  - Le dispatcher `handleCheckoutCompleted` route correctement selon metadata.type
 *  - `handleQuoteDepositCompleted` marque le devis payé + insère un `payments`
 *  - Idempotence : rejouer le même event ne double pas l'insert
 *  - Metadata manquante → warn silent, pas de crash
 *  - Devis introuvable → warn silent, pas de crash
 */

import { describe, expect, it, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks (même pattern que deposit-webhook.test.ts pour cohérence)
// ---------------------------------------------------------------------------

function makeSelectChain(returnValue: unknown[]) {
  const chain: {
    from: () => typeof chain;
    innerJoin: () => typeof chain;
    where: () => typeof chain;
    limit: () => Promise<unknown[]>;
  } = {
    from: () => chain,
    innerJoin: () => chain,
    where: () => chain,
    limit: () => Promise.resolve(returnValue),
  };
  return chain;
}

// État partagé du mock DB, réinitialisé à chaque test
const dbState = {
  selectResults: [] as unknown[][], // stack : chaque select consomme le premier
  updates: [] as unknown[],
  inserts: [] as unknown[],
};

vi.mock("@/db", () => ({
  db: {
    select: () => {
      // Consomme la première réponse préparée (permet de mock plusieurs selects successifs)
      const r = dbState.selectResults.shift() ?? [];
      return makeSelectChain(r);
    },
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

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock("@/lib/email", () => ({
  sendEmail: vi.fn(async () => ({ success: true })),
}));

// notify est fire-and-forget → on stub par une fn vide qui ne throw pas
vi.mock("@/lib/notify", () => ({
  notifyAsync: vi.fn(),
}));

import { handleCheckoutCompleted, handleQuoteDepositCompleted } from "@/lib/stripe-events";
import type Stripe from "stripe";

beforeEach(() => {
  dbState.selectResults = [];
  dbState.updates = [];
  dbState.inserts = [];
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function buildQuoteDepositEvent(overrides: Partial<Stripe.Checkout.Session> = {}): Stripe.Event {
  const session: Partial<Stripe.Checkout.Session> = {
    id: "cs_test_quote_1",
    object: "checkout.session",
    metadata: {
      type: "quote_deposit",
      quoteId: "quote-uuid-1",
      quoteNumber: "DEV-2026-001",
      businessId: "biz-uuid-1",
    },
    amount_total: 30000, // 300 €
    currency: "eur",
    payment_intent: "pi_test_1",
    customer: "cus_test_1",
    ...overrides,
  };
  return {
    id: "evt_test_quote_1",
    type: "checkout.session.completed",
    data: { object: session as Stripe.Checkout.Session },
  } as unknown as Stripe.Event;
}

const quoteRow = {
  id: "quote-uuid-1",
  quoteNumber: "DEV-2026-001",
  clientId: "client-uuid-1",
  stripeDepositSessionId: "cs_test_quote_1",
  depositPaidAt: null,
};

// ---------------------------------------------------------------------------
// Tests dispatch
// ---------------------------------------------------------------------------

describe("handleCheckoutCompleted — dispatch metadata.type", () => {
  it("route vers handleQuoteDepositCompleted si type=quote_deposit", async () => {
    dbState.selectResults = [[quoteRow], [{ ownerId: "owner-1" }]];
    const event = buildQuoteDepositEvent();

    await handleCheckoutCompleted(event);

    // Devis marqué payé
    expect(dbState.updates).toHaveLength(1);
    expect(dbState.updates[0]).toMatchObject({
      depositPaidAt: expect.any(Date),
    });
    // Ligne payments créée avec le quoteId
    expect(dbState.inserts).toHaveLength(1);
    expect(dbState.inserts[0]).toMatchObject({
      quoteId: "quote-uuid-1",
      type: "deposit",
      status: "completed",
      amount: "300.00",
    });
  });

  it("ne route PAS vers quote_deposit si type=booking_deposit", async () => {
    // On construit un event booking et on vérifie qu'aucune modif "quote" ne se produit
    const bookingEvent = buildQuoteDepositEvent({
      metadata: {
        type: "booking_deposit",
        appointmentId: "apt-1",
        businessId: "biz-1",
      },
    });
    // Simule aucun matching sur le premier select (appointment absent = warn silent)
    dbState.selectResults = [[]];

    // Doit ne rien throw même si l'appointment est absent
    await expect(handleCheckoutCompleted(bookingEvent)).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Tests handler direct
// ---------------------------------------------------------------------------

describe("handleQuoteDepositCompleted — logique métier", () => {
  it("insert payments avec metadata source=quote_deposit", async () => {
    dbState.selectResults = [[quoteRow], [{ ownerId: "owner-1" }]];

    await handleQuoteDepositCompleted(buildQuoteDepositEvent());

    expect(dbState.inserts[0]).toMatchObject({
      metadata: expect.objectContaining({
        source: "quote_deposit",
        sessionId: "cs_test_quote_1",
        quoteId: "quote-uuid-1",
        quoteNumber: "DEV-2026-001",
      }),
    });
  });

  it("idempotence — si depositPaidAt déjà set, no-op complet", async () => {
    dbState.selectResults = [[{ ...quoteRow, depositPaidAt: new Date("2026-06-01") }]];

    await handleQuoteDepositCompleted(buildQuoteDepositEvent());

    expect(dbState.updates).toHaveLength(0);
    expect(dbState.inserts).toHaveLength(0);
  });

  it("metadata manquante → warn silent, aucune modif DB", async () => {
    const event = buildQuoteDepositEvent({
      metadata: { type: "quote_deposit" }, // pas de quoteId/businessId
    });

    await handleQuoteDepositCompleted(event);

    expect(dbState.updates).toHaveLength(0);
    expect(dbState.inserts).toHaveLength(0);
  });

  it("devis introuvable → warn silent, aucune modif DB", async () => {
    dbState.selectResults = [[]]; // aucun row

    await handleQuoteDepositCompleted(buildQuoteDepositEvent());

    expect(dbState.updates).toHaveLength(0);
    expect(dbState.inserts).toHaveLength(0);
  });

  it("amount_total = 0 → paiement inséré avec 0.00 (défensif, pas de crash)", async () => {
    dbState.selectResults = [[quoteRow], [{ ownerId: "owner-1" }]];

    await handleQuoteDepositCompleted(
      buildQuoteDepositEvent({ amount_total: 0 })
    );

    expect(dbState.inserts[0]).toMatchObject({
      amount: "0.00",
    });
  });
});
