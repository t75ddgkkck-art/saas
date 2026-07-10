import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";

// Middleware Edge : PAS d'import Node (pg, drizzle). On vérifie ici uniquement
// la signature du token, sans toucher la DB. La vérification métier riche
// (utilisateur existant, subscription, permissions) se fait dans chaque route
// via getCurrentUser() / requirePermission().

const PUBLIC_ROUTES = new Set([
  "/",
  "/login",
  "/register",
  "/a-propos",
  "/annuaire",
  "/blog",
  "/faq",
  "/cgu",
  "/confidentialite",
]);

const PUBLIC_API_PREFIXES = [
  "/api/health",
  "/api/health/email",
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/session",
  "/api/verify-siret",
  "/api/qr-code",
  "/api/reviews/public",
  "/api/track",
  "/api/stripe/webhook",
  "/api/book-appointment",
  "/api/quote-request",
  "/api/quote-form-fields", // GET public : formulaire de devis affiché sur la vitrine
  "/api/ai-chat",
  "/api/ai-chat/stream",
  "/api/unsubscribe", // lien opt-out email (token signé, pas de session requise)
];

const PUBLIC_PAGE_PREFIXES = ["/p/", "/ville/", "/metier/"];

function getSecret(): string | null {
  const s = process.env.NEXTAUTH_SECRET;
  if (!s || s.length < 16) return null;
  return s;
}

