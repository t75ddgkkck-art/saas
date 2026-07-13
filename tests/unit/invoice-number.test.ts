/**
 * Lot 42 (F9) — Tests numérotation facture.
 *
 * On teste la logique PURE de formatage (padding, prefix, année).
 * La partie atomique SELECT ... FOR UPDATE est garantie par Postgres,
 * non reproductible en unitaire sans vraie DB.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock le module @/db AVANT tout autre import qui l'utilise.
// Note : le mock est hoisté par Vitest, il s'applique même aux imports statiques ci-dessous.
vi.mock("@/db", () => ({
  db: {
    transaction: vi.fn(),
  },
}));

import { generateInvoiceNumber } from "@/lib/invoice-number";
import { db } from "@/db";

/**
 * Fabrique un executor mockable simulant Drizzle.execute().
 * On distingue SELECT (retourne row) et UPDATE (silent) par matching sur queryChunks.
 */
function mockTransactionOnce(row: { prefix: string | null; counter: number } | null) {
  (db as unknown as { transaction: ReturnType<typeof vi.fn> }).transaction.mockImplementationOnce(
    async (fn: (tx: unknown) => Promise<unknown>) => {
      const executor = {
        // Drizzle .execute() renvoie { rows, ... } (pattern pg driver)
        execute: vi.fn(async (query: unknown) => {
          const chunks = (query as { queryChunks?: unknown[] }).queryChunks ?? [];
          const asText = JSON.stringify(chunks).toLowerCase();
          if (asText.includes("select")) {
            return {
              rows:
                row === null
                  ? []
                  : [{ invoice_prefix: row.prefix, invoice_counter: row.counter }],
            };
          }
          // UPDATE : retour sans rows utile
          return { rows: [] };
        }),
      };
      return fn(executor);
    }
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("generateInvoiceNumber - format", () => {
  it("format complet avec padding 4 chiffres et année", async () => {
    mockTransactionOnce({ prefix: "F-", counter: 0 });

    const result = await generateInvoiceNumber(
      "biz-uuid",
      undefined,
      () => new Date("2026-07-13T12:00:00Z")
    );

    expect(result.year).toBe(2026);
    expect(result.counter).toBe(1);
    expect(result.invoiceNumber).toBe("F-2026-0001");
  });

  it("incrément sur compteur existant", async () => {
    mockTransactionOnce({ prefix: "F-", counter: 42 });

    const result = await generateInvoiceNumber(
      "biz-uuid",
      undefined,
      () => new Date("2026-01-01T00:00:00Z")
    );

    expect(result.counter).toBe(43);
    expect(result.invoiceNumber).toBe("F-2026-0043");
  });

  it("préfixe custom respecté", async () => {
    mockTransactionOnce({ prefix: "FAC-", counter: 99 });

    const result = await generateInvoiceNumber(
      "biz-uuid",
      undefined,
      () => new Date("2027-03-15T00:00:00Z")
    );

    expect(result.invoiceNumber).toBe("FAC-2027-0100");
  });

  it("préfixe null → default 'F-'", async () => {
    mockTransactionOnce({ prefix: null, counter: 0 });

    const result = await generateInvoiceNumber(
      "biz-uuid",
      undefined,
      () => new Date("2026-06-01T00:00:00Z")
    );

    expect(result.invoiceNumber).toBe("F-2026-0001");
  });

  it("padding tient jusqu'à 9999 puis déborde proprement (10000)", async () => {
    mockTransactionOnce({ prefix: "F-", counter: 9999 });

    const result = await generateInvoiceNumber(
      "biz-uuid",
      undefined,
      () => new Date("2026-12-31T23:59:00Z")
    );

    // padStart(4) laisse passer les chiffres au-delà de 4 sans troncage
    expect(result.invoiceNumber).toBe("F-2026-10000");
    expect(result.counter).toBe(10000);
  });
});

describe("generateInvoiceNumber - erreurs", () => {
  it("throw si business introuvable (row vide)", async () => {
    mockTransactionOnce(null);

    await expect(generateInvoiceNumber("missing-uuid")).rejects.toThrow(/introuvable/);
  });
});
