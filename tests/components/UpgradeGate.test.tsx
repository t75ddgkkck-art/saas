/**
 * Lot 50 — Test <UpgradeGate> (F1, Lot 29).
 *
 * Critique business : ce composant est utilisé PARTOUT pour gater les features
 * Premium. Un bug ici = feature payante offerte gratuitement OU inversement
 * feature Free bloquée par erreur.
 *
 * On mocke `useEntitlement` pour tester les 3 états : loading / allowed / blocked.
 */

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Mock le hook AVANT l'import du composant (hoisté par vi)
vi.mock("@/hooks/useEntitlement", () => ({
  useEntitlement: vi.fn(),
}));

import { UpgradeGate } from "@/components/entitlements/UpgradeGate";
import { useEntitlement } from "@/hooks/useEntitlement";

const mockedUseEntitlement = vi.mocked(useEntitlement);

describe("<UpgradeGate />", () => {
  it("loading → n'affiche PAS les enfants (évite flash de contenu)", () => {
    mockedUseEntitlement.mockReturnValue({
      allowed: false,
      loading: true,
      requiredPlan: "premium",
      label: "IA Chat",
      description: "Assistant IA",
      currentPlan: "free",
    });
    render(
      <UpgradeGate feature="ai.chat">
        <div data-testid="protected">SECRET</div>
      </UpgradeGate>
    );
    expect(screen.queryByTestId("protected")).not.toBeInTheDocument();
  });

  it("allowed=true → rend les enfants (accès autorisé)", () => {
    mockedUseEntitlement.mockReturnValue({
      allowed: true,
      loading: false,
      requiredPlan: "premium",
      label: "IA Chat",
      description: "",
      currentPlan: "free",
    });
    render(
      <UpgradeGate feature="ai.chat">
        <div data-testid="protected">CONTENU PREMIUM</div>
      </UpgradeGate>
    );
    expect(screen.getByTestId("protected")).toBeInTheDocument();
    expect(screen.getByText("CONTENU PREMIUM")).toBeInTheDocument();
  });

  it("allowed=false → cache les enfants + affiche le CTA upgrade", () => {
    mockedUseEntitlement.mockReturnValue({
      allowed: false,
      loading: false,
      requiredPlan: "premium",
      label: "IA Chat",
      description: "Réservé au plan Premium",
      currentPlan: "free",
    });
    render(
      <UpgradeGate feature="ai.chat">
        <div data-testid="protected">SECRET</div>
      </UpgradeGate>
    );
    expect(screen.queryByTestId("protected")).not.toBeInTheDocument();
    // Le CTA doit mentionner "Premium" (au moins une occurrence — bouton ou texte)
    const premiumMatches = screen.getAllByText(/Premium/i);
    expect(premiumMatches.length).toBeGreaterThan(0);
  });

  it("fallback custom rendu si allowed=false et fallback fourni", () => {
    mockedUseEntitlement.mockReturnValue({
      allowed: false,
      loading: false,
      requiredPlan: "premium",
      label: "IA Chat",
      description: "",
      currentPlan: "free",
    });
    render(
      <UpgradeGate
        feature="ai.chat"
        fallback={<div data-testid="custom-fallback">MON CTA CUSTOM</div>}
      >
        <div data-testid="protected">SECRET</div>
      </UpgradeGate>
    );
    expect(screen.queryByTestId("protected")).not.toBeInTheDocument();
    expect(screen.getByTestId("custom-fallback")).toBeInTheDocument();
  });

  it("mode=blur → enfants restent visibles (blurred) même si allowed=false", () => {
    mockedUseEntitlement.mockReturnValue({
      allowed: false,
      loading: false,
      requiredPlan: "premium",
      label: "IA",
      description: "",
      currentPlan: "free",
    });
    render(
      <UpgradeGate feature="ai.chat" mode="blur">
        <div data-testid="protected">BLURRED CONTENT</div>
      </UpgradeGate>
    );
    // En mode blur, le contenu EST rendu (dans un container blur)
    expect(screen.getByTestId("protected")).toBeInTheDocument();
  });

  it("loadingFallback custom prioritaire sur le fallback par défaut pendant loading", () => {
    mockedUseEntitlement.mockReturnValue({
      allowed: false,
      loading: true,
      requiredPlan: "premium",
      label: "IA",
      description: "",
      currentPlan: "free",
    });
    render(
      <UpgradeGate
        feature="ai.chat"
        loadingFallback={<div data-testid="loader">Chargement...</div>}
      >
        <div data-testid="protected">SECRET</div>
      </UpgradeGate>
    );
    expect(screen.getByTestId("loader")).toBeInTheDocument();
    expect(screen.queryByTestId("protected")).not.toBeInTheDocument();
  });
});