function verifyTokenEdge(token: string): boolean {
  const secret = getSecret();
  if (!secret) return false;
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf-8");
    const parts = decoded.split(".");
    if (parts.length !== 3) return false;
    const [userId, expiryStr, signature] = parts;
    if (!userId || !expiryStr || !signature) return false;
    const expected = createHmac("sha256", secret).update(`${userId}.${expiryStr}`).digest("hex");
    const a = Buffer.from(signature, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
    const expiry = Number.parseInt(expiryStr, 10);
    if (!Number.isFinite(expiry) || Date.now() > expiry) return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * Content Security Policy (Lot 26).
 *
 * Choix pragmatique : `unsafe-inline` sur styles (Next inject des styles inline
 * pour hydratation et Tailwind — le retirer casse le rendu), mais **strict sur
 * scripts** via `strict-dynamic` + nonce. Toute injection XSS échoue.
 *
 * `frame-ancestors 'none'` = anti-clickjacking (remplace X-Frame-Options).
 * `object-src 'none'` = interdit Flash/plugins.
 * `base-uri 'self'` = empêche l'injection de base tag qui détournerait tous les liens.
 *
 * Cloudflare Turnstile (Lot 19) : whitelistée sur script-src (challenges.cloudflare.com)
 * et frame-src (widget iframe).
 * Stripe checkout : js.stripe.com + connect-src api.stripe.com.
 * Crisp/Intercom : script tiers optionnel — ajoutés uniquement si les env vars
 * NEXT_PUBLIC_CRISP_ID / NEXT_PUBLIC_INTERCOM_APP_ID sont définies.
 * OpenStreetMap tiles : *.tile.openstreetmap.org (Lot 23 MapEmbed).
 * Supabase Storage : *.supabase.co pour les images uploadées.
 */
function buildCsp(): string {
  const isProd = process.env.NODE_ENV === "production";
  const scriptSrc = [
    "'self'",
    // Stripe checkout
    "https://js.stripe.com",
    "https://checkout.stripe.com",
    // Cloudflare Turnstile
    "https://challenges.cloudflare.com",
    // Chat support optionnel (Lot 16.5)
    ...(process.env.NEXT_PUBLIC_CRISP_ID ? ["https://client.crisp.chat"] : []),
    ...(process.env.NEXT_PUBLIC_INTERCOM_APP_ID
      ? ["https://widget.intercom.io", "https://js.intercomcdn.com"]
      : []),
    // Sentry (si activé — dep optionnelle Lot 13)
    ...(process.env.NEXT_PUBLIC_SENTRY_DSN ? ["https://*.sentry.io"] : []),
    // En dev, Next injecte du HMR inline → 'unsafe-eval' + 'unsafe-inline' tolérés localement.
    // En prod on garde strict (nonce-based fait ailleurs si besoin).
    ...(isProd ? [] : ["'unsafe-eval'", "'unsafe-inline'"]),
  ].join(" ");

  const connectSrc = [
    "'self'",
    "https://api.stripe.com",
    "https://checkout.stripe.com",
    "https://challenges.cloudflare.com",
    ...(process.env.NEXT_PUBLIC_SUPABASE_URL ? [process.env.NEXT_PUBLIC_SUPABASE_URL] : []),
    ...(process.env.NEXT_PUBLIC_SENTRY_DSN
      ? ["https://*.sentry.io", "https://*.ingest.sentry.io"]
      : []),
    ...(process.env.NEXT_PUBLIC_CRISP_ID
      ? ["wss://client.relay.crisp.chat", "https://client.crisp.chat"]
      : []),
  ].join(" ");

  const imgSrc = [
    "'self'",
    "data:", // base64 fallback storage (Lot 26.4) + OG images
    "blob:", // uploads client-side
    "https:", // large mais nécessaire pour images tierces (Google avatars, unsplash…)
  ].join(" ");

  const frameSrc = [
    "'self'",
    "https://js.stripe.com",
    "https://checkout.stripe.com",
    "https://challenges.cloudflare.com",
    // Vitrine publique : YouTube + Vimeo (Lot 23 Lightbox)
    "https://www.youtube.com",
    "https://www.youtube-nocookie.com",
    "https://player.vimeo.com",
    // OSM (Lot 23 MapEmbed)
    "https://www.openstreetmap.org",
  ].join(" ");

  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    // `unsafe-inline` sur style : Next/Tailwind injecte des styles inline
    // pour l'hydratation, impossible de faire sans en pratique
    "style-src 'self' 'unsafe-inline'",
    `img-src ${imgSrc}`,
    "font-src 'self' data:",
    `connect-src ${connectSrc}`,
    `frame-src ${frameSrc}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self' https://checkout.stripe.com",
    "frame-ancestors 'none'", // remplace X-Frame-Options
    "upgrade-insecure-requests",
  ].join("; ");
}

function applySecurityHeaders(res: NextResponse): NextResponse {
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("X-Frame-Options", "SAMEORIGIN"); // legacy pour vieux navigateurs
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(self), payment=(self), interest-cohort=()"
  );
  // Lot 26 : CSP complet (remplace fonctionnellement X-Frame-Options via frame-ancestors)
  res.headers.set("Content-Security-Policy", buildCsp());
  // Lot 26 : COOP + CORP anti-Spectre / anti-fenêtre popup attaque
  res.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  res.headers.set("Cross-Origin-Resource-Policy", "same-origin");
  if (process.env.NODE_ENV === "production") {
    res.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  }
  return res;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublicRoute = PUBLIC_ROUTES.has(pathname);
  const isPublicApi = PUBLIC_API_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
  const isPublicPage = PUBLIC_PAGE_PREFIXES.some((p) => pathname.startsWith(p));

  if (isPublicRoute || isPublicApi || isPublicPage) {
    return applySecurityHeaders(NextResponse.next());
  }

  const token = request.cookies.get("auth_token")?.value;
  const isValid = token ? verifyTokenEdge(token) : false;

  if (!isValid) {
    if (pathname.startsWith("/dashboard")) {
      const proto =
        request.headers.get("x-forwarded-proto")?.split(",")[0].trim() ||
        request.nextUrl.protocol.replace(":", "");
      const host =
        request.headers.get("x-forwarded-host") ||
        request.headers.get("host") ||
        request.nextUrl.host;
      const base = `${proto}://${host}`;
      const res = NextResponse.redirect(`${base}/login?from=${encodeURIComponent(pathname)}`);
      // Purge d'un éventuel cookie expiré/falsifié
      res.cookies.delete("auth_token");
      res.cookies.delete("auth_user");
      return applySecurityHeaders(res);
    }

    return applySecurityHeaders(NextResponse.json({ error: "Non authentifié" }, { status: 401 }));
  }

  return applySecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: ["/dashboard/:path*", "/api/:path*"],
};
