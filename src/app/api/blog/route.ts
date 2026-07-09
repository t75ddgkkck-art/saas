import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { blogPosts } from "@/db/schema";
import { eq } from "drizzle-orm";
import { slugify } from "@/lib/utils";
import { getCurrentBusiness } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const biz = await getCurrentBusiness();
    if (!biz) return NextResponse.json({ posts: [] });

    const posts = await db.select().from(blogPosts)
      .where(eq(blogPosts.businessId, biz.id))
      .orderBy(blogPosts.createdAt);

    return NextResponse.json({ posts });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const biz = await getCurrentBusiness();
    if (!biz) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

    const slug = slugify(body.title);
    const [post] = await db.insert(blogPosts).values({
      businessId: biz.id,
      title: body.title,
      slug,
      excerpt: body.excerpt || null,
      content: body.content,
      coverImage: body.coverImage || null,
      authorName: biz.name,
      isPublished: false,
    }).returning();

    return NextResponse.json({ post });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
