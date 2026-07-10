import { db } from "@/db";
import { blogPosts, businesses } from "@/db/schema";
import { and, desc, eq, isNull } from "drizzle-orm";

export const dynamic = "force-static";
export const revalidate = 3600;

const PAGE_SIZE = 5000;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ page: string }> }
) {
  const { page } = await params;
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://www.vitrix.fr").replace(/\/$/, "");

  let rows: {
    businessSlug: string;
    postSlug: string;
    updatedAt: Date;
    publishedAt: Date | null;
  }[] = [];

  try {
    rows = await db
      .select({
        businessSlug: businesses.slug,
        postSlug: blogPosts.slug,
        updatedAt: blogPosts.updatedAt,
        publishedAt: blogPosts.publishedAt,
      })
      .from(blogPosts)
      .innerJoin(businesses, eq(businesses.id, blogPosts.businessId))
      // Lot 14.3 : exclure articles + vitrines soft-deleted
      .where(
        and(
          eq(blogPosts.isPublished, true),
          isNull(blogPosts.deletedAt),
          isNull(businesses.deletedAt)
        )
      )
      .orderBy(desc(blogPosts.publishedAt))
      .limit(PAGE_SIZE)
      .offset((pageNum - 1) * PAGE_SIZE);
  } catch {
    // ignore
  }

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${rows
  .map((p) => {
    const lastmod = (p.publishedAt || p.updatedAt).toISOString();
    return `  <url>
    <loc>${appUrl}/${p.businessSlug}/blog/${p.postSlug}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>`;
  })
  .join("\n")}
</urlset>`;

  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
