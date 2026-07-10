import { db } from "@/db";
import { businesses } from "@/db/schema";
import { desc, isNull } from "drizzle-orm";

export const dynamic = "force-static";
export const revalidate = 3600; // 1 heure

const PAGE_SIZE = 5000;

export async function GET(_req: Request, { params }: { params: Promise<{ page: string }> }) {
  const { page } = await params;
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://www.vitrix.fr").replace(/\/$/, "");

  let rows: { slug: string; updatedAt: Date }[] = [];
  try {
    rows = await db
      .select({ slug: businesses.slug, updatedAt: businesses.updatedAt })
      .from(businesses)
      // Lot 14.3 : exclure les soft-deleted du sitemap (Google ne doit pas les crawler)
      .where(isNull(businesses.deletedAt))
      .orderBy(desc(businesses.updatedAt))
      .limit(PAGE_SIZE)
      .offset((pageNum - 1) * PAGE_SIZE);
  } catch {
    // Build sans DB : renvoie sitemap vide plutôt que crasher.
  }

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${rows
  .map(
    (b) => `  <url>
    <loc>${appUrl}/${b.slug}</loc>
    <lastmod>${b.updatedAt.toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
    <xhtml:link rel="alternate" hreflang="fr" href="${appUrl}/${b.slug}"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="${appUrl}/${b.slug}"/>
  </url>`
  )
  .join("\n")}
</urlset>`;

  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
