import { db } from "@/db";
import { businesses, blogPosts } from "@/db/schema";
import { and, count, eq, sql } from "drizzle-orm";

export const dynamic = "force-static";
export const revalidate = 3600; // 1 heure

const PAGE_SIZE = 5000;

/**
 * SITEMAP INDEX — pointe vers plusieurs sitemaps par type.
 *
 * Avantages :
 *  - Contourne la limite de 50 000 URL / sitemap Google
 *  - Google recrawle uniquement les sitemaps modifiés (lastmod)
 *  - Isole les types (static / businesses / blog / cities / categories)
 *
 * Chaque sous-sitemap est en ISR 1h (route.ts sitemap-*.xml).
 */

interface SitemapEntry {
  loc: string;
  lastmod?: string;
}

async function computeIndex(appUrl: string): Promise<SitemapEntry[]> {
  const now = new Date().toISOString();
  const entries: SitemapEntry[] = [{ loc: `${appUrl}/sitemap-static.xml`, lastmod: now }];

  try {
    // Pagination sitemaps businesses
    const [{ total: bizTotal }] = await db.select({ total: count() }).from(businesses);
    const bizPages = Math.max(1, Math.ceil(Number(bizTotal ?? 0) / PAGE_SIZE));
    for (let i = 0; i < bizPages; i++) {
      entries.push({ loc: `${appUrl}/sitemap-businesses/${i + 1}`, lastmod: now });
    }

    // Pagination sitemaps blog (uniquement articles publiés)
    const [{ total: blogTotal }] = await db
      .select({ total: count() })
      .from(blogPosts)
      .where(eq(blogPosts.isPublished, true));
    const blogPages = Math.max(1, Math.ceil(Number(blogTotal ?? 0) / PAGE_SIZE));
    if (Number(blogTotal ?? 0) > 0) {
      for (let i = 0; i < blogPages; i++) {
        entries.push({ loc: `${appUrl}/sitemap-blog/${i + 1}`, lastmod: now });
      }
    }

    // Cities & categories : distincts, rarement > 500
    entries.push({ loc: `${appUrl}/sitemap-cities.xml`, lastmod: now });
    entries.push({ loc: `${appUrl}/sitemap-categories.xml`, lastmod: now });
  } catch {
    // DB indispo au build → on renvoie au moins le sitemap-static.
  }

  return entries;
}

export async function GET() {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://www.vitrix.fr").replace(/\/$/, "");
  const entries = await computeIndex(appUrl);

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries
  .map(
    (e) => `  <sitemap>
    <loc>${e.loc}</loc>
    ${e.lastmod ? `<lastmod>${e.lastmod}</lastmod>` : ""}
  </sitemap>`
  )
  .join("\n")}
</sitemapindex>`;

  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}

// Exporté pour être réutilisé dans les sous-sitemaps
export const SITEMAP_PAGE_SIZE = PAGE_SIZE;
export { sql };
