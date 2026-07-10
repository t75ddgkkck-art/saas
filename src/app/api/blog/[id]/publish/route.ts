import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { blogPosts } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { getCurrentBusiness } from "@/lib/session";
import { handleApiError, notFound, unauthorized } from "@/lib/api-error";

export const dynamic = "force-dynamic";

export async function PUT(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const business = await getCurrentBusiness();
    if (!business) throw unauthorized();

    // Vérifie l'appartenance avant modification (fix IDOR)
    const [post] = await db
      .select({ id: blogPosts.id })
      .from(blogPosts)
      .where(and(eq(blogPosts.id, id), eq(blogPosts.businessId, business.id)))
      .limit(1);
    if (!post) throw notFound("Article introuvable");

    await db
      .update(blogPosts)
      .set({ isPublished: true, publishedAt: new Date() })
      .where(and(eq(blogPosts.id, id), eq(blogPosts.businessId, business.id)));

    return NextResponse.json({ success: true });
  } catch (err) {
    return handleApiError(err, { route: "PUT /api/blog/[id]/publish" });
  }
}
