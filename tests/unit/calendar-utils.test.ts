/**
 * F4 (Lot 33) — Tests des utils calendrier (fonctions pures).
 */

import { describe, expect, it } from "vitest";
import {
  toIsoDate,
  toIsoTime,
  startOfWeek,
  startOfMonth,
  endOfMonth,
  addDays,
  addMonths,
  addMinutes,
  isSameDay,
  weekDays,
  monthGrid,
  rangeLabel,
  colorForKey,
  hourSlots,
  timeToPx,
  durationToPx,
} from "@/components/calendar/calendar-utils";

describe("toIsoDate/toIsoTime", () => {
  it("formate YYYY-MM-DD correctement (padding)", () => {
    expect(toIsoDate(new Date(2026, 0, 3))).toBe("2026-01-03");
    expect(toIsoDate(new Date(2026, 11, 31))).toBe("2026-12-31");
  });

  it("formate HH:MM correctement (padding)", () => {
    const d = new Date(2026, 0, 1, 7, 5);
    expect(toIsoTime(d)).toBe("07:05");
  });
});

describe("startOfWeek (lundi ISO)", () => {
  it("mardi → lundi précédent", () => {
    // 2026-08-11 = mardi → 2026-08-10 = lundi
    const d = new Date(2026, 7, 11);
    expect(toIsoDate(startOfWeek(d))).toBe("2026-08-10");
  });

  it("dimanche → lundi précédent (pas suivant)", () => {
    // 2026-08-16 = dimanche → 2026-08-10 = lundi
    const d = new Date(2026, 7, 16);
    expect(toIsoDate(startOfWeek(d))).toBe("2026-08-10");
  });

  it("lundi → lui-même", () => {
    const d = new Date(2026, 7, 10);
    expect(toIsoDate(startOfWeek(d))).toBe("2026-08-10");
  });
});

describe("startOfMonth / endOfMonth", () => {
  it("15/08 → 01/08 et 31/08", () => {
    const d = new Date(2026, 7, 15);
    expect(toIsoDate(startOfMonth(d))).toBe("2026-08-01");
    expect(toIsoDate(endOfMonth(d))).toBe("2026-08-31");
  });

  it("29/02 année bissextile → 29/02", () => {
    const d = new Date(2028, 1, 15); // février 2028 = bissextile
    expect(toIsoDate(endOfMonth(d))).toBe("2028-02-29");
  });
});

describe("addDays / addMonths / addMinutes", () => {
  it("addDays est immutable", () => {
    const d = new Date(2026, 0, 1);
    const d2 = addDays(d, 5);
    expect(toIsoDate(d)).toBe("2026-01-01");
    expect(toIsoDate(d2)).toBe("2026-01-06");
  });

  it("addDays gère les rollover de mois", () => {
    expect(toIsoDate(addDays(new Date(2026, 0, 30), 5))).toBe("2026-02-04");
  });

  it("addMonths gère la fin de mois", () => {
    // 31 janvier + 1 mois = 3 mars (car février n'a que 28j) — comportement JS natif
    expect(addMonths(new Date(2026, 0, 31), 1).getMonth()).toBe(2); // mars (0-indexé)
  });

  it("addMinutes", () => {
    const d = new Date(2026, 0, 1, 10, 0);
    expect(addMinutes(d, 90).getHours()).toBe(11);
    expect(addMinutes(d, 90).getMinutes()).toBe(30);
  });
});

describe("isSameDay", () => {
  it("true pour le même jour", () => {
    expect(isSameDay(new Date(2026, 0, 1, 8), new Date(2026, 0, 1, 20))).toBe(true);
  });

  it("false pour jours différents", () => {
    expect(isSameDay(new Date(2026, 0, 1), new Date(2026, 0, 2))).toBe(false);
  });
});

describe("weekDays", () => {
  it("renvoie 7 jours lundi → dimanche", () => {
    const week = weekDays(new Date(2026, 7, 15));
    expect(week).toHaveLength(7);
    expect(toIsoDate(week[0])).toBe("2026-08-10");
    expect(toIsoDate(week[6])).toBe("2026-08-16");
  });
});

describe("monthGrid", () => {
  it("renvoie 42 cases (6 semaines × 7 jours)", () => {
    const grid = monthGrid(new Date(2026, 7, 15));
    expect(grid).toHaveLength(42);
    // Commence toujours un lundi
    expect(grid[0].getDay()).toBe(1);
  });

  it("premier lundi peut être dans le mois précédent", () => {
    // Août 2026 commence un samedi → premier lundi de la grille = 27 juillet
    const grid = monthGrid(new Date(2026, 7, 15));
    expect(toIsoDate(grid[0])).toBe("2026-07-27");
  });
});

describe("rangeLabel", () => {
  it("mode day", () => {
    const label = rangeLabel("day", new Date(2026, 7, 10));
    expect(label).toContain("Lundi");
    expect(label).toContain("10");
    expect(label).toContain("2026");
  });

  it("mode week (même mois)", () => {
    const label = rangeLabel("week", new Date(2026, 7, 11));
    expect(label).toContain("10 – 16");
    expect(label).toContain("août");
  });

  it("mode month", () => {
    expect(rangeLabel("month", new Date(2026, 7, 15))).toBe("Août 2026");
  });
});

describe("colorForKey (déterministe)", () => {
  it("même clé → même couleur", () => {
    expect(colorForKey("user-1")).toBe(colorForKey("user-1"));
  });

  it("null → couleur grise fallback", () => {
    expect(colorForKey(null)).toBe("#94a3b8");
    expect(colorForKey(undefined)).toBe("#94a3b8");
  });

  it("clés différentes → potentiellement couleurs différentes (mais pas garanti sur 2 clés)", () => {
    const colors = new Set(["a", "b", "c", "d", "e", "f", "g", "h"].map((k) => colorForKey(k)));
    // 8 clés → au moins 4 couleurs distinctes (palette de 8)
    expect(colors.size).toBeGreaterThanOrEqual(4);
  });
});

describe("hourSlots", () => {
  it("génère les slots entre startHour et endHour (inclus)", () => {
    const slots = hourSlots(9, 11, 60);
    expect(slots).toEqual(["09:00", "10:00", "11:00"]);
  });

  it("pas de 30 min", () => {
    const slots = hourSlots(9, 10, 30);
    expect(slots).toEqual(["09:00", "09:30", "10:00", "10:30"]);
  });
});

describe("timeToPx / durationToPx", () => {
  it("timeToPx 08:00 avec startHour=7, pxPerHour=48 → 48", () => {
    expect(timeToPx("08:00", 7, 48)).toBe(48);
  });

  it("timeToPx 07:30 → 24 (demi-heure)", () => {
    expect(timeToPx("07:30", 7, 48)).toBe(24);
  });

  it("durationToPx 09:00 → 10:30 → 72 (1h30)", () => {
    expect(durationToPx("09:00", "10:30", 48)).toBe(72);
  });

  it("durée 0 min → 0", () => {
    expect(durationToPx("09:00", "09:00", 48)).toBe(0);
  });
});
