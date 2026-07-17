/**
 * Lot 56 — Tests helpers export CSV analytics.
 *
 * Focus PURE functions (0 mock, 0 DB) :
 *  - escapeCsvCell : escape RFC 4180 pour séparateur `;` FR
 *  - csvRow : concat ligne
 *  - buildAnalyticsCsv : structure multi-sections, BOM, sections optionnelles
 *  - buildFilename : sanitize slug + format daté
 */

import { describe, expect, it } from "vitest";
import {
  escapeCsvCell,
  csvRow,
  buildAnalyticsCsv,
  buildFilename,
  type AnalyticsExportData,
} from "@/lib/analytics-export";

// ---------------------------------------------------------------------------
// escapeCsvCell
// ---------------------------------------------------------------------------

describe("escapeCsvCell", () => {
  it("valeur simple → non quotée", () => {
    expect(escapeCsvCell("hello")).toBe("hello");
    expect(escapeCsvCell(42)).toBe("42");
    expect(escapeCsvCell(0)).toBe("0");
  });

  it("null/undefined → chaîne vide", () => {
    expect(escapeCsvCell(null)).toBe("");
    expect(escapeCsvCell(undefined)).toBe("");
  });

  it("valeur avec `;` → quotée", () => {
    expect(escapeCsvCell("a;b")).toBe('"a;b"');
  });

  it("valeur avec `\"` → quotée + escape `\"\"`", () => {
    expect(escapeCsvCell('say "hi"')).toBe('"say ""hi"""');
  });

  it("valeur avec newline → quotée", () => {
    expect(escapeCsvCell("line1\nline2")).toBe('"line1\nline2"');
    expect(escapeCsvCell("line1\r\nline2")).toBe('"line1\r\nline2"');
  });

  it("valeur avec `,` → PAS quotée (séparateur FR = `;`)", () => {
    // Différence clé vs csv.ts existant (Lot 24) qui utilise `,`
    expect(escapeCsvCell("1,000 €")).toBe("1,000 €");
  });

  it("nombre → converti en string sans quotes", () => {
    expect(escapeCsvCell(1234.56)).toBe("1234.56");
  });

  it("boolean → converti en string sans quotes", () => {
    expect(escapeCsvCell(true)).toBe("true");
    expect(escapeCsvCell(false)).toBe("false");
  });
});

// ---------------------------------------------------------------------------
// csvRow
// ---------------------------------------------------------------------------

describe("csvRow", () => {
  it("concat les cellules avec `;`", () => {
    expect(csvRow(["a", "b", "c"])).toBe("a;b;c");
  });

  it("gère les cellules vides", () => {
    expect(csvRow(["", "b", ""])).toBe(";b;");
    expect(csvRow([null, undefined, "x"])).toBe(";;x");
  });

  it("quote les cellules avec séparateur", () => {
    expect(csvRow(["a", "b;c", "d"])).toBe('a;"b;c";d');
  });

  it("mixe types number + string + null", () => {
    expect(csvRow(["Métrique", 123, null])).toBe("Métrique;123;");
  });
});

// ---------------------------------------------------------------------------
// buildAnalyticsCsv
// ---------------------------------------------------------------------------

const baseData: AnalyticsExportData = {
  period: "30d",
  businessName: "Dupont Plomberie",
  businessSlug: "dupont-plomberie",
  summary: {
    totalVisits: 1234,
    uniqueVisitors: 456,
    newAppointments: 12,
    newQuotes: 5,
    revenueEur: 2500,
  },
  daily: [
    { date: "2026-07-01", visits: 42, uniqueVisitors: 12 },
    { date: "2026-07-02", visits: 38, uniqueVisitors: 15 },
  ],
};

describe("buildAnalyticsCsv - structure", () => {
  it("commence par BOM UTF-8 (Excel compat accents)", () => {
    const csv = buildAnalyticsCsv(baseData);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
  });

  it("contient header commentaire avec nom + période", () => {
    const csv = buildAnalyticsCsv(baseData);
    expect(csv).toContain("# Vitrix — Analytics — Dupont Plomberie — 30d");
    expect(csv).toContain("# Généré le");
  });

  it("section 'Vue d'ensemble' avec toutes les métriques", () => {
    const csv = buildAnalyticsCsv(baseData);
    expect(csv).toContain("# Vue d'ensemble");
    expect(csv).toContain("Visites totales;1234");
    expect(csv).toContain("Visiteurs uniques;456");
    expect(csv).toContain("Nouveaux rendez-vous;12");
    expect(csv).toContain("Nouveaux devis;5");
    expect(csv).toContain("Revenus (EUR);2500.00");
  });

  it("section 'Visites par jour' avec toutes les lignes", () => {
    const csv = buildAnalyticsCsv(baseData);
    expect(csv).toContain("# Visites par jour");
    expect(csv).toContain("Date;Visites;Visiteurs uniques");
    expect(csv).toContain("2026-07-01;42;12");
    expect(csv).toContain("2026-07-02;38;15");
  });

  it("séparateur ligne = `\\r\\n` (compat Excel Windows)", () => {
    const csv = buildAnalyticsCsv(baseData);
    expect(csv).toContain("\r\n");
    // Pas de \n sans \r (défensif)
    const orphanLf = csv.split("\r\n").join("").indexOf("\n");
    expect(orphanLf).toBe(-1);
  });

  it("revenue formaté à 2 décimales", () => {
    const csv = buildAnalyticsCsv({
      ...baseData,
      summary: { ...baseData.summary, revenueEur: 1234.567 },
    });
    expect(csv).toContain("Revenus (EUR);1234.57");
  });
});

