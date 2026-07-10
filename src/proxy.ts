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
    const expected = createHmac("sha256", secret)
      .update(`${userId}.${expiryStr}`)
      .digest("hex");
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

function applySecurityHeaders(res: NextResponse): NextResponse {
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("X-Frame-Options", "SAMEORIGIN");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(self), payment=(self)"
  );
  if (process.env.NODE_ENV === "production") {
    res.headers.set(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains; preload"
    );
  }
  return res;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublicRoute = PUBLIC_ROUTES.has(pathname);
  const isPublicApi = PUBLIC_API_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
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
      const res = NextResponse.redirect(
        `${base}/login?from=${encodeURIComponent(pathname)}`
      );
      // Purge d'un éventuel cookie expiré/falsifié
      res.cookies.delete("auth_token");
      res.cookies.delete("auth_user");
      return applySecurityHeaders(res);
    }

    return applySecurityHeaders(
      NextResponse.json({ error: "Non authentifié" }, { status: 401 })
    );
  }

  return applySecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/api/:path*",
  ],
};
