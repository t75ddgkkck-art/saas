import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { blogPosts } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { slugify } from "@/lib/utils";
import { getCurrentBusiness } from "@/lib/session";
import { requirePermission } from "@/lib/validation";
import { PLAN_PERMISSIONS, type SubscriptionPlan } from "@/lib/permissions";
import { handleApiError, unauthorized, forbidden, conflict } from "@/lib/api-error";
import { validateBody } from "@/lib/api-helpers";
import { checkRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const CreateSchema = z.object({
  title: z.string().trim().min(1).max(200),
  excerpt: z.string().trim().max(500).optional().nullable(),
  content: z.string().trim().min(1),
  coverImage: z.string().url().max(2000).optional().nullable(),
});

export async function GET() {
  try {
    const biz = await getCurrentBusiness();
    if (!biz) return NextResponse.json({ posts: [] });

    const posts = await db
      .select()
      .from(blogPosts)
      .where(eq(blogPosts.businessId, biz.id))
      .orderBy(blogPosts.createdAt);

    return NextResponse.json({ posts });
  } catch (err) {
    return handleApiError(err, { route: "GET /api/blog" });
  }
}

export async function POST(request: NextRequest) {
  // Lot 63 SEC3 : 20 articles/h max — un pro écrit 1-3 articles/jour au max.
  // Protège contre spam de contenu généré (surtout maintenant que le blog est
  // rendu safe XSS via renderBlogContent : évite juste le remplissage DB).
  const rl = checkRateLimit(request, { key: "blog-post", limit: 20, windowSec: 3600 });
  if (!rl.ok) return rl.response;

  const perm = await requirePermission("maxBlogPosts");
  // requirePermission renvoie une erreur uniquement si false — ici maxBlogPosts est un nombre,
  // donc on gère la limite manuellement.
  if (!perm.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  try {
    const biz = await getCurrentBusiness();
    if (!biz) throw unauthorized();

    const plan = (perm.user.subscription || "free") as SubscriptionPlan;
    const maxPosts = PLAN_PERMISSIONS[plan].maxBlogPosts;
    if (maxPosts !== -1) {
      const existing = await db
        .select({ id: blogPosts.id })
        .from(blogPosts)
        .where(eq(blogPosts.businessId, biz.id));
      if (existing.length >= maxPosts) {
        throw forbidden(`Limite d'articles atteinte (${maxPosts} max sur ${plan})`);
      }
    }

    const data = await validateBody(request, CreateSchema);
    const slug = slugify(data.title);

    // Anti-collision de slug pour ce business
    const [dup] = await db
      .select({ id: blogPosts.id })
      .from(blogPosts)
      .where(and(eq(blogPosts.businessId, biz.id), eq(blogPosts.slug, slug)))
      .limit(1);
    if (dup) throw conflict("Un article avec ce titre existe déjà");

    const [post] = await db
      .insert(blogPosts)
      .values({
        businessId: biz.id,
        title: data.title,
        slug,
        excerpt: data.excerpt || null,
        content: data.content,
        coverImage: data.coverImage || null,
        authorName: biz.name,
        isPublished: false,
      })
      .returning();

    return NextResponse.json({ post });
  } catch (err) {
    return handleApiError(err, { route: "POST /api/blog" });
  }
}
