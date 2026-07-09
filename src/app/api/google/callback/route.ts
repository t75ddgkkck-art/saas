import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { businesses } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.json({ error: "Code manquant" }, { status: 400 });
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || "http://localhost:3000/api/google/callback";

  try {
    // Échanger le code contre un access token + refresh token
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId!,
        client_secret: clientSecret!,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenData.access_token) {
      return NextResponse.json({ error: "Impossible d'obtenir un token Google", details: tokenData }, { status: 400 });
    }

    // Récupérer les infos du compte Google Business (si le pro a Google Business Profile)
    const profileResponse = await fetch(
      "https://mybusinessbusinessinformation.googleapis.com/v1/accounts",
      {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      }
    );

    const profileData = await profileResponse.json();

    // Sauvegarder le refresh token + Place ID dans le business du pro
    // (pour l'instant on log, en prod on mettrait à jour le business)
    console.log("Google connected:", {
      refreshToken: tokenData.refresh_token,
      accessToken: tokenData.access_token,
      accounts: profileData,
    });

    // Rediriger vers le dashboard avec un message de succès
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/dashboard?google=connected`
    );
  } catch (error: any) {
    console.error("Google OAuth error:", error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/dashboard?google=error`
    );
  }
}
