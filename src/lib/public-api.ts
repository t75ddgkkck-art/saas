/**
 * Helpers pour l'API publique v1 (Lot 16.4).
 * Wrap `authenticateApiKey` + `handleApiError` en une fonction utilitaire.
 */

import { NextRequest, NextResponse } from "next/server";
import { authenticateApiKey, type ApiKeyAuthResult } from "@/lib/api-keys";
import { checkRateLimit } from "@/lib/rate-limit";

/**
 * Retourne un 401 formaté API si aucune clé valide.
 * Rate-limit générique : 60 req/min par clé (headers `X-RateLimit-*` déjà posés
 * par `checkRateLimit`).
 */
export async function requireApiKey(
  req: NextRequest,
  requireWrite = false
): Promise<{ ok: true; auth: ApiKeyAuthResult } | { ok: false; response: NextResponse }> {
  const auth = await authenticateApiKey(req);
  if (!auth) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "unauthorized",
          message: "Clé API manquante ou invalide. Header attendu : Authorization: Bearer vx_live_...",
        },
        { status: 401 }
      ),
    };
  }

  if (requireWrite && auth.scope !== "read_write") {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "insufficient_scope", message: "Cette clé est en lecture seule." },
        { status: 403 }
      ),
    };
  }

  // Rate-limit par clé (60/min baseline)
  const rl = checkRateLimit(req, {
    key: `api-v1:${auth.keyId}`,
    limit: 60,
    windowSec: 60,
  });
  if (!rl.ok) return { ok: false, response: rl.response };

  return { ok: true, auth };
}
