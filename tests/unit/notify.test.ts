/**
 * F6 (Lot 34) — Tests du helper `notify()` + `isInDnd()`.
 *
 * On mocke la DB pour vérifier :
 *  - insert dans `notifications` selon canaux
 *  - respect des `disabledTypes` (skip complet)
 *  - respect des `disabledChannels` (skip un canal)
 *  - DND : push suppressed sauf priority=high
 *  - Comportement non-throwing sur erreur DB
 */

import { describe, expect, it, vi, beforeEach } from "vitest";

// -----------------------------------------------------------------------------
// Mocks
// -----------------------------------------------------------------------------

const dbState = {
  prefs: null as null | {
    disabledTypes: string[];
    disabledChannels: string[];
    dndStart: string | null;
    dndEnd: string | null;
  },
  inserted: [] as unknown[],
  shouldFail: false,
};

vi.mock("@/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve(dbState.prefs ? [dbState.prefs] : []),
        }),
      }),
    }),
    insert: () => ({
      values: (v: unknown) => ({
        returning: () => {
          if (dbState.shouldFail) return Promise.reject(new Error("DB insert failed"));
          dbState.inserted.push(v);
          return Promise.resolve([{ id: "notif-1" }]);
        },
      }),
    }),
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// Mock push : compte les appels sans dep réelle
const pushCalls: { userId: string; payload: unknown }[] = [];
vi.mock("@/lib/push", () => ({
  sendPushToUser: vi.fn(async (userId: string, payload: unknown) => {
    pushCalls.push({ userId, payload });
    return 1; // simule 1 device touché
  }),
}));

import { notify, isInDnd } from "@/lib/notify";

beforeEach(() => {
  dbState.prefs = null;
  dbState.inserted = [];
  dbState.shouldFail = false;
  pushCalls.length = 0;
});

// -----------------------------------------------------------------------------
// isInDnd — cases limites de la fenêtre horaire
// -----------------------------------------------------------------------------

describe("isInDnd()", () => {
  it("false si dnd non défini", () => {
    expect(isInDnd(new Date(), null, null)).toBe(false);
    expect(isInDnd(new Date(), "22:00", null)).toBe(false);
    expect(isInDnd(new Date(), null, "08:00")).toBe(false);
  });

  it("false si dndStart === dndEnd", () => {
    const d = new Date(2026, 0, 1, 12, 0);
    expect(isInDnd(d, "12:00", "12:00")).toBe(false);
  });

  it("fenêtre simple (start < end) : 09:00-17:00", () => {
    expect(isInDnd(new Date(2026, 0, 1, 8, 59), "09:00", "17:00")).toBe(false);
    expect(isInDnd(new Date(2026, 0, 1, 9, 0), "09:00", "17:00")).toBe(true);
    expect(isInDnd(new Date(2026, 0, 1, 16, 59), "09:00", "17:00")).toBe(true);
    // Bord exclusif à endMin
    expect(isInDnd(new Date(2026, 0, 1, 17, 0), "09:00", "17:00")).toBe(false);
  });

  it("fenêtre wrap-around (start > end) : 22:00-08:00", () => {
    // Nuit
    expect(isInDnd(new Date(2026, 0, 1, 22, 0), "22:00", "08:00")).toBe(true);
    expect(isInDnd(new Date(2026, 0, 1, 23, 59), "22:00", "08:00")).toBe(true);
    expect(isInDnd(new Date(2026, 0, 2, 0, 0), "22:00", "08:00")).toBe(true);
    expect(isInDnd(new Date(2026, 0, 2, 7, 59), "22:00", "08:00")).toBe(true);
    // Jour
    expect(isInDnd(new Date(2026, 0, 1, 8, 0), "22:00", "08:00")).toBe(false);
    expect(isInDnd(new Date(2026, 0, 1, 12, 0), "22:00", "08:00")).toBe(false);
    expect(isInDnd(new Date(2026, 0, 1, 21, 59), "22:00", "08:00")).toBe(false);
  });
});

// -----------------------------------------------------------------------------
// notify()
// -----------------------------------------------------------------------------

