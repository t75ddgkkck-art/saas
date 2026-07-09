import { describe, it, expect } from "vitest";
import { slugify, formatPrice, generateQuoteNumber } from "@/lib/utils";
import { isValidEmail, isValidFrenchPhone, normalizePhone } from "@/lib/validation";

describe("slugify", () => {
  it("gère les accents et espaces", () => {
    expect(slugify("Plombier à Paris")).toBe("plombier-a-paris");
    expect(slugify("  Éric  Léon  ")).toBe("eric-leon");
  });
  it("supprime les caractères spéciaux", () => {
    expect(slugify("Coiffeur & Barbier #1")).toBe("coiffeur-barbier-1");
  });
  it("ne renvoie pas de tiret initial/final", () => {
    expect(slugify("---test---")).toBe("test");
  });
});

describe("formatPrice", () => {
  it("formate en euros par défaut", () => {
    expect(formatPrice(12.5)).toBe("12.50 €");
    expect(formatPrice(0)).toBe("0.00 €");
  });
});

describe("generateQuoteNumber", () => {
  it("respecte le format DEV-AAAA-NNNN", () => {
    const n = generateQuoteNumber();
    expect(n).toMatch(/^DEV-\d{4}-\d{4}$/);
  });
});

describe("isValidEmail", () => {
  it.each([
    ["a@b.c", true],
    ["user.name+tag@sub.example.com", true],
    ["notanemail", false],
    ["missing@tld", false],
    ["@missing.local", false],
  ])("valide %s -> %s", (e, ok) => {
    expect(isValidEmail(e)).toBe(ok);
  });
});

describe("téléphone français", () => {
  it("normalise", () => {
    expect(normalizePhone("06 12 34 56 78")).toBe("0612345678");
    expect(normalizePhone("+33 6 12-34-56.78")).toBe("+33612345678");
  });
  it("valide format FR", () => {
    expect(isValidFrenchPhone("06 12 34 56 78")).toBe(true);
    expect(isValidFrenchPhone("+33612345678")).toBe(true);
    expect(isValidFrenchPhone("0012345678")).toBe(false);
    expect(isValidFrenchPhone("12345")).toBe(false);
  });
});
