/**
 * F4 (Lot 33) — Gestion du secret ICS d'un business.
 *
 * GET  → renvoie l'URL courante (ou null si pas encore généré)
 * POST → génère (ou rotate) le secret et renvoie la nouvelle URL
 * DELETE → révoque le secret (les abonnements existants tombent en 404)
 *
 * Auth : requireTeamPermission("business.edit") — owner + admin uniquement.
 */

import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { db } from "@/db";
import { businesses } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireTeamPermission } from "@/lib/team-context";
import { handleApiError } from "@/lib/api-error";
import { checkRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const RATE = { key: "ics-secret", limit: 20, windowSec: 3600 } as const;

function buildIcsUrl(secret: string): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.vitrix.fr";
  return `${appUrl}/api/calendar/${secret}.ics`;
}

export async function GET() {
  try {
    const ctx = await requireTeamPermission("business.edit");
    const url = ctx.business.icsSecret ? buildIcsUrl(ctx.business.icsSecret) : null;
    return NextResponse.json({ url, hasSecret: Boolean(ctx.business.icsSecret) });
  } catch (err) {
    return handleApiError(err, { route: "GET /api/calendar/ics-secret" });
  }
}

export async function POST(request: NextRequest) {
  const rl = checkRateLimit(request, RATE);
  if (!rl.ok) return rl.response;

  try {
    const ctx = await requireTeamPermission("business.edit");
    // 32 bytes hex = 64 chars, entropie 256 bits
    const newSecret = randomBytes(32).toString("hex");
    await db
      .update(businesses)
      .set({ icsSecret: newSecret })
      .where(eq(businesses.id, ctx.business.id));
    return NextResponse.json({ url: buildIcsUrl(newSecret), rotated: true });
  } catch (err) {
    return handleApiError(err, { route: "POST /api/calendar/ics-secret" });
  }
}

export async function DELETE() {
  try {
    const ctx = await requireTeamPermission("business.edit");
    await db.update(businesses).set({ icsSecret: null }).where(eq(businesses.id, ctx.business.id));
    return NextResponse.json({ ok: true, revoked: true });
  } catch (err) {
    return handleApiError(err, { route: "DELETE /api/calendar/ics-secret" });
  }
}
