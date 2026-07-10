/**
 * F3 (Lot 31) — GET /api/client/verify?token=<raw>
 *
 * Consomme le magic-link, crée une session, pose le cookie et redirige
 * vers `/mon-compte`.
 *
 * Réponses :
 *  - Token valide → 302 vers /mon-compte
 *  - Token invalide/expiré/déjà utilisé → 302 vers /mon-compte/login?error=invalid
 *
 * Rate-limit : 10/min/IP (léger — un user peut retenter honnêtement)
 */

import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { consumeClientAuthToken } from "@/lib/client-auth";
import { createClientSession } from "@/lib/client-session";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const RATE = { key: "client-verify", limit: 10, windowSec: 60 } as const;

export async function GET(request: NextRequest) {
  const rl = checkRateLimit(request, RATE);
  if (!rl.ok) return rl.response;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const userAgent = request.headers.get("user-agent") ?? null;

  const result = await consumeClientAuthToken(token, { ip });

  if (!result.ok) {
    logger.info("[client-verify] token invalide", { reason: result.reason });
    return NextResponse.redirect(`${appUrl}/mon-compte/login?error=invalid`);
  }

  await createClientSession({ email: result.email, ip, userAgent });

  logger.info("[client-verify] session créée", { email: result.email });
  return NextResponse.redirect(`${appUrl}/mon-compte`);
}
