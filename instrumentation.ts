/**
 * Point d'entrée d'instrumentation Next.js.
 * Appelé automatiquement au boot du serveur (Node ou Edge).
 *
 * Docs: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 *
 * On tente de charger Sentry en dynamique (require) pour ne pas planter
 * si le package n'est pas installé. Si absent → l'app boote normalement,
 * juste sans reporting Sentry.
 */

import { logger } from "@/lib/logger";

/**
 * Charge un module optionnel sans que Turbopack tente sa résolution
 * statique au build. On utilise `Function("return require")()` : c'est
 * autorisé côté Node runtime (edge runtime est déjà écarté ci-dessous
 * via `NEXT_RUNTIME`), et invisible pour l'analyse du bundler.
 *
 * Safe : path littéral hardcodé, jamais d'input utilisateur.
 */
function optionalRequire(modulePath: string): unknown {
  const req = Function("return require")() as (p: string) => unknown;
  return req(modulePath);
}

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.SENTRY_DSN) {
    try {
      optionalRequire("./sentry.server.config");
      logger.info("[instrumentation] Sentry (node) initialisé");
    } catch (err) {
      logger.warn("[instrumentation] Sentry non chargé (node)", {
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (process.env.NEXT_RUNTIME === "edge" && process.env.SENTRY_DSN) {
    try {
      optionalRequire("./sentry.edge.config");
      logger.info("[instrumentation] Sentry (edge) initialisé");
    } catch (err) {
      logger.warn("[instrumentation] Sentry non chargé (edge)", {
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

/**
 * Hook `onRequestError` — Next.js 15+ / 16 propage ici toutes les erreurs
 * non catchées côté server. On les remonte via notre capture centralisée
 * pour qu'elles arrivent dans Sentry ET dans les logs structurés.
 */
export async function onRequestError(
  err: unknown,
  request: {
    path?: string;
    method?: string;
    headers?: Record<string, string | string[] | undefined>;
  }
) {
  const { captureException } = await import("@/lib/monitoring");
  captureException(err, {
    route: request?.path ? `${request.method || "?"} ${request.path}` : undefined,
    severity: "error",
    extra: {
      method: request?.method,
      path: request?.path,
    },
  });
}
