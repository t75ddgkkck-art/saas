import { db } from "@/db";
import { businesses, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import Link from "next/link";
import type { Metadata } from "next";

// Rendu dynamique (dépendance DB)
export const dynamic = "force-dynamic";
export const revalidate = 0;

// Contenu dynamique (dépend de la DB) : évite les échecs de prerender au build
// quand DATABASE_URL pointe sur un environnement non joignable (ex: preview).

export const metadata: Metadata = {
  title: "Annuaire des artisans - Trouvez un professionnel près de chez vous",
  description: "Découvrez les meilleurs artisans inscrits sur Vitrix. Plombiers, électriciens, peintres et plus encore.",
};

export default async function AnnuairePage() {
  const pros = await db
    .select({
      business: businesses,
      user: users,
    })
    .from(businesses)
    .innerJoin(users, eq(businesses.ownerId, users.id))
    .orderBy(businesses.createdAt);

  // Grouper par catégorie
  const byCategory: Record<string, typeof pros> = {};
  pros.forEach((pro) => {
    const cat = pro.business.category || "autre";
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(pro);
  });

  const categoryLabels: Record<string, string> = {
    plombier: "Plombiers",
    electricien: "Électriciens",
    peintre: "Peintres",
    menuisier: "Menuisiers",
    couvreur: "Couvreurs",
    macon: "Maçons",
    jardinier: "Jardiniers",
    garagiste: "Garagistes",
    coiffeur: "Coiffeurs",
    esthetician: "Esthéticiennes",
    restaurant: "Restaurants",
    autre: "Autres professionnels",
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 dark:bg-slate-900 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 py-12">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
            Annuaire des professionnels
          </h1>
          <p className="mt-2 text-slate-600 dark:text-slate-400">
            Trouvez les meilleurs artisans inscrits sur Vitrix
          </p>
        </div>
      </div>

      {/* Contenu */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {Object.entries(byCategory).length === 0 ? (
          <div className="text-center py-12">
            <p className="text-slate-500 dark:text-slate-400">
              Aucun professionnel inscrit pour le moment.
            </p>
            <Link href="/register" className="mt-4 inline-block text-blue-600 hover:underline">
              Inscrivez-vous
            </Link>
          </div>
        ) : (
          <div className="space-y-12">
            {Object.entries(byCategory).map(([category, pros]) => (
              <div key={category}>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-6">
                  {categoryLabels[category] || category}
                </h2>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {pros.map(({ business, user }) => (
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
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
