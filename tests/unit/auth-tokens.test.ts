/**
 * Tests des helpers auth-tokens (Lot 19).
 * On mock @/db pour ne pas dépendre d'une vraie DB.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

const insertResults: Array<{ id: string }[]> = [];
const selectResults: unknown[][] = [];
const updateResults: Array<{ id: string }[]> = [];

vi.mock("@/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => {
          // `.where(...)` peut être :
          //  - awaited directement → renvoie l'array de résultats
          //  - suivi de `.limit(n)` → renvoie l'array de résultats
          // On crée un objet thenable + qui expose `.limit()` pour couvrir les 2.
          const rows = selectResults.shift() ?? [];
          const promise: Promise<unknown[]> & { limit?: (n: number) => Promise<unknown[]> } =
            Promise.resolve(rows) as Promise<unknown[]>;
          promise.limit = (_n: number) => Promise.resolve(rows);
          return promise;
        },
      }),
    }),
    insert: () => ({
      values: () => ({
        returning: () => Promise.resolve(insertResults.shift() ?? [{ id: "mock-id" }]),
      }),
    }),
    update: () => ({
      set: () => ({
        where: () => ({
          returning: () => Promise.resolve(updateResults.shift() ?? []),
        }),
      }),
    }),
  },
}));

import {
  generateRawToken,
  hashToken,
  createAuthToken,
  consumeAuthToken,
} from "../../src/lib/auth-tokens";

describe("auth-tokens (Lot 19)", () => {
  beforeEach(() => {
    insertResults.length = 0;
    selectResults.length = 0;
    updateResults.length = 0;
  });

  it("generateRawToken produit 64 chars hex (32 bytes)", () => {
    const t = generateRawToken();
    expect(t).toMatch(/^[0-9a-f]{64}$/);
  });

  it("generateRawToken produit des valeurs différentes à chaque appel", () => {
    const s = new Set<string>();
    for (let i = 0; i < 50; i++) s.add(generateRawToken());
    expect(s.size).toBe(50);
  });

  it("hashToken est déterministe (SHA-256)", () => {
    const t = "a".repeat(64);
    expect(hashToken(t)).toBe(hashToken(t));
    // Change 1 char → hash totalement différent
    const t2 = "b" + t.slice(1);
    expect(hashToken(t)).not.toBe(hashToken(t2));
  });

  it("hashToken retourne 64 chars hex", () => {
    expect(hashToken("test")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("createAuthToken refuse si trop de tokens actifs", async () => {
    // count() renvoie [{ activeCount: X }] : on simule 3 actifs pour password_reset
    selectResults.push([{ activeCount: 3 }]);
    await expect(createAuthToken({ userId: "u1", type: "password_reset" })).rejects.toThrow(
      /TOO_MANY_ACTIVE_TOKENS/
    );
  });

  it("createAuthToken retourne { rawToken, id } si OK", async () => {
    selectResults.push([{ activeCount: 0 }]);
    insertResults.push([{ id: "token-uuid" }]);
    const out = await createAuthToken({ userId: "u1", type: "password_reset" });
    expect(out.rawToken).toMatch(/^[0-9a-f]{64}$/);
    expect(out.id).toBe("token-uuid");
  });

  it("consumeAuthToken rejette un token qui n'a pas la bonne longueur", async () => {
    const r = await consumeAuthToken("short", "password_reset");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("not_found");
  });

  it("consumeAuthToken rejette un token inconnu (pas en DB)", async () => {
    selectResults.push([]); // rien trouvé
    const raw = "a".repeat(64);
    const r = await consumeAuthToken(raw, "password_reset");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("not_found");
  });

  it("consumeAuthToken rejette un token du mauvais type", async () => {
    selectResults.push([
      {
        id: "t1",
        userId: "u1",
        type: "email_verify",
        expiresAt: new Date(Date.now() + 60_000),
        usedAt: null,
      },
    ]);
    const r = await consumeAuthToken("a".repeat(64), "password_reset");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("wrong_type");
  });

  it("consumeAuthToken rejette un token expiré", async () => {
    selectResults.push([
      {
        id: "t1",
        userId: "u1",
        type: "password_reset",
        expiresAt: new Date(Date.now() - 1000), // expiré
        usedAt: null,
      },
    ]);
    const r = await consumeAuthToken("a".repeat(64), "password_reset");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("expired");
  });

  it("consumeAuthToken rejette un token déjà utilisé", async () => {
    selectResults.push([
      {
        id: "t1",
        userId: "u1",
        type: "password_reset",
        expiresAt: new Date(Date.now() + 60_000),
        usedAt: new Date(Date.now() - 100), // déjà consommé
      },
    ]);
    const r = await consumeAuthToken("a".repeat(64), "password_reset");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("already_used");
  });

  it("consumeAuthToken marque used + renvoie userId si tout OK", async () => {
    selectResults.push([
      {
        id: "t1",
        userId: "u1",
        type: "password_reset",
        expiresAt: new Date(Date.now() + 60_000),
        usedAt: null,
      },
    ]);
    updateResults.push([{ id: "t1" }]); // update WHERE used_at IS NULL → 1 row
    const r = await consumeAuthToken("a".repeat(64), "password_reset");
    expect(r.ok).toBe(true);
    expect(r.userId).toBe("u1");
  });

  it("consumeAuthToken gère la race condition (2 consommations parallèles)", async () => {
    // 1ère consommation OK
    selectResults.push([
      {
        id: "t1",
        userId: "u1",
        type: "password_reset",
        expiresAt: new Date(Date.now() + 60_000),
        usedAt: null,
      },
    ]);
    updateResults.push([]); // WHERE used_at IS NULL n'a rien matché → race perdue
    const r = await consumeAuthToken("a".repeat(64), "password_reset");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("already_used");
  });
});
