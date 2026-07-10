import { describe, it, expect, beforeAll } from "vitest";

// Force le secret avant l'import (comme session.test.ts)
process.env.NEXTAUTH_SECRET = "test-secret-must-be-at-least-16-chars-long";

const {
  createUnsubscribeToken,
  verifyUnsubscribeToken,
  buildUnsubscribeUrl,
  buildListUnsubscribeHeaders,
  isValidCategory,
} = await import("@/lib/unsubscribe");

describe("unsubscribe — token", () => {
  it("crée un token qui se vérifie correctement", () => {
    const token = createUnsubscribeToken("nathan@example.com", "marketing");
    const verified = verifyUnsubscribeToken(token);
    expect(verified).not.toBeNull();
    expect(verified?.email).toBe("nathan@example.com");
    expect(verified?.category).toBe("marketing");
  });

  it("normalise l'email en lowercase", () => {
    const token = createUnsubscribeToken("Nathan@Example.COM", "reminders");
    expect(verifyUnsubscribeToken(token)?.email).toBe("nathan@example.com");
  });

  it("rejette un token vide ou malformé", () => {
    expect(verifyUnsubscribeToken("")).toBeNull();
    expect(verifyUnsubscribeToken("garbage")).toBeNull();
    expect(verifyUnsubscribeToken("not.enough.parts")).toBeNull();
  });

  it("rejette un token dont la signature a été modifiée", () => {
    const token = createUnsubscribeToken("nathan@example.com", "marketing");
    // Décode, altère la signature, ré-encode
    const decoded = Buffer.from(token, "base64url").toString();
    const parts = decoded.split("|");
    const forged = Buffer.from(
      [parts[0], parts[1], parts[2], "deadbeefdeadbeef"].join("|")
    ).toString("base64url");
    expect(verifyUnsubscribeToken(forged)).toBeNull();
  });

  it("rejette un token dont la catégorie a été modifiée", () => {
    const token = createUnsubscribeToken("nathan@example.com", "reminders");
    const decoded = Buffer.from(token, "base64url").toString();
    const parts = decoded.split("|");
    // Changer catégorie mais garder signature = invalide
    const forged = Buffer.from([parts[0], "marketing", parts[2], parts[3]].join("|")).toString(
      "base64url"
    );
    expect(verifyUnsubscribeToken(forged)).toBeNull();
  });

  it("rejette une catégorie inconnue", () => {
    expect(isValidCategory("foo")).toBe(false);
    expect(isValidCategory("marketing")).toBe(true);
    expect(isValidCategory("all")).toBe(true);
  });
});

describe("unsubscribe — buildUnsubscribeUrl", () => {
  it("génère une URL valide avec token en query", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://www.vitrix.fr";
    const url = buildUnsubscribeUrl("nathan@example.com", "marketing");
    expect(url).toMatch(/^https:\/\/www\.vitrix\.fr\/api\/unsubscribe\?token=/);
  });
});

describe("unsubscribe — headers List-Unsubscribe RFC 8058", () => {
  it("produit les 2 headers requis", () => {
    const headers = buildListUnsubscribeHeaders("nathan@example.com", "marketing");
    expect(headers["List-Unsubscribe"]).toMatch(/^<https:\/\/.*\/api\/unsubscribe\?token=/);
    expect(headers["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
  });
});
