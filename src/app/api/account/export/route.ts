/**
 * GET /api/account/export
 * Droit à la portabilité (RGPD article 20).
 *
 * Retourne un fichier JSON téléchargeable avec toutes les données personnelles
 * de l'utilisateur connecté + les données de son business.
 *
 * Rate limit strict : 3 exports / heure / user (pas un endpoint pour spammer).
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { handleApiError, unauthorized } from "@/lib/api-error";
import { checkRateLimit } from "@/lib/rate-limit";
import { buildRgpdExport } from "@/lib/rgpd-export";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  // 3 exports max par heure — suffit pour un usage humain, bloque le scraping
  const rl = checkRateLimit(req, { key: "account:export", limit: 3, windowSec: 3600 });
  if (!rl.ok) return rl.response;

  try {
    const user = await getCurrentUser();
    if (!user) throw unauthorized();

    logger.info("[rgpd] export demandé", { userId: user.id });

    const data = await buildRgpdExport(user.id);
    const json = JSON.stringify(data, null, 2);

    // Nom de fichier avec date pour la trace côté user
    const date = new Date().toISOString().slice(0, 10);
    const filename = `vitrix-mes-donnees-${date}.json`;

    return new NextResponse(json, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        // Pas de cache : les données peuvent changer entre 2 exports
        "Cache-Control": "no-store, must-revalidate",
      },
    });
  } catch (err) {
    return handleApiError(err, { route: "GET /api/account/export" });
  }
}
