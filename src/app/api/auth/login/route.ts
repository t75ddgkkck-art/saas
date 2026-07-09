import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifyPassword } from "@/lib/auth";
import { createSessionToken } from "@/lib/session";

export const dynamic = "force-dynamic";

const TOKEN_EXPIRY = 7 * 24 * 60 * 60;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ error: "Email et mot de passe requis" }, { status: 400 });
    }

    const userResult = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (userResult.length === 0) {
      return NextResponse.json({ error: "Email ou mot de passe incorrect" }, { status: 401 });
    }

    const user = userResult[0];
    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      return NextResponse.json({ error: "Email ou mot de passe incorrect" }, { status: 401 });
    }

    const token = createSessionToken(user.id);
    const expiresAt = new Date(Date.now() + TOKEN_EXPIRY * 1000);
    const secure = (request.headers.get("x-forwarded-proto")?.split(",")[0].trim() === "https") || new URL(request.url).protocol === "https:";

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        subscription: user.subscription,
      },
    });

    response.cookies.set("auth_token", token, {
      httpOnly: true,
      secure,
      sameSite: "lax",
      expires: expiresAt,
      path: "/",
    });

    response.cookies.set("auth_user", JSON.stringify({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      subscription: user.subscription,
    }), {
      httpOnly: false,
      secure,
      sameSite: "lax",
      expires: expiresAt,
      path: "/",
    });

    return response;
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Erreur de connexion" }, { status: 500 });
  }
}
