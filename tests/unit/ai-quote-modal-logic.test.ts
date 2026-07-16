/**
 * Lot 45 — Tests des helpers de la modal AI Generate.
 *
 * On teste UNIQUEMENT les fonctions pures utilisées côté client :
 *  - Le mapping AiGeneratedItem → NewQuoteItem (append du unit dans description)
 *  - La stratégie replace vs append (edge cases : lignes vides existantes)
 *
 * La modal React elle-même n'est pas testée ici (composants React = P2 audit V5,
 * pas encore couverts sans @testing-library/react).
 */

import { describe, expect, it } from "vitest";

// -----------------------------------------------------------------------------
// Réimplémentation locale des fonctions helper à tester
// (on évite de les exporter juste pour les tests → design volontairement local
//  côté page.tsx. On les re-teste isolées ici pour prouver la logique)
// -----------------------------------------------------------------------------

interface NewQuoteItem {
  description: string;
  quantity: number;
  unitPrice: number;
}

interface AiGeneratedItem {
  description: string;
  quantity: number;
  unit_price: number;
  unit?: string;
}

/** Copie EXACTE de la logique de src/app/dashboard/quotes/page.tsx `mergeDescription`. */
function mergeDescription(existing: string, aiNotes: string | null): string {
  const trimmed = existing.trim();
  if (!aiNotes) return existing;
  if (!trimmed) return aiNotes;
  return `${trimmed}\n\n---\n${aiNotes}`;
}

/** Copie EXACTE de la logique de mapping IA → form (applyAiGenerated). */
function mapAiItemsToForm(items: AiGeneratedItem[]): NewQuoteItem[] {
  return items.map((it) => ({
    description: it.description + (it.unit ? ` (${it.unit})` : ""),
    quantity: it.quantity,
    unitPrice: it.unit_price,
  }));
}

/** Simule la logique "replace / append" du parent. */
function computeFormItems(
  previousItems: NewQuoteItem[],
  aiItems: AiGeneratedItem[],
  mode: "replace" | "append"
): NewQuoteItem[] {
  const newItems = mapAiItemsToForm(aiItems);
  const EMPTY: NewQuoteItem = { description: "", quantity: 1, unitPrice: 0 };

  if (mode === "replace") {
    return newItems.length > 0 ? newItems : [{ ...EMPTY }];
  }
  return [
    ...previousItems.filter((it) => it.description.trim() || it.unitPrice > 0),
    ...newItems,
  ];
}

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

describe("mergeDescription", () => {
  it("existing vide + notes IA → renvoie juste les notes", () => {
    expect(mergeDescription("", "Notes IA générées")).toBe("Notes IA générées");
    expect(mergeDescription("   ", "Notes IA générées")).toBe("Notes IA générées");
  });

  it("existing rempli + notes IA null → renvoie existing intact", () => {
    expect(mergeDescription("Description du pro", null)).toBe("Description du pro");
  });

  it("existing rempli + notes IA → concatène avec séparateur", () => {
    const result = mergeDescription("Description du pro", "Notes IA");
    expect(result).toBe("Description du pro\n\n---\nNotes IA");
  });

  it("existing vide + notes IA null → renvoie chaîne vide (pas de crash)", () => {
    expect(mergeDescription("", null)).toBe("");
  });

  it("trimme l'existing avant fusion (whitespace ne compte pas)", () => {
    // "   " est considéré comme vide, donc on ne préserve pas les espaces
    const result = mergeDescription("   ", "Notes IA");
    expect(result).toBe("Notes IA");
  });
});

describe("mapAiItemsToForm", () => {
  it("mappe unit_price → unitPrice sans conflit", () => {
    const [item] = mapAiItemsToForm([
      { description: "Pose carrelage", quantity: 5, unit_price: 45.5 },
    ]);
    expect(item).toEqual({
      description: "Pose carrelage",
      quantity: 5,
      unitPrice: 45.5,
    });
  });

  it("append le unit dans la description (m², h, kg, ...) pour clarté", () => {
    const [item] = mapAiItemsToForm([
      { description: "Pose carrelage", quantity: 5, unit_price: 45.5, unit: "m²" },
    ]);
    expect(item.description).toBe("Pose carrelage (m²)");
  });

  it("pas de unit → pas de suffixe", () => {
    const [item] = mapAiItemsToForm([
      { description: "Main d'œuvre", quantity: 8, unit_price: 55 },
    ]);
    expect(item.description).toBe("Main d'œuvre");
  });

  it("liste vide → tableau vide", () => {
    expect(mapAiItemsToForm([])).toEqual([]);
  });
});

describe("computeFormItems - replace mode", () => {
  it("replace : écrase les lignes existantes", () => {
    const previous: NewQuoteItem[] = [
      { description: "Ancienne ligne", quantity: 1, unitPrice: 100 },
    ];
    const ai: AiGeneratedItem[] = [
      { description: "Nouvelle IA 1", quantity: 2, unit_price: 50 },
      { description: "Nouvelle IA 2", quantity: 3, unit_price: 75 },
    ];
    const result = computeFormItems(previous, ai, "replace");
    expect(result).toHaveLength(2);
    expect(result[0].description).toBe("Nouvelle IA 1");
  });

  it("replace mais IA renvoie 0 lignes → ligne vide de safety", () => {
    const previous: NewQuoteItem[] = [
      { description: "Existant", quantity: 1, unitPrice: 100 },
    ];
    const result = computeFormItems(previous, [], "replace");
    expect(result).toHaveLength(1);
    expect(result[0].description).toBe("");
    expect(result[0].quantity).toBe(1);
  });
});

describe("computeFormItems - append mode", () => {
  it("append : ajoute les lignes IA à la suite des existantes", () => {
    const previous: NewQuoteItem[] = [
      { description: "Existante", quantity: 1, unitPrice: 100 },
    ];
    const ai: AiGeneratedItem[] = [
      { description: "IA ajoutée", quantity: 2, unit_price: 50 },
    ];
    const result = computeFormItems(previous, ai, "append");
    expect(result).toHaveLength(2);
    expect(result[0].description).toBe("Existante");
    expect(result[1].description).toBe("IA ajoutée");
  });

  it("append : filtre les lignes existantes VIDES (description trim + prix 0)", () => {
    const previous: NewQuoteItem[] = [
      { description: "Existante", quantity: 1, unitPrice: 100 },
      { description: "", quantity: 1, unitPrice: 0 }, // ligne vide typique
      { description: "   ", quantity: 1, unitPrice: 0 }, // whitespace only
    ];
    const ai: AiGeneratedItem[] = [
      { description: "IA", quantity: 1, unit_price: 20 },
    ];
    const result = computeFormItems(previous, ai, "append");
    // Doit rester : Existante + IA (les 2 lignes vides sautent)
    expect(result).toHaveLength(2);
    expect(result[0].description).toBe("Existante");
    expect(result[1].description).toBe("IA");
  });

  it("append : garde une ligne vide SI elle a un prix (edge case bizarre mais valide)", () => {
    const previous: NewQuoteItem[] = [
      { description: "", quantity: 1, unitPrice: 50 }, // prix > 0 même si desc vide
    ];
    const ai: AiGeneratedItem[] = [
      { description: "IA", quantity: 1, unit_price: 20 },
    ];
    const result = computeFormItems(previous, ai, "append");
    expect(result).toHaveLength(2);
  });
});
