import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

/**
 * Gestion centralisée des erreurs API.
 * - Log complet côté serveur (avec stack).
 * - Réponse générique côté client (pas de fuite de détails internes).
 * - Support de codes HTTP typés via `HttpError`.
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
    return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
  }

  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;

  logger.error("[api] Unhandled error", { ...context, message, stack });

  // Message générique pour ne pas fuiter la stack / SQL
  return NextResponse.json(
    { error: "Erreur serveur, veuillez réessayer." },
    { status: 500 }
  );
}
