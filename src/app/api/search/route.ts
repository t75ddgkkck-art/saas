/**
 * GET /api/search?q=<query>
 * Recherche unifiée sur (businesses actifs + blog publiés).
 *
 * Publique — pas d'auth. Rate-limit par IP pour éviter le scraping intensif.
 * ILIKE simple (assez pour < 100k rows) — passer sur pg_trgm ou Meili au-delà.
 *
 * Bloque : services (privés au business), users (privés).
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { businesses, blogPosts } from "@/db/schema";
import { and, eq, ilike, isNull, or, desc } from "drizzle-orm";
import { checkRateLimit } from "@/lib/rate-limit";
import { handleApiError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

interface SearchResult {
  type: "business" | "blog";
  title: string;
  subtitle: string;
  href: string;
}

export async function GET(req: NextRequest) {
  const rl = checkRateLimit(req, { key: "search", limit: 30, windowSec: 60 });
  if (!rl.ok) return rl.response;

  try {
    const url = new URL(req.url);
    const raw = (url.searchParams.get("q") || "").trim();
    // Sanity : au moins 2 chars, max 100 (évite ILIKE gigantesque)
    if (raw.length < 2) {
      return NextResponse.json({ results: [] });
    }
    const q = raw.slice(0, 100);
    const pattern = `%${q}%`;

    // Requêtes parallèles, chacune capée à 5 résultats → 10 max total
    const [bizRows, blogRows] = await Promise.all([
      db
        .select({
          id: businesses.id,
          slug: businesses.slug,
          name: businesses.name,
          category: businesses.category,
          city: businesses.city,
        })
        .from(businesses)
        .where(
          and(
            isNull(businesses.deletedAt),
            or(
              ilike(businesses.name, pattern),
              ilike(businesses.category, pattern),
              ilike(businesses.city, pattern)
            )
          )
        )
        .orderBy(desc(businesses.createdAt))
        .limit(5),
      db
        .select({
          id: blogPosts.id,
          slug: blogPosts.slug,
          title: blogPosts.title,
          excerpt: blogPosts.excerpt,
          bizSlug: businesses.slug,
          bizName: businesses.name,
        })
        .from(blogPosts)
        .innerJoin(businesses, eq(businesses.id, blogPosts.businessId))
        .where(
          and(
            eq(blogPosts.isPublished, true),
            isNull(blogPosts.deletedAt),
            isNull(businesses.deletedAt),
            or(ilike(blogPosts.title, pattern), ilike(blogPosts.excerpt, pattern))
          )
        )
        .orderBy(desc(blogPosts.publishedAt))
        .limit(5),
    ]);

    const results: SearchResult[] = [
      ...bizRows.map((b) => ({
        type: "business" as const,
        title: b.name,
        subtitle: [b.category, b.city].filter(Boolean).join(" • "),
        href: `/${b.slug}`,
      })),
      ...blogRows.map((p) => ({
        type: "blog" as const,
        title: p.title,
        subtitle: `Article • ${p.bizName}`,
        href: `/${p.bizSlug}/blog/${p.slug}`,
      })),
    ];

    return NextResponse.json({ results });
  } catch (err) {
    return handleApiError(err, { route: "GET /api/search" });
  }
}
