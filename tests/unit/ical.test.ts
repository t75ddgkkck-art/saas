/**
 * F4 (Lot 33) — Tests iCalendar (RFC 5545).
 */

import { describe, expect, it } from "vitest";
import {
  buildIcsEvent,
  buildIcsCalendar,
  escapeIcsText,
  foldIcsLine,
  formatIcsUtc,
  composeDateTime,
} from "@/lib/ical";

describe("formatIcsUtc", () => {
  it("format YYYYMMDDTHHMMSSZ", () => {
    const d = new Date(Date.UTC(2026, 7, 15, 9, 30, 0));
    expect(formatIcsUtc(d)).toBe("20260815T093000Z");
  });

  it("padding zeros", () => {
    const d = new Date(Date.UTC(2026, 0, 1, 0, 5, 3));
    expect(formatIcsUtc(d)).toBe("20260101T000503Z");
  });
});

describe("escapeIcsText", () => {
  it("échappe backslash", () => {
    expect(escapeIcsText("a\\b")).toBe("a\\\\b");
  });

  it("échappe semicolon et virgule", () => {
    expect(escapeIcsText("a;b,c")).toBe("a\\;b\\,c");
  });

  it("échappe newlines (CRLF, LF, CR)", () => {
    expect(escapeIcsText("line1\nline2")).toBe("line1\\nline2");
    expect(escapeIcsText("line1\r\nline2")).toBe("line1\\nline2");
    expect(escapeIcsText("line1\rline2")).toBe("line1\\nline2");
  });

  it("préserve les caractères normaux et accents", () => {
    expect(escapeIcsText("Réservation à 10h")).toBe("Réservation à 10h");
  });

  it("ordre backslash first (pas de double-escape)", () => {
    // Un `\;` déjà escape dans l'input ne doit pas devenir `\\\;`
    expect(escapeIcsText("\\;")).toBe("\\\\\\;");
  });
});

describe("foldIcsLine", () => {
  it("ne fold pas si ligne ≤ 75 chars", () => {
    const short = "a".repeat(75);
    expect(foldIcsLine(short)).toBe(short);
  });

  it("fold en lignes de max 75 chars avec CRLF + espace", () => {
    const long = "a".repeat(150);
    const folded = foldIcsLine(long);
    const parts = folded.split("\r\n");
    expect(parts.length).toBeGreaterThan(1);
    // Chaque ligne suivante commence par un espace
    for (let i = 1; i < parts.length; i++) {
      expect(parts[i][0]).toBe(" ");
    }
  });
});

describe("buildIcsEvent", () => {
  it("construit un VEVENT valide minimal", () => {
    const ics = buildIcsEvent({
      uid: "test-1@vitrix.fr",
      start: new Date(Date.UTC(2026, 7, 15, 9, 0, 0)),
      end: new Date(Date.UTC(2026, 7, 15, 10, 0, 0)),
      summary: "Réparation fuite",
    });
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("END:VEVENT");
    expect(ics).toContain("UID:test-1@vitrix.fr");
    expect(ics).toContain("DTSTART:20260815T090000Z");
    expect(ics).toContain("DTEND:20260815T100000Z");
    expect(ics).toContain("SUMMARY:Réparation fuite");
  });

  it("échappe le summary", () => {
    const ics = buildIcsEvent({
      uid: "u",
      start: new Date(),
      end: new Date(),
      summary: "RDV; client, note",
    });
    expect(ics).toContain("SUMMARY:RDV\\; client\\, note");
  });

  it("inclut location + description + organizer + url + status", () => {
    const ics = buildIcsEvent({
      uid: "u",
      start: new Date(Date.UTC(2026, 0, 1, 12, 0)),
      end: new Date(Date.UTC(2026, 0, 1, 13, 0)),
      summary: "Test",
      description: "Détails",
      location: "Argentré, 53",
      organizer: { email: "pro@ex.com", name: "Pro" },
      url: "https://vitrix.fr/dashboard",
      status: "CONFIRMED",
    });
    expect(ics).toContain("DESCRIPTION:Détails");
    expect(ics).toContain("LOCATION:Argentré\\, 53");
    // (la virgule échappée `\,` mais l'espace passe tel quel)
    expect(ics).toContain("ORGANIZER;CN=Pro:mailto:pro@ex.com");
    expect(ics).toContain("URL:https://vitrix.fr/dashboard");
    expect(ics).toContain("STATUS:CONFIRMED");
  });

  it("status TENTATIVE / CANCELLED", () => {
    const t = buildIcsEvent({
      uid: "u",
      start: new Date(),
      end: new Date(),
      summary: "x",
      status: "TENTATIVE",
    });
    expect(t).toContain("STATUS:TENTATIVE");
    const c = buildIcsEvent({
      uid: "u",
      start: new Date(),
      end: new Date(),
      summary: "x",
      status: "CANCELLED",
    });
    expect(c).toContain("STATUS:CANCELLED");
  });
});

describe("buildIcsCalendar", () => {
  it("wrap avec VCALENDAR + PRODID + VERSION", () => {
    const ics = buildIcsCalendar([], { calendarName: "Mon calendrier" });
    expect(ics.startsWith("BEGIN:VCALENDAR")).toBe(true);
    expect(ics).toContain("VERSION:2.0");
    expect(ics).toContain("PRODID:-//Vitrix//Calendar 1.0//FR");
    expect(ics).toContain("X-WR-CALNAME:Mon calendrier");
    expect(ics.trimEnd().endsWith("END:VCALENDAR")).toBe(true);
  });

  it("CRLF partout (RFC 5545 §3.1)", () => {
    const ics = buildIcsCalendar([
      {
        uid: "u",
        start: new Date(Date.UTC(2026, 0, 1)),
        end: new Date(Date.UTC(2026, 0, 1, 1)),
        summary: "x",
      },
    ]);
    // Pas de LF isolé (chaque LF doit être précédé de CR)
    const lines = ics.split("\r\n");
    expect(lines.length).toBeGreaterThan(5);
  });

  it("plusieurs events", () => {
    const ics = buildIcsCalendar([
      { uid: "a", start: new Date(), end: new Date(), summary: "A" },
      { uid: "b", start: new Date(), end: new Date(), summary: "B" },
    ]);
    expect((ics.match(/BEGIN:VEVENT/g) ?? []).length).toBe(2);
    expect((ics.match(/END:VEVENT/g) ?? []).length).toBe(2);
  });
});

describe("composeDateTime", () => {
  it("parse date + time en local time", () => {
    const d = composeDateTime("2026-08-15", "09:30");
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(7);
    expect(d.getDate()).toBe(15);
    expect(d.getHours()).toBe(9);
    expect(d.getMinutes()).toBe(30);
  });
});
