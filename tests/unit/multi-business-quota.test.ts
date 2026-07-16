/**
 * Lot 46 (F11) — Tests gate + quota multi-vitrines.
 *
 * Focus sur la logique PURE (entitlements + limites), pas de mock DB.
 * La route API et le sélecteur UI sont testés indirectement via TSC + build.
 */

import { describe, expect, it } from "vitest";
import { canUse, checkQuota, getLimit, FEATURES } from "@/lib/entitlements";
import { PLAN_PERMISSIONS } from "@/lib/permissions";

describe("business.multi feature — matrice", () => {
  it("Free ne peut PAS avoir multi-vitrines", () => {
    expect(canUse("free", "business.multi")).toBe(false);
  });

  it("Pro ne peut PAS avoir multi-vitrines (argument commercial upgrade)", () => {
    expect(canUse("pro", "business.multi")).toBe(false);
  });

  it("Premium PEUT avoir multi-vitrines", () => {
    expect(canUse("premium", "business.multi")).toBe(true);
  });

  it("La feature est bien référencée dans FEATURES avec plans=[premium]", () => {
    expect(FEATURES["business.multi"]).toBeDefined();
    expect(FEATURES["business.multi"].plans).toEqual(["premium"]);
    expect(FEATURES["business.multi"].minPlan).toBe("premium");
  });
});

describe("maxBusinesses quota", () => {
  it("Free : 1 vitrine max", () => {
    expect(getLimit("free", "maxBusinesses")).toBe(1);
    expect(PLAN_PERMISSIONS.free.maxBusinesses).toBe(1);
  });

  it("Pro : 1 vitrine max (identique Free — l'upgrade Premium est l'argument multi)", () => {
    expect(getLimit("pro", "maxBusinesses")).toBe(1);
  });

  it("Premium : 3 vitrines max", () => {
    expect(getLimit("premium", "maxBusinesses")).toBe(3);
  });
});

describe("checkQuota maxBusinesses — flux création", () => {
  it("Free avec 0 vitrine → 1ère autorisée", () => {
    const r = checkQuota("free", "maxBusinesses", 0);
    expect(r.allowed).toBe(true);
    expect(r.limit).toBe(1);
    expect(r.remaining).toBe(1);
  });

  it("Free avec 1 vitrine → bloqué (quota atteint)", () => {
    const r = checkQuota("free", "maxBusinesses", 1);
    expect(r.allowed).toBe(false);
    expect(r.remaining).toBe(0);
  });

  it("Pro avec 1 vitrine → bloqué (même limite que Free)", () => {
    const r = checkQuota("pro", "maxBusinesses", 1);
    expect(r.allowed).toBe(false);
  });

  it("Premium avec 0 vitrine → allowed avec 3 restantes", () => {
    const r = checkQuota("premium", "maxBusinesses", 0);
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(3);
  });

  it("Premium avec 1 vitrine → allowed avec 2 restantes (peut créer 2e)", () => {
    const r = checkQuota("premium", "maxBusinesses", 1);
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(2);
  });

  it("Premium avec 3 vitrines → bloqué (quota max atteint)", () => {
    const r = checkQuota("premium", "maxBusinesses", 3);
    expect(r.allowed).toBe(false);
    expect(r.remaining).toBe(0);
  });

  it("Premium avec 5 vitrines (état corrompu impossible normalement) → toujours bloqué", () => {
    const r = checkQuota("premium", "maxBusinesses", 5);
    expect(r.allowed).toBe(false);
    expect(r.remaining).toBe(0);
  });
});

describe("scénario métier — franchise Premium", () => {
  it("upgrade path : Free 1 → Pro 1 → Premium 3", () => {
    // Free : ne peut pas dépasser 1
    expect(checkQuota("free", "maxBusinesses", 1).allowed).toBe(false);
    // Pro : upgrade payant mais quota identique → NE justifie PAS le passage à Pro
    // pour ce use case. C'est le passage à Premium qui débloque.
    expect(checkQuota("pro", "maxBusinesses", 1).allowed).toBe(false);
    // Premium : ouverture immédiate de 2 slots supplémentaires
    expect(checkQuota("premium", "maxBusinesses", 1).allowed).toBe(true);
    expect(checkQuota("premium", "maxBusinesses", 1).remaining).toBe(2);
  });

  it("premium chain : création vitrine #2 puis #3 puis blocage #4", () => {
    // Après création #2 (count=2)
    let r = checkQuota("premium", "maxBusinesses", 1);
    expect(r.allowed).toBe(true);
    // Après création #3 (count=3)
    r = checkQuota("premium", "maxBusinesses", 2);
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(1);
    // Tentative création #4 → refus
    r = checkQuota("premium", "maxBusinesses", 3);
    expect(r.allowed).toBe(false);
  });
});
