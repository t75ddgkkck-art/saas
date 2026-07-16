/**
 * Lot 50 — Test <ConfirmDialog> (Lot 22).
 *
 * Utilisé partout pour les actions destructives (supprimer devis, annuler abo, etc.).
 * Critique : un mauvais handler = suppression accidentelle.
 */

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

describe("<ConfirmDialog />", () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onConfirm: vi.fn(),
    title: "Supprimer ?",
  };

  it("rend title + boutons Confirmer/Annuler par défaut", () => {
    render(<ConfirmDialog {...defaultProps} />);
    expect(screen.getByText("Supprimer ?")).toBeInTheDocument();
    // Labels FR par défaut
    expect(screen.getByRole("button", { name: /confirmer/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /annuler/i })).toBeInTheDocument();
  });

  it("labels custom respectés", () => {
    render(
      <ConfirmDialog
        {...defaultProps}
        confirmLabel="Supprimer définitivement"
        cancelLabel="Retour"
      />
    );
    expect(
      screen.getByRole("button", { name: "Supprimer définitivement" })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retour" })).toBeInTheDocument();
  });

  it("clic Confirmer → onConfirm appelé", async () => {
    const onConfirm = vi.fn();
    render(<ConfirmDialog {...defaultProps} onConfirm={onConfirm} />);
    await userEvent.click(screen.getByRole("button", { name: /confirmer/i }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("clic Annuler → onClose appelé (pas onConfirm)", async () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    render(<ConfirmDialog {...defaultProps} onConfirm={onConfirm} onClose={onClose} />);
    await userEvent.click(screen.getByRole("button", { name: /annuler/i }));
    expect(onClose).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("variant danger → bouton confirmer rouge", () => {
    render(<ConfirmDialog {...defaultProps} variant="danger" />);
    const confirmBtn = screen.getByRole("button", { name: /confirmer/i });
    // Danger utilise bg-red (voir Button variant destructive/danger)
    expect(confirmBtn.className).toContain("bg-red");
  });

  it("requireTypedConfirmation → confirm bloqué tant que pas tapé", async () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        {...defaultProps}
        onConfirm={onConfirm}
        requireTypedConfirmation="SUPPRIMER"
      />
    );
    // Le bouton confirmer doit être disabled au départ
    const confirmBtn = screen.getByRole("button", { name: /confirmer/i });
    expect(confirmBtn).toBeDisabled();

    // Tapons la confirmation
    const input = screen.getByRole("textbox");
    await userEvent.type(input, "SUPPRIMER");
    expect(confirmBtn).not.toBeDisabled();

    await userEvent.click(confirmBtn);
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("requireTypedConfirmation → texte incorrect ne débloque pas", async () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        {...defaultProps}
        onConfirm={onConfirm}
        requireTypedConfirmation="SUPPRIMER"
      />
    );
    await userEvent.type(screen.getByRole("textbox"), "supprimer"); // lowercase
    expect(screen.getByRole("button", { name: /confirmer/i })).toBeDisabled();
  });
});
