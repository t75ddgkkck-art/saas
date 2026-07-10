import { describe, it, expect } from "vitest";
import {
  clampText,
  clampTitle,
  clampDescription,
  buildBusinessTitle,
  buildBusinessDescription,
} from "@/lib/seo";
import { generateUniqueSlug, slugify } from "@/lib/utils";

describe("SEO — clampText", () => {
  it("laisse passer les textes courts intacts", () => {
    expect(clampText("Hello", 20)).toBe("Hello");
  });

  it("tronque sur une frontière de mot avec ellipsis", () => {
    const s = clampText("Bonjour tout le monde comment allez-vous", 20);
    expect(s.length).toBeLessThanOrEqual(20);
    expect(s.endsWith("…")).toBe(true);
    // Aucune fin de mot coupée : le dernier "mot" avant … est complet
    expect(s.split(" ").slice(-1)[0].replace("…", "")).toMatch(/^[A-Za-zÀ-ÿ-]*$/);
  });

  it("normalise les espaces multiples", () => {
    expect(clampText("  a   b   c ", 20)).toBe("a b c");
  });
});

describe("SEO — clampTitle / clampDescription", () => {
  it("titre respecte la limite Google (60 chars)", () => {
    const long =
      "Plomberie Dupont Père et Fils — Électricien Chauffagiste à Paris 15ème Arrondissement";
    expect(clampTitle(long).length).toBeLessThanOrEqual(60);
  });

  it("description respecte la limite Google (155 chars)", () => {
    const long =
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco.";
    expect(clampDescription(long).length).toBeLessThanOrEqual(155);
  });
});

describe("SEO — buildBusinessTitle", () => {
  it("format 'Nom — Catégorie à Ville'", () => {
    const t = buildBusinessTitle({
      name: "Ambiance Services",
      category: "plombier",
      city: "Rennes",
    });
    expect(t).toContain("Ambiance Services");
    expect(t).toContain("Plombier");
    expect(t).toContain("Rennes");
  });

  it("omet la ville si absente", () => {
    const t = buildBusinessTitle({ name: "Ambiance Services", category: "peintre", city: null });
    expect(t).toContain("Peintre");
    expect(t).not.toContain(" à ");
  });
});

describe("SEO — buildBusinessDescription", () => {
  it("utilise la description du pro si elle est suffisamment riche", () => {
    const d = buildBusinessDescription({
      name: "Toto Plomberie",
      description:
        "Spécialiste dépannage d'urgence 24h/24, installation de chaudières haute performance et rénovation complète de salles de bain sur mesure.",
      category: "plombier",
      city: "Lyon",
    });
    expect(d).toContain("Toto Plomberie");
    expect(d).toContain("Lyon");
    expect(d.length).toBeLessThanOrEqual(155);
  });

  it("fallback métier si description trop courte", () => {
    const d = buildBusinessDescription({
      name: "Coiffure Anna",
      description: "Coiffeuse",
      category: "coiffeur",
      city: "Bordeaux",
    });
    expect(d).toContain("Coiffure Anna");
    expect(d).toContain("Coiffeur");
    // Le hook coiffeur doit apparaître
    expect(d.toLowerCase()).toMatch(/coupe|coloration|rendez-vous/);
  });

  it("ajoute la note si présente", () => {
    const d = buildBusinessDescription({
      name: "Plomberie Dupont",
      description: null,
      category: "plombier",
      city: "Rennes",
      avgRating: 4.7,
      reviewsCount: 42,
    });
    expect(d).toContain("4.7");
    expect(d).toContain("42 avis");
  });
});

describe("utils — generateUniqueSlug", () => {
  it("retourne le slug de base s'il est libre", async () => {
    const s = await generateUniqueSlug("Plomberie Dupont", async () => false);
    expect(s).toBe("plomberie-dupont");
  });

  it("essaie -2 -3 -4 ... si collision", async () => {
    let calls = 0;
    const taken = new Set(["plomberie-dupont", "plomberie-dupont-2"]);
    const s = await generateUniqueSlug("Plomberie Dupont", async (c) => {
      calls++;
      return taken.has(c);
    });
    expect(s).toBe("plomberie-dupont-3");
    expect(calls).toBe(3);
  });

  it("slugify basique", () => {
    expect(slugify("Éric & Fils")).toBe("eric-fils");
    expect(slugify("PLOMBERIE-DUPONT !")).toBe("plomberie-dupont");
  });
});
