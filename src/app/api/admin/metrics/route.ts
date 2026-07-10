/**
 * GET /api/admin/metrics
 * Retourne les metrics business agrégées (cache 60s).
 * Accès admin uniquement.
 */

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { getBusinessMetrics, getConversionRate30d } from "@/lib/metrics";
import { handleApiError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdmin();
    const [metrics, conversion] = await Promise.all([getBusinessMetrics(), getConversionRate30d()]);
    return NextResponse.json({ ...metrics, conversion });
  } catch (err) {
    return handleApiError(err, { route: "GET /api/admin/metrics" });
  }
}
