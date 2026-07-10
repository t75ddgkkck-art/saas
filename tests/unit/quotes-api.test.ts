/**
 * Test contract léger de la route POST /api/quotes (Lot 18 fix B15).
 *
 * On ne teste PAS la route directement (elle lit cookies/session, DB, etc.)
 * mais on valide que le schéma Zod de création rejette bien les inputs
 * invalides — c'est là que la majorité des 400 se joue.
 *
 * L'import du schéma depuis la route est trop lourd (chaîne d'imports Next).
 * On refait ici la même contrainte pour vérifier notre convention.
 */

import { describe, it, expect } from "vitest";
import { z } from "zod";

// Copie du schéma effective de src/app/api/quotes/route.ts.
// On garde ces 2 sources synchro à la main — un vrai test contract Lot 27
// consommera le schéma exporté.
const CreateQuoteSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional(),
  category: z.string().trim().max(100).optional(),
  clientId: z.string().uuid().optional(),
  client: z
    .object({
      firstName: z.string().min(1).max(100),
      lastName: z.string().min(1).max(100),
      phone: z.string().min(4).max(20),
      email: z.string().email().max(255).optional(),
    })
    .optional(),
  items: z
    .array(
      z.object({
        description: z.string().min(1).max(500),
        quantity: z.number().int().min(1).max(9999),
        unitPrice: z.number().min(0).max(999999),
      })
    )
    .min(1)
    .max(50),
  taxRate: z.number().min(0).max(100).default(20),
  depositAmount: z.number().min(0).max(999999).optional(),
  validityDays: z.number().int().min(1).max(365).default(30),
  termsAndConditions: z.string().max(3000).optional(),
});

describe("POST /api/quotes — schéma Zod (Lot 18 B15)", () => {
  it("accepte un devis minimal valide (client à la volée)", () => {
    const ok = CreateQuoteSchema.safeParse({
      title: "Rénovation SdB",
      client: { firstName: "Alice", lastName: "Dupont", phone: "+33612345678" },
      items: [{ description: "Pose douche", quantity: 1, unitPrice: 800 }],
    });
    expect(ok.success).toBe(true);
    if (ok.success) {
      // Les defaults sont bien appliqués
      expect(ok.data.taxRate).toBe(20);
      expect(ok.data.validityDays).toBe(30);
    }
  });

  it("accepte un devis avec clientId UUID existant", () => {
    const ok = CreateQuoteSchema.safeParse({
      title: "Test",
      clientId: "550e8400-e29b-41d4-a716-446655440000",
      items: [{ description: "Ligne", quantity: 1, unitPrice: 100 }],
    });
    expect(ok.success).toBe(true);
  });

  it("rejette un devis sans items", () => {
    const ko = CreateQuoteSchema.safeParse({
      title: "Test",
      client: { firstName: "A", lastName: "B", phone: "0612" },
      items: [],
    });
    expect(ko.success).toBe(false);
  });

  it("rejette un titre vide", () => {
    const ko = CreateQuoteSchema.safeParse({
      title: "",
      items: [{ description: "x", quantity: 1, unitPrice: 1 }],
    });
    expect(ko.success).toBe(false);
  });

  it("rejette une quantité négative ou nulle", () => {
    const zero = CreateQuoteSchema.safeParse({
      title: "T",
      items: [{ description: "x", quantity: 0, unitPrice: 10 }],
    });
    expect(zero.success).toBe(false);
    const neg = CreateQuoteSchema.safeParse({
      title: "T",
      items: [{ description: "x", quantity: -1, unitPrice: 10 }],
    });
    expect(neg.success).toBe(false);
  });

  it("rejette un email client invalide", () => {
    const ko = CreateQuoteSchema.safeParse({
      title: "T",
      client: { firstName: "A", lastName: "B", phone: "0612", email: "not-an-email" },
      items: [{ description: "x", quantity: 1, unitPrice: 1 }],
    });
    expect(ko.success).toBe(false);
  });

  it("rejette un clientId non-UUID (anti-IDOR côté schéma)", () => {
    const ko = CreateQuoteSchema.safeParse({
      title: "T",
      clientId: "DEV-2025-001", // ancien format mock → doit être rejeté
      items: [{ description: "x", quantity: 1, unitPrice: 1 }],
    });
    expect(ko.success).toBe(false);
  });

  it("plafonne à 50 lignes max", () => {
    const items = Array.from({ length: 51 }, (_, i) => ({
      description: `L${i}`,
      quantity: 1,
      unitPrice: 1,
    }));
    const ko = CreateQuoteSchema.safeParse({
      title: "T",
      client: { firstName: "A", lastName: "B", phone: "0612" },
      items,
    });
    expect(ko.success).toBe(false);
  });
});
