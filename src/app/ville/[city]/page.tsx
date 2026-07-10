import { db } from "@/db";
import { businesses, reviews } from "@/db/schema";
import { and, eq, ilike, isNull, desc, sql } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

// Rendu dynamique (dépendance DB)
// ISR : régénération toutes les 10 minutes.
export const revalidate = 600;

type Props = {
  params: Promise<{ city: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { city } = await params;
  const cityName = decodeURIComponent(city).replace(/-/g, " ");
  return {
    title: `Artisans à ${cityName} - Trouvez un professionnel`,
    description: `Découvrez les meilleurs artisans à ${cityName}. Plombiers, électriciens, peintres et plus encore.`,
  };
}

export default async function VillePage({ params }: Props) {
  const { city } = await params;
  const cityName = decodeURIComponent(city).replace(/-/g, " ");

  // 1 seule requête avec agrégats note+count (utilise l'index city + reviews.business_id)
  const pros = await db
    .select({
      id: businesses.id,
      slug: businesses.slug,
      name: businesses.name,
      city: businesses.city,
      description: businesses.description,
      category: businesses.category,
      avgRating: sql<string>`coalesce(avg(${reviews.rating})::numeric(3,2), 0)`,
      reviewsCount: sql<number>`count(${reviews.id})::int`,
    })
    .from(businesses)
    .leftJoin(reviews, eq(reviews.businessId, businesses.id))
    // Lot 14.3 : masquer les vitrines soft-deleted de l'annuaire ville
    .where(and(ilike(businesses.city, `%${cityName}%`), isNull(businesses.deletedAt)))
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
      <div className="bg-white border-b border-slate-200 dark:bg-slate-900 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 py-12">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
            Artisans à {cityName}
          </h1>
          <p className="mt-2 text-slate-600 dark:text-slate-400">
            {pros.length} professionnel(s) trouvé(s)
          </p>
        </div>
      </div>

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
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 capitalize">
                {pro.category}
              </p>
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
