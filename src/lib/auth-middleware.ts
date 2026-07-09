import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";

// Liste des routes publiques (ne nécessitent pas d'authentification)
const PUBLIC_ROUTES = [
  "/api/auth/login",
  "/api/auth/register",
  "/api/reviews/public",
  "/api/track",
  "/api/stripe/webhook",
];

// Liste des routes Premium (nécessitent un abonnement premium)
const PREMIUM_ROUTES = [
  "/api/ai/social-post",
  "/api/ai/monthly-report",
  "/api/ai/auto-review",
];

// Liste des routes Pro (nécessitent au moins un abonnement pro)
const PRO_ROUTES = [
  "/api/subscribe",
  "/api/subscribe/cancel",
];

export async function authMiddleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Routes publiques - pas de vérification
  if (PUBLIC_ROUTES.some(route => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Vérifier l'authentification
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: "Non authentifié" },
      { status: 401 }
    );
  }

  // Routes Premium - vérifier l'abonnement
  if (PREMIUM_ROUTES.some(route => pathname.startsWith(route))) {
    if (user.subscription !== "premium") {
      return NextResponse.json(
        { error: "Fonctionnalité réservée au plan Premium" },
        { status: 403 }
      );
    }
  }

  // Routes Pro - vérifier l'abonnement
  if (PRO_ROUTES.some(route => pathname.startsWith(route))) {
    if (user.subscription === "free") {
      return NextResponse.json(
        { error: "Fonctionnalité réservée aux plans Pro et Premium" },
        { status: 403 }
      );
    }
  }

  // Tout est OK, on continue
  return NextResponse.next();
}
