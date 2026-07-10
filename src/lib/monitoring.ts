/**
 * Monitoring centralisé - capture d'exceptions et messages avec Sentry.
 *
 * Design : Sentry est une dépendance OPTIONNELLE.
 * - Si `@sentry/nextjs` est installé + `SENTRY_DSN` défini, on l'utilise
 * - Sinon on retombe sur le logger (aucun crash)
 *
 * Bénéfice : un dev qui clone sans DSN ne subit aucune friction, mais
 * en prod on peut activer Sentry en 30s (`npm i @sentry/nextjs` + DSN).
 *
 * Toutes les fonctions sont sync-safe et ne throw jamais : le monitoring
 * ne doit JAMAIS faire tomber l'app qu'il surveille.
 */

import { logger } from "@/lib/logger";
import { sendAlert } from "@/lib/alerts";

// Interface minimale de ce dont on a besoin côté Sentry. Volontairement
// restreinte pour ne pas coupler à toute l'API @sentry/nextjs.
interface SentryLike {
  captureException: (err: unknown, ctx?: unknown) => string | void;
  captureMessage: (msg: string, level?: string) => string | void;
  setUser?: (u: { id?: string; email?: string } | null) => void;
  setTag?: (key: string, value: string) => void;
}

let cachedSentry: SentryLike | null | undefined = undefined;

/**
 * Résout `@sentry/nextjs` en dynamique. Retourne `null` si absent ou
 * si `SENTRY_DSN` n'est pas défini. Mis en cache pour éviter les
 * `require` répétés à chaque `captureException`.
 */
function getSentry(): SentryLike | null {
  if (cachedSentry !== undefined) return cachedSentry;

  if (!process.env.SENTRY_DSN && !process.env.NEXT_PUBLIC_SENTRY_DSN) {
    cachedSentry = null;
    return null;
  }

  // Edge runtime interdit `eval` et n'a pas `require`. On désactive Sentry
  // ici et on laissera le runtime Node (server / instrumentation) gérer.
  // Détection : `EdgeRuntime` est une global côté edge Vercel.
  if (typeof (globalThis as { EdgeRuntime?: unknown }).EdgeRuntime !== "undefined") {
    cachedSentry = null;
    return null;
  }

  try {
    // On utilise `Function("return require")()` (au lieu d'un `require()`
    // direct) pour empêcher le bundler (Turbopack/Webpack) de tenter la
    // résolution statique de @sentry/nextjs — c'est une dépendance
    // OPTIONNELLE (non listée dans package.json).
    // Safe : pas d'input utilisateur, littéral hardcodé.
    const req = Function("return require")() as (p: string) => SentryLike;
    const mod = req("@sentry/nextjs");
    cachedSentry = mod;
    return mod;
  } catch {
    cachedSentry = null;
    return null;
  }
}

/**
 * Capture une exception. Non-bloquant.
 * Ajoute automatiquement une alerte webhook si `severity: "critical"`.
 */
export function captureException(
  err: unknown,
  context?: {
    route?: string;
    userId?: string;
    severity?: "info" | "warning" | "error" | "critical";
    tags?: Record<string, string>;
    extra?: Record<string, unknown>;
  }
): void {
  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;

  // Log local (toujours) : garantit un audit trail même sans Sentry
  logger.error(`[monitoring] ${message}`, {
    route: context?.route,
    userId: context?.userId,
    severity: context?.severity,
    stack,
    ...context?.extra,
  });

  const sentry = getSentry();
  if (sentry) {
    try {
      sentry.captureException(err, {
        tags: {
          route: context?.route,
          severity: context?.severity,
          ...context?.tags,
        },
        user: context?.userId ? { id: context.userId } : undefined,
        extra: context?.extra,
      });
    } catch {
      // Ne jamais laisser Sentry casser l'app
    }
  }

  // Alerte critique → webhook (Slack/Discord/etc.)
  if (context?.severity === "critical") {
    void sendAlert({
      title: `Erreur critique : ${message}`,
      level: "critical",
      route: context.route,
      userId: context.userId,
      extra: context.extra,
    });
  }
}

/**
 * Capture un message texte (sans exception).
 * Utile pour "un webhook Stripe a échoué 3x", "queue email pleine", etc.
 */
export function captureMessage(
  msg: string,
  context?: {
    level?: "info" | "warning" | "error";
    route?: string;
    userId?: string;
    extra?: Record<string, unknown>;
  }
): void {
  const level = context?.level ?? "info";
  logger[level === "warning" ? "warn" : level](`[monitoring] ${msg}`, {
    route: context?.route,
    userId: context?.userId,
    ...context?.extra,
  });

  const sentry = getSentry();
  if (sentry) {
    try {
      sentry.captureMessage(msg, level);
    } catch {
      /* noop */
    }
  }
}

/**
 * Tag l'utilisateur courant sur le scope Sentry.
 * À appeler en début de requête authentifiée si Sentry est configuré.
 */
export function setMonitoringUser(user: { id: string; email?: string } | null): void {
  const sentry = getSentry();
  if (sentry?.setUser) {
    try {
      sentry.setUser(user);
    } catch {
      /* noop */
    }
  }
}

/**
 * Indique si Sentry est actif. Utile pour les tests + le healthcheck.
 */
export function isMonitoringEnabled(): boolean {
  return getSentry() !== null;
}

/**
 * Reset du cache pour les tests (interne, ne pas utiliser en prod).
 */
export function __resetMonitoringCache(): void {
  cachedSentry = undefined;
}
