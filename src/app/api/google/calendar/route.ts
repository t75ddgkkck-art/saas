/**
 * F4 (Lot 33) — GET / DELETE /api/google/calendar
 *
 * GET    → statut connexion (connecté ou non)
 * DELETE → déconnexion (supprime le token côté Vitrix ; le pro peut aussi
 *          révoquer côté Google via son compte)
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTeamPermission } from "@/lib/team-context";
import {
  hasGoogleCalendarConnection,
  disconnectGoogleCalendar,
  isGoogleCalendarConfigured,
} from "@/lib/google-calendar";
import { handleApiError } from "@/lib/api-error";
import { checkRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  // Lot 64 : 60 checks/min — lecture standard
  const rl = checkRateLimit(request, { key: "google-cal-get", limit: 60, windowSec: 60 });
  if (!rl.ok) return rl.response;

  try {
    const ctx = await requireTeamPermission("business.edit");
    const connected = await hasGoogleCalendarConnection(ctx.business.id);
    return NextResponse.json({
      configured: isGoogleCalendarConfigured(),
      connected,
    });
  } catch (err) {
    return handleApiError(err, { route: "GET /api/google/calendar" });
  }
}

export async function DELETE(request: NextRequest) {
  // Lot 64 : 10 déconnexions/h — action rare
  const rl = checkRateLimit(request, { key: "google-cal-disconnect", limit: 10, windowSec: 3600 });
  if (!rl.ok) return rl.response;

  try {
    const ctx = await requireTeamPermission("business.edit");
    await disconnectGoogleCalendar(ctx.business.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err, { route: "DELETE /api/google/calendar" });
  }
}
