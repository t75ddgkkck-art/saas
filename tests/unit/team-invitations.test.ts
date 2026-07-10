/**
 * F5 (Lot 32) — Tests team-invitations (crypto + consommation).
 * Même pattern que client-auth : mocks DB fluide.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";

const dbState = {
  selectedInvite: null as null | {
    id: string;
    businessId: string;
    email: string;
    memberRole: string;
    expiresAt: Date;
    acceptedAt: Date | null;
  },
  inserted: [] as unknown[],
  updated: [] as unknown[],
};

vi.mock("@/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve(dbState.selectedInvite ? [dbState.selectedInvite] : []),
        }),
      }),
    }),
    insert: () => ({
      values: (v: unknown) => ({
        returning: () => {
          dbState.inserted.push(v);
          return Promise.resolve([{ id: "inv-1" }]);
        },
      }),
    }),
    update: () => ({
      set: (v: unknown) => ({
        where: () => ({
          returning: () => {
            dbState.updated.push(v);
            return Promise.resolve(
              dbState.selectedInvite ? [{ id: dbState.selectedInvite.id }] : []
            );
          },
        }),
      }),
    }),
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import {
  generateInvitationRawToken,
  hashInvitationToken,
  createTeamInvitation,
  consumeTeamInvitation,
  peekTeamInvitation,
} from "@/lib/team-invitations";

beforeEach(() => {
  dbState.selectedInvite = null;
  dbState.inserted = [];
  dbState.updated = [];
});

describe("generateInvitationRawToken", () => {
  it("génère 64 chars hex", () => {
    const t = generateInvitationRawToken();
    expect(t).toMatch(/^[0-9a-f]{64}$/);
  });
  it("unicité sur 100 tirages", () => {
    const s = new Set<string>();
    for (let i = 0; i < 100; i++) s.add(generateInvitationRawToken());
    expect(s.size).toBe(100);
  });
});

describe("hashInvitationToken", () => {
  it("déterministe", () => {
    const t = "a".repeat(64);
    expect(hashInvitationToken(t)).toBe(hashInvitationToken(t));
  });
  it("SHA-256 hex (64 chars)", () => {
    expect(hashInvitationToken("x")).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("createTeamInvitation", () => {
  it("normalise email + stocke le hash + renvoie le brut", async () => {
    const res = await createTeamInvitation({
      businessId: "biz-1",
      email: "  USER@EX.COM  ",
      memberRole: "employee",
      invitedByUserId: "user-1",
    });
    expect(res.rawToken).toMatch(/^[0-9a-f]{64}$/);
    expect(res.id).toBe("inv-1");
    const row = dbState.inserted[0] as { email: string; tokenHash: string; memberRole: string };
    expect(row.email).toBe("user@ex.com");
    expect(row.memberRole).toBe("employee");
    expect(row.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    // Le token brut n'est PAS dans la DB
    expect(row.tokenHash).not.toBe(res.rawToken);
  });
});

describe("consumeTeamInvitation", () => {
  it("refuse un token vide / de mauvaise longueur", async () => {
    expect((await consumeTeamInvitation("")).ok).toBe(false);
    expect((await consumeTeamInvitation("short")).ok).toBe(false);
  });

  it("not_found si rien en DB", async () => {
    dbState.selectedInvite = null;
    const res = await consumeTeamInvitation("a".repeat(64));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("not_found");
  });

  it("already_used si acceptedAt non null", async () => {
    dbState.selectedInvite = {
      id: "inv-1",
      businessId: "biz-1",
      email: "u@u.com",
      memberRole: "employee",
      expiresAt: new Date(Date.now() + 60_000),
      acceptedAt: new Date(),
    };
    const res = await consumeTeamInvitation("b".repeat(64));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("already_used");
  });

  it("expired si expiresAt passé", async () => {
    dbState.selectedInvite = {
      id: "inv-1",
      businessId: "biz-1",
      email: "u@u.com",
      memberRole: "employee",
      expiresAt: new Date(Date.now() - 1000),
      acceptedAt: null,
    };
    const res = await consumeTeamInvitation("c".repeat(64));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("expired");
  });

  it("cas nominal → renvoie infos + normalise rôle inconnu à viewer", async () => {
    dbState.selectedInvite = {
      id: "inv-1",
      businessId: "biz-1",
      email: "u@u.com",
      memberRole: "employee",
      expiresAt: new Date(Date.now() + 60_000),
      acceptedAt: null,
    };
    const res = await consumeTeamInvitation("d".repeat(64));
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.businessId).toBe("biz-1");
      expect(res.email).toBe("u@u.com");
      expect(res.memberRole).toBe("employee");
    }
    expect(dbState.updated.length).toBe(1);
  });

  it("rôle DB corrompu → normalise à viewer (safe)", async () => {
    dbState.selectedInvite = {
      id: "inv-1",
      businessId: "biz-1",
      email: "u@u.com",
      memberRole: "supersuperuser", // non canonique
      expiresAt: new Date(Date.now() + 60_000),
      acceptedAt: null,
    };
    const res = await consumeTeamInvitation("e".repeat(64));
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.memberRole).toBe("viewer");
  });
});

describe("peekTeamInvitation", () => {
  it("renvoie null si expiré", async () => {
    dbState.selectedInvite = {
      id: "inv-1",
      businessId: "biz-1",
      email: "u@u.com",
      memberRole: "employee",
      expiresAt: new Date(Date.now() - 1000),
      acceptedAt: null,
    };
    expect(await peekTeamInvitation("f".repeat(64))).toBeNull();
  });

  it("renvoie null si déjà accepté", async () => {
    dbState.selectedInvite = {
      id: "inv-1",
      businessId: "biz-1",
      email: "u@u.com",
      memberRole: "employee",
      expiresAt: new Date(Date.now() + 60_000),
      acceptedAt: new Date(),
    };
    expect(await peekTeamInvitation("g".repeat(64))).toBeNull();
  });

  it("cas nominal", async () => {
    dbState.selectedInvite = {
      id: "inv-1",
      businessId: "biz-1",
      email: "u@u.com",
      memberRole: "admin",
      expiresAt: new Date(Date.now() + 60_000),
      acceptedAt: null,
    };
    const res = await peekTeamInvitation("h".repeat(64));
    expect(res).not.toBeNull();
    expect(res?.memberRole).toBe("admin");
    // Le peek NE MARQUE PAS accepted (pas d'update)
    expect(dbState.updated.length).toBe(0);
  });
});
