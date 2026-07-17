/**
 * Lot 60 — Vérifie le gate Premium sur la feature `reviews.google_import`.
 *
 * Ce test protège contre :
 *  1. Régression : quelqu'un rouvre accidentellement la feature à Pro/Free
 *  2. Faille de sécurité : l'UI a un `<UpgradeGate>` mais si l'API laisse passer,
 *     un curl trivial contourne
 *
 * On teste `canUse(plan, "reviews.google_import")` directement — c'est la
 * fonction utilisée par le PUT /api/my-business (voir route.ts).
 */
import { describe, it, expect } from "vitest";
import { canUse, FEATURES } from "@/lib/entitlements";

describe("Feature reviews.google_import (Lot 60 gate Premium)", () => {
  it("est déclarée dans FEATURES", () => {
    expect(FEATURES["reviews.google_import"]).toBeDefined();
  });

  it("liste UNIQUEMENT Premium (règle métier stricte)", () => {
    // Si un jour on ouvre à Pro, le test doit être mis à jour EXPLICITEMENT
    // (empêche l'ouverture accidentelle par un dev qui bougerait la matrice).
    expect(FEATURES["reviews.google_import"].plans).toEqual(["premium"]);
    expect(FEATURES["reviews.google_import"].minPlan).toBe("premium");
  });

  it("free ne peut PAS utiliser", () => {
    expect(canUse("free", "reviews.google_import")).toBe(false);
  });

  it("pro ne peut PAS utiliser (feature Premium exclusive)", () => {
    expect(canUse("pro", "reviews.google_import")).toBe(false);
  });

  it("premium peut utiliser", () => {
    expect(canUse("premium", "reviews.google_import")).toBe(true);
  });

  it("label + description sont non vides (affichés dans UpgradeGate)", () => {
    expect(FEATURES["reviews.google_import"].label.length).toBeGreaterThan(0);
    expect(FEATURES["reviews.google_import"].description.length).toBeGreaterThan(20);
  });
});
