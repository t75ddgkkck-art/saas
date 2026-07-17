/**
 * F3 (Lot 31) — POST /api/client/logout
 * Révoque la session courante côté DB + supprime le cookie.
 */

import { NextRequest, NextResponse } from "next/server";
import { revokeCurrentClientSession } from "@/lib/client-session";
import { handleApiError } from "@/lib/api-error";
import { checkRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  // Lot 64 : 20 logouts/min — logout trivial mais on évite le spam qui
  // pourrait faire écrire des révocations en cascade côté DB.
  const rl = checkRateLimit(request, { key: "client-logout", limit: 20, windowSec: 60 });
  if (!rl.ok) return rl.response;

  try {
    await revokeCurrentClientSession();
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err, { route: "POST /api/client/logout" });
  }
}
