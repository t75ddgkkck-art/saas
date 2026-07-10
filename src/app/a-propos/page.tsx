import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "À propos de Vitrix - La plateforme des artisans",
  description:
    "Découvrez Vitrix, la plateforme qui aide les artisans à développer leur activité et trouver plus de clients.",
};

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      {/* Header */}
      <div className="bg-gradient-to-br from-blue-600 to-purple-700 text-white">
        <div className="max-w-4xl mx-auto px-4 py-20 text-center">
          <h1 className="text-4xl md:text-5xl font-bold">À propos de Vitrix</h1>
          <p className="mt-4 text-xl text-blue-100">
            La plateforme qui révolutionne le quotidien des artisans
          </p>
        </div>
      </div>

      {/* Mission */}
      <div className="max-w-4xl mx-auto px-4 py-16">
        <div className="prose prose-lg dark:prose-invert max-w-none">
          <h2 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Notre mission</h2>
          <p className="text-lg text-slate-600 dark:text-slate-400 leading-relaxed">
            Vitrix est né d&apos;un constat simple : les artisans passent trop de temps sur
            l&apos;administratif et pas assez sur leur métier. Notre objectif est de leur redonner
            du temps en automatisant tout ce qui peut l&apos;être.
          </p>
        </div>

        {/* Statistiques */}
        <div className="grid md:grid-cols-3 gap-8 mt-16">
          <div className="text-center">
            <div className="text-4xl font-bold text-blue-600 dark:text-blue-400">500+</div>
            <div className="text-slate-600 dark:text-slate-400 mt-2">Artisans inscrits</div>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-purple-600 dark:text-purple-400">10 000+</div>
            <div className="text-slate-600 dark:text-slate-400 mt-2">Rendez-vous gérés</div>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-emerald-600 dark:text-emerald-400">98%</div>
            <div className="text-slate-600 dark:text-slate-400 mt-2">De satisfaction</div>
          </div>
        </div>

        {/* Valeurs */}
        <div className="mt-20">
          <h2 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-8">
            Nos valeurs
          </h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-3">
                Simplicité
              </h3>
              <p className="text-slate-600 dark:text-slate-400">
                Nous croyons que les outils professionnels doivent être simples à utiliser. Pas de
                formation nécessaire, pas de complications.
              </p>
            </div>
            <div>
              <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-3">
                ⚡ Efficacité
              </h3>
              <p className="text-slate-600 dark:text-slate-400">
                Chaque fonctionnalité est pensée pour faire gagner du temps aux artisans. Moins
                d&apos;administratif, plus de chantiers.
              </p>
            </div>
            <div>
              <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-3">
                🤝 Proximité
              </h3>
              <p className="text-slate-600 dark:text-slate-400">
                Nous sommes à l&apos;écoute des artisans. Nos évolutions sont guidées par leurs
                retours et leurs besoins réels.
              </p>
            </div>
            <div>
              <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-3">
                🚀 Innovation
              </h3>
              <p className="text-slate-600 dark:text-slate-400">
                Nous utilisons les dernières technologies (IA, automatisation) pour offrir des
                outils modernes et performants.
              </p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-20 text-center bg-slate-50 dark:bg-slate-900 rounded-2xl p-12">
          <h2 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-4">
            Prêt à rejoindre l&apos;aventure ?
          </h2>
          <p className="text-lg text-slate-600 dark:text-slate-400 mb-8">
            Rejoignez des centaines d&apos;artisans qui ont déjà transformé leur activité
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/register"
              className="px-8 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              Commencer gratuitement
            </Link>
            <Link
              href="/tarifs"
              className="px-8 py-3 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg font-semibold border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              Voir les tarifs
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
