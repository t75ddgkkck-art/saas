import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Politique de confidentialité",
  description: "Politique de confidentialité et protection des données de Vitrix.",
};

export default function ConfidentialitePage() {
  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      <div className="mx-auto max-w-3xl px-4 py-16">
        <Link href="/" className="text-sm text-slate-500 hover:text-slate-900 dark:hover:text-slate-100">← Retour à Vitrix</Link>
        <h1 className="mt-6 text-3xl font-bold text-slate-900 dark:text-slate-100">Politique de confidentialité</h1>
        <p className="mt-2 text-sm text-slate-500">Dernière mise à jour : {new Date().toLocaleDateString("fr-FR")}</p>

        <div className="mt-8 space-y-6 text-slate-700 dark:text-slate-300">
          <section>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">1. Données collectées</h2>
            <p className="mt-2 text-sm leading-relaxed">
              Nous collectons uniquement les données nécessaires au fonctionnement du service : identité (nom, prénom, email), informations professionnelles (SIRET, nom d&apos;entreprise, adresse), et les données de vos clients que vous enregistrez (nom, téléphone, email).
            </p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">2. Utilisation des données</h2>
            <p className="mt-2 text-sm leading-relaxed">
              Vos données servent exclusivement à fournir le service : affichage de votre vitrine, gestion des rendez-vous et devis, envoi des notifications que vous avez activées. Nous ne vendons jamais vos données à des tiers.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">3. Hébergement et sécurité</h2>
            <p className="mt-2 text-sm leading-relaxed">
              Les données sont hébergées dans l&apos;Union Européenne. Les mots de passe sont chiffrés (bcrypt), les sessions sécurisées par cookies httpOnly, et les paiements traités par Stripe (certifié PCI-DSS niveau 1).
            </p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">4. Vos droits (RGPD)</h2>
            <p className="mt-2 text-sm leading-relaxed">
              Conformément au RGPD, vous disposez d&apos;un droit d&apos;accès, de rectification, de portabilité et de suppression de vos données. La suppression de compte est disponible directement dans vos paramètres et efface immédiatement l&apos;intégralité de vos données.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">5. Cookies</h2>
            <p className="mt-2 text-sm leading-relaxed">
              Vitrix utilise uniquement des cookies essentiels au fonctionnement (session de connexion). Aucun cookie publicitaire ou de pistage tiers n&apos;est utilisé.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">6. Contact</h2>
            <p className="mt-2 text-sm leading-relaxed">
              Délégué à la protection des données : <a href="mailto:contact@vitrix.fr" className="text-blue-600 hover:underline">contact@vitrix.fr</a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
