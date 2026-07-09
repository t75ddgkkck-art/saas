import { NextRequest, NextResponse } from "next/server";
import { getCurrentBusiness } from "@/lib/session";
import { uploadFile } from "@/lib/storage";
import { checkRateLimit } from "@/lib/rate-limit";
import { handleApiError, badRequest, unauthorized } from "@/lib/api-error";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// Uploads authentifiés uniquement (protégés par le middleware).
// Rate-limit défensif contre un compte compromis qui uploaderait en masse.
const RATE = { key: "upload", limit: 40, windowSec: 300 } as const;

const VALID_FOLDERS = new Set(["logo", "cover", "profile", "gallery", "blog", "signature", "misc"]);

/**
 * POST /api/upload
 * Form-data:
 *   - file: File (image/video/pdf, ≤ 10 Mo)
 *   - folder: "logo" | "cover" | "profile" | "gallery" | "blog" | "signature" | "misc"
 *
 * Renvoie : { url, backend, name, size, contentType }
 *
 * Le backend utilisé est Supabase Storage si SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 * + SUPABASE_STORAGE_BUCKET sont configurés ; sinon fallback base64 (data-URI).
 */
export async function POST(request: NextRequest) {
  const rl = checkRateLimit(request, RATE);
  if (!rl.ok) return rl.response;

  try {
    const business = await getCurrentBusiness();
    if (!business) throw unauthorized();

    const formData = await request.formData();
    const file = formData.get("file");
    const rawFolder = formData.get("folder");

    if (!(file instanceof File)) throw badRequest("Champ 'file' manquant");
    const folder = typeof rawFolder === "string" && VALID_FOLDERS.has(rawFolder)
      ? rawFolder
      : "misc";

    // On préfixe avec l'ID business pour l'isolation storage
    const uploaded = await uploadFile(file, { folder: `${folder}/${business.id}` });
    if (!uploaded) throw badRequest("Fichier refusé (type ou taille invalide)");

    logger.info("upload.ok", {
      businessId: business.id,
      folder,
      backend: uploaded.backend,
      size: uploaded.size,
      contentType: uploaded.contentType,
    });

    return NextResponse.json(uploaded);
  } catch (err) {
    return handleApiError(err, { route: "POST /api/upload" });
  }
}
