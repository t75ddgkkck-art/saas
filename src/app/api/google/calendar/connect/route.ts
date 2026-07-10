/**
 * F4 (Lot 33) — GET /api/google/calendar/connect
 *
 * Point d'entrée pour connecter Google Calendar.
 * Redirige vers Google OAuth avec le scope `calendar.events` + `state` signé
 * pour éviter les attaques CSRF et transporter le businessId au callback.
 */

import { NextResponse } from "next/server";
import { createHmac, randomBytes } from "crypto";
import { requireTeamPermission } from "@/lib/team-context";
import { buildGoogleCalendarAuthUrl, isGoogleCalendarConfigured } from "@/lib/google-calendar";
import { handleApiError, badRequest } from "@/lib/api-error";

export const dynamic = "force-dynamic";

/**
 * Signe un state OAuth : `businessId.nonce.hmac(businessId.nonce)` en base64url.
 * Le callback vérifie la signature avant de faire confiance au businessId.
 */
function signState(businessId: string): string {
  const secret = process.env.NEXTAUTH_SECRET || "dev-secret-change-me";
  const nonce = randomBytes(8).toString("hex");
  const payload = `${businessId}.${nonce}`;
  const hmac = createHmac("sha256", secret).update(payload).digest("hex");
  return Buffer.from(`${payload}.${hmac}`).toString("base64url");
}

export async function GET() {
  try {
    if (!isGoogleCalendarConfigured()) {
      throw badRequest(
        "Google Calendar n'est pas configuré côté serveur. Contactez l'administrateur."
      );
    }
    const ctx = await requireTeamPermission("business.edit");
    const state = signState(ctx.business.id);
    const url = buildGoogleCalendarAuthUrl(state);
    if (!url) throw badRequest("Impossible de générer l'URL Google");
    return NextResponse.redirect(url);
  } catch (err) {
    return handleApiError(err, { route: "GET /api/google/calendar/connect" });
  }
}
