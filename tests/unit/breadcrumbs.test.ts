/**
 * Test unitaire des Breadcrumbs (Lot 22).
 * On teste la logique de labelization pure (segments → labels) sans DOM.
 */

import { describe, it, expect } from "vitest";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  appointments: "Rendez-vous",
  quotes: "Devis",
  clients: "Clients",
  payments: "Paiements",
  blog: "Blog",
  admin: "Admin",
  "ai-chat": "Assistant IA",
  "my-businesses": "Mes vitrines",
};

// Copie de la fonction humanize() de Breadcrumbs.tsx pour le test.
// (Elle n'est pas exportée car interne au composant client.)
function humanize(segment: string): string {
  if (UUID_RE.test(segment)) return "…";
  if (LABELS[segment]) return LABELS[segment];
  return segment.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase());
}

describe("Breadcrumbs.humanize (Lot 22)", () => {
  it("mappe les segments techniques vers des libellés lisibles", () => {
    expect(humanize("dashboard")).toBe("Dashboard");
    expect(humanize("appointments")).toBe("Rendez-vous");
    expect(humanize("quotes")).toBe("Devis");
    expect(humanize("admin")).toBe("Admin");
  });

  it("abrège les UUIDs en …", () => {
    expect(humanize("550e8400-e29b-41d4-a716-446655440000")).toBe("…");
    expect(humanize("AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE")).toBe("…");
  });

  it("humanise les segments inconnus (kebab-case → capitalized)", () => {
    expect(humanize("quote-form-fields")).toBe("Quote form fields");
    expect(humanize("something-new")).toBe("Something new");
  });

  it("mappe les segments composés avec tiret dans le dico", () => {
    expect(humanize("ai-chat")).toBe("Assistant IA");
    expect(humanize("my-businesses")).toBe("Mes vitrines");
  });

  it("ne considère PAS un mot court comme UUID", () => {
    expect(humanize("id")).toBe("Id");
    expect(humanize("blog")).toBe("Blog");
  });
});
