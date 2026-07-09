import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { generateQRCode } from "@/lib/siret";
import { checkRateLimit } from "@/lib/rate-limit";
import { handleApiError } from "@/lib/api-error";
import { validateBody } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

// La génération QR est CPU-only, mais on empêche quand même le spam.
const RATE = { key: "qr-code", limit: 30, windowSec: 60 } as const;

const Schema = z.object({
  url: z.string().url("URL invalide").max(2000),
});

export async function POST(request: NextRequest) {
  const rl = checkRateLimit(request, RATE);
  if (!rl.ok) return rl.response;

  try {
    const { url } = await validateBody(request, Schema);
    const qrDataUrl = await generateQRCode(url);
    return NextResponse.json({ qrCode: qrDataUrl });
  } catch (err) {
    return handleApiError(err, { route: "POST /api/qr-code" });
  }
}
