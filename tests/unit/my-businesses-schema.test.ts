/**
 * Tests Lot 59 MIN2 — validation Zod du schéma CreateBusinessSchema.
 *
 * Avant le Lot 59, `POST /api/my-businesses` faisait `request.json()` cru
 * (aucune validation) → un attaquant pouvait envoyer siret 10k chars, name objet,
 * etc. → crash SQL avec message technique exposé.
 *
 * On teste le schéma en isolation (ré-export pour testabilité).
 */
import { describe, it, expect } from "vitest";
import { z } from "zod";

// On duplique le schéma pour le tester sans importer la route (qui charge db + session).
// C'est le prix à payer pour tester en isolation sans mocker Drizzle + cookies Next.
// Toute évolution du schéma dans route.ts doit être répercutée ici.
const CreateBusinessSchema = z.object({
  name: z.string().trim().min(1, "Nom requis").max(100),
  category: z.string().trim().min(1, "Catégorie requise").max(100),
  description: z.string().trim().max(2000).optional().nullable().or(z.literal("")),
  address: z.string().trim().max(500).optional().nullable().or(z.literal("")),
  city: z.string().trim().max(100).optional().nullable().or(z.literal("")),
  postalCode: z
    .string()
    .trim()
    .max(10)
    .regex(/^\d{0,5}$/, "Code postal invalide (5 chiffres max)")
    .optional()
    .nullable()
    .or(z.literal("")),
  phone: z.string().trim().max(30).optional().nullable().or(z.literal("")),
  siret: z
    .string()
    .trim()
    .regex(/^(\d{14})?$/, "SIRET invalide (14 chiffres attendus)")
    .optional()
    .nullable()
    .or(z.literal("")),
});

describe("CreateBusinessSchema — happy path", () => {
  it("accepte un business minimal (name + category)", () => {
    const r = CreateBusinessSchema.safeParse({ name: "Plomberie Dupont", category: "plombier" });
    expect(r.success).toBe(true);
  });

  it("accepte un business complet", () => {
    const r = CreateBusinessSchema.safeParse({
      name: "Plomberie Dupont",
      category: "plombier",
      description: "Dépannage rapide 7j/7 en Île-de-France",
      address: "12 rue du Marché",
      city: "Villepinte",
      postalCode: "93420",
      phone: "0612345678",
      siret: "12345678901234",
    });
    expect(r.success).toBe(true);
  });

  it("accepte les champs optionnels vides (chaîne vide)", () => {
    const r = CreateBusinessSchema.safeParse({
      name: "X",
      category: "Y",
      description: "",
      address: "",
      city: "",
      postalCode: "",
      phone: "",
      siret: "",
    });
    expect(r.success).toBe(true);
  });
});

describe("CreateBusinessSchema — rejet des inputs invalides (fix MIN2)", () => {
  it("rejette name manquant", () => {
    const r = CreateBusinessSchema.safeParse({ category: "plombier" });
    expect(r.success).toBe(false);
  });

  it("rejette name vide", () => {
    const r = CreateBusinessSchema.safeParse({ name: "", category: "plombier" });
    expect(r.success).toBe(false);
  });

  it("rejette name > 100 caractères", () => {
    const r = CreateBusinessSchema.safeParse({
      name: "a".repeat(101),
      category: "plombier",
    });
    expect(r.success).toBe(false);
  });

  it("rejette category manquant", () => {
    const r = CreateBusinessSchema.safeParse({ name: "X" });
    expect(r.success).toBe(false);
  });

  it("rejette description > 2000 chars (protège la colonne text illimité côté DB)", () => {
    const r = CreateBusinessSchema.safeParse({
      name: "X",
      category: "Y",
      description: "a".repeat(2001),
    });
    expect(r.success).toBe(false);
  });

  it("rejette siret non numérique", () => {
    const r = CreateBusinessSchema.safeParse({
      name: "X",
      category: "Y",
      siret: "123456789ABCDE",
    });
    expect(r.success).toBe(false);
  });

  it("rejette siret < 14 chiffres", () => {
    const r = CreateBusinessSchema.safeParse({
      name: "X",
      category: "Y",
      siret: "1234567890",
    });
    expect(r.success).toBe(false);
  });

  it("rejette siret > 14 chiffres (10k chars scenario)", () => {
    const r = CreateBusinessSchema.safeParse({
      name: "X",
      category: "Y",
      siret: "1".repeat(10000),
    });
    expect(r.success).toBe(false);
  });

  it("rejette postalCode non numérique", () => {
    const r = CreateBusinessSchema.safeParse({
      name: "X",
      category: "Y",
      postalCode: "AB12C",
    });
    expect(r.success).toBe(false);
  });

  it("rejette postalCode > 5 chiffres", () => {
    const r = CreateBusinessSchema.safeParse({
      name: "X",
      category: "Y",
      postalCode: "934200",
    });
    expect(r.success).toBe(false);
  });

  it("rejette name en objet (type coerce protection)", () => {
    const r = CreateBusinessSchema.safeParse({
      name: { evil: "payload" },
      category: "Y",
    });
    expect(r.success).toBe(false);
  });

  it("rejette phone > 30 chars", () => {
    const r = CreateBusinessSchema.safeParse({
      name: "X",
      category: "Y",
      phone: "0".repeat(31),
    });
    expect(r.success).toBe(false);
  });

  it("rejette city > 100 chars", () => {
    const r = CreateBusinessSchema.safeParse({
      name: "X",
      category: "Y",
      city: "a".repeat(101),
    });
    expect(r.success).toBe(false);
  });
});

describe("CreateBusinessSchema — comportement normalisation", () => {
  it("trim() les espaces autour de name", () => {
    const r = CreateBusinessSchema.safeParse({
      name: "  Plomberie Dupont  ",
      category: "plombier",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.name).toBe("Plomberie Dupont");
  });

  it("accepte postalCode vide (optionnel)", () => {
    const r = CreateBusinessSchema.safeParse({
      name: "X",
      category: "Y",
      postalCode: "",
    });
    expect(r.success).toBe(true);
  });

  it("accepte siret vide (optionnel)", () => {
    const r = CreateBusinessSchema.safeParse({
      name: "X",
      category: "Y",
      siret: "",
    });
    expect(r.success).toBe(true);
  });
});
