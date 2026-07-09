import { db } from "@/db";
import { businesses } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  const allBusinesses = await db.select({ slug: businesses.slug, updatedAt: businesses.updatedAt }).from(businesses);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${appUrl}</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${appUrl}/login</loc>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>
  <url>
    <loc>${appUrl}/register</loc>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>
  ${allBusinesses
    .map(
      (b) => `
  <url>
    <loc>${appUrl}/${b.slug}</loc>
    <lastmod>${b.updatedAt.toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`
    )
    .join("")}
</urlset>`;

  return new Response(xml, {
    headers: { "Content-Type": "application/xml", "Cache-Control": "public, max-age=3600" },
  });
}
