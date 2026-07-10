/**
 * Test contract : schéma Zod de POST /api/payments (Lot 20).
 */

import { describe, it, expect } from "vitest";
import { z } from "zod";

const CreateSchema = z.object({
  clientId: z.string().uuid().optional().nullable(),
  quoteId: z.string().uuid().optional().nullable(),
  amount: z.number().positive().max(999999.99),
  currency: z.string().length(3).default("EUR"),
  type: z.enum(["deposit", "full", "subscription"]),
  status: z.enum(["pending", "completed", "failed", "refunded"]).default("completed"),
  method: z.string().max(50).optional(),
  note: z.string().max(500).optional(),
});

describe("payments API — schéma Zod (Lot 20)", () => {
  it("accepte un paiement minimal", () => {
    const r = CreateSchema.safeParse({ amount: 100, type: "full" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.currency).toBe("EUR");
      expect(r.data.status).toBe("completed");
    }
  });

  it("accepte deposit + méthode + note", () => {
    const r = CreateSchema.safeParse({
      amount: 250,
      type: "deposit",
      method: "cash",
      note: "acompte chantier",
    });
    expect(r.success).toBe(true);
  });

  it("rejette montant 0 ou négatif", () => {
    expect(CreateSchema.safeParse({ amount: 0, type: "full" }).success).toBe(false);
    expect(CreateSchema.safeParse({ amount: -10, type: "full" }).success).toBe(false);
  });

  it("rejette un type inconnu", () => {
    const r = CreateSchema.safeParse({ amount: 10, type: "hack" });
    expect(r.success).toBe(false);
  });

  it("rejette devise malformée (doit être 3 chars)", () => {
    const r = CreateSchema.safeParse({ amount: 10, type: "full", currency: "EURO" });
    expect(r.success).toBe(false);
  });

  it("rejette clientId non-UUID", () => {
    const r = CreateSchema.safeParse({
      amount: 10,
      type: "full",
      clientId: "not-a-uuid",
    });
    expect(r.success).toBe(false);
  });

  it("cape le montant à 999999.99", () => {
    const r = CreateSchema.safeParse({ amount: 1_000_000, type: "full" });
    expect(r.success).toBe(false);
  });
});
