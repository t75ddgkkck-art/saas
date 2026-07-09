import { describe, it, expect } from "vitest";
import {
  DEFAULT_TIMEZONE,
  formatSlot,
  shouldWarnTimezoneMismatch,
  tzOffsetMinutes,
} from "@/lib/timezone";

describe("timezone utils", () => {
  it("expose Europe/Paris comme défaut", () => {
    expect(DEFAULT_TIMEZONE).toBe("Europe/Paris");
  });

  it("calcule un offset positif pour Paris (UTC+1 hiver / +2 été)", () => {
    const offset = tzOffsetMinutes("Europe/Paris");
    // En été = 120, en hiver = 60 → toujours > 0
    expect(offset).toBeGreaterThan(0);
    expect(offset).toBeLessThanOrEqual(120);
  });

  it("calcule un offset négatif pour la Martinique (UTC-4)", () => {
    const offset = tzOffsetMinutes("America/Martinique");
    expect(offset).toBe(-240);
  });

  it("formatte un slot en fr-FR", () => {
    const s = formatSlot("2026-07-15", "14:30", "Europe/Paris", "fr-FR");
    expect(s).toMatch(/2026/);
    expect(s.toLowerCase()).toContain("14:30");
  });

  it("ajoute le label TZ quand demandé", () => {
    const s = formatSlot("2026-07-15", "14:30", "Europe/Paris", "fr-FR", { withTz: true });
    expect(s).toContain("Paris");
  });

  it("détecte un vrai mismatch de TZ (Paris vs Martinique)", () => {
    expect(shouldWarnTimezoneMismatch("Europe/Paris", "America/Martinique")).toBe(true);
  });

  it("ne warn pas quand les TZ sont identiques", () => {
    expect(shouldWarnTimezoneMismatch("Europe/Paris", "Europe/Paris")).toBe(false);
  });
});
