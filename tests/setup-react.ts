/**
 * Lot 50 — Setup Vitest pour les tests composants React.
 *
 * Applique :
 *  - @testing-library/jest-dom matchers (`toBeInTheDocument`, `toHaveClass`, etc.)
 *  - Nettoyage automatique du DOM après chaque test (cleanup)
 *  - Polyfills jsdom : scrollIntoView (Lot 55), matchMedia (si utilisé)
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

// Lot 55 — Polyfill jsdom : scrollIntoView n'est PAS implémenté dans jsdom.
// Sans ce stub, les composants qui l'appellent (CommandPalette, Modal, etc.)
// crashent en test avec "el.scrollIntoView is not a function".
if (typeof window !== "undefined" && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function () {
    /* no-op — le scroll n'a pas de sens en jsdom */
  };
}
