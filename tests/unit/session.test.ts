import { describe, it, expect, beforeEach } from "vitest";

// On force un secret prévisible AVANT d'importer le module.
process.env.NEXTAUTH_SECRET = "test-secret-must-be-at-least-16-chars-long";

// Import après avoir posé la variable d'env
const { createSessionToken, verifySessionToken } = await import("@/lib/session");

describe("session token", () => {
  it("crée un token vérifiable et récupère le userId", () => {
    const token = createSessionToken("user-abc");
    const session = verifySessionToken(token);
    expect(session).not.toBeNull();
    expect(session?.userId).toBe("user-abc");
  });

  it("rejette un token vide", () => {
    expect(verifySessionToken("")).toBeNull();
  });

  it("rejette un token mal formé", () => {
    expect(verifySessionToken("not.a.valid.token")).toBeNull();
    expect(verifySessionToken("aaaaaaaaaa")).toBeNull();
  });

  it("rejette un token falsifié (signature altérée)", () => {
    const token = createSessionToken("user-abc");
    const decoded = Buffer.from(token, "base64url").toString("utf-8");
    const [userId, expiry] = decoded.split(".");
    // Signature bidon
    const forged = Buffer.from(`${userId}.${expiry}.deadbeef`).toString("base64url");
    expect(verifySessionToken(forged)).toBeNull();
  });

  it("rejette un token avec un userId modifié", () => {
    const token = createSessionToken("user-abc");
    const decoded = Buffer.from(token, "base64url").toString("utf-8");
    const [, expiry, sig] = decoded.split(".");
    const tampered = Buffer.from(`user-xyz.${expiry}.${sig}`).toString("base64url");
    expect(verifySessionToken(tampered)).toBeNull();
  });

  it("rejette un token expiré", () => {
    const decoded = `user-abc.${Date.now() - 1000}.deadbeef`;
    const forged = Buffer.from(decoded).toString("base64url");
    expect(verifySessionToken(forged)).toBeNull();
  });
});
