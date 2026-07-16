/**
 * Lot 50 — Test composant <Badge> (sanité setup React).
 *
 * Vérifie que le pipeline testing-library + jsdom + jest-dom fonctionne.
 * Badge est trivial mais valide toute la chaîne. Si ce test passe, on peut
 * tester les composants plus complexes en confiance.
 */

import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Badge } from "@/components/ui/Badge";

describe("<Badge />", () => {
  it("rend le texte enfant", () => {
    render(<Badge>Nouveau</Badge>);
    expect(screen.getByText("Nouveau")).toBeInTheDocument();
  });

  it("applique la classe par défaut (variant=default)", () => {
    render(<Badge>Test</Badge>);
    const el = screen.getByText("Test");
    // La classe default contient bg-slate-100 (voir Badge.tsx)
    expect(el.className).toContain("bg-slate-100");
  });

  it("applique la variante success", () => {
    render(<Badge variant="success">Payé</Badge>);
    const el = screen.getByText("Payé");
    expect(el.className).toContain("bg-emerald");
  });

  it("applique la variante danger", () => {
    render(<Badge variant="danger">Annulé</Badge>);
    const el = screen.getByText("Annulé");
    expect(el.className).toContain("bg-red");
  });

  it("fusionne className custom via cn()", () => {
    render(
      <Badge className="my-custom-class" data-testid="badge">
        X
      </Badge>
    );
    const el = screen.getByTestId("badge");
    expect(el.className).toContain("my-custom-class");
    // La classe par défaut reste appliquée
    expect(el.className).toContain("rounded-full");
  });
});
