/**
 * Lot 47 (F12) — GET /api/qr-codes/[id]/download?format=png|svg&size=512
 *
 * Génère à la demande le PNG (buffer) ou SVG (texte) du QR trackable.
 * Réponse avec Content-Disposition: attachment pour déclencher le téléchargement.
 *
 * Aucun stockage cache — la génération QRCode est CPU-only et suffisamment rapide
 * (~5ms pour un 512×512). Faire du cache serait prématuré + gestion invalidation
 * complexe si le pro modifie le label.
 */

import { NextRequest, NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import QRCode from "qrcode";
import { db } from "@/db";
import { qrCodes, businesses } from "@/db/schema";
import { getCurrentBusiness } from "@/lib/session";
import { handleApiError, notFound, unauthorized, badRequest } from "@/lib/api-error";
import { checkRateLimit } from "@/lib/rate-limit";
import { buildTrackedUrl } from "@/lib/qr-tracking";

export const dynamic = "force-dynamic";

const RATE = { key: "qr-code-download", limit: 30, windowSec: 60 } as const;

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const rl = checkRateLimit(req, RATE);
  if (!rl.ok) return rl.response;

  try {
    const biz = await getCurrentBusiness();
    if (!biz) throw unauthorized();

    const { id } = await ctx.params;
    const url = new URL(req.url);
    const format = (url.searchParams.get("format") || "png").toLowerCase();
    // Size : entre 128 et 2048 (défaut 512). Défensif contre les XXL abusifs.
    const size = Math.min(
      2048,
      Math.max(128, Number(url.searchParams.get("size")) || 512)
    );

    if (format !== "png" && format !== "svg") {
      throw badRequest("Format doit être png ou svg");
    }

    // Anti-IDOR + load business slug pour construire l'URL trackée
    const [row] = await db
      .select({ qr: qrCodes, bizSlug: businesses.slug })
      .from(qrCodes)
      .innerJoin(businesses, eq(qrCodes.businessId, businesses.id))
      .where(and(eq(qrCodes.id, id), eq(qrCodes.businessId, biz.id), isNull(qrCodes.deletedAt)))
      .limit(1);

    if (!row) throw notFound("QR code introuvable");

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://www.vitrix.fr").replace(
      /\/+$/,
      ""
    );
    const trackedUrl = buildTrackedUrl(`${appUrl}/${row.bizSlug}`, {
      source: row.qr.source,
      utmCampaign: row.qr.utmCampaign,
      utmMedium: row.qr.utmMedium,
      utmContent: row.qr.utmContent,
    });

    // Slug filename safe pour Content-Disposition
    const filenameSafe = row.qr.source.replace(/[^a-z0-9-]/gi, "");

    if (format === "svg") {
      const svg = await QRCode.toString(trackedUrl, {
        type: "svg",
        width: size,
        margin: 2,
        color: { dark: "#0f172a", light: "#ffffff" },
        errorCorrectionLevel: "M",
      });
      return new NextResponse(svg, {
        headers: {
          "Content-Type": "image/svg+xml",
          "Content-Disposition": `attachment; filename="qr-${filenameSafe}.svg"`,
          "Cache-Control": "private, max-age=3600",
        },
      });
    }

    // PNG
    const pngBuffer = await QRCode.toBuffer(trackedUrl, {
      width: size,
      margin: 2,
      color: { dark: "#0f172a", light: "#ffffff" },
      errorCorrectionLevel: "M",
    });

    return new NextResponse(pngBuffer as unknown as BodyInit, {
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": `attachment; filename="qr-${filenameSafe}.png"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (err) {
    return handleApiError(err, { route: "GET /api/qr-codes/[id]/download" });
  }
}
