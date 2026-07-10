/**
 * F1 (Lot 29) — Tests du guard API `requireEntitlement`.
 *
 * On mocke `getCurrentUser` pour simuler différents plans et vérifier
 * que le guard throw le bon HttpError avec les bons `details`.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock de session AVANT l'import du module testé.
vi.mock("@/lib/session", () => ({
  getCurrentUser: vi.fn(),
}));

import { getCurrentUser } from "@/lib/session";
import { requireEntitlement, tryEntitlement } from "@/lib/require-entitlement";
import { HttpError } from "@/lib/api-error";

const mockedGetCurrentUser = vi.mocked(getCurrentUser);

beforeEach(() => {
  mockedGetCurrentUser.mockReset();
});

describe("requireEntitlement", () => {
  it("throw 401 UNAUTHORIZED si pas de session", async () => {
    mockedGetCurrentUser.mockResolvedValue(null);
    await expect(requireEntitlement("ai.chat")).rejects.toBeInstanceOf(HttpError);
    try {
      await requireEntitlement("ai.chat");
    } catch (e) {
      const err = e as HttpError;
      expect(err.status).toBe(401);
      expect(err.code).toBe("UNAUTHORIZED");
    }
  });

  it("throw 402 PLAN_REQUIRED si le plan est insuffisant", async () => {
    mockedGetCurrentUser.mockResolvedValue({ id: "u1", subscription: "free" } as never);
    try {
      await requireEntitlement("loyalty.enable");
      throw new Error("Devrait avoir throw");
    } catch (e) {
      const err = e as HttpError;
      expect(err.status).toBe(402);
      expect(err.code).toBe("PLAN_REQUIRED");
      // Détails structurés dans le body de la réponse (pour l'UI upgrade)
      expect(err.details).toMatchObject({
        requiredPlan: "premium",
        currentPlan: "free",
        feature: "loyalty.enable",
      });
    }
  });

  it("throw 402 si Pro essaie une feature Premium-only", async () => {
    mockedGetCurrentUser.mockResolvedValue({ id: "u1", subscription: "pro" } as never);
    try {
      await requireEntitlement("ai.chat");
      throw new Error("Devrait avoir throw");
    } catch (e) {
      const err = e as HttpError;
      expect(err.status).toBe(402);
      expect(err.details).toMatchObject({ requiredPlan: "premium", currentPlan: "pro" });
    }
  });

  it("passe si le plan couvre la feature", async () => {
    mockedGetCurrentUser.mockResolvedValue({
      id: "u1",
      subscription: "premium",
    } as never);
    const ctx = await requireEntitlement("ai.chat");
    expect(ctx.plan).toBe("premium");
    expect(ctx.user.id).toBe("u1");
  });

  it("Pro peut accéder à une feature Pro+ (quotes.enable)", async () => {
    mockedGetCurrentUser.mockResolvedValue({ id: "u1", subscription: "pro" } as never);
    const ctx = await requireEntitlement("quotes.enable");
    expect(ctx.plan).toBe("pro");
  });

  it("subscription null → traité comme free", async () => {
    mockedGetCurrentUser.mockResolvedValue({ id: "u1", subscription: null } as never);
    try {
      await requireEntitlement("quotes.enable");
      throw new Error("Devrait avoir throw");
    } catch (e) {
      const err = e as HttpError;
      expect(err.status).toBe(402);
      expect(err.details).toMatchObject({ currentPlan: "free" });
    }
  });
});

describe("tryEntitlement", () => {
  it("renvoie null sur pas de session", async () => {
    mockedGetCurrentUser.mockResolvedValue(null);
    const ctx = await tryEntitlement("ai.chat");
    expect(ctx).toBeNull();
  });

  it("renvoie null sur plan insuffisant (jamais de throw)", async () => {
    mockedGetCurrentUser.mockResolvedValue({ id: "u1", subscription: "free" } as never);
    const ctx = await tryEntitlement("loyalty.enable");
    expect(ctx).toBeNull();
  });

  it("renvoie le contexte si OK", async () => {
    mockedGetCurrentUser.mockResolvedValue({
      id: "u1",
      subscription: "premium",
    } as never);
    const ctx = await tryEntitlement("ai.chat");
    expect(ctx).not.toBeNull();
    expect(ctx?.plan).toBe("premium");
  });
});
