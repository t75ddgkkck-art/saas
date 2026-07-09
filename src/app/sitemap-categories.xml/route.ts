import { db } from "@/db";
import { businesses } from "@/db/schema";
import { sql } from "drizzle-orm";

export const dynamic = "force-static";
export const revalidate = 86400;

export async function GET() {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://www.vitrix.fr").replace(/\/$/, "");

  let categories: { category: string; count: number }[] = [];
  try {
    const rows = await db
      .select({
        category: businesses.category,
        count: sql<number>`count(*)::int`,
      })
      .from(businesses)
      .groupBy(businesses.category);
    categories = rows.map((r) => ({ category: r.category, count: Number(r.count) || 0 }));
  } catch {
    // ignore
  }

  const now = new Date().toISOString();
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${categories
  .map((c) => {
    const priority = Math.min(0.9, 0.6 + Math.log10(1 + c.count) * 0.1).toFixed(1);
    return `  <url>
    <loc>${appUrl}/metier/${encodeURIComponent(c.category)}</loc>
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
