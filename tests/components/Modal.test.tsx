/**
 * Lot 50 — Test composant <Modal>.
 *
 * Focus a11y : role=dialog, aria-modal, ferme sur Escape, appelle onClose sur clic overlay.
 */

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Modal } from "@/components/ui/Modal";

describe("<Modal />", () => {
  it("rend rien quand isOpen=false", () => {
    render(
      <Modal isOpen={false} onClose={() => {}} title="Test">
        <p>Contenu</p>
      </Modal>
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("rend le contenu quand isOpen=true", () => {
    render(
      <Modal isOpen onClose={() => {}} title="Confirmation">
        <p>Corps du modal</p>
      </Modal>
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Corps du modal")).toBeInTheDocument();
  });

  it("aria-modal=true + role=dialog", () => {
    render(
      <Modal isOpen onClose={() => {}} title="A11y test">
        <p>Body</p>
      </Modal>
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
  });

  it("title rendu comme heading + relié via aria-labelledby", () => {
    render(
      <Modal isOpen onClose={() => {}} title="Supprimer ?">
        <p>Content</p>
      </Modal>
    );
    const dialog = screen.getByRole("dialog");
    const titleId = dialog.getAttribute("aria-labelledby");
    expect(titleId).toBeTruthy();
    const heading = document.getElementById(titleId!);
    expect(heading).toHaveTextContent("Supprimer ?");
  });

  it("Escape → appelle onClose", async () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen onClose={onClose} title="Test">
        <p>Body</p>
      </Modal>
    );
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("closeOnEscape=false → Escape ne ferme PAS", async () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen onClose={onClose} title="Test" closeOnEscape={false}>
        <p>Body</p>
      </Modal>
    );
    await userEvent.keyboard("{Escape}");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("description rendue si fournie", () => {
    render(
      <Modal isOpen onClose={() => {}} title="Titre" description="Description longue ici">
        <p>Body</p>
      </Modal>
    );
    expect(screen.getByText("Description longue ici")).toBeInTheDocument();
  });
});
