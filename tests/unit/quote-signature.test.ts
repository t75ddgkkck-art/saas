/**
 * F8 (Lot 38) — Tests signature devis (hash + fingerprint + token).
 */

import { describe, expect, it } from "vitest";
import {
  generateSignatureRawToken,
  hashSignatureToken,
  computeSignatureHash,
  computeItemsFingerprint,
  buildSignatureUrl,
} from "@/lib/quote-signature";

describe("generateSignatureRawToken", () => {
  it("64 chars hex", () => {
    expect(generateSignatureRawToken()).toMatch(/^[0-9a-f]{64}$/);
  });
  it("unicité forte", () => {
    const s = new Set<string>();
    for (let i = 0; i < 50; i++) s.add(generateSignatureRawToken());
    expect(s.size).toBe(50);
  });
});

describe("hashSignatureToken", () => {
  it("SHA-256 hex 64 chars, déterministe", () => {
    const t = "a".repeat(64);
    const h1 = hashSignatureToken(t);
    const h2 = hashSignatureToken(t);
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("computeItemsFingerprint", () => {
  it("ordre stable (trié par description)", () => {
    const a = [
      { description: "Zeta", quantity: 1, unitPrice: 10 },
      { description: "Alpha", quantity: 2, unitPrice: 20 },
    ];
    const b = [
      { description: "Alpha", quantity: 2, unitPrice: 20 },
      { description: "Zeta", quantity: 1, unitPrice: 10 },
    ];
    expect(computeItemsFingerprint(a)).toBe(computeItemsFingerprint(b));
  });

  it("change si qty change", () => {
    const a = [{ description: "X", quantity: 1, unitPrice: 10 }];
    const b = [{ description: "X", quantity: 2, unitPrice: 10 }];
    expect(computeItemsFingerprint(a)).not.toBe(computeItemsFingerprint(b));
  });

  it("change si prix change", () => {
    const a = [{ description: "X", quantity: 1, unitPrice: 10 }];
    const b = [{ description: "X", quantity: 1, unitPrice: 11 }];
    expect(computeItemsFingerprint(a)).not.toBe(computeItemsFingerprint(b));
  });

  it("supporte string ou number pour quantity/unitPrice", () => {
    const a = [{ description: "X", quantity: 1, unitPrice: 10 }];
    const b = [{ description: "X", quantity: "1", unitPrice: "10" }];
    expect(computeItemsFingerprint(a)).toBe(computeItemsFingerprint(b));
  });
});

describe("computeSignatureHash", () => {
  const base = {
    quoteId: "q-1",
    total: "150.00",
    itemsFingerprint: "X|1|150",
    signedByEmail: "user@example.com",
    signedAt: "2026-08-15T10:00:00.000Z",
    signedIp: "1.2.3.4",
    signedUserAgent: "Mozilla/5.0",
  };

  it("déterministe (mêmes inputs = même hash)", () => {
    const h1 = computeSignatureHash(base);
    const h2 = computeSignatureHash(base);
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
  });

  it("change si total change (integrity → fraude détectée)", () => {
    const h1 = computeSignatureHash(base);
    const h2 = computeSignatureHash({ ...base, total: "999.00" });
    expect(h1).not.toBe(h2);
  });

  it("change si items change (fingerprint différent)", () => {
    const h1 = computeSignatureHash(base);
    const h2 = computeSignatureHash({ ...base, itemsFingerprint: "Y|2|200" });
    expect(h1).not.toBe(h2);
  });

  it("insensible à la casse email (normalise lowercase)", () => {
    const h1 = computeSignatureHash({ ...base, signedByEmail: "user@example.com" });
    const h2 = computeSignatureHash({ ...base, signedByEmail: "USER@EXAMPLE.COM" });
    expect(h1).toBe(h2);
  });

  it("tronque IP à 45 chars", () => {
    // IPv6 max = 39 chars, mais on cap à 45 pour préfixe "::ffff:" mapped
    const long = "x".repeat(200);
    const h = computeSignatureHash({ ...base, signedIp: long });
    // Devrait générer un hash (pas de throw)
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });

  it("tronque userAgent à 500 chars", () => {
    const long = "u".repeat(2000);
    const h = computeSignatureHash({ ...base, signedUserAgent: long });
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("buildSignatureUrl", () => {
  it("construit une URL avec le token en path", () => {
    const url = buildSignatureUrl("a".repeat(64));
    expect(url).toContain("/devis/");
    expect(url).toContain("a".repeat(64));
    expect(url).toMatch(/^https?:\/\//);
  });
});
