/**
 * F6 (Lot 35) — Tests state machine appointments + timeline.
 */

import { describe, expect, it } from "vitest";
import {
  canTransition,
  allowedNextStatuses,
  resolveTimelineFields,
  computeDurationMinutes,
  computeTravelMinutes,
  STATUS_LABELS,
  type AppointmentStatus,
} from "@/lib/appointment-status";

describe("canTransition — matrice", () => {
  it("pending → confirmed / cancelled autorisés", () => {
    expect(canTransition("pending", "confirmed")).toBe(true);
    expect(canTransition("pending", "cancelled")).toBe(true);
  });
  it("pending → completed refusé (doit passer par confirmed)", () => {
    expect(canTransition("pending", "completed")).toBe(false);
    expect(canTransition("pending", "en_route")).toBe(false);
  });
  it("confirmed → tout sauf pending", () => {
    expect(canTransition("confirmed", "en_route")).toBe(true);
    expect(canTransition("confirmed", "in_progress")).toBe(true);
    expect(canTransition("confirmed", "completed")).toBe(true);
    expect(canTransition("confirmed", "no_show")).toBe(true);
    expect(canTransition("confirmed", "cancelled")).toBe(true);
    expect(canTransition("confirmed", "pending")).toBe(false);
  });
  it("en_route → in_progress / completed / cancelled uniquement", () => {
    expect(canTransition("en_route", "in_progress")).toBe(true);
    expect(canTransition("en_route", "completed")).toBe(true);
    expect(canTransition("en_route", "cancelled")).toBe(true);
    expect(canTransition("en_route", "no_show")).toBe(false);
    expect(canTransition("en_route", "confirmed")).toBe(false);
  });
  it("in_progress → completed / cancelled uniquement", () => {
    expect(canTransition("in_progress", "completed")).toBe(true);
    expect(canTransition("in_progress", "cancelled")).toBe(true);
    expect(canTransition("in_progress", "en_route")).toBe(false);
    expect(canTransition("in_progress", "pending")).toBe(false);
  });
  it("états finaux ne transitionnent JAMAIS (B23)", () => {
    const finals: AppointmentStatus[] = ["completed", "no_show", "cancelled"];
    const others: AppointmentStatus[] = ["pending", "confirmed", "en_route", "in_progress"];
    for (const from of finals) {
      for (const to of others) {
        expect(canTransition(from, to)).toBe(false);
      }
      // Sauf vers eux-mêmes (idempotence)
      expect(canTransition(from, from)).toBe(true);
    }
  });
  it("idempotence : même statut = true (permet retry sans erreur)", () => {
    for (const s of Object.keys(STATUS_LABELS) as AppointmentStatus[]) {
      expect(canTransition(s, s)).toBe(true);
    }
  });
});

describe("allowedNextStatuses", () => {
  it("renvoie une copie (mutation locale interdite)", () => {
    const list = allowedNextStatuses("confirmed");
    list.push("pending" as AppointmentStatus);
    expect(allowedNextStatuses("confirmed")).not.toContain("pending");
  });
  it("état final = liste vide", () => {
    expect(allowedNextStatuses("completed")).toEqual([]);
    expect(allowedNextStatuses("no_show")).toEqual([]);
    expect(allowedNextStatuses("cancelled")).toEqual([]);
  });
});

describe("resolveTimelineFields", () => {
  const NOW = new Date("2026-08-15T10:00:00Z");
  const EMPTY = { checkedInAt: null, startedAt: null, finishedAt: null };

  it("en_route → pose checkedInAt uniquement", () => {
    const patch = resolveTimelineFields("en_route", EMPTY, NOW);
    expect(patch.checkedInAt).toBe(NOW);
    expect(patch.startedAt).toBeUndefined();
    expect(patch.finishedAt).toBeUndefined();
  });

  it("in_progress vierge → pose checkedInAt + startedAt", () => {
    const patch = resolveTimelineFields("in_progress", EMPTY, NOW);
    expect(patch.checkedInAt).toBe(NOW);
    expect(patch.startedAt).toBe(NOW);
    expect(patch.finishedAt).toBeUndefined();
  });

  it("in_progress avec checkedInAt déjà set → ne l'écrase pas", () => {
    const earlier = new Date("2026-08-15T09:30:00Z");
    const patch = resolveTimelineFields(
      "in_progress",
      { checkedInAt: earlier, startedAt: null, finishedAt: null },
      NOW
    );
    expect(patch.checkedInAt).toBeUndefined(); // pas de patch = pas d'écrasement
    expect(patch.startedAt).toBe(NOW);
  });

  it("completed vierge → pose les 3 timestamps", () => {
    const patch = resolveTimelineFields("completed", EMPTY, NOW);
    expect(patch.checkedInAt).toBe(NOW);
    expect(patch.startedAt).toBe(NOW);
    expect(patch.finishedAt).toBe(NOW);
  });

  it("completed avec tout déjà set → aucun patch", () => {
    const t = new Date();
    const patch = resolveTimelineFields(
      "completed",
      { checkedInAt: t, startedAt: t, finishedAt: t },
      NOW
    );
    expect(patch).toEqual({});
  });

  it("cancelled / no_show / pending / confirmed → aucun patch", () => {
    for (const s of ["cancelled", "no_show", "pending", "confirmed"] as AppointmentStatus[]) {
      expect(resolveTimelineFields(s, EMPTY, NOW)).toEqual({});
    }
  });
});

describe("computeDurationMinutes / computeTravelMinutes", () => {
  it("duration = finishedAt - startedAt en minutes", () => {
    expect(
      computeDurationMinutes({
        checkedInAt: null,
        startedAt: new Date("2026-08-15T10:00:00Z"),
        finishedAt: new Date("2026-08-15T11:30:00Z"),
      })
    ).toBe(90);
  });

  it("duration null si startedAt manquant", () => {
    expect(
      computeDurationMinutes({
        checkedInAt: new Date(),
        startedAt: null,
        finishedAt: new Date(),
      })
    ).toBeNull();
  });

  it("travel = startedAt - checkedInAt", () => {
    expect(
      computeTravelMinutes({
        checkedInAt: new Date("2026-08-15T09:30:00Z"),
        startedAt: new Date("2026-08-15T10:00:00Z"),
        finishedAt: null,
      })
    ).toBe(30);
  });

  it("null si un timestamp manque", () => {
    expect(
      computeTravelMinutes({ checkedInAt: null, startedAt: new Date(), finishedAt: null })
    ).toBeNull();
  });
});

describe("STATUS_LABELS", () => {
  it("couvre tous les statuts", () => {
    const statuses: AppointmentStatus[] = [
      "pending",
      "confirmed",
      "en_route",
      "in_progress",
      "completed",
      "no_show",
      "cancelled",
    ];
    for (const s of statuses) {
      expect(STATUS_LABELS[s]).toBeTruthy();
    }
  });
});
