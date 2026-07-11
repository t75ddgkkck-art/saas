/**
 * Lot 37 — Tests vitrine personalization (fonts + presets + sections + sanitizer).
 */

import { describe, expect, it } from "vitest";
import {
  FONT_OPTIONS,
  getFontById,
  COLOR_PRESETS,
  suggestPresetForCategory,
  VITRINE_SECTIONS,
  DEFAULT_SECTION_ORDER,
  normalizeSectionOrder,
  sanitizeCustomCss,
} from "@/lib/vitrine-personalization";

describe("FONT_OPTIONS", () => {
  it("expose 10 fonts curated", () => {
    expect(FONT_OPTIONS).toHaveLength(10);
  });

  it("chaque font a stack + category + description", () => {
    for (const f of FONT_OPTIONS) {
      expect(f.id.length).toBeGreaterThan(0);
      expect(f.stack.length).toBeGreaterThan(0);
      expect(["sans-serif", "serif", "display", "monospace"]).toContain(f.category);
      expect(f.description.length).toBeGreaterThan(0);
    }
  });

  it("ids uniques (pas de collision)", () => {
    const ids = FONT_OPTIONS.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("getFontById", () => {
  it("renvoie la font demandée", () => {
    expect(getFontById("poppins").id).toBe("poppins");
  });
  it("fallback inter si inconnu", () => {
    expect(getFontById("unknown-font").id).toBe("inter");
    expect(getFontById(null).id).toBe("inter");
    expect(getFontById(undefined).id).toBe("inter");
  });
});

describe("COLOR_PRESETS", () => {
  it("16 presets (dont custom)", () => {
    expect(COLOR_PRESETS.length).toBeGreaterThan(10);
  });

  it("chaque preset a 3 couleurs hex valides", () => {
    for (const p of COLOR_PRESETS) {
      expect(p.primary).toMatch(/^#[0-9a-f]{6}$/i);
      expect(p.secondary).toMatch(/^#[0-9a-f]{6}$/i);
      expect(p.accent).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it("preset 'custom' présent en dernier", () => {
    expect(COLOR_PRESETS[COLOR_PRESETS.length - 1].id).toBe("custom");
  });
});

describe("suggestPresetForCategory", () => {
  it("plombier → preset bleu", () => {
    expect(suggestPresetForCategory("Plombier").id).toBe("plumber-blue");
    expect(suggestPresetForCategory("plomberie").id).toBe("plumber-blue");
  });

  it("coiffeur → preset rose", () => {
    expect(suggestPresetForCategory("Coiffeur").id).toBe("hairdresser-pink");
    expect(suggestPresetForCategory("salon de coiffure").id).toBe("hairdresser-pink");
  });

  it("restaurant → preset rouge", () => {
    expect(suggestPresetForCategory("restaurant").id).toBe("restaurant-red");
    expect(suggestPresetForCategory("Traiteur").id).toBe("restaurant-red");
  });

  it("avocat → preset bordeaux", () => {
    expect(suggestPresetForCategory("Avocat").id).toBe("lawyer-burgundy");
    expect(suggestPresetForCategory("notaire").id).toBe("lawyer-burgundy");
  });

  it("catégorie inconnue non-null → preset 'custom' (dernier de la liste)", () => {
    expect(suggestPresetForCategory("métier bizarre inconnu").id).toBe("custom");
  });

  it("null / undefined → premier preset (fallback safe, non 'custom')", () => {
    // Défaut = COLOR_PRESETS[0] qui est plumber-blue (choix arbitraire du 1er)
    expect(suggestPresetForCategory(null).id).toBe("plumber-blue");
    expect(suggestPresetForCategory(undefined).id).toBe("plumber-blue");
  });
});

describe("VITRINE_SECTIONS", () => {
  it("expose 8 sections dont hero + contact obligatoires", () => {
    expect(VITRINE_SECTIONS.length).toBe(8);
    const required = VITRINE_SECTIONS.filter((s) => s.required);
    expect(required.map((r) => r.id).sort()).toEqual(["contact", "hero"]);
  });

  it("DEFAULT_SECTION_ORDER contient toutes les sections sauf 'menu'", () => {
    // menu est spécifique aux restaurants (opt-in explicite via UI)
    expect(DEFAULT_SECTION_ORDER).not.toContain("menu");
    // Toutes les autres présentes
    for (const s of VITRINE_SECTIONS) {
      if (s.id === "menu") continue;
      expect(DEFAULT_SECTION_ORDER).toContain(s.id);
    }
  });
});

describe("normalizeSectionOrder", () => {
  it("null → ordre par défaut", () => {
    expect(normalizeSectionOrder(null)).toEqual(DEFAULT_SECTION_ORDER);
    expect(normalizeSectionOrder(undefined)).toEqual(DEFAULT_SECTION_ORDER);
    expect(normalizeSectionOrder([])).toEqual(DEFAULT_SECTION_ORDER);
  });

  it("filtre les IDs inconnus (protection DB corrompue)", () => {
    const result = normalizeSectionOrder(["hero", "xxx-inconnu", "contact"]);
    expect(result).not.toContain("xxx-inconnu");
    expect(result[0]).toBe("hero");
  });

  it("ajoute les sections manquantes à la fin", () => {
    const result = normalizeSectionOrder(["contact", "hero"]);
    // hero + contact en premier, puis le reste ajouté à la fin
    expect(result[0]).toBe("contact");
    expect(result[1]).toBe("hero");
    // services, gallery, etc. présents à la fin
    expect(result).toContain("services");
    expect(result).toContain("gallery");
    expect(result).toContain("reviews");
  });

  it("préserve l'ordre custom pour les sections valides", () => {
    const result = normalizeSectionOrder(["gallery", "hero", "faq", "contact"]);
    expect(result.slice(0, 4)).toEqual(["gallery", "hero", "faq", "contact"]);
  });
});

describe("sanitizeCustomCss", () => {
  it("null/undefined/vide → ''", () => {
    expect(sanitizeCustomCss(null)).toBe("");
    expect(sanitizeCustomCss(undefined)).toBe("");
    expect(sanitizeCustomCss("")).toBe("");
  });

  it("CSS normal passé tel quel", () => {
    const css = ".hero { border-radius: 24px; padding: 20px; }";
    expect(sanitizeCustomCss(css)).toBe(css);
  });

  it("bloque @import (chargement CSS externe)", () => {
    const css = "@import url('https://evil.com/track.css'); .hero { color: red; }";
    const sanitized = sanitizeCustomCss(css);
    expect(sanitized).not.toContain("@import");
    expect(sanitized).toContain(".hero");
  });

  it("bloque url() externes http/https/data/javascript", () => {
    const cases = [
      "background: url('https://evil.com/x.png');",
      'background: url("http://evil.com");',
      "background: url(data:image/png;base64,xxx);",
      "background: url(javascript:alert(1));",
    ];
    for (const c of cases) {
      expect(sanitizeCustomCss(c)).not.toMatch(/url\s*\(\s*['"]?\s*(?:https?:|data:|javascript:)/i);
    }
  });

  it("bloque expression() (IE legacy XSS)", () => {
    const css = ".hero { width: expression(alert(1)); }";
    expect(sanitizeCustomCss(css)).not.toContain("expression(");
  });

  it("bloque javascript: URIs", () => {
    const css = ".hero { background: javascript:alert(1); }";
    expect(sanitizeCustomCss(css).toLowerCase()).not.toContain("javascript:");
  });

  it("bloque <script>", () => {
    const css = "<script>alert(1)</script>";
    const sanitized = sanitizeCustomCss(css);
    expect(sanitized.toLowerCase()).not.toContain("<script");
    expect(sanitized.toLowerCase()).not.toContain("</script");
  });

  it("cap à 20 KB → renvoie chaîne vide au-delà", () => {
    const huge = "a".repeat(20 * 1024 + 1);
    expect(sanitizeCustomCss(huge)).toBe("");
    const ok = "a".repeat(20 * 1024);
    expect(sanitizeCustomCss(ok)).toBe(ok);
  });
});
