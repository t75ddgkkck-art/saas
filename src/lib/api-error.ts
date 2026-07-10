import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { captureException } from "@/lib/monitoring";

/**
 * Gestion centralisée des erreurs API.
 * - Log complet côté serveur (avec stack).
 * - Réponse générique côté client (pas de fuite de détails internes).
 * - Support de codes HTTP typés via `HttpError`.
 * - Erreurs 5xx transmises à Sentry via `captureException` (Lot 13).
 */
export class HttpError extends Error {
  status: number;
  code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function badRequest(message = "Requête invalide", code?: string) {
  return new HttpError(400, message, code);
}
export function unauthorized(message = "Non authentifié") {
  return new HttpError(401, message, "UNAUTHORIZED");
}
export function forbidden(message = "Accès interdit") {
  return new HttpError(403, message, "FORBIDDEN");
}
export function notFound(message = "Ressource introuvable") {
  return new HttpError(404, message, "NOT_FOUND");
}
export function conflict(message = "Conflit") {
  return new HttpError(409, message, "CONFLICT");
}

export function handleApiError(
  err: unknown,
  context?: { route?: string; userId?: string }
): NextResponse {
  if (err instanceof HttpError) {
    // Erreur métier attendue : on log en info/warn, pas en error
    logger.warn(`[api] ${err.status} ${err.message}`, { ...context, code: err.code });
    // On ne remonte PAS les 4xx à Sentry (bruit inutile)
    return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
  }

  const message = err instanceof Error ? err.message : String(err);

  // Erreur 5xx inattendue → Sentry + log + éventuelle alerte
  // captureException log déjà en interne, pas besoin de logger.error en double
  captureException(err, {
    route: context?.route,
    userId: context?.userId,
    severity: "error",
    extra: { message },
  });

  // Message générique pour ne pas fuiter la stack / SQL
  return NextResponse.json(
    { error: "Erreur serveur, veuillez réessayer." },
    { status: 500 }
  );
}
