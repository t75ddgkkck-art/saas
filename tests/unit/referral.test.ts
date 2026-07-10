import { describe, it, expect } from "vitest";
import { generateReferralCode } from "../../src/lib/referral";

describe("referral (Lot 16.3)", () => {
  it("generateReferralCode produit un format VX-XXXXXX", () => {
    const code = generateReferralCode();
    expect(code).toMatch(/^VX-[0-9A-Z]{6}$/);
  });

  it("generateReferralCode produit des codes différents à chaque appel", () => {
    const codes = new Set<string>();
    for (let i = 0; i < 20; i++) codes.add(generateReferralCode());
    // Sur 20 tirages parmi 32^6 = 1 milliard : la proba de collision est ~0
    expect(codes.size).toBe(20);
  });

  it("les caractères ambigus (I, O, L, U) sont exclus", () => {
    for (let i = 0; i < 50; i++) {
      const code = generateReferralCode();
      expect(code).not.toMatch(/[ILOU]/);
    }
  });
});
