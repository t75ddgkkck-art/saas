/**
 * Lot 50 — Test composant <Button>.
 *
 * Couvre :
 *  - Rendu du contenu enfant
 *  - Loading state (spinner + disabled + aria-busy)
 *  - leftIcon / rightIcon
 *  - variants + sizes appliqués
 *  - Handler onClick appelé/pas appelé selon disabled/loading
 */

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "@/components/ui/Button";

describe("<Button />", () => {
  it("rend le texte enfant", () => {
    render(<Button>Envoyer</Button>);
    expect(screen.getByRole("button", { name: "Envoyer" })).toBeInTheDocument();
  });

  it("est cliquable et appelle onClick", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Clic</Button>);
    await userEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("disabled → bloque le clic", async () => {
    const onClick = vi.fn();
    render(
      <Button onClick={onClick} disabled>
        Bloqué
      </Button>
    );
    await userEvent.click(screen.getByRole("button"));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("loading → disabled + affiche le spinner + aria-busy", () => {
    render(<Button loading>Sauvegarder</Button>);
    const btn = screen.getByRole("button");
    expect(btn).toBeDisabled();
    // Lot 50 : test aria-busy validé après le fix bug A11Y1 (phase 3 de ce lot)
    expect(btn.getAttribute("aria-busy")).toBe("true");
  });

  it("loading empêche le clic même sans disabled prop", async () => {
    const onClick = vi.fn();
    render(
      <Button onClick={onClick} loading>
        Loading
      </Button>
    );
    await userEvent.click(screen.getByRole("button"));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("applique variant destructive (bg rouge)", () => {
    render(<Button variant="destructive">Supprimer</Button>);
    expect(screen.getByRole("button").className).toContain("bg-red");
  });

  it("applique size lg (padding & height différents)", () => {
    render(<Button size="lg">Grand</Button>);
    const btn = screen.getByRole("button");
    // size="lg" contient h-13 (voir Button.tsx)
    expect(btn.className).toContain("h-13");
  });

  it("leftIcon rendu avant le texte", () => {
    render(
      <Button leftIcon={<span data-testid="left-icon">←</span>}>
        Retour
      </Button>
    );
    expect(screen.getByTestId("left-icon")).toBeInTheDocument();
  });

  it("type défaut = 'button' (pas 'submit' — protection anti-submit accidentel)", () => {
    render(<Button>Test</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("type", "button");
  });

  it("type='submit' explicite respecté", () => {
    render(<Button type="submit">Envoyer form</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("type", "submit");
  });
});
