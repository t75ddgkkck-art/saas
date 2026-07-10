import { describe, it, expect } from "vitest";
import { markDeleted, markRestored, notDeleted, onlyDeleted } from "../../src/lib/soft-delete";
import { businesses, users } from "../../src/db/schema";

describe("soft-delete helpers (Lot 14.3)", () => {
  it("markDeleted retourne une Date récente", () => {
    const before = Date.now();
    const d = markDeleted();
    const after = Date.now();
    expect(d).toBeInstanceOf(Date);
    expect(d.getTime()).toBeGreaterThanOrEqual(before);
    expect(d.getTime()).toBeLessThanOrEqual(after);
  });

  it("markRestored retourne null (pour reset la colonne)", () => {
    expect(markRestored()).toBeNull();
  });

  it("notDeleted produit un SQL fragment", () => {
    const sql = notDeleted(users.deletedAt);
    expect(sql).toBeDefined();
    // Un SQL Drizzle expose une .queryChunks / .decoder
    expect(sql).toHaveProperty("queryChunks");
  });

  it("onlyDeleted produit un SQL fragment", () => {
    const sql = onlyDeleted(users.deletedAt);
    expect(sql).toBeDefined();
    expect(sql).toHaveProperty("queryChunks");
  });

  it("les colonnes deleted_at sont bien présentes dans le schéma", () => {
    // Test de non-régression : si quelqu'un supprime `deletedAt` par erreur,
    // ce test lève une erreur explicite avant d'aller en prod.
    expect(users.deletedAt).toBeDefined();
    expect(businesses.deletedAt).toBeDefined();
  });
});
