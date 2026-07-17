import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { checkRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// GET /api/auth/session : renvoie l'utilisateur courant si la session est valide.
// Utilisé par le client pour re-hydrater l'AuthContext sans lire un cookie non-httpOnly.
export async function GET(req: NextRequest) {
  // Rate-limit assez généreux (120/min) : cette route est appelée à chaque mount
  // d'AuthProvider et lors de la resync focus tab. On veut juste bloquer un scraping massif.
  const rl = checkRateLimit(req, { key: "auth-session-get", limit: 120, windowSec: 60 });
  if (!rl.ok) return rl.response;

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ user: null }, { status: 200 });
  }
  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      subscription: user.subscription,
      // Lot 19 : le dashboard a besoin de savoir si l'email est vérifié
      // pour afficher la bannière "vérifiez votre email".
      emailVerified: user.emailVerified,
    },
  });
}

// DELETE /api/auth/session : logout.
export async function DELETE(req: NextRequest) {
  // Rate-limit léger sur logout (20/min) — pas critique mais évite spam.
  const rl = checkRateLimit(req, { key: "auth-session-delete", limit: 20, windowSec: 60 });
  if (!rl.ok) return rl.response;

  const response = NextResponse.json({ success: true });
  response.cookies.delete("auth_token");
  response.cookies.delete("auth_user");
  return response;
}
