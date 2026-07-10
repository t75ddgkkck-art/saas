import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { generateApiKey, hashApiKey, extractApiKey } from "../../src/lib/api-keys";

describe("api-keys (Lot 16.4)", () => {
  it("generateApiKey (live) produit une clé au bon format", () => {
    const { rawKey, keyPrefix, keyHash } = generateApiKey("live");
    expect(rawKey).toMatch(/^vx_live_[0-9A-Z]{24}$/);
    expect(keyPrefix).toBe(rawKey.slice(0, 12));
    expect(keyPrefix).toMatch(/^vx_live_[0-9A-Z]{4}$/);
    // SHA-256 hex = 64 chars
    expect(keyHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("generateApiKey (test) produit une clé avec préfixe test", () => {
    const { rawKey } = generateApiKey("test");
    expect(rawKey).toMatch(/^vx_test_/);
  });

  it("hashApiKey est déterministe pour la même entrée", () => {
    const h1 = hashApiKey("vx_live_ABCD1234EFGH5678IJKL");
    const h2 = hashApiKey("vx_live_ABCD1234EFGH5678IJKL");
    expect(h1).toBe(h2);
    // Un caractère de différence change tout le hash
    const h3 = hashApiKey("vx_live_ABCD1234EFGH5678IJKM");
    expect(h1).not.toBe(h3);
  });

  it("extractApiKey lit le header Authorization Bearer", () => {
    const req = new NextRequest("http://localhost/x", {
      headers: { authorization: "Bearer vx_live_ABCDEFG" },
    });
    expect(extractApiKey(req)).toBe("vx_live_ABCDEFG");
  });

  it("extractApiKey lit le header X-Api-Key en fallback", () => {
    const req = new NextRequest("http://localhost/x", {
      headers: { "x-api-key": "vx_live_XYZ" },
    });
    expect(extractApiKey(req)).toBe("vx_live_XYZ");
  });

  it("extractApiKey retourne null si aucun header", () => {
    const req = new NextRequest("http://localhost/x");
    expect(extractApiKey(req)).toBeNull();
  });

  it("les clés sont uniques à chaque génération", () => {
    const s = new Set<string>();
    for (let i = 0; i < 20; i++) s.add(generateApiKey().rawKey);
    expect(s.size).toBe(20);
  });
});
