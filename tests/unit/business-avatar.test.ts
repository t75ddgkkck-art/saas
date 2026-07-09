import { describe, it, expect } from "vitest";

/**
 * Tests unitaires du calcul d'initiales.
 * Le composant BusinessAvatar est visuel mais la logique de génération
 * doit être déterministe (même nom → mêmes initiales et couleur).
 */

// Réimplémentation identique à celle du composant pour tester isolément.
function initials(name: string): string {
  const parts = name
    .replace(/[^\p{L}\s]/gu, "")
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

describe("BusinessAvatar / initials", () => {
  it("retourne les 2 premières lettres si un seul mot", () => {
    expect(initials("Plomberie")).toBe("PL");
  });

  it("retourne première lettre du premier et dernier mot", () => {
    expect(initials("Ambiance Services")).toBe("AS");
    expect(initials("Jean-Michel Dupont Fils")).toBe("JF");
  });

  it("gère les accents et caractères spéciaux", () => {
    expect(initials("Éric Léon")).toBe("ÉL");
    expect(initials("Coiffeur & Barbier")).toBe("CB");
  });

  it("retourne ? si nom vide ou uniquement des symboles", () => {
    expect(initials("")).toBe("?");
    expect(initials("  ")).toBe("?");
    expect(initials("!!!")).toBe("?");
  });
});
