/**
 * Rate limiter en mémoire — token bucket simplifié.
 *
 * ⚠️  Limitations :
 *  - Ne fonctionne qu'au sein d'une seule instance Node (pas cluster/serverless partagé).
 *  - Pour du multi-région / serverless, remplacer par Upstash Redis, @vercel/kv ou équivalent.
 *  - Suffisant pour bloquer un scripting basique et prévenir un abus mono-IP en attendant.
 */
import { NextRequest, NextResponse } from "next/server";

type Bucket = { count: number; resetAt: number };

const store = new Map<string, Bucket>();

// Nettoyage périodique léger : on purge à la lecture si le seuil est atteint.
function cleanup(now: number) {
  if (store.size < 10_000) return;
  for (const [k, v] of store) {
    if (v.resetAt < now) store.delete(k);
  }
}

export interface RateLimitOptions {
  /** Nombre de requêtes autorisées par fenêtre. */
  limit: number;
  /** Taille de la fenêtre en secondes. */
  windowSec: number;
  /** Identifiant logique (route, action) : concaténé à l'IP. */
  key: string;
}

export function getClientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

/**
 * Retourne { ok: true } ou une NextResponse 429 déjà prête.
 * Usage :
 *   const rl = checkRateLimit(req, { key: "login", limit: 5, windowSec: 60 });
 *   if (!rl.ok) return rl.response;
 */
export function checkRateLimit(
  req: NextRequest,
  opts: RateLimitOptions
): { ok: true } | { ok: false; response: NextResponse } {
  const ip = getClientIp(req);
  const now = Date.now();
  cleanup(now);

  const bucketKey = `${opts.key}:${ip}`;
  const existing = store.get(bucketKey);

  if (!existing || existing.resetAt < now) {
    store.set(bucketKey, { count: 1, resetAt: now + opts.windowSec * 1000 });
    return { ok: true };
  }

  existing.count += 1;

  if (existing.count > opts.limit) {
    const retryAfter = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
    const response = NextResponse.json(
      { error: "Trop de requêtes. Réessayez plus tard." },
      { status: 429 }
    );
    response.headers.set("Retry-After", String(retryAfter));
    response.headers.set("X-RateLimit-Limit", String(opts.limit));
    response.headers.set("X-RateLimit-Remaining", "0");
    return { ok: false, response };
  }

  return { ok: true };
}
