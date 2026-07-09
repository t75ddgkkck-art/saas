import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { pageVisits, businesses } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

// Détecte la source depuis le referrer
function detectSource(referrer: string | null, utm: string | null): string {
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
  try {
    const body = await request.json();
    const { slug, referrer, device, path, utm } = body;

    if (!slug) return NextResponse.json({ ok: false });

    const biz = await db.select({ id: businesses.id }).from(businesses).where(eq(businesses.slug, slug)).limit(1);
    if (biz.length === 0) return NextResponse.json({ ok: false });

    const today = new Date().toISOString().split("T")[0];

    await db.insert(pageVisits).values({
      businessId: biz[0].id,
      date: today,
      source: detectSource(referrer, utm),
      device: device === "mobile" ? "mobile" : device === "tablet" ? "tablet" : "desktop",
      path: path || "/",
    });

    return NextResponse.json({ ok: true });
  } catch {
    // Le tracking ne doit jamais faire échouer la page
    return NextResponse.json({ ok: false });
  }
}
