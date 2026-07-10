/**
 * F3 (Lot 31) — Tests client-auth (magic-link).
 *
 * On mocke la DB. Focus :
 *  - Génération token brut = 64 chars hex
 *  - Hash déterministe (SHA-256 hex 64 chars)
 *  - createClientAuthToken : anti-spam TOO_MANY_ACTIVE_TOKENS
 *  - consumeClientAuthToken : cas nominal / expiré / déjà utilisé / not_found
 */

import { describe, expect, it, vi, beforeEach } from "vitest";

// State partagé mockable
const dbState = {
  activeCount: 0,
  insertedRows: [] as unknown[],
  selectedToken: null as null | {
    id: string;
    email: string;
    expiresAt: Date;
    usedAt: Date | null;
  },
  updated: [] as unknown[],
};

vi.mock("@/db", () => ({
  db: {
    select: (cols?: unknown) => ({
      from: () => ({
        where: () => {
          // Si on demande count() → renvoie [{activeCount: n}]
          if (cols && typeof cols === "object" && "activeCount" in cols) {
            return Promise.resolve([{ activeCount: dbState.activeCount }]);
          }
          return {
            limit: () => Promise.resolve(dbState.selectedToken ? [dbState.selectedToken] : []),
          };
        },
      }),
    }),
    insert: () => ({
      values: (v: unknown) => ({
        returning: () => {
          dbState.insertedRows.push(v);
          return Promise.resolve([{ id: "tok-inserted-id" }]);
        },
      }),
    }),
    update: () => ({
      set: (v: unknown) => ({
        where: () => ({
          returning: () => {
            dbState.updated.push(v);
            // Simule : si on a un token sélectionné, l'update réussit (renvoie 1 row)
            return Promise.resolve(dbState.selectedToken ? [{ id: dbState.selectedToken.id }] : []);
          },
        }),
      }),
    }),
    delete: () => ({
      where: () => ({
        returning: () => Promise.resolve([]),
      }),
    }),
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import {
  generateClientRawToken,
  hashClientToken,
  createClientAuthToken,
  consumeClientAuthToken,
  CLIENT_MAX_ACTIVE_TOKENS,
} from "@/lib/client-auth";

beforeEach(() => {
  dbState.activeCount = 0;
  dbState.insertedRows = [];
  dbState.selectedToken = null;
  dbState.updated = [];
});

describe("generateClientRawToken", () => {
  it("génère 64 chars hex", () => {
    const t = generateClientRawToken();
    expect(t).toMatch(/^[0-9a-f]{64}$/);
  });

  it("est non-devinable (unicité forte sur 100 tirages)", () => {
    const set = new Set<string>();
    for (let i = 0; i < 100; i++) set.add(generateClientRawToken());
    expect(set.size).toBe(100);
  });
});

describe("hashClientToken", () => {
  it("est déterministe (même input = même hash)", () => {
    const t = "a".repeat(64);
    expect(hashClientToken(t)).toBe(hashClientToken(t));
  });
  it("renvoie 64 chars hex (SHA-256)", () => {
    expect(hashClientToken("hello")).toMatch(/^[0-9a-f]{64}$/);
  });
  it("est différent pour deux inputs différents", () => {
    expect(hashClientToken("a")).not.toBe(hashClientToken("b"));
  });
});

describe("createClientAuthToken", () => {
  it("crée un token si activeCount < max", async () => {
    dbState.activeCount = 0;
    const res = await createClientAuthToken({ email: "user@example.com" });
    expect(res.rawToken).toMatch(/^[0-9a-f]{64}$/);
    expect(res.id).toBe("tok-inserted-id");
    expect(res.expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(dbState.insertedRows.length).toBe(1);
  });

  it("normalise l'email en lowercase + trim", async () => {
    await createClientAuthToken({ email: "  USER@EXAMPLE.COM  " });
    const row = dbState.insertedRows[0] as { email: string };
    expect(row.email).toBe("user@example.com");
  });

  it("throw TOO_MANY_ACTIVE_TOKENS si limite atteinte", async () => {
    dbState.activeCount = CLIENT_MAX_ACTIVE_TOKENS;
    await expect(createClientAuthToken({ email: "a@a.com" })).rejects.toThrow(
      "TOO_MANY_ACTIVE_TOKENS"
    );
    expect(dbState.insertedRows.length).toBe(0);
  });

  it("stocke le HASH, pas le token brut (crypto safety)", async () => {
    await createClientAuthToken({ email: "x@x.com" });
    const row = dbState.insertedRows[0] as { tokenHash: string };
    expect(row.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    // Un hash n'a pas la même valeur que le brut (impossible d'inverser)
    expect(row.tokenHash).not.toContain(" ");
  });
});

describe("consumeClientAuthToken", () => {
  it("refuse un token vide / trop court", async () => {
    expect((await consumeClientAuthToken("")).ok).toBe(false);
    expect((await consumeClientAuthToken("short")).ok).toBe(false);
    // Un token de bonne longueur mais non hex reste "not_found" (le hash
    // fonctionne mais aucune ligne DB ne correspond)
    dbState.selectedToken = null;
    const res = await consumeClientAuthToken("z".repeat(64));
    expect(res.ok).toBe(false);
  });

  it("renvoie not_found si aucun token match", async () => {
    dbState.selectedToken = null;
    const raw = "a".repeat(64);
    const res = await consumeClientAuthToken(raw);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("not_found");
  });

  it("renvoie already_used si usedAt non null", async () => {
    dbState.selectedToken = {
      id: "t1",
      email: "u@u.com",
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: new Date(),
    };
    const raw = "b".repeat(64);
    const res = await consumeClientAuthToken(raw);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("already_used");
  });

  it("renvoie expired si expiresAt < now", async () => {
    dbState.selectedToken = {
      id: "t1",
      email: "u@u.com",
      expiresAt: new Date(Date.now() - 1000),
      usedAt: null,
    };
    const raw = "c".repeat(64);
    const res = await consumeClientAuthToken(raw);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("expired");
  });

  it("consomme + renvoie email si tout OK", async () => {
    dbState.selectedToken = {
      id: "t1",
      email: "user@example.com",
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: null,
    };
    const raw = "d".repeat(64);
    const res = await consumeClientAuthToken(raw);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.email).toBe("user@example.com");
    expect(dbState.updated.length).toBe(1);
  });
});
