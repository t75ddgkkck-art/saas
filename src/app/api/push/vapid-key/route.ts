/**
 * F6 (Lot 34) — GET /api/push/vapid-key
 * Renvoie la clé publique VAPID pour que le frontend puisse s'abonner.
 * Null si push non configuré (frontend cache alors le toggle).
 */

import { NextResponse } from "next/server";
import { getVapidPublicKey, isPushConfigured } from "@/lib/push";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    {
      publicKey: getVapidPublicKey(),
      configured: isPushConfigured(),
    },
    { headers: { "Cache-Control": "public, max-age=3600" } }
  );
}
