import { NextRequest, NextResponse } from "next/server";
import { generateMonthlyReport } from "@/lib/ai-content";
import { requirePermission } from "@/lib/validation";
import { checkRateLimit } from "@/lib/rate-limit";
import { handleApiError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

// Génération lourde IA : 5/heure/IP suffit largement.
const RATE = { key: "ai:monthly-report", limit: 5, windowSec: 3600 } as const;

export async function POST(request: NextRequest) {
  const perm = await requirePermission("canAiReports");
  if (perm.error) return perm.error;

  const rl = checkRateLimit(request, RATE);
  if (!rl.ok) return rl.response;

  try {
    const result = await generateMonthlyReport();
    return NextResponse.json(result);
  } catch (err) {
    return handleApiError(err, { route: "POST /api/ai/monthly-report" });
  }
}
