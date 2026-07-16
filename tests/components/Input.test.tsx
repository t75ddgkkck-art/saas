/**
 * Lot 50 — Test composant <Input>.
 *
 * Focus accessibilité (labels associés, aria-invalid, aria-describedby)
 * et interactions (typing, controlled state).
 */

import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Input } from "@/components/ui/Input";

describe("<Input />", () => {
  it("rend le label associé à l'input (a11y)", () => {
    render(<Input label="Email" />);
    const input = screen.getByLabelText("Email");
    expect(input).toBeInTheDocument();
    expect(input.tagName).toBe("INPUT");
  });

  it("passe le placeholder", () => {
    render(<Input label="Email" placeholder="vous@exemple.com" />);
    expect(screen.getByPlaceholderText("vous@exemple.com")).toBeInTheDocument();
  });

  it("état contrôlé — value passe à l'input", () => {
    render(<Input label="Nom" value="Dupont" onChange={() => {}} />);
    const input = screen.getByLabelText("Nom") as HTMLInputElement;
    expect(input.value).toBe("Dupont");
  });

  it("onChange déclenché quand l'user tape", async () => {
    let val = "";
    const { rerender } = render(
      <Input
        label="Nom"
        value={val}
        onChange={(e) => {
          val = e.target.value;
        }}
      />
    );
    await userEvent.type(screen.getByLabelText("Nom"), "Jean");
    // Le composant est contrôlé — rerender pour appliquer la valeur
    rerender(<Input label="Nom" value="Jean" onChange={() => {}} />);
    expect((screen.getByLabelText("Nom") as HTMLInputElement).value).toBe("Jean");
  });

  it("error → aria-invalid=true + rôle alert", () => {
    render(<Input label="Email" error="Email invalide" />);
    const input = screen.getByLabelText("Email");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    // Le message d'erreur est un role=alert
    expect(screen.getByRole("alert")).toHaveTextContent("Email invalide");
  });

  it("error → aria-describedby pointe sur le message d'erreur", () => {
    render(<Input label="Email" error="Erreur" />);
    const input = screen.getByLabelText("Email");
    const describedBy = input.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    // L'ID de l'alert = describedBy
    const alert = screen.getByRole("alert");
    expect(alert.id).toBe(describedBy);
  });

  it("helperText affiché si pas d'error", () => {
    render(<Input label="Mot de passe" helperText="8 caractères minimum" />);
    expect(screen.getByText("8 caractères minimum")).toBeInTheDocument();
    // Pas d'aria-invalid quand pas d'erreur
    expect(screen.getByLabelText("Mot de passe").getAttribute("aria-invalid")).toBeNull();
  });

  it("helperText MASQUÉ quand error présent (priorité au warning)", () => {
    render(
      <Input label="Email" helperText="Format standard" error="Email invalide" />
    );
    expect(screen.queryByText("Format standard")).not.toBeInTheDocument();
    expect(screen.getByText("Email invalide")).toBeInTheDocument();
  });

  it("required → attribut passé", () => {
    render(<Input label="Nom" required />);
    expect(screen.getByLabelText("Nom")).toBeRequired();
  });

  it("type=email et autres attrs HTML passent", () => {
    render(<Input label="Email" type="email" autoComplete="email" />);
    const input = screen.getByLabelText("Email");
    expect(input).toHaveAttribute("type", "email");
    expect(input).toHaveAttribute("autocomplete", "email");
  });
});