describe("notify()", () => {
  it("insert DB + envoie push par défaut (canaux ['db','push'])", async () => {
    const res = await notify({
      userId: "u1",
      type: "appointment.created",
      title: "T",
      message: "M",
    });
    expect(res.notificationId).toBe("notif-1");
    expect(res.pushDevices).toBe(1);
    expect(res.skipped).toBe(false);
    expect(dbState.inserted.length).toBe(1);
    expect(pushCalls.length).toBe(1);
  });

  it("skip complet si type dans disabledTypes", async () => {
    dbState.prefs = {
      disabledTypes: ["review.received"],
      disabledChannels: [],
      dndStart: null,
      dndEnd: null,
    };
    const res = await notify({
      userId: "u1",
      type: "review.received",
      title: "T",
      message: "M",
    });
    expect(res.skipped).toBe(true);
    expect(res.notificationId).toBeNull();
    expect(res.pushDevices).toBe(0);
    expect(dbState.inserted.length).toBe(0);
    expect(pushCalls.length).toBe(0);
  });

  it("skip push si channel 'push' dans disabledChannels", async () => {
    dbState.prefs = {
      disabledTypes: [],
      disabledChannels: ["push"],
      dndStart: null,
      dndEnd: null,
    };
    const res = await notify({
      userId: "u1",
      type: "appointment.created",
      title: "T",
      message: "M",
    });
    // DB OK, push skip
    expect(res.notificationId).toBe("notif-1");
    expect(res.pushDevices).toBe(0);
    expect(dbState.inserted.length).toBe(1);
    expect(pushCalls.length).toBe(0);
  });

  it("skip DB si channel 'db' dans disabledChannels", async () => {
    dbState.prefs = {
      disabledTypes: [],
      disabledChannels: ["db"],
      dndStart: null,
      dndEnd: null,
    };
    const res = await notify({
      userId: "u1",
      type: "appointment.created",
      title: "T",
      message: "M",
    });
    expect(res.notificationId).toBeNull();
    expect(res.pushDevices).toBe(1);
    expect(dbState.inserted.length).toBe(0);
  });

  it("DND actif + priority normal → push suppressed, DB OK", async () => {
    dbState.prefs = {
      disabledTypes: [],
      disabledChannels: [],
      // Fenêtre 24h/24 pour être sûr d'être dedans
      dndStart: "00:00",
      dndEnd: "23:59",
    };
    const res = await notify({
      userId: "u1",
      type: "review.received",
      title: "T",
      message: "M",
    });
    expect(res.notificationId).toBe("notif-1");
    expect(res.pushDevices).toBe(0); // push skip par DND
    expect(pushCalls.length).toBe(0);
  });

  it("DND actif + priority high → push envoyée quand même", async () => {
    dbState.prefs = {
      disabledTypes: [],
      disabledChannels: [],
      dndStart: "00:00",
      dndEnd: "23:59",
    };
    const res = await notify({
      userId: "u1",
      type: "subscription.trial_ending",
      title: "T",
      message: "M",
      priority: "high",
    });
    expect(res.pushDevices).toBe(1);
    expect(pushCalls.length).toBe(1);
  });

  it("channels custom ['db'] → pas de push même sans DND", async () => {
    const res = await notify({
      userId: "u1",
      type: "system.info",
      title: "T",
      message: "M",
      channels: ["db"],
    });
    expect(res.notificationId).toBe("notif-1");
    expect(res.pushDevices).toBe(0);
    expect(pushCalls.length).toBe(0);
  });

  it("non-throwing même si DB insert fail", async () => {
    dbState.shouldFail = true;
    // Ne doit PAS throw
    const res = await notify({
      userId: "u1",
      type: "appointment.created",
      title: "T",
      message: "M",
    });
    // DB fail → notificationId null, mais push OK
    expect(res.notificationId).toBeNull();
    expect(res.pushDevices).toBe(1);
  });

  it("tag par défaut = type (dedup côté SW/push)", async () => {
    await notify({
      userId: "u1",
      type: "appointment.created",
      title: "T",
      message: "M",
    });
    const call = pushCalls[0] as { payload: { tag?: string } };
    expect(call.payload.tag).toBe("appointment.created");
  });

  it("tag custom respecté", async () => {
    await notify({
      userId: "u1",
      type: "appointment.created",
      title: "T",
      message: "M",
      tag: "appointment-abc-123",
    });
    const call = pushCalls[0] as { payload: { tag?: string } };
    expect(call.payload.tag).toBe("appointment-abc-123");
  });

  it("url par défaut = /dashboard, sinon custom", async () => {
    await notify({ userId: "u1", type: "system.info", title: "T", message: "M" });
    let call = pushCalls[0] as { payload: { url?: string } };
    expect(call.payload.url).toBe("/dashboard");

    pushCalls.length = 0;
    await notify({
      userId: "u1",
      type: "review.received",
      title: "T",
      message: "M",
      url: "/dashboard/reviews",
    });
    call = pushCalls[0] as { payload: { url?: string } };
    expect(call.payload.url).toBe("/dashboard/reviews");
  });

  it("message tronqué à 300 chars dans le body push", async () => {
    const long = "a".repeat(400);
    await notify({
      userId: "u1",
      type: "system.info",
      title: "T",
      message: long,
    });
    const call = pushCalls[0] as { payload: { body: string } };
    expect(call.payload.body.length).toBe(300);
  });
});
