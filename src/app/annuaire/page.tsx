import { db } from "@/db";
import { businesses, reviews } from "@/db/schema";
import { desc, eq, isNull, sql } from "drizzle-orm";
import Link from "next/link";
import type { Metadata } from "next";

// ISR : la liste change rarement, on la régénère toutes les 10 minutes.
export const revalidate = 600;

export const metadata: Metadata = {
  title: "Annuaire des artisans - Trouvez un professionnel près de chez vous",
  description:
    "Découvrez les meilleurs artisans inscrits sur Vitrix. Plombiers, électriciens, peintres et plus encore.",
};

const CATEGORY_LABELS: Record<string, string> = {
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

type ProCard = {
  id: string;
  slug: string;
  name: string;
  city: string | null;
  description: string | null;
  category: string;
  avgRating: number;
  reviewsCount: number;
};

async function fetchDirectory(): Promise<ProCard[]> {
  // 1 seule requête SQL avec :
  //  - projection des seuls champs affichés (pas de SELECT * inutile)
  //  - agrégats note moyenne + count via LEFT JOIN GROUP BY
  //  - tri par note desc puis date de création desc (met en avant les mieux notés)
  // Résultat : plus de N+1, plus de download inutile, index business_id + reviews utilisés.
  try {
    const rows = await db
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
      // Lot 14.3 : masquer les vitrines soft-deleted de l'annuaire public
      .where(isNull(businesses.deletedAt))
      .groupBy(businesses.id)
      .orderBy(desc(sql`coalesce(avg(${reviews.rating}), 0)`), desc(businesses.createdAt));

    return rows.map((r) => ({
      ...r,
      avgRating: Number(r.avgRating) || 0,
    }));
  } catch {
    // DB inaccessible au moment du build ISR (preview Vercel) : on renvoie
    // une liste vide plutôt que de faire planter le build. La prochaine
    // régénération (à la 1ʳᵉ visite avec DB dispo) affichera les vrais pros.
    return [];
  }
}

export default async function AnnuairePage() {
  const pros = await fetchDirectory();

  // Groupement par catégorie côté serveur (déjà côté DB par tri stable)
  const byCategory: Record<string, ProCard[]> = {};
  for (const p of pros) {
    const cat = p.category || "autre";
    (byCategory[cat] ??= []).push(p);
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 dark:bg-slate-900 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 py-12">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
            Annuaire des professionnels
          </h1>
          <p className="mt-2 text-slate-600 dark:text-slate-400">
            Trouvez les meilleurs artisans inscrits sur Vitrix
          </p>
        </div>
      </header>

      {/* Contenu */}
      <main
        id="main-content"
        tabIndex={-1}
        className="max-w-7xl mx-auto px-4 py-8 focus:outline-none"
      >
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
            {Object.entries(byCategory).map(([category, list]) => (
              <section key={category} aria-labelledby={`cat-${category}`}>
                <h2
                  id={`cat-${category}`}
                  className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-6"
                >
                  {CATEGORY_LABELS[category] || category}{" "}
                  <span className="text-base font-normal text-slate-500">({list.length})</span>
                </h2>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {list.map((pro) => (
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
                            aria-label={`Note moyenne ${pro.avgRating.toFixed(1)} sur 5, ${pro.reviewsCount} avis`}
                          >
                            ⭐ {pro.avgRating.toFixed(1)} ({pro.reviewsCount})
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
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
