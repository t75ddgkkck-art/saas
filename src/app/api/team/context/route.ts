/**
 * F5 (Lot 32) — GET /api/team/context
 *
 * Retourne le contexte équipe minimal pour l'user courant :
 *  - business (id, name, slug)
 *  - role (owner | admin | employee | viewer)
 *  - isOwner
 *
 * Utilisé par le bandeau "Vous êtes membre de X" dans le dashboard layout.
 * Rate-limit léger (60/min).
 */

import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { getCurrentTeamContext } from "@/lib/team-context";
import { handleApiError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

const RATE = { key: "team-context", limit: 60, windowSec: 60 } as const;

export async function GET(request: NextRequest) {
  const rl = checkRateLimit(request, RATE);
  if (!rl.ok) return rl.response;

  try {
    const ctx = await getCurrentTeamContext();
    if (!ctx) return NextResponse.json({ ok: false }, { status: 401 });

    return NextResponse.json(
      {
        ok: true,
        business: {
          id: ctx.business.id,
          name: ctx.business.name,
          slug: ctx.business.slug,
        },
        role: ctx.role,
        isOwner: ctx.isOwner,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    return handleApiError(err, { route: "GET /api/team/context" });
  }
}
