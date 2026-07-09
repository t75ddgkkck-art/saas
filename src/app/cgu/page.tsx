import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Conditions Générales d'Utilisation",
  description: "Conditions générales d'utilisation de la plateforme Vitrix.",
};

export default function CGUPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      <div className="mx-auto max-w-3xl px-4 py-16">
        <Link href="/" className="text-sm text-slate-500 hover:text-slate-900 dark:hover:text-slate-100">← Retour à Vitrix</Link>
        <h1 className="mt-6 text-3xl font-bold text-slate-900 dark:text-slate-100">Conditions Générales d'Utilisation</h1>
        <p className="mt-2 text-sm text-slate-500">Dernière mise à jour : {new Date().toLocaleDateString("fr-FR")}</p>

        <div className="prose prose-slate mt-8 space-y-6 text-slate-700 dark:text-slate-300">
          <section>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">1. Objet</h2>
            <p className="mt-2 text-sm leading-relaxed">
              Vitrix est une plateforme SaaS permettant aux professionnels et artisans disposant d'un numéro SIRET valide de créer une page vitrine professionnelle, de gérer leurs rendez-vous, devis, clients et paiements en ligne. L'utilisation de la plateforme implique l'acceptation pleine et entière des présentes conditions.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">2. Inscription</h2>
            <p className="mt-2 text-sm leading-relaxed">
              L'inscription est réservée aux professionnels disposant d'un numéro SIRET actif, vérifié auprès de la base SIRENE de l'INSEE. Toute fausse déclaration entraîne la suppression immédiate du compte. L'utilisateur s'engage à fournir des informations exactes et à jour.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">3. Abonnements et paiements</h2>
            <p className="mt-2 text-sm leading-relaxed">
              Vitrix propose un plan Gratuit ainsi que des plans payants (Pro, Premium) facturés mensuellement. Les paiements sont traités par Stripe. L'abonnement est résiliable à tout moment depuis les paramètres du compte, la résiliation prenant effet à la fin de la période en cours. Aucun remboursement au prorata n'est effectué.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">4. Paiements encaissés par les professionnels</h2>
            <p className="mt-2 text-sm leading-relaxed">
              Les professionnels peuvent connecter leur propre compte Stripe pour encaisser les paiements de leurs clients. Vitrix n'est pas partie aux transactions entre le professionnel et ses clients et ne peut être tenu responsable des litiges commerciaux entre eux.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">5. Contenu publié</h2>
            <p className="mt-2 text-sm leading-relaxed">
              Le professionnel est seul responsable du contenu publié sur sa vitrine (textes, photos, tarifs, articles de blog). Tout contenu illicite, trompeur ou contraire aux bonnes mœurs entraînera la suspension du compte.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">6. Avis clients</h2>
            <p className="mt-2 text-sm leading-relaxed">
              Vitrix lutte activement contre les faux avis. Les avis importés depuis Google proviennent exclusivement du compte Google Business vérifié du professionnel. La publication de faux avis constitue une pratique commerciale trompeuse sanctionnée par le Code de la consommation.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">7. Données personnelles</h2>
            <p className="mt-2 text-sm leading-relaxed">
              Les données sont traitées conformément au RGPD. Consultez notre <Link href="/confidentialite" className="text-blue-600 hover:underline">politique de confidentialité</Link> pour plus de détails. Chaque utilisateur peut supprimer son compte et l'intégralité de ses données à tout moment depuis les paramètres.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">8. Responsabilité</h2>
            <p className="mt-2 text-sm leading-relaxed">
              Vitrix s'engage à fournir un service disponible et sécurisé, sans toutefois garantir une disponibilité de 100 %. Vitrix ne saurait être tenu responsable des dommages indirects résultant de l'utilisation ou de l'impossibilité d'utiliser le service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">9. Contact</h2>
            <p className="mt-2 text-sm leading-relaxed">
              Pour toute question : <a href="mailto:contact@vitrix.fr" className="text-blue-600 hover:underline">contact@vitrix.fr</a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
