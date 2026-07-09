import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Routes publiques - pas de vérification
  const publicRoutes = [
    "/",
    "/login",
    "/register",
    "/a-propos",
    "/annuaire",
    "/blog",
    "/faq",
    "/cgu",
    "/confidentialite",
  ];

  // Routes API publiques
  const publicApiPrefixes = [
    "/p/",
    "/ville/",
    "/metier/",
    "/api/health",
    "/api/auth/login",
    "/api/auth/register",
    "/api/verify-siret",
    "/api/qr-code",
    "/api/reviews/public",
    "/api/track",
    "/api/stripe/webhook",
  ];

  // Vérifier si la route est publique
  const isPublicRoute = publicRoutes.includes(pathname);
  const isPublicPrefix = publicApiPrefixes.some((prefix) => pathname.startsWith(prefix));

  if (isPublicRoute || isPublicPrefix) {
    return NextResponse.next();
  }

  // Pour les routes dashboard et API, vérifier l'authentification
  const token = request.cookies.get("auth_token")?.value;
  if (!token) {
    const proto = request.headers.get("x-forwarded-proto")?.split(",")[0].trim()
      || request.nextUrl.protocol.replace(":", "");
    const host = request.headers.get("x-forwarded-host")
      || request.headers.get("host")
      || request.nextUrl.host;
    const base = `${proto}://${host}`;

    if (pathname.startsWith("/dashboard")) {
      return NextResponse.redirect(`${base}/login?from=${encodeURIComponent(pathname)}`);
    }
    
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/api/:path*",
  ],
};