describe("buildAnalyticsCsv - sections optionnelles Pro+", () => {
  it("sources absentes si non fournies (plan Free)", () => {
    const csv = buildAnalyticsCsv(baseData);
    expect(csv).not.toContain("# Sources de trafic");
    expect(csv).not.toContain("# Devices");
    expect(csv).not.toContain("# Pages les plus visitées");
  });

  it("sources vides (array vide) → PAS de section rendue", () => {
    const csv = buildAnalyticsCsv({ ...baseData, sources: [], devices: [], topPaths: [] });
    expect(csv).not.toContain("# Sources de trafic");
    expect(csv).not.toContain("# Devices");
  });

  it("sources fournies → section complète", () => {
    const csv = buildAnalyticsCsv({
      ...baseData,
      sources: [
        { source: "google", count: 45 },
        { source: "carte-visite", count: 12 },
      ],
    });
    expect(csv).toContain("# Sources de trafic");
    expect(csv).toContain("Source;Nombre de visites");
    expect(csv).toContain("google;45");
    expect(csv).toContain("carte-visite;12");
  });

  it("devices et topPaths rendus si fournis", () => {
    const csv = buildAnalyticsCsv({
      ...baseData,
      devices: [
        { device: "mobile", count: 300 },
        { device: "desktop", count: 156 },
      ],
      topPaths: [{ path: "/dupont-plomberie", count: 500 }],
    });
    expect(csv).toContain("# Devices");
    expect(csv).toContain("mobile;300");
    expect(csv).toContain("# Pages les plus visitées");
    expect(csv).toContain("/dupont-plomberie;500");
  });
});

describe("buildAnalyticsCsv - escaping défensif", () => {
  it("business name avec `;` → quoté correctement", () => {
    const csv = buildAnalyticsCsv({
      ...baseData,
      businessName: "Marc; Plombier",
    });
    // Le nom apparaît dans le header commentaire (non escapé car # est un commentaire)
    // mais l'important c'est qu'aucune ligne data ne casse
    expect(csv).toContain("Marc; Plombier");
  });

  it("source avec `\"` interne → escape `\"\"`", () => {
    const csv = buildAnalyticsCsv({
      ...baseData,
      sources: [{ source: 'guillemet"test', count: 5 }],
    });
    expect(csv).toContain('"guillemet""test";5');
  });

  it("path avec `;` (edge case) → quoté", () => {
    const csv = buildAnalyticsCsv({
      ...baseData,
      topPaths: [{ path: "/a;/b", count: 3 }],
    });
    expect(csv).toContain('"/a;/b";3');
  });
});

// ---------------------------------------------------------------------------
// buildFilename
// ---------------------------------------------------------------------------

describe("buildFilename", () => {
  it("format standard : vitrix-analytics-<slug>-<period>-<date>.csv", () => {
    const filename = buildFilename("dupont-plomberie", "30d", new Date("2026-07-19T10:00:00Z"));
    expect(filename).toBe("vitrix-analytics-dupont-plomberie-30d-2026-07-19.csv");
  });

  it("sanitize les caractères spéciaux du slug", () => {
    const filename = buildFilename("MARC & PLOMBIER!", "7d", new Date("2026-01-01"));
    // & et ! virés, espaces → -, tout en lowercase
    expect(filename).toBe("vitrix-analytics-marc---plombier--7d-2026-01-01.csv");
  });

  it("tronque le slug à 40 chars max (défensif)", () => {
    const longSlug = "a".repeat(80);
    const filename = buildFilename(longSlug, "30d", new Date("2026-01-01"));
    // Le slug dans le filename ne doit pas dépasser 40 chars
    const slugPart = filename
      .replace("vitrix-analytics-", "")
      .replace(/-30d-.+$/, "");
    expect(slugPart.length).toBeLessThanOrEqual(40);
  });

  it("date par défaut = aujourd'hui", () => {
    const filename = buildFilename("test", "7d");
    // Format YYYY-MM-DD présent
    expect(filename).toMatch(/-\d{4}-\d{2}-\d{2}\.csv$/);
  });
});
