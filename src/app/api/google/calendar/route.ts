/**
 * F4 (Lot 33) — GET / DELETE /api/google/calendar
 *
 * GET    → statut connexion (connecté ou non)
 * DELETE → déconnexion (supprime le token côté Vitrix ; le pro peut aussi
 *          révoquer côté Google via son compte)
 */

import { NextResponse } from "next/server";
import { requireTeamPermission } from "@/lib/team-context";
import {
  hasGoogleCalendarConnection,
  disconnectGoogleCalendar,
  isGoogleCalendarConfigured,
} from "@/lib/google-calendar";
import { handleApiError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

export async function GET() {
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

export async function DELETE() {
  try {
    const ctx = await requireTeamPermission("business.edit");
    await disconnectGoogleCalendar(ctx.business.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err, { route: "DELETE /api/google/calendar" });
  }
}
