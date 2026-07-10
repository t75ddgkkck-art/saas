import { db } from "@/db";
import { blogPosts, businesses } from "@/db/schema";
import { eq, and, desc, isNull } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";

// Rendu dynamique (dépendance DB)
// ISR : régénération toutes les 10 minutes.
export const revalidate = 600;

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  // Lot 14.3 : vitrine soft-deleted → titre "Page non trouvée"
  const biz = await db
    .select()
    .from(businesses)
    .where(and(eq(businesses.slug, slug), isNull(businesses.deletedAt)))
    .limit(1);
  if (!biz.length) return { title: "Page non trouvée" };
  return {
    title: `Blog - ${biz[0].name}`,
    description: `Articles et conseils de ${biz[0].name}`,
  };
}

export default async function PublicBlogPage({ params }: Props) {
  const { slug } = await params;
  // Lot 14.3 : vitrine soft-deleted → 404
  const bizResult = await db
    .select()
    .from(businesses)
    .where(and(eq(businesses.slug, slug), isNull(businesses.deletedAt)))
    .limit(1);
  const biz = bizResult[0];
  if (!biz) notFound();

  // Lot 14.3 : article soft-deleted → masqué du listing public
  const posts = await db
    .select()
    .from(blogPosts)
    .where(
      and(
        eq(blogPosts.businessId, biz.id),
        eq(blogPosts.isPublished, true),
        isNull(blogPosts.deletedAt)
      )
    )
    .orderBy(desc(blogPosts.publishedAt));

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      <div className="mx-auto max-w-4xl px-4 py-12">
        <Link href={`/${biz.slug}`} className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100">
          ← Retour à {biz.name}
        </Link>

        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Blog</h1>
        <p className="mt-2 text-slate-500 dark:text-slate-400">Conseils et actualités de {biz.name}</p>

        {posts.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-slate-500 dark:text-slate-400">Aucun article publié pour le moment.</p>
          </div>
        ) : (
          <div className="mt-8 space-y-6">
            {posts.map((post) => (
              <article key={post.id} className="rounded-2xl border border-slate-200 overflow-hidden transition-all hover:shadow-md dark:border-slate-800">
                {post.coverImage && (
                  <img src={post.coverImage} alt={post.title} className="h-48 w-full object-cover" />
                )}
                <div className="p-6">
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-2">
                    <span>{post.publishedAt ? new Date(post.publishedAt).toLocaleDateString("fr-FR") : ""}</span>
                    <span>•</span>
                    <span>{post.views} lectures</span>
                  </div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">{post.title}</h2>
                  {post.excerpt && <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{post.excerpt}</p>}
                  <Link href={`/${biz.slug}/blog/${post.slug}`} className="mt-4 inline-block text-sm font-medium text-blue-600 hover:underline dark:text-blue-400">
                    Lire l&apos;article →
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
