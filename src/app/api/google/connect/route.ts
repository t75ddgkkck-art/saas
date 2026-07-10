import { NextRequest, NextResponse } from "next/server";

// Cette route redirige vers Google OAuth pour que le pro connecte son compte Google
// et importe ses VRAIS avis Google (évite les faux avis)

export async function GET(request: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI || "http://localhost:3000/api/google/callback";

  if (!clientId) {
    return NextResponse.json({ error: "Google OAuth non configuré" }, { status: 500 });
  }

  const scopes = [
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/business.manage", // Pour lire les avis Google Business
  ].join(" ");

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scopes)}&access_type=offline&prompt=consent`;

  return NextResponse.redirect(authUrl);
}
