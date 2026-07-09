import { db } from "@/db";
import { businesses, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

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

  const pros = await db
    .select({
      business: businesses,
      user: users,
    })
    .from(businesses)
    .innerJoin(users, eq(businesses.ownerId, users.id))
    .where(eq(businesses.category, categoryName));

  if (pros.length === 0) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="bg-white border-b border-slate-200 dark:bg-slate-900 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 py-12">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 capitalize">
            {categoryName}s
          </h1>
          <p className="mt-2 text-slate-600 dark:text-slate-400">
            {pros.length} professionnel(s) trouvé(s)
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {pros.map(({ business }) => (
            <Link
              key={business.id}
              href={`/${business.slug}`}
              className="block p-6 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 hover:shadow-md transition-shadow"
            >
              <h3 className="font-semibold text-lg text-slate-900 dark:text-slate-100">
                {business.name}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                {business.city}
              </p>
              {business.description && (
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-3 line-clamp-2">
                  {business.description}
                </p>
              )}
              <div className="mt-4 text-sm text-blue-600 font-medium">
                Voir la page →
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
