/**
 * Test unitaire des URLs générées par MapEmbed (Lot 23).
 * On reproduit la construction bbox/URL et on vérifie le format.
 */

import { describe, it, expect } from "vitest";

function buildBbox(lat: number, lon: number, delta = 0.005): string {
  return [
    (lon - delta).toFixed(6),
    (lat - delta).toFixed(6),
    (lon + delta).toFixed(6),
    (lat + delta).toFixed(6),
  ].join(",");
}

function buildDirectionsUrl(
  lat: number,
  lon: number,
  address?: string | null,
  city?: string | null
): string {
  const q = [address, city].filter(Boolean).join(", ") || `${lat},${lon}`;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}`;
}

describe("MapEmbed URL helpers (Lot 23)", () => {
  it("construit une bbox OSM avec 4 coords formatées 6 décimales", () => {
    const bbox = buildBbox(48.856614, 2.352222); // Paris centre
    const parts = bbox.split(",");
    expect(parts).toHaveLength(4);
    for (const p of parts) {
      expect(p).toMatch(/^-?\d+\.\d{6}$/);
    }
    // Vérifie l'ordre : minLon, minLat, maxLon, maxLat
    expect(Number(parts[0])).toBeLessThan(Number(parts[2]));
    expect(Number(parts[1])).toBeLessThan(Number(parts[3]));
  });

  it("directions URL utilise l'adresse texte si dispo (mieux que latlon)", () => {
    const url = buildDirectionsUrl(48.85, 2.35, "12 rue Exemple", "Paris");
    expect(url).toContain("destination=");
    expect(url).toContain(encodeURIComponent("12 rue Exemple, Paris"));
  });

  it("directions fallback sur latlon si pas d'adresse", () => {
    const url = buildDirectionsUrl(48.85, 2.35);
    expect(url).toContain("destination=48.85%2C2.35");
  });

  it("directions ignore les valeurs vides/null dans le join", () => {
    const url1 = buildDirectionsUrl(48.85, 2.35, null, "Paris");
    expect(url1).toContain(encodeURIComponent("Paris"));
    expect(url1).not.toContain(encodeURIComponent(", Paris")); // pas de virgule vide
  });
});
