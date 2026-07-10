import { ImageResponse } from "next/og";
import { db } from "@/db";
import { businesses, reviews } from "@/db/schema";
import { eq } from "drizzle-orm";

// OG image dynamique par vitrine (Facebook, LinkedIn, WhatsApp, Twitter…)
// Générée à la volée par Next.js sur l'edge. Cache 1h côté CDN.
export const runtime = "nodejs"; // db/pg = pas edge-compatible
export const revalidate = 3600;
export const alt = "Aperçu de la vitrine";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Props = { params: Promise<{ slug: string }> };

export default async function OgImage({ params }: Props) {
  const { slug } = await params;

  let business: {
    name: string;
    category: string;
    city: string | null;
    description: string | null;
    primaryColor: string | null;
  } | null = null;
  let avgRating = 0;
  let reviewsCount = 0;

  try {
    const [b] = await db
      .select({
        name: businesses.name,
        category: businesses.category,
        city: businesses.city,
        description: businesses.description,
        primaryColor: businesses.primaryColor,
      })
      .from(businesses)
      .where(eq(businesses.slug, slug))
      .limit(1);
    business = b ?? null;

    if (business) {
      const rvws = await db
        .select({ rating: reviews.rating })
        .from(reviews)
        .where(
          eq(
            reviews.businessId,
            (
              await db
                .select({ id: businesses.id })
                .from(businesses)
                .where(eq(businesses.slug, slug))
                .limit(1)
            )[0]!.id
          )
        );
      reviewsCount = rvws.length;
      avgRating = reviewsCount > 0 ? rvws.reduce((s, r) => s + r.rating, 0) / reviewsCount : 0;
    }
  } catch {
    // Fallback silencieux : on rend un OG générique
  }

  const primary =
    business?.primaryColor && /^#[0-9a-fA-F]{6}$/.test(business.primaryColor)
      ? business.primaryColor
      : "#0f172a";
  const name = business?.name ?? "Vitrine";
  const category = business?.category ?? "Artisan";
  const city = business?.city ?? "";
  const desc = (business?.description ?? "").slice(0, 120);

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "64px 80px",
        background: `linear-gradient(135deg, ${primary} 0%, #1e293b 100%)`,
        color: "#ffffff",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      {/* Header : catégorie + note */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            padding: "10px 20px",
            borderRadius: 999,
            background: "rgba(255,255,255,0.15)",
            fontSize: 24,
            fontWeight: 500,
            color: "#e2e8f0",
            textTransform: "capitalize",
          }}
        >
          {category}
        </div>
        {reviewsCount > 0 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "10px 20px",
              borderRadius: 999,
              background: "rgba(255,255,255,0.15)",
              fontSize: 26,
              fontWeight: 600,
              color: "#fef3c7",
            }}
          >
            ⭐ {avgRating.toFixed(1)} · {reviewsCount} avis
          </div>
        )}
      </div>

      {/* Nom + ville + description */}
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div
          style={{
            fontSize: 90,
            fontWeight: 800,
            lineHeight: 1,
            letterSpacing: "-0.03em",
            color: "#ffffff",
          }}
        >
          {name}
        </div>
        {city && <div style={{ fontSize: 40, fontWeight: 500, color: "#cbd5e1" }}>📍 {city}</div>}
        {desc && (
          <div style={{ fontSize: 28, color: "#94a3b8", lineHeight: 1.35, marginTop: 8 }}>
            {desc}
          </div>
        )}
      </div>

      {/* Footer : branding */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              display: "flex",
              width: 56,
              height: 56,
              borderRadius: 14,
              background: "#ffffff",
              color: primary,
              fontSize: 40,
              fontWeight: 900,
              alignItems: "center",
              justifyContent: "center",
              lineHeight: 1,
            }}
          >
            V
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 30, fontWeight: 700, color: "#ffffff" }}>Vitrix</div>
            <div style={{ fontSize: 20, color: "#94a3b8" }}>vitrix.fr/{slug}</div>
          </div>
        </div>
        <div
          style={{
            display: "flex",
            padding: "12px 24px",
            borderRadius: 12,
            background: "#ffffff",
            color: primary,
            fontSize: 22,
            fontWeight: 700,
          }}
        >
          Prendre RDV →
        </div>
      </div>
    </div>,
    { ...size }
  );
}
