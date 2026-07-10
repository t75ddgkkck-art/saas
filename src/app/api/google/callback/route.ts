import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  if (!code) {
    return NextResponse.json({ error: "Code manquant" }, { status: 400 });
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${appUrl}/api/google/callback`;

  try {
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

    const tokenData = (await tokenResponse.json()) as {
      access_token?: string;
      refresh_token?: string;
    };

    if (!tokenData.access_token) {
      logger.warn("google.oauth.no_token", { tokenData });
      return NextResponse.json({ error: "Impossible d'obtenir un token Google" }, { status: 400 });
    }

    // Récupérer les infos du compte Google Business
    const profileResponse = await fetch(
      "https://mybusinessbusinessinformation.googleapis.com/v1/accounts",
      { headers: { Authorization: `Bearer ${tokenData.access_token}` } }
    );
    const profileData = (await profileResponse.json()) as unknown;

    // TODO: persister refresh_token + Place ID dans la table businesses de l'user courant
    logger.info("google.oauth.success", {
      hasRefreshToken: !!tokenData.refresh_token,
      profileData,
    });

    return NextResponse.redirect(`${appUrl}/dashboard?google=connected`);
  } catch (error) {
    logger.error("google.oauth.failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.redirect(`${appUrl}/dashboard?google=error`);
  }
}
