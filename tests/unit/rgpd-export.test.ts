/**
 * Tests de l'export RGPD (Lot 15.5).
 * On mock @/db avec un select chainable qui retourne des données contrôlables
 * indexées par ordre d'appel.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// Séquence des résultats à renvoyer aux appels successifs de .then/.limit
const responses: unknown[][] = [];

vi.mock("@/db", () => {
  return {
    db: {
      select: () => ({
        from: () => ({
          where: () => {
            // .limit(1) OU .then direct → même comportement : shift la première réponse
            const chainable: {
              limit: (n: number) => Promise<unknown[]>;
              then: <T>(fn: (v: unknown[]) => T) => Promise<T>;
            } = {
              limit: (n: number) => Promise.resolve((responses.shift() ?? []).slice(0, n)),
              then: (fn) => Promise.resolve(responses.shift() ?? []).then(fn),
            };
            return chainable;
          },
        }),
      }),
    },
  };
});

import { buildRgpdExport } from "../../src/lib/rgpd-export";

describe("rgpd-export (Lot 15.5)", () => {
  beforeEach(() => {
    responses.length = 0;
  });

  it("throw si user introuvable", async () => {
    responses.push([]); // 1er appel = users → vide
    await expect(buildRgpdExport("nonexistent")).rejects.toThrow(/User introuvable/);
  });

  it("retourne meta + user sans passwordHash + arrays vides si pas de business", async () => {
    // Ordre d'appels dans buildRgpdExport :
    //  1. users (select+limit)
    //  2. businesses (select where ownerId)
    //  3. hasBiz === false → SKIP les 7 requêtes liées businesses
    //  4. aiUsage
    //  5. emailOptouts
    responses.push([
      {
        id: "u1",
        email: "user@example.com",
        passwordHash: "should-be-hidden-bcrypt-hash",
        firstName: "Test",
        lastName: "User",
        role: "professional",
        subscription: "free",
        createdAt: new Date(),
      },
    ]);
    responses.push([]); // businesses vide
    responses.push([]); // aiUsage
    responses.push([]); // emailOptouts

    const out = await buildRgpdExport("u1");

    expect(out.meta.format).toBe("vitrix-rgpd-v1");
    expect(out.meta.userId).toBe("u1");
    expect(out.meta.exportedAt).toMatch(/T\d\d:\d\d/);
    expect(out.meta.notice).toContain("RGPD");

    // Le hash BCRYPT NE DOIT PAS être exporté
    expect(out.user).not.toHaveProperty("passwordHash");
    expect(out.user.email).toBe("user@example.com");

    expect(out.businesses).toHaveLength(0);
    expect(out.clients).toHaveLength(0);
    expect(out.appointments).toHaveLength(0);
    expect(out.quotes).toHaveLength(0);
    expect(out.payments).toHaveLength(0);
    expect(out.blogPosts).toHaveLength(0);
    expect(out.reviews).toHaveLength(0);
    expect(out.services).toHaveLength(0);
    expect(out.aiUsage).toHaveLength(0);
    expect(out.emailOptouts).toHaveLength(0);
  });

  it("inclut les données de business + clients + RDV quand présents", async () => {
    responses.push([
      {
        id: "u1",
        email: "pro@example.com",
        passwordHash: "hash",
        firstName: "Pro",
        lastName: "User",
      },
    ]);
    // businesses (1 résultat)
    responses.push([{ id: "b1", ownerId: "u1", name: "Mon garage" }]);
    // Les 7 collections liées (dans l'ordre du Promise.all du code) :
    // clients, appointments, quotes, payments, blogPosts, reviews, services
    responses.push([{ id: "c1", firstName: "Alice", lastName: "Dupont" }]);
    responses.push([{ id: "a1", title: "Vidange" }]);
    responses.push([]);
    responses.push([]);
    responses.push([{ id: "bp1", title: "Article" }]);
    responses.push([]);
    responses.push([{ id: "s1", name: "Vidange" }]);
    responses.push([]); // aiUsage
    responses.push([]); // emailOptouts

    const out = await buildRgpdExport("u1");
    expect(out.businesses).toHaveLength(1);
    expect(out.clients).toHaveLength(1);
    expect(out.appointments).toHaveLength(1);
    expect(out.blogPosts).toHaveLength(1);
    expect(out.services).toHaveLength(1);
    expect(out.user).not.toHaveProperty("passwordHash");
  });
});
