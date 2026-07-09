import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifySiret } from "@/lib/siret";
import { checkRateLimit } from "@/lib/rate-limit";
import { handleApiError } from "@/lib/api-error";
import { validateBody } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

// Cap strict : la vérif SIRET tape sur l'API INSEE — 10/min/IP maxi.
const RATE = { key: "verify-siret", limit: 10, windowSec: 60 } as const;

const Schema = z.object({
  siret: z
    .string()
    .trim()
    .transform((s) => s.replace(/\s/g, ""))
    .refine((s) => /^\d{14}$/.test(s), "SIRET doit contenir exactement 14 chiffres"),
});

export async function POST(request: NextRequest) {
  const rl = checkRateLimit(request, RATE);
  if (!rl.ok) return rl.response;

  try {
    const { siret } = await validateBody(request, Schema);
    const result = await verifySiret(siret);
    return NextResponse.json(result);
  } catch (err) {
    return handleApiError(err, { route: "POST /api/verify-siret" });
  }
}
