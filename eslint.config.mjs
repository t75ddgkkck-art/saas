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
      "no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
]);
