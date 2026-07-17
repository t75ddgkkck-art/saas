/**
 * Lot 55 — Tests <CommandPalette>.
 *
 * Focus :
 *  - Rendu conditionnel selon isOpen
 *  - Aria (role=dialog, aria-modal, aria-label)
 *  - Actions rapides affichées quand query vide
 *  - Empty state quand query mais 0 résultats
 *  - Fetch appelé quand query >= 2 chars
 *
 * On mocke fetch + next/navigation router pour isoler le composant.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Mock next/navigation router
const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: vi.fn() }),
}));

import { CommandPalette } from "@/components/command/CommandPalette";

beforeEach(() => {
  vi.clearAllMocks();
  pushMock.mockClear();
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ results: [] }),
  });
  // Reset localStorage entre tests
  localStorage.clear();
});

describe("<CommandPalette /> — rendu", () => {
  it("ne rend rien si isOpen=false", () => {
    render(<CommandPalette isOpen={false} onClose={() => {}} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("rend la modal si isOpen=true", () => {
    render(<CommandPalette isOpen onClose={() => {}} />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("dialog").getAttribute("aria-modal")).toBe("true");
    expect(screen.getByRole("dialog").getAttribute("aria-label")).toBe("Rechercher");
  });

  it("input auto-focus à l'ouverture", async () => {
    render(<CommandPalette isOpen onClose={() => {}} />);
    // setTimeout 50ms dans le composant — on attend un tick
    await waitFor(
      () => {
        const input = screen.getByPlaceholderText(/Rechercher un client/i);
        expect(document.activeElement).toBe(input);
      },
      { timeout: 500 }
    );
  });
});

describe("<CommandPalette /> — accueil (query vide)", () => {
  it("affiche les actions rapides", () => {
    render(<CommandPalette isOpen onClose={() => {}} />);
    // Les 6 actions rapides doivent être visibles
    expect(screen.getByText("Nouveau devis")).toBeInTheDocument();
    expect(screen.getByText("Nouveau client")).toBeInTheDocument();
    expect(screen.getByText(/Aujourd/i)).toBeInTheDocument();
    expect(screen.getByText("Statistiques")).toBeInTheDocument();
  });

  it("groupe 'Actions rapides' visible", () => {
    render(<CommandPalette isOpen onClose={() => {}} />);
    expect(screen.getByText("Actions rapides")).toBeInTheDocument();
  });

  it("pas de groupe 'Récents' si historique vide", () => {
    render(<CommandPalette isOpen onClose={() => {}} />);
    expect(screen.queryByText("Récents")).not.toBeInTheDocument();
  });

  it("affiche 'Récents' si localStorage contient un historique", () => {
    localStorage.setItem(
      "vitrix:cmdk:history",
      JSON.stringify([
        {
          type: "client",
          title: "Jean Dupont",
          subtitle: "jean@example.com",
          href: "/dashboard/clients/uuid-1",
        },
      ])
    );
    render(<CommandPalette isOpen onClose={() => {}} />);
    expect(screen.getByText("Récents")).toBeInTheDocument();
    expect(screen.getByText("Jean Dupont")).toBeInTheDocument();
  });
});

describe("<CommandPalette /> — recherche", () => {
  it("fetch pas déclenché si query < 2 chars", async () => {
    render(<CommandPalette isOpen onClose={() => {}} />);
    await userEvent.type(screen.getByPlaceholderText(/Rechercher/i), "a");
    // Debounce 200ms — on attend un peu
    await new Promise((r) => setTimeout(r, 300));
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("fetch déclenché quand query >= 2 chars", async () => {
    render(<CommandPalette isOpen onClose={() => {}} />);
    await userEvent.type(screen.getByPlaceholderText(/Rechercher/i), "du");
    // Attente debounce
    await new Promise((r) => setTimeout(r, 300));
    expect(globalThis.fetch).toHaveBeenCalled();
    // 2 endpoints appelés en parallèle : privé + public
    const calls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls;
    const urls = calls.map((c) => c[0] as string);
    expect(urls.some((u) => u.includes("/api/search/dashboard"))).toBe(true);
    expect(urls.some((u) => u.includes("/api/search?"))).toBe(true);
  });

  it("empty state affiché si query >= 2 et 0 résultats", async () => {
    render(<CommandPalette isOpen onClose={() => {}} />);
    await userEvent.type(screen.getByPlaceholderText(/Rechercher/i), "zzznotfound");
    // Attente debounce + fetch
    await waitFor(() => {
      expect(screen.getByText(/Aucun résultat/i)).toBeInTheDocument();
    });
  });

  it("affiche les résultats privés dans le groupe 'Dans votre business'", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url.includes("/api/search/dashboard")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            results: [
              {
                type: "client",
                title: "Marie Curie",
                subtitle: "marie@example.com",
                href: "/dashboard/clients/uuid-marie",
              },
            ],
          }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({ results: [] }) });
    });

    render(<CommandPalette isOpen onClose={() => {}} />);
    await userEvent.type(screen.getByPlaceholderText(/Rechercher/i), "marie");
    await waitFor(() => {
      expect(screen.getByText("Marie Curie")).toBeInTheDocument();
      expect(screen.getByText("Dans votre business")).toBeInTheDocument();
    });
  });
});

describe("<CommandPalette /> — interactions", () => {
  it("clic sur backdrop → appelle onClose", async () => {
    const onClose = vi.fn();
    render(<CommandPalette isOpen onClose={onClose} />);
    // Le backdrop est le div avec role=dialog
    await userEvent.click(screen.getByRole("dialog"));
    expect(onClose).toHaveBeenCalled();
  });

  it("clic sur item action → router.push + onClose", async () => {
    const onClose = vi.fn();
    render(<CommandPalette isOpen onClose={onClose} />);
    await userEvent.click(screen.getByText("Nouveau devis"));
    expect(pushMock).toHaveBeenCalledWith("/dashboard/quotes");
    expect(onClose).toHaveBeenCalled();
  });

  it("clic sur item ajoute à l'historique localStorage", async () => {
    render(<CommandPalette isOpen onClose={() => {}} />);
    await userEvent.click(screen.getByText("Nouveau client"));
    const stored = localStorage.getItem("vitrix:cmdk:history");
    expect(stored).toBeTruthy();
    const parsed = JSON.parse(stored!);
    expect(parsed[0].href).toBe("/dashboard/clients");
  });
});

describe("<CommandPalette /> — footer keyboard hints", () => {
  it("affiche les hints ↑ ↓ ↵ Esc", () => {
    render(<CommandPalette isOpen onClose={() => {}} />);
    expect(screen.getByText("naviguer")).toBeInTheDocument();
    expect(screen.getByText("sélectionner")).toBeInTheDocument();
  });
});
