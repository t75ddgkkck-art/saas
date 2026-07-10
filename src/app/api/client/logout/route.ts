/**
 * F3 (Lot 31) — POST /api/client/logout
 * Révoque la session courante côté DB + supprime le cookie.
 */

import { NextResponse } from "next/server";
import { revokeCurrentClientSession } from "@/lib/client-session";
import { handleApiError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    await revokeCurrentClientSession();
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err, { route: "POST /api/client/logout" });
  }
}
