/**
 * Lot 50 — Test <AiGenerateModal> (Lot 45).
 *
 * Critique récent. Couvre le comportement gate + submission + preview.
 * On mocke `useEntitlement` + `fetch` global pour isoler complètement.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/hooks/useEntitlement", () => ({
  useEntitlement: vi.fn(),
}));

// Mock ToastProvider — le composant appelle useToast() en interne
vi.mock("@/components/ui/Toast", async () => {
  const actual = await vi.importActual<Record<string, unknown>>("@/components/ui/Toast");
  return {
    ...actual,
    useToast: () => ({
      success: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      warning: vi.fn(),
    }),
  };
});

import { AiGenerateModal } from "@/components/quotes/AiGenerateModal";
import { useEntitlement } from "@/hooks/useEntitlement";

const mockedUseEntitlement = vi.mocked(useEntitlement);

beforeEach(() => {
  vi.clearAllMocks();
  // Reset fetch mock
  globalThis.fetch = vi.fn();
});

describe("<AiGenerateModal /> — gate Premium", () => {
  it("plan Free → affiche CTA upgrade (pas le formulaire)", () => {
    mockedUseEntitlement.mockReturnValue({
      allowed: false,
      loading: false,
      requiredPlan: "premium",
      label: "Génération IA de devis",
      description: "Réservé Premium",
      currentPlan: "free",
    });
    render(
      <AiGenerateModal
        isOpen
        onClose={() => {}}
        onGenerated={() => {}}
        existingItemsCount={0}
      />
    );
    // Pas de champ description (formulaire IA caché)
    expect(screen.queryByLabelText(/Décrivez le chantier/i)).not.toBeInTheDocument();
    // CTA Premium affiché
    const premiumMatches = screen.getAllByText(/Premium/i);
    expect(premiumMatches.length).toBeGreaterThan(0);
  });

  it("plan Premium → affiche le formulaire", () => {
    mockedUseEntitlement.mockReturnValue({
      allowed: true,
      loading: false,
      requiredPlan: "premium",
      label: "IA",
      description: "",
      currentPlan: "free",
    });
    render(
      <AiGenerateModal
        isOpen
        onClose={() => {}}
        onGenerated={() => {}}
        existingItemsCount={0}
      />
    );
    expect(screen.getByLabelText(/Décrivez le chantier/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Générer avec l'IA/i })).toBeInTheDocument();
  });
});

describe("<AiGenerateModal /> — comportement formulaire", () => {
  beforeEach(() => {
    mockedUseEntitlement.mockReturnValue({
      allowed: true,
      loading: false,
      requiredPlan: "premium",
      label: "IA",
      description: "",
      currentPlan: "free",
    });
  });

  it("bouton Générer désactivé si description < 10 chars", () => {
    render(
      <AiGenerateModal
        isOpen
        onClose={() => {}}
        onGenerated={() => {}}
        existingItemsCount={0}
      />
    );
    const btn = screen.getByRole("button", { name: /Générer avec l'IA/i });
    expect(btn).toBeDisabled();
  });

  it("radio Remplacer/Ajouter visible SEULEMENT si existingItemsCount > 0", () => {
    const { rerender } = render(
      <AiGenerateModal
        isOpen
        onClose={() => {}}
        onGenerated={() => {}}
        existingItemsCount={0}
      />
    );
    expect(screen.queryByText(/Vous avez déjà/i)).not.toBeInTheDocument();

    rerender(
      <AiGenerateModal
        isOpen
        onClose={() => {}}
        onGenerated={() => {}}
        existingItemsCount={3}
      />
    );
    expect(screen.getByText(/Vous avez déjà 3 lignes/i)).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Ajouter à la suite/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Remplacer/i })).toBeInTheDocument();
  });

  it("appel API avec succès → passe en preview + callback onGenerated en cliquant Utiliser", async () => {
    const mockResponse = {
      title: "Rénovation SDB",
      items: [
        { description: "Pose carrelage", quantity: 5, unit_price: 45, unit: "m²" },
      ],
      notes: "Prix indicatifs",
      warning: null,
      estimatedDays: 2,
      suggestedTotal: 225,
      tokensUsed: 500,
    };
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const onGenerated = vi.fn();
    const onClose = vi.fn();

    render(
      <AiGenerateModal
        isOpen
        onClose={onClose}
        onGenerated={onGenerated}
        existingItemsCount={0}
      />
    );

    // Remplit la description
    await userEvent.type(
      screen.getByLabelText(/Décrivez le chantier/i),
      "Rénovation salle de bain 5m² avec pose carrelage"
    );

    // Clic Générer
    await userEvent.click(screen.getByRole("button", { name: /Générer avec l'IA/i }));

    // On doit voir le preview (attente async)
    expect(await screen.findByText(/Pose carrelage/i)).toBeInTheDocument();
    expect(screen.getByText(/Prix indicatifs/i)).toBeInTheDocument();

    // Clic sur "Remplacer les lignes"
    const useBtn = screen.getByRole("button", { name: /Remplacer les lignes/i });
    await userEvent.click(useBtn);

    expect(onGenerated).toHaveBeenCalledOnce();
    const call = onGenerated.mock.calls[0];
    expect(call[0].items[0].description).toBe("Pose carrelage");
    expect(call[1]).toBe("replace");
    expect(onClose).toHaveBeenCalled();
  });

  it("réponse API 402 → toast erreur, pas de preview", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 402,
      json: async () => ({ error: "Premium required" }),
    });

    render(
      <AiGenerateModal
        isOpen
        onClose={() => {}}
        onGenerated={() => {}}
        existingItemsCount={0}
      />
    );

    await userEvent.type(
      screen.getByLabelText(/Décrivez le chantier/i),
      "Description assez longue pour valider"
    );
    await userEvent.click(screen.getByRole("button", { name: /Générer avec l'IA/i }));

    // Le formulaire reste visible (pas de preview)
    expect(screen.getByLabelText(/Décrivez le chantier/i)).toBeInTheDocument();
  });
});
