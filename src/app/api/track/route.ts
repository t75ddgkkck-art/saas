import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { pageVisits, businesses } from "@/db/schema";
import { eq } from "drizzle-orm";
import { checkRateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// Cap : 60 hits/min/IP suffit largement pour du vrai trafic humain,
// bloque les bots qui tenteraient de gonfler les stats.
const RATE = { key: "track", limit: 60, windowSec: 60 } as const;

const Schema = z.object({
  slug: z.string().trim().min(1).max(150),
  referrer: z.string().max(500).optional().nullable(),
  device: z.enum(["mobile", "desktop", "tablet"]).optional(),
  path: z.string().max(200).optional(),
  utm: z.string().max(50).optional().nullable(),
});

function detectSource(referrer: string | null | undefined, utm: string | null | undefined): string {
  if (utm === "qr") return "qr";
  if (!referrer) return "direct";
  const r = referrer.toLowerCase();
  if (r.includes("google")) return "google";
  if (r.includes("facebook") || r.includes("fb.com")) return "facebook";
  if (r.includes("instagram")) return "instagram";
  if (r.includes("linkedin")) return "linkedin";
  if (r.includes("bing")) return "bing";
  if (r.includes("vitrix")) return "vitrix";
  return "autre";
}

export async function POST(request: NextRequest) {
  const rl = checkRateLimit(request, RATE);
  if (!rl.ok) return rl.response;

  try {
    const raw = await request.json().catch(() => null);
    const parsed = Schema.safeParse(raw);
    // Le tracking ne doit JAMAIS faire échouer la page côté client :
    // on renvoie ok:false silencieusement en cas d'input invalide.
    if (!parsed.success) return NextResponse.json({ ok: false });
    const data = parsed.data;

    const [biz] = await db
      .select({ id: businesses.id })
      .from(businesses)
      .where(eq(businesses.slug, data.slug))
      .limit(1);
    if (!biz) return NextResponse.json({ ok: false });

    const today = new Date().toISOString().split("T")[0];
    await db.insert(pageVisits).values({
      businessId: biz.id,
      date: today,
      source: detectSource(data.referrer, data.utm),
      device: data.device ?? "desktop",
      path: data.path || "/",
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    // Fire-and-forget : on log mais on ne remonte pas d'erreur au client.
    logger.warn("track.failed", {
      message: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ ok: false });
  }
}
