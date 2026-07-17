/**
 * GET /api/account/referral
 * Retourne le code parrain du user + les filleuls + le crédit accumulé.
 *
 * Lot 52 (F14) : enrichi avec `loadReferralStats` + `loadReferralList`.
 * Ajout du plafond max (12 mois cumulés) + liste des filleuls masquée.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { handleApiError, unauthorized } from "@/lib/api-error";
import { loadReferralStats, loadReferralList } from "@/lib/referral-stats";
import { checkRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    // Rate-limit lecture standard (60/min) — 2 queries agrégées derrière.
    const rl = checkRateLimit(req, { key: "account-referral-get", limit: 60, windowSec: 60 });
    if (!rl.ok) return rl.response;

    const user = await getCurrentUser();
    if (!user) throw unauthorized();

    const [stats, list] = await Promise.all([
      loadReferralStats(user.id),
      // Lot 52 : on plafonne à 50 filleuls affichés (largement suffisant en v1)
      loadReferralList(user.id, 50),
    ]);

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.vitrix.fr";

    return NextResponse.json({
      ok: true,
      referralCode: user.referralCode,
      shareUrl: user.referralCode ? `${appUrl}/register?ref=${user.referralCode}` : null,
      creditMonths: stats.creditMonths,
      // Lot 52 : plafond exposé pour l'affichage "X mois sur 12 max"
      maxCreditMonths: stats.maxCreditMonths,
      atMaxCredit: stats.atMaxCredit,
      stats: {
        totalReferred: stats.totalReferred,
        // Backward compat : l'ancien champ s'appelait `paidReferred`, on garde
        paidReferred: stats.converted,
        converted: stats.converted,
        pending: stats.pending,
      },
      referredList: list,
    });
  } catch (err) {
    return handleApiError(err, { route: "GET /api/account/referral" });
  }
}
