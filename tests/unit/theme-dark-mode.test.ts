/**
 * Test de non-régression du BUG B1 (Lot 18) : dark mode Tailwind v4 class-based.
 *
 * Contexte : dans Tailwind v4, `@import "tailwindcss"` active la variante `dark:`
 * uniquement via `prefers-color-scheme` par défaut. La détection par CLASS
 * (`document.documentElement.classList.add("dark")`, notre THEME_INIT_SCRIPT)
 * exige un `@custom-variant dark (&:where(.dark, .dark *))` explicite.
 *
 * On lit `src/app/globals.css` et on vérifie que cette directive est bien là.
 * Sans elle, tout `dark:` du code retomberait sur prefers-color-scheme → le
 * toggle utilisateur clair/sombre ne fonctionnerait plus (bug initial).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("dark mode Tailwind v4 (Lot 18 B1)", () => {
  it("globals.css déclare bien @custom-variant dark (class-based)", () => {
    const css = readFileSync(resolve(__dirname, "../../src/app/globals.css"), "utf-8");
    // On accepte plusieurs syntaxes valides du selector (avec ou sans espaces)
    expect(css).toMatch(/@custom-variant\s+dark\s*\(/);
    expect(css).toContain(".dark");
  });

  it("le script d'init pose bien la classe .dark sur <html>", async () => {
    const { THEME_INIT_SCRIPT } = await import("../../src/contexts/ThemeContext");
    expect(THEME_INIT_SCRIPT).toContain("classList.add('dark')");
  });
});
