import { db } from "@/db";
import { blogPosts, businesses } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";

// Rendu dynamique (dépendance DB)
// ISR : régénération toutes les 10 minutes.
export const revalidate = 600;

type Props = {
  params: Promise<{ slug: string; postSlug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, postSlug } = await params;
  const biz = await db.select().from(businesses).where(eq(businesses.slug, slug)).limit(1);
  if (!biz.length) return { title: "Article non trouvé" };
  const post = await db.select().from(blogPosts)
    .where(and(eq(blogPosts.businessId, biz[0].id), eq(blogPosts.slug, postSlug), eq(blogPosts.isPublished, true)))
    .limit(1);
  if (!post.length) return { title: "Article non trouvé" };
  // Increment views
  await db.update(blogPosts).set({ views: (post[0].views || 0) + 1 })
    .where(eq(blogPosts.id, post[0].id));
  return {
    title: `${post[0].title} - ${biz[0].name}`,
    description: post[0].excerpt || undefined,
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug, postSlug } = await params;
  const bizResult = await db.select().from(businesses).where(eq(businesses.slug, slug)).limit(1);
  const biz = bizResult[0];
  if (!biz) notFound();

  const postResult = await db.select().from(blogPosts)
    .where(and(eq(blogPosts.businessId, biz.id), eq(blogPosts.slug, postSlug), eq(blogPosts.isPublished, true)))
    .limit(1);
  const post = postResult[0];
  if (!post) notFound();

  // Simple markdown-like rendering
  const renderedContent = post.content
    .split("\n")
    .map((line) => {
      if (line.startsWith("# ")) return `<h1 class="text-3xl font-bold text-slate-900 dark:text-slate-100 mt-8 mb-4">${line.slice(2)}</h1>`;
      if (line.startsWith("## ")) return `<h2 class="text-2xl font-semibold text-slate-900 dark:text-slate-100 mt-6 mb-3">${line.slice(3)}</h2>`;
      if (line.startsWith("- ")) return `<li class="ml-4 list-disc text-slate-700 dark:text-slate-300">${line.slice(2)}</li>`;
      if (line.match(/^\d+\.\s/)) return `<li class="ml-4 list-decimal text-slate-700 dark:text-slate-300">${line.replace(/^\d+\.\s/, "")}</li>`;
      if (line.trim() === "") return `<div class="h-4"></div>`;
      if (line.startsWith("**") && line.endsWith("**")) return `<p class="font-bold text-slate-900 dark:text-slate-100">${line.slice(2, -2)}</p>`;
      return `<p class="text-slate-700 dark:text-slate-300 leading-relaxed">${line}</p>`;
    })
    .join("");

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      <div className="mx-auto max-w-3xl px-4 py-12">
        <Link href={`/${biz.slug}/blog`} className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100">
          ← Retour au blog
        </Link>

        {post.coverImage && (
          <img src={post.coverImage} alt={post.title} className="w-full h-64 sm:h-80 object-cover rounded-2xl mb-8" />
        )}

        <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-slate-100">{post.title}</h1>
        <div className="mt-3 flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
          <span>{post.authorName}</span>
          <span>•</span>
          <span>{post.publishedAt ? new Date(post.publishedAt).toLocaleDateString("fr-FR", { year: "numeric", month: "long", day: "numeric" }) : ""}</span>
          <span>•</span>
          <span>{(post.views || 0) + 1} lectures</span>
        </div>

        {post.excerpt && (
          <p className="mt-4 text-lg text-slate-600 dark:text-slate-400 italic border-l-4 border-blue-500 pl-4">{post.excerpt}</p>
        )}

        <article className="mt-8 prose prose-slate dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: renderedContent }} />

        {/* CTA */}
        <div className="mt-12 rounded-2xl bg-slate-50 p-8 dark:bg-slate-900 text-center">
          <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">Besoin d&apos;un professionnel ?</h3>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Contactez {biz.name} pour un devis gratuit.</p>
          <div className="mt-4 flex justify-center gap-3">
            <Link href={`/${biz.slug}`} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100">
              Retour à la page
            </Link>
            {biz.phone && (
              <a href={`tel:${biz.phone}`} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-6 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:text-slate-300">
                📞 Appeler
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
