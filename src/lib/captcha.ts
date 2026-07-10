/**
 * Vérification Cloudflare Turnstile (Lot 19).
 *
 * Cloudflare Turnstile = alternative gratuite/RGPD-friendly à reCAPTCHA.
 * Docs : https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
 *
 * DESIGN :
 * - Optionnel : si `TURNSTILE_SECRET_KEY` n'est pas défini, on retourne `{ ok: true }`
 *   → dev local sans setup, prod protégée quand la clé est set
 * - Timeout hard 5s (Cloudflare doit répondre vite, sinon on considère safe pour ne pas
 *   bloquer un login légitime — trade-off à assumer)
 * - Failure logs pour audit mais on ne throw jamais (le monitoring capture)
 *
 * USAGE côté route API :
 *   const captcha = await verifyCaptcha(req.headers.get("x-turnstile-token"));
 *   if (!captcha.ok) throw badRequest("Captcha invalide");
 *
 * USAGE côté UI :
 *   <div className="cf-turnstile" data-sitekey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY} />
 *   → script Turnstile injecte le token dans un input hidden, envoyé au submit
 */

import { logger } from "@/lib/logger";

const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const TIMEOUT_MS = 5000;

export interface CaptchaResult {
  ok: boolean;
  reason?: "no_token" | "no_secret" | "invalid" | "network_error" | "timeout";
  hostname?: string;
  challengeTs?: string;
}

/**
 * Retourne `true` si le captcha est activé (secret défini).
 * Utile côté route pour skip la vérif en dev sans crash.
 */
export function isCaptchaEnabled(): boolean {
  return Boolean(process.env.TURNSTILE_SECRET_KEY);
}

/**
 * Vérifie un token Turnstile côté serveur.
 *
 * Si TURNSTILE_SECRET_KEY n'est pas défini (dev), on retourne `{ ok: true, reason: "no_secret" }`
 * → l'appelant peut ignorer et continuer. Log explicite pour ne pas oublier en prod.
 */
export async function verifyCaptcha(
  token: string | null | undefined,
  opts?: { ip?: string | null }
): Promise<CaptchaResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    // Mode dev : pas de captcha configuré. On accepte mais on log en debug.
    logger.debug("[captcha] TURNSTILE_SECRET_KEY non défini — skip vérification");
    return { ok: true, reason: "no_secret" };
  }
  if (!token || typeof token !== "string") {
    return { ok: false, reason: "no_token" };
  }

  const body = new URLSearchParams({ secret, response: token });
  if (opts?.ip) body.set("remoteip", opts.ip);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(TURNSTILE_VERIFY_URL, {
      method: "POST",
      body,
      signal: controller.signal,
    });

    if (!res.ok) {
      logger.warn("[captcha] non-2xx from Cloudflare", { status: res.status });
      return { ok: false, reason: "network_error" };
    }

    const data = (await res.json()) as {
      success: boolean;
      hostname?: string;
      challenge_ts?: string;
      "error-codes"?: string[];
    };

    if (!data.success) {
      logger.warn("[captcha] validation failed", { errors: data["error-codes"] });
      return { ok: false, reason: "invalid" };
    }

    return {
      ok: true,
      hostname: data.hostname,
      challengeTs: data.challenge_ts,
    };
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError";
    logger.warn("[captcha] fetch error", { err: String(err), aborted });
    return { ok: false, reason: aborted ? "timeout" : "network_error" };
  } finally {
    clearTimeout(timer);
  }
}
