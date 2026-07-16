/**
 * Lot 50 — Setup Vitest pour les tests composants React.
 *
 * Applique :
 *  - @testing-library/jest-dom matchers (`toBeInTheDocument`, `toHaveClass`, etc.)
 *  - Nettoyage automatique du DOM après chaque test (cleanup)
 *  - Mocks globaux nécessaires : next/navigation, next/link
 *
 * Chargé uniquement quand `environment === "jsdom"` (voir vitest.config.ts).
 * Pour les tests en env `node` (libs pures), ce fichier est un no-op silencieux.
 */

import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// Cleanup DOM après chaque test — évite les fuites entre tests
afterEach(() => {
  cleanup();
});
