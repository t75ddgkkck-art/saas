import { db } from "@/db";
import { businesses } from "@/db/schema";
import { isNotNull, sql } from "drizzle-orm";

export const dynamic = "force-static";
export const revalidate = 86400; // 1 jour (les villes changent rarement)

/** URL-safe : "Saint-Étienne" → "saint-etienne" */
function slugifyCity(city: string): string {
  return city
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export async function GET() {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://www.vitrix.fr").replace(/\/$/, "");

  let cities: { city: string; count: number }[] = [];
  try {
    // DISTINCT + count pour ne lister que les villes qui ont au moins 1 pro.
    // Utilise l'index businesses_city_idx.
    const rows = await db
      .select({
        city: businesses.city,
        count: sql<number>`count(*)::int`,
      })
      .from(businesses)
      .where(isNotNull(businesses.city))
      .groupBy(businesses.city);
    cities = rows
      .filter((r): r is { city: string; count: number } => Boolean(r.city))
      .map((r) => ({ city: r.city, count: Number(r.count) || 0 }));
  } catch {
    // ignore
  }

  const now = new Date().toISOString();
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${cities
  .map((c) => {
    const slug = slugifyCity(c.city);
    // Priorité un peu plus élevée pour les villes avec beaucoup de pros
    const priority = Math.min(0.9, 0.6 + Math.log10(1 + c.count) * 0.1).toFixed(1);
    return `  <url>
    <loc>${appUrl}/ville/${slug}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${priority}</priority>
  </url>`;
  })
  .join("\n")}
</urlset>`;

  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
