import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

// GET /api/auth/session : renvoie l'utilisateur courant si la session est valide.
// Utilisé par le client pour re-hydrater l'AuthContext sans lire un cookie non-httpOnly.
export async function GET() {
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
    },
  });
}

// DELETE /api/auth/session : logout.
export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.delete("auth_token");
  response.cookies.delete("auth_user");
  return response;
}
