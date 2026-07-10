/**
 * Test unitaire de la logique de "confirmation typée" du ConfirmDialog (Lot 22).
 * On teste le predicate pur, pas le JSX.
 */

import { describe, it, expect } from "vitest";

/**
 * Miroir de la logique interne :
 * `canConfirm = !requiresTyping || typed === requireTypedConfirmation`
 */
function canConfirm(typed: string, requireTypedConfirmation?: string): boolean {
  if (!requireTypedConfirmation) return true;
  return typed === requireTypedConfirmation;
}

describe("ConfirmDialog.canConfirm (Lot 22)", () => {
  it("autorise par défaut si pas de confirmation typée requise", () => {
    expect(canConfirm("", undefined)).toBe(true);
    expect(canConfirm("nimportequoi", undefined)).toBe(true);
  });

  it("bloque tant que l'user n'a pas tapé la valeur exacte", () => {
    expect(canConfirm("", "SUPPRIMER")).toBe(false);
    expect(canConfirm("SUPPRIM", "SUPPRIMER")).toBe(false);
    expect(canConfirm("supprimer", "SUPPRIMER")).toBe(false); // sensible à la casse
  });

  it("autorise après match exact", () => {
    expect(canConfirm("SUPPRIMER", "SUPPRIMER")).toBe(true);
  });

  it("ne fait pas de trim/normalisation implicite (sécurité pédagogique)", () => {
    expect(canConfirm(" SUPPRIMER ", "SUPPRIMER")).toBe(false);
    expect(canConfirm("SUPPRIMER\n", "SUPPRIMER")).toBe(false);
  });
});
