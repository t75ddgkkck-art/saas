/**
 * F4 (Lot 33) — GET /api/google/calendar/callback
 *
 * Callback OAuth Google Calendar. Vérifie state → échange code contre tokens
 * → stocke refresh_token + access_token dans `calendar_tokens` → redirect
 * dashboard avec message succès.
 */

import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { db } from "@/db";
import { calendarTokens } from "@/db/schema";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

function verifyState(
  state: string
): { ok: true; businessId: string } | { ok: false; reason: string } {
  try {
    const secret = process.env.NEXTAUTH_SECRET || "dev-secret-change-me";
    const decoded = Buffer.from(state, "base64url").toString("utf8");
    const parts = decoded.split(".");
    if (parts.length !== 3) return { ok: false, reason: "bad_format" };
    const [businessId, nonce, hmac] = parts;
    const expected = createHmac("sha256", secret).update(`${businessId}.${nonce}`).digest("hex");
    const a = Buffer.from(hmac, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length) return { ok: false, reason: "bad_sig" };
    if (!timingSafeEqual(a, b)) return { ok: false, reason: "bad_sig" };
    return { ok: true, businessId };
  } catch {
    return { ok: false, reason: "parse_error" };
  }
}

export async function GET(request: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state") ?? "";
  const errorParam = searchParams.get("error");

  if (errorParam) {
    logger.warn("google-calendar.oauth.error", { error: errorParam });
    return NextResponse.redirect(`${appUrl}/dashboard/appointments?gcal=denied`);
  }

  if (!code) {
    return NextResponse.redirect(`${appUrl}/dashboard/appointments?gcal=missing_code`);
  }

  const stateCheck = verifyState(state);
  if (!stateCheck.ok) {
    logger.warn("google-calendar.oauth.bad_state", { reason: stateCheck.reason });
    return NextResponse.redirect(`${appUrl}/dashboard/appointments?gcal=bad_state`);
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri =
    process.env.GOOGLE_CALENDAR_REDIRECT_URI || `${appUrl}/api/google/calendar/callback`;

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${appUrl}/dashboard/appointments?gcal=not_configured`);
  }

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }),
    });
    const tokenData = (await tokenRes.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      scope?: string;
      error?: string;
    };

    if (!tokenData.access_token || !tokenData.refresh_token) {
      // refresh_token absent = le user avait déjà consenti sans révoquer entre-temps.
      // On force `prompt=consent` côté connect pour éviter, mais on gère quand même.
      logger.warn("google-calendar.oauth.no_refresh_token", {
        businessId: stateCheck.businessId,
        hasAccess: Boolean(tokenData.access_token),
        error: tokenData.error,
      });
      return NextResponse.redirect(`${appUrl}/dashboard/appointments?gcal=no_refresh`);
    }

    const expiresAt = new Date(Date.now() + (tokenData.expires_in ?? 3600) * 1000);

    // Upsert (1 seul token Calendar par business)
    await db
      .insert(calendarTokens)
      .values({
        businessId: stateCheck.businessId,
        provider: "google",
        refreshToken: tokenData.refresh_token,
        accessToken: tokenData.access_token,
        accessTokenExpiresAt: expiresAt,
        calendarId: "primary",
        scope: tokenData.scope ?? null,
      })
      .onConflictDoUpdate({
        target: calendarTokens.businessId,
        set: {
          refreshToken: tokenData.refresh_token,
          accessToken: tokenData.access_token,
          accessTokenExpiresAt: expiresAt,
          scope: tokenData.scope ?? null,
          connectedAt: new Date(),
        },
      });

    logger.info("google-calendar.oauth.connected", { businessId: stateCheck.businessId });
    return NextResponse.redirect(`${appUrl}/dashboard/appointments?gcal=connected`);
  } catch (err) {
    logger.error("google-calendar.oauth.exchange_failed", {
      err: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.redirect(`${appUrl}/dashboard/appointments?gcal=error`);
  }
}
