import { db } from "@/db";
import { businesses, reviews } from "@/db/schema";
import { desc, eq, sql } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

// ISR : régénération toutes les 10 minutes.
export const revalidate = 600;

type Props = {
  params: Promise<{ category: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category } = await params;
  const categoryName = decodeURIComponent(category).replace(/-/g, " ");
  return {
    title: `${categoryName}s - Trouvez un professionnel`,
    description: `Découvrez les meilleurs ${categoryName}s inscrits sur Vitrix.`,
  };
}

export default async function MetierPage({ params }: Props) {
  const { category } = await params;
  const categoryName = decodeURIComponent(category);

  // 1 requête avec agrégats (utilise l'index business.category + reviews.business_id)
  const pros = await db
    .select({
      id: businesses.id,
      slug: businesses.slug,
      name: businesses.name,
      city: businesses.city,
      description: businesses.description,
      avgRating: sql<string>`coalesce(avg(${reviews.rating})::numeric(3,2), 0)`,
      reviewsCount: sql<number>`count(${reviews.id})::int`,
    })
    .from(businesses)
    .leftJoin(reviews, eq(reviews.businessId, businesses.id))
    .where(eq(businesses.category, categoryName))
    .groupBy(businesses.id)
    .orderBy(
      desc(sql`coalesce(avg(${reviews.rating}), 0)`),
      desc(businesses.createdAt)
    );

  if (pros.length === 0) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="bg-white border-b border-slate-200 dark:bg-slate-900 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 py-12">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 capitalize">
            {categoryName}s
          </h1>
          <p className="mt-2 text-slate-600 dark:text-slate-400">
            {pros.length} professionnel(s) trouvé(s)
          </p>
        </div>
      </header>

      <main id="main-content" tabIndex={-1} className="max-w-7xl mx-auto px-4 py-8 focus:outline-none">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {pros.map((pro) => (
            <Link
              key={pro.id}
              href={`/${pro.slug}`}
              className="block p-6 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 hover:shadow-md transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-lg text-slate-900 dark:text-slate-100">
                  {pro.name}
                </h3>
                {pro.reviewsCount > 0 && (
                  <span
                    className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                    aria-label={`Note ${Number(pro.avgRating).toFixed(1)} sur 5, ${pro.reviewsCount} avis`}
                  >
                    ⭐ {Number(pro.avgRating).toFixed(1)} ({pro.reviewsCount})
                  </span>
                )}
              </div>
              {pro.city && (
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  📍 {pro.city}
                </p>
              )}
              {pro.description && (
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-3 line-clamp-2">
                  {pro.description}
                </p>
              )}
              <div className="mt-4 text-sm text-blue-600 dark:text-blue-400 font-medium">
                Voir la page →
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
