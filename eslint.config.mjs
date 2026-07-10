import { defineConfig, globalIgnores } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

// NB : pour activer @typescript-eslint/* il faudrait installer
// `@typescript-eslint/eslint-plugin` et `@typescript-eslint/parser`.
// On garde ici des règles ESLint core, dispo sans dépendance supplémentaire.
export default defineConfig([
  ...nextCoreWebVitals,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "dist/**",
    "coverage/**",
    "test-results/**",
    "playwright-report/**",
    "next-env.d.ts",
    "mobile/**",
  ]),
  {
    rules: {
      // console : autoriser warn/error, avertir sur log
      "no-console": ["warn", { allow: ["warn", "error"] }],
      // Force les === strict
      eqeqeq: ["error", "always"],
      // Interdit var
      "no-var": "error",
      // Préfère const
      "prefer-const": "warn",
      // Détecte les variables non utilisées mais tolère "_prefixed"
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      // -----------------------------------------------------------------
      // Lot 27 — CI-friendly downgrades
      // -----------------------------------------------------------------
      // Cosmétique : apostrophes/quotes non échappées dans JSX. Zéro impact
      // fonctionnel (React les gère nativement), on garde en warn.
      "react/no-unescaped-entities": "warn",
      // <a href="/api/..."> vers une route API → l'avertissement Next
      // suggère <Link> mais <Link> ne marche PAS pour un GET file download
      // (ex : /api/clients/export). Warn seulement.
      "@next/next/no-html-link-for-pages": "warn",
      // -----------------------------------------------------------------
      // React Compiler (eslint-plugin-react-hooks v6+, expérimental Next 16)
      // -----------------------------------------------------------------
      // Ces règles émises par le compilateur React sont ENCORE EXPÉRIMENTALES
      // (Next 16.2). Elles remontent des faux positifs sur des patterns valides
      // (setState après early-return, factories dans .map, etc.).
      // On garde en warn pour visibilité — refactor à faire progressivement
      // sur les fichiers touchés, plutôt qu'un big-bang qui casserait tout.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/set-state-in-render": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/component-hook-factories": "warn",
      "react-hooks/static-components": "warn",
    },
  },
]);
