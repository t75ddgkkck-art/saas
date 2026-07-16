/**
 * Lot 47 (F12) — Tests helpers URL trackée QR codes.
 *
 * Focus sur logique PURE (pas de mock DB, pas de fetch réseau).
 * Vérifie cohérence avec `detectSource()` (visitor-hash.ts) qui accepte
 * [a-z0-9-]+ uniquement pour le paramètre `?src=`.
 */

import { describe, expect, it } from "vitest";
import { slugifySource, buildTrackedUrl, validateSource } from "@/lib/qr-tracking";

// ---------------------------------------------------------------------------
// slugifySource
// ---------------------------------------------------------------------------

describe("slugifySource", () => {
  it("lowercase + espaces → tirets", () => {
    expect(slugifySource("Carte de visite")).toBe("carte-de-visite");
  });

  it("supprime les accents (normalisation NFD)", () => {
    expect(slugifySource("Épinière")).toBe("epiniere");
    expect(slugifySource("Café à emporter")).toBe("cafe-a-emporter");
  });

  it("supprime les caractères spéciaux (!, ?, /, etc.)", () => {
    expect(slugifySource("Flyer !!! avril?")).toBe("flyer-avril");
  });

  it("collapse les tirets multiples", () => {
    expect(slugifySource("test---multi--tirets")).toBe("test-multi-tirets");
  });

  it("trim les tirets début/fin", () => {
    expect(slugifySource("-test-")).toBe("test");
    expect(slugifySource("---")).toBe("");
  });

  it("cap à 50 caractères max", () => {
    const long = "a".repeat(100);
    expect(slugifySource(long).length).toBe(50);
  });

  it("chaîne vide → chaîne vide", () => {
    expect(slugifySource("")).toBe("");
  });

  it("underscores devienent tirets (cohérence detectSource)", () => {
    expect(slugifySource("carte_visite_pro")).toBe("carte-visite-pro");
  });

  it("caractères asiatiques / emoji retirés", () => {
    expect(slugifySource("café 🚀 rocket")).toBe("cafe-rocket");
  });
});

// ---------------------------------------------------------------------------
// validateSource
// ---------------------------------------------------------------------------

describe("validateSource", () => {
  it("source valide → null (pas d'erreur)", () => {
    expect(validateSource("carte-visite")).toBeNull();
    expect(validateSource("flyer2026")).toBeNull();
  });

  it("source vide → erreur", () => {
    expect(validateSource("")).toContain("caractère");
    expect(validateSource("   ")).toContain("caractère");
    expect(validateSource("!!!")).toContain("caractère");
  });

  it("source avec seulement des accents → erreur (deviennent vide après normalize)", () => {
    // "éà" → "ea" → OK (2 chars valides)
    expect(validateSource("éà")).toBeNull();
    // "!!" → "" → erreur
    expect(validateSource("!!")).toContain("caractère");
  });
});

// ---------------------------------------------------------------------------
// buildTrackedUrl
// ---------------------------------------------------------------------------

describe("buildTrackedUrl", () => {
  it("URL absolue + source basique", () => {
    const url = buildTrackedUrl("https://vitrix.fr/dupont-plomberie", {
      source: "carte-visite",
    });
    const parsed = new URL(url);
    expect(parsed.searchParams.get("src")).toBe("carte-visite");
    expect(parsed.searchParams.get("utm_source")).toBe("qr");
    expect(parsed.searchParams.get("utm_medium")).toBe("qr");
  });

  it("utm_campaign optionnel — ajouté si fourni", () => {
    const url = buildTrackedUrl("https://vitrix.fr/dupont", {
      source: "flyer",
      utmCampaign: "printemps-2026",
    });
    const parsed = new URL(url);
    expect(parsed.searchParams.get("utm_campaign")).toBe("printemps-2026");
  });

  it("utm_campaign absent (null) — pas dans l'URL", () => {
    const url = buildTrackedUrl("https://vitrix.fr/dupont", {
      source: "flyer",
      utmCampaign: null,
    });
    const parsed = new URL(url);
    expect(parsed.searchParams.has("utm_campaign")).toBe(false);
  });

  it("utm_medium custom override le défaut 'qr'", () => {
    const url = buildTrackedUrl("https://vitrix.fr/dupont", {
      source: "flyer",
      utmMedium: "print",
    });
    const parsed = new URL(url);
    expect(parsed.searchParams.get("utm_medium")).toBe("print");
    // utm_source RESTE fixe "qr" (par design — c'est la marque du canal QR)
    expect(parsed.searchParams.get("utm_source")).toBe("qr");
  });

  it("utm_content ajouté si fourni", () => {
    const url = buildTrackedUrl("https://vitrix.fr/dupont", {
      source: "flyer",
      utmContent: "flyer-a5-recto",
    });
    const parsed = new URL(url);
    expect(parsed.searchParams.get("utm_content")).toBe("flyer-a5-recto");
  });

  it("URL avec query params existants — préservés + ajout des UTM", () => {
    const url = buildTrackedUrl("https://vitrix.fr/dupont?ref=partner", {
      source: "carte",
    });
    const parsed = new URL(url);
    expect(parsed.searchParams.get("ref")).toBe("partner");
    expect(parsed.searchParams.get("src")).toBe("carte");
  });

  it("URL trailing slash respecté", () => {
    const url = buildTrackedUrl("https://vitrix.fr/dupont/", { source: "carte" });
    expect(url).toContain("/dupont/?");
  });

  it("tous les UTM ensemble = URL complète standard GA/Matomo", () => {
    const url = buildTrackedUrl("https://vitrix.fr/dupont", {
      source: "flyer",
      utmCampaign: "printemps",
      utmMedium: "print",
      utmContent: "a5-recto",
    });
    const parsed = new URL(url);
    expect(parsed.searchParams.get("src")).toBe("flyer");
    expect(parsed.searchParams.get("utm_source")).toBe("qr");
    expect(parsed.searchParams.get("utm_medium")).toBe("print");
    expect(parsed.searchParams.get("utm_campaign")).toBe("printemps");
    expect(parsed.searchParams.get("utm_content")).toBe("a5-recto");
  });
});

// ---------------------------------------------------------------------------
// Cohérence slugify + build (chaîne complète)
// ---------------------------------------------------------------------------

describe("intégration slugify + build", () => {
  it("un label humain → source slugifiée → URL propre", () => {
    const rawLabel = "Carte de visite avril 2026 !";
    const source = slugifySource(rawLabel);
    expect(source).toBe("carte-de-visite-avril-2026");
    const url = buildTrackedUrl("https://vitrix.fr/dupont", { source });
    const parsed = new URL(url);
    // Vérif : la source stockée dans ?src= est bien celle qui matchera
    // `detectSource()` côté visitor-hash.ts (accepte [a-z0-9-]+)
    expect(parsed.searchParams.get("src")).toMatch(/^[a-z0-9-]+$/);
  });
});
