import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { blogPosts } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { slugify } from "@/lib/utils";
import { getCurrentBusiness } from "@/lib/session";
import { badRequest, forbidden, handleApiError, notFound, unauthorized } from "@/lib/api-error";

export const dynamic = "force-dynamic";

const UpdateSchema = z.object({
  title: z.string().trim().min(1).max(200),
  excerpt: z.string().trim().max(500).optional().nullable(),
  content: z.string().trim().min(1),
  coverImage: z.string().url().max(2000).optional().nullable(),
});

async function ownedPost(id: string) {
  const business = await getCurrentBusiness();
  if (!business) throw unauthorized();
  const [post] = await db
    .select()
    .from(blogPosts)
    .where(and(eq(blogPosts.id, id), eq(blogPosts.businessId, business.id)))
    .limit(1);
  if (!post) throw notFound("Article introuvable");
  return { post, business };
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await ownedPost(id); // ⚠️  vérif d'appartenance (fix IDOR)

    const parsed = UpdateSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw badRequest(parsed.error.issues[0]?.message ?? "Données invalides");
    }
    const body = parsed.data;

    await db
      .update(blogPosts)
      .set({
        title: body.title,
        slug: slugify(body.title),
        excerpt: body.excerpt || null,
        content: body.content,
        coverImage: body.coverImage || null,
        updatedAt: new Date(),
      })
      .where(eq(blogPosts.id, id));

    return NextResponse.json({ success: true });
  } catch (err) {
    return handleApiError(err, { route: "PUT /api/blog/[id]" });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { business } = await ownedPost(id);

    // Double filtre par sécurité (id + businessId) : même si un jour on retire
    // ownedPost, la ligne WHERE seule protège encore contre l'IDOR.
    const result = await db
      .delete(blogPosts)
      .where(and(eq(blogPosts.id, id), eq(blogPosts.businessId, business.id)));

    if ((result as { rowCount?: number }).rowCount === 0) {
      throw forbidden();
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    return handleApiError(err, { route: "DELETE /api/blog/[id]" });
  }
}
