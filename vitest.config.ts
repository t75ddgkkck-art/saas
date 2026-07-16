import { defineConfig } from "vitest/config";
import path from "node:path";

// Vitest — runner unitaire du projet.
// Lot 27 : ajout du provider `v8` pour le coverage.
// Le provider `v8` est le plus léger (utilise directement Node --experimental-vm-modules).
// Les seuils sont indicatifs : la CI ne fail PAS dessus (voir workflow),
// on garde l'info pour tendance/dashboard Codecov ultérieur.
export default defineConfig({
  test: {
    // Lot 50 : environmentMatchGlobs → node par défaut (rapide, isolé),
    // jsdom seulement pour les tests React (`.test.tsx` ou `-component`).
    // Évite de payer le coût jsdom (~30% plus lent) sur tous les tests unit lib.
    environment: "node",
    environmentMatchGlobs: [
      ["tests/components/**", "jsdom"],
      ["**/*.test.tsx", "jsdom"],
    ],
    setupFiles: ["./tests/setup-react.ts"],
    include: [
      "src/**/*.test.ts",
      "tests/unit/**/*.test.ts",
      // Lot 50 : nouveaux tests composants React
      "tests/components/**/*.test.tsx",
    ],
    globals: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary", "html", "lcov", "json-summary"],
      reportsDirectory: "./coverage",
      // On ne mesure QUE le code source `src/lib/**` — c'est là que se trouve
      // toute la logique métier testable en unitaire.
      // Les composants React (`src/components`), routes API (`src/app/api`) et pages
      // sont couverts par les tests d'intégration (`tests/unit/*-api.test.ts`) ou E2E
      // Playwright (hors scope coverage v8 côté vitest).
      include: ["src/lib/**/*.ts"],
      exclude: [
        "**/*.test.ts",
        "**/*.d.ts",
        "src/lib/ai/prompts.ts", // gros JSON, non testable unitairement
      ],
      // Seuils "plancher" — la CI FAIL si on descend en dessous.
      // Ces chiffres reflètent l'existant mesuré au Lot 27 (42% lignes).
      // Objectif à moyen terme : monter à 60% en ajoutant des tests sur les
      // libs non couvertes (stripe.ts, siret.ts, sms.ts, storage.ts, ai/client.ts).
      // Branches est haut (80%) car les tests existants couvrent bien les chemins
      // if/else des fonctions testées, même si toutes les fonctions ne le sont pas.
      thresholds: {
        lines: 40,
        statements: 40,
        functions: 55,
        branches: 70,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
