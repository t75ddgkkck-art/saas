/**
 * Lot 36 — POST /api/track/visit
 *
 * Log une visite de vitrine dans `page_visits`. Appelée depuis PublicPage.tsx
 * après le mount (client-side, fire-and-forget).
 *
 * Sécurité :
 *  - Rate-limit 60/min/IP (une vraie visite = 1 call, on tolère quelques rechargements)
 *  - Body minimal (businessId + path), le reste est déduit côté serveur (headers)
 *  - Aucune PII écrite en DB (visitorHash = SHA-256 salted, IP/UA jamais stockés)
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { pageVisits, businesses } from "@/db/schema";
import { eq, isNull, and } from "drizzle-orm";
import { checkRateLimit } from "@/lib/rate-limit";
import { validateBody } from "@/lib/api-helpers";
import { computeVisitorHash, detectDevice, detectSource } from "@/lib/visitor-hash";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const RATE = { key: "track-visit", limit: 60, windowSec: 60 } as const;

const Schema = z.object({
  businessId: z.string().uuid(),
  path: z.string().max(200).optional(),
  /** Source explicite via query param (?src=qr, ?src=email, etc.) */
  src: z.string().max(50).optional(),
});

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function POST(request: NextRequest) {
  const rl = checkRateLimit(request, RATE);
  if (!rl.ok) return rl.response;

  try {
    const { businessId, path, src } = await validateBody(request, Schema);

    // Vérifie que le business existe (anti-flood sur random UUID)
    const [biz] = await db
      .select({ id: businesses.id })
      .from(businesses)
      .where(and(eq(businesses.id, businessId), isNull(businesses.deletedAt)))
      .limit(1);
    if (!biz) {
      // Répond 200 même si non trouvé (anti-énumération d'IDs)
      return NextResponse.json({ ok: true });
    }

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    const userAgent = request.headers.get("user-agent");
    const referer = request.headers.get("referer");

    await db.insert(pageVisits).values({
      businessId,
      date: todayIso(),
      source: detectSource(referer, src ?? null),
      device: detectDevice(userAgent),
      path: path?.slice(0, 200) ?? "/",
      visitorHash: computeVisitorHash(ip, userAgent),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    // Non-throwing pour ne jamais casser le rendering de la vitrine
    logger.warn("track.visit.failed", {
      err: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
