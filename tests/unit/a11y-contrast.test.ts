import { describe, it, expect } from "vitest";

/**
 * Vérifie que les couleurs "brand" choisies dans le ColorPicker respectent
 * WCAG AA (≥ 4.5:1) sur fond blanc. Sécurité contre une régression accidentelle
 * dans la palette suggérée.
 */

const SUGGESTED_COLORS = [
  "#0f172a", // Bleu marine
  "#3730a3", // Indigo
  "#1d4ed8", // Bleu roi
  "#047857", // Émeraude
  "#166534", // Forêt
  "#991b1b", // Bordeaux
  "#c2410c", // Orange
  "#6d28d9", // Violet
  "#be185d", // Rose
  "#475569", // Slate
];

function ratio(hex: string, against = "#ffffff"): number {
  const parse = (h: string): [number, number, number] => {
    const c = h.replace("#", "");
    return [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)];
  };
  const lum = (rgb: [number, number, number]) => {
    const [r, g, b] = rgb.map((v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    }) as [number, number, number];
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const l1 = lum(parse(hex));
  const l2 = lum(parse(against));
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

describe("Accessibility — palette suggérée", () => {
  it.each(SUGGESTED_COLORS)("%s a un contraste ≥ 4.5:1 avec du texte blanc (WCAG AA)", (color) => {
    const r = ratio(color, "#ffffff");
    expect(r).toBeGreaterThanOrEqual(4.5);
  });

  it("le noir a un contraste maximal avec le blanc", () => {
    expect(ratio("#000000", "#ffffff")).toBeCloseTo(21, 0);
  });

  it("détecte un contraste insuffisant (jaune sur blanc)", () => {
    expect(ratio("#facc15", "#ffffff")).toBeLessThan(4.5);
  });
});
