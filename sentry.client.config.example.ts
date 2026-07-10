/**
 * EXEMPLE de config Sentry côté client (browser).
 *
 * Pour activer Sentry :
 *   1. `npm install @sentry/nextjs`
 *   2. Copier ce fichier en `sentry.client.config.ts` (racine du projet)
 *   3. Copier `sentry.server.config.example.ts` et `sentry.edge.config.example.ts`
 *   4. Ajouter `NEXT_PUBLIC_SENTRY_DSN` et `SENTRY_DSN` dans les env vars Vercel
 *   5. `npx @sentry/wizard@latest -i nextjs` pour la config automatique (recommandé)
 *
 * Ce fichier reste .example.ts par défaut pour ne pas exiger le package.
 */

// import * as Sentry from "@sentry/nextjs";
//
// Sentry.init({
//   dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
//   tracesSampleRate: 0.1,
//   replaysSessionSampleRate: 0.0,
//   replaysOnErrorSampleRate: 1.0,
//   environment: process.env.VERCEL_ENV || process.env.NODE_ENV,
//   ignoreErrors: [
//     // Extensions navigateur
//     "Non-Error promise rejection captured",
//     "ResizeObserver loop limit exceeded",
//   ],
// });

export {};
