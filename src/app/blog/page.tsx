import { db } from "@/db";
import { blogPosts, businesses } from "@/db/schema";
import { eq } from "drizzle-orm";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Blog - Conseils et astuces pour votre activité",
  description: "Découvrez nos conseils pour améliorer votre visibilité et gérer votre activité d'artisan.",
};

export default async function BlogPage() {
  const posts = await db
    .select({
      post: blogPosts,
      business: businesses,
    })
    .from(blogPosts)
    .innerJoin(businesses, eq(blogPosts.businessId, businesses.id))
    .where(eq(blogPosts.isPublished, true))
    .orderBy(blogPosts.publishedAt);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="bg-white border-b border-slate-200 dark:bg-slate-900 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 py-12">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
            Blog
          </h1>
          <p className="mt-2 text-slate-600 dark:text-slate-400">
            Conseils et astuces pour les artisans
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {posts.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-slate-500 dark:text-slate-400">
              Aucun article publié pour le moment.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {posts.map(({ post, business }) => (
              <Link
                key={post.id}
                href={`/blog/${post.slug}`}
                className="block bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden hover:shadow-md transition-shadow"
              >
                {post.coverImage && (
                  <div className="h-48 bg-slate-100 dark:bg-slate-800">
                    <img
                      src={post.coverImage}
                      alt={post.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <div className="p-6">
                  <h3 className="font-semibold text-lg text-slate-900 dark:text-slate-100">
                    {post.title}
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    {business.name}
                  </p>
                  {post.excerpt && (
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-3 line-clamp-3">
                      {post.excerpt}
                    </p>
                  )}
                  <div className="mt-4 text-sm text-blue-600 font-medium">
                    Lire la suite →
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
