/**
 * Conditions Générales d'Utilisation (Lot 15.1 + 15.4).
 *
 * Contenu conforme aux exigences françaises/UE :
 * - Identification de l'éditeur
 * - Obligations de chaque partie
 * - Prix, résiliation, rétractation
 * - Responsabilité, garanties
 * - RGPD + DPA (Data Processing Agreement) pour la sous-traitance
 * - Droit applicable, juridiction
 *
 * ⚠ Ce texte est un cadre technique + fait par un dev, PAS une validation
 * juridique. Faire relire par un avocat avant mise en prod commerciale.
 */

import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Conditions Générales d'Utilisation",
  description:
    "Conditions générales d'utilisation et clauses de sous-traitance RGPD de la plateforme Vitrix.",
};

const publisherName = process.env.NEXT_PUBLIC_LEGAL_PUBLISHER || "Vitrix";
const publisherEmail = process.env.NEXT_PUBLIC_LEGAL_EMAIL || "contact@vitrix.fr";

// Lot 18 B14 : date de mise à jour figée au build (évite hydration mismatch
// dû aux différences timezone/locale entre server et client). À bumper
// manuellement quand on modifie vraiment le texte des CGU.
const LAST_UPDATED = "10/07/2026";

export default function CGUPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      <div className="mx-auto max-w-3xl px-4 py-16">
        <Link
          href="/"
          className="text-sm text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
        >
          ← Retour à Vitrix
        </Link>
        <h1 className="mt-6 text-3xl font-bold text-slate-900 dark:text-slate-100">
          Conditions Générales d&apos;Utilisation
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Version 2 · Dernière mise à jour : {LAST_UPDATED}
        </p>

        <nav
          aria-label="Sommaire"
          className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm dark:border-slate-800 dark:bg-slate-900"
        >
          <p className="font-semibold text-slate-900 dark:text-slate-100">Sommaire</p>
          <ol className="mt-2 list-decimal space-y-1 pl-6 text-slate-600 dark:text-slate-400">
            <li>
              <a href="#objet" className="hover:underline">
                Objet et acceptation
              </a>
            </li>
            <li>
              <a href="#editeur" className="hover:underline">
                Éditeur et identification
              </a>
            </li>
            <li>
              <a href="#inscription" className="hover:underline">
                Inscription et accès
              </a>
            </li>
            <li>
              <a href="#abonnements" className="hover:underline">
                Abonnements, prix, résiliation
              </a>
            </li>
            <li>
              <a href="#retractation" className="hover:underline">
                Droit de rétractation (pro)
              </a>
            </li>
            <li>
              <a href="#paiements-pros" className="hover:underline">
                Paiements encaissés via Stripe Connect
              </a>
            </li>
            <li>
              <a href="#contenu" className="hover:underline">
                Contenu publié par l&apos;utilisateur
              </a>
            </li>
            <li>
              <a href="#avis" className="hover:underline">
                Avis clients
              </a>
            </li>
            <li>
              <a href="#responsabilite" className="hover:underline">
                Responsabilité et disponibilité
              </a>
            </li>
            <li>
              <a href="#donnees" className="hover:underline">
                Données personnelles
              </a>
            </li>
            <li>
              <a href="#dpa" className="hover:underline">
                Sous-traitance RGPD (DPA)
              </a>
            </li>
            <li>
              <a href="#force-majeure" className="hover:underline">
                Force majeure
              </a>
            </li>
            <li>
              <a href="#modifications" className="hover:underline">
                Modification des CGU
              </a>
            </li>
            <li>
              <a href="#droit" className="hover:underline">
                Droit applicable et litiges
              </a>
            </li>
          </ol>
        </nav>

        <div className="prose prose-slate mt-8 space-y-8 text-slate-700 dark:text-slate-300">
          <section id="objet">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
              1. Objet et acceptation
            </h2>
            <p className="mt-2 text-sm leading-relaxed">
              {publisherName} est une plateforme SaaS destinée aux professionnels et artisans
              disposant d&apos;un SIRET valide, leur permettant de créer une vitrine web, gérer
              leurs rendez-vous, devis, clients et paiements. L&apos;usage du service implique
              l&apos;acceptation pleine et entière des présentes CGU. En cas de désaccord,
              l&apos;utilisateur doit renoncer à utiliser la plateforme.
            </p>
          </section>

          <section id="editeur">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
              2. Éditeur et identification
            </h2>
            <p className="mt-2 text-sm leading-relaxed">
              Coordonnées complètes de l&apos;éditeur, du directeur de la publication et de
              l&apos;hébergeur dans les{" "}
              <Link
                href="/mentions-legales"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                mentions légales
              </Link>
              .
            </p>
          </section>

          <section id="inscription">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
              3. Inscription et accès
            </h2>
            <p className="mt-2 text-sm leading-relaxed">
              L&apos;inscription est réservée aux professionnels disposant d&apos;un SIRET actif,
              vérifié auprès de la base SIRENE de l&apos;INSEE. L&apos;utilisateur s&apos;engage à
              fournir des informations exactes et à les maintenir à jour. Toute fausse déclaration
              entraîne la suspension immédiate du compte, sans préavis ni remboursement.
            </p>
            <p className="mt-2 text-sm leading-relaxed">
              Les identifiants (email, mot de passe) sont strictement personnels. L&apos;utilisateur
              est responsable de leur confidentialité et des actions effectuées depuis son compte.
            </p>
          </section>

          <section id="abonnements">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
              4. Abonnements, prix et résiliation
            </h2>
            <p className="mt-2 text-sm leading-relaxed">
              {publisherName} propose un plan Gratuit et des plans payants (Pro, Premium), facturés
              mensuellement ou annuellement. Les paiements sont opérés par Stripe. Les prix sont
              indiqués TTC.
            </p>
            <p className="mt-2 text-sm leading-relaxed">
              Un essai gratuit de 14 jours est proposé sur les plans Pro et Premium. À l&apos;issue
              de la période d&apos;essai, l&apos;abonnement est renouvelé automatiquement. Il est
              résiliable à tout moment depuis les paramètres du compte, la résiliation prenant effet
              à la fin de la période en cours. Aucun remboursement au prorata n&apos;est effectué,
              sauf disposition légale contraire.
            </p>
            <p className="mt-2 text-sm leading-relaxed">
              En cas d&apos;échec de paiement, une période de grâce de 3 jours (Pro) ou 7 jours
              (Premium) est appliquée avant downgrade vers le plan Gratuit. Les données sont
              préservées durant cette période.
            </p>
          </section>

          <section id="retractation">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
              5. Droit de rétractation
            </h2>
            <p className="mt-2 text-sm leading-relaxed">
              Le service étant destiné exclusivement à des professionnels agissant dans le cadre de
              leur activité (B2B), le droit de rétractation prévu par le Code de la consommation ne
              s&apos;applique pas (article L221-3 CC). La période d&apos;essai de 14 jours en tient
              toutefois lieu commercialement.
            </p>
          </section>

          <section id="paiements-pros">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
              6. Paiements encaissés via Stripe Connect
            </h2>
            <p className="mt-2 text-sm leading-relaxed">
              Les professionnels peuvent connecter leur propre compte Stripe pour encaisser les
              paiements de leurs clients directement. Dans ce cadre,
              {publisherName} n&apos;est pas partie aux transactions et ne peut être tenu
              responsable des litiges commerciaux, remboursements, ou impayés entre le professionnel
              et ses clients.
            </p>
          </section>

          <section id="contenu">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
              7. Contenu publié
            </h2>
            <p className="mt-2 text-sm leading-relaxed">
              Le professionnel est seul responsable du contenu publié sur sa vitrine (textes,
              photos, tarifs, articles de blog). Il garantit disposer des droits nécessaires (droits
              d&apos;auteur, droit à l&apos;image, marques…) et s&apos;engage à ne publier aucun
              contenu :
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-6 text-sm">
              <li>Illicite, trompeur, diffamatoire ou contraire aux bonnes mœurs</li>
              <li>Portant atteinte à la vie privée ou aux droits d&apos;un tiers</li>
              <li>Faisant la promotion de produits ou services illégaux</li>
            </ul>
            <p className="mt-2 text-sm leading-relaxed">
              {publisherName} se réserve le droit de retirer sans préavis tout contenu signalé comme
              illicite (LCEN article 6-I-5) et de suspendre le compte concerné.
            </p>
          </section>

          <section id="avis">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
              8. Avis clients
            </h2>
            <p className="mt-2 text-sm leading-relaxed">
              {publisherName} lutte activement contre les faux avis. Les avis importés proviennent
              exclusivement du compte Google Business vérifié du professionnel. La publication de
              faux avis constitue une pratique commerciale trompeuse sanctionnée par le Code de la
              consommation (article L121-2) et entraîne la fermeture immédiate du compte.
            </p>
          </section>

          <section id="responsabilite">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
              9. Responsabilité et disponibilité
            </h2>
            <p className="mt-2 text-sm leading-relaxed">
              {publisherName} s&apos;engage à fournir un service disponible et sécurisé, sans
              toutefois garantir une disponibilité de 100 %. Des interruptions peuvent survenir pour
              maintenance, mise à jour ou en raison de faits tiers (hébergeur, prestataires).
            </p>
            <p className="mt-2 text-sm leading-relaxed">
              {publisherName} ne saurait être tenu responsable des dommages indirects (perte de
              chiffre d&apos;affaires, perte de clientèle) résultant de l&apos;utilisation ou de
              l&apos;impossibilité d&apos;utiliser le service. Sa responsabilité éventuelle est en
              tout état de cause limitée au montant des sommes effectivement versées par
              l&apos;utilisateur sur les 12 derniers mois.
            </p>
          </section>

          <section id="donnees">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
              10. Données personnelles
            </h2>
            <p className="mt-2 text-sm leading-relaxed">
              Les données sont traitées conformément au Règlement (UE) 2016/679 (RGPD) et à la loi
              Informatique et Libertés. Consultez la{" "}
              <Link
                href="/confidentialite"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                politique de confidentialité
              </Link>{" "}
              pour le détail des traitements, durées de conservation et vos droits.
            </p>
          </section>

          <section id="dpa">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
              11. Sous-traitance RGPD (Data Processing Agreement)
            </h2>
            <p className="mt-2 text-sm leading-relaxed">
              Lorsque le professionnel utilise Vitrix pour traiter les données de ses propres
              clients (fiches CRM, RDV, devis, factures), il agit en qualité de{" "}
              <strong>responsable de traitement</strong>. Vitrix agit alors en qualité de{" "}
              <strong>sous-traitant</strong> au sens de l&apos;article 28 du RGPD. Les présentes
              clauses valent contrat de sous-traitance :
            </p>
            <ul className="mt-2 list-disc space-y-2 pl-6 text-sm leading-relaxed">
              <li>
                <strong>Objet du traitement</strong> : hébergement et mise à disposition
                d&apos;outils de gestion CRM, RDV, devis, paiements, campagnes email/SMS pour le
                compte du professionnel.
              </li>
              <li>
                <strong>Durée</strong> : durée de l&apos;abonnement + rétention 30 jours après
                suppression du compte (droit à l&apos;oubli automatisé).
              </li>
              <li>
                <strong>Catégories de données</strong> : identité (nom, email, téléphone, adresse),
                données commerciales (historique RDV, devis, paiements), notes libres. Aucune donnée
                sensible (santé, opinions) n&apos;est requise.
              </li>
              <li>
                <strong>Obligations du sous-traitant</strong> : traiter uniquement sur instructions
                documentées du responsable, garantir la confidentialité, notifier toute violation
                sous 72h, assister le responsable pour l&apos;exercice des droits des personnes
                concernées et pour les analyses d&apos;impact.
              </li>
              <li>
                <strong>Sous-traitants ultérieurs</strong> : autorisation générale accordée à Vitrix
                de recourir aux sous-traitants listés ci-dessous (Stripe, Resend, OpenAI, Vercel,
                Supabase). Vitrix informera le responsable de tout changement.
              </li>
              <li>
                <strong>Transferts hors UE</strong> : certains sous-traitants (Stripe, OpenAI,
                Vercel) sont établis aux États-Unis. Les transferts sont encadrés par les Clauses
                Contractuelles Types (décision UE 2021/914) et le cadre EU-US Data Privacy Framework
                lorsque applicable.
              </li>
              <li>
                <strong>Fin du contrat</strong> : à la résiliation, les données sont supprimées ou
                restituées au responsable dans un délai de 30 jours (export JSON téléchargeable
                depuis les paramètres du compte).
              </li>
              <li>
                <strong>Audit</strong> : Vitrix met à disposition toutes les informations
                nécessaires pour démontrer sa conformité et permet des audits (dans la limite du
                raisonnable technique et sur préavis 30 jours).
              </li>
            </ul>
            <p className="mt-2 text-sm leading-relaxed">
              Pour toute question relative à cette clause de sous-traitance ou pour signer un DPA
              formel séparé :{" "}
              <a
                href={`mailto:${publisherEmail}`}
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                {publisherEmail}
              </a>
              .
            </p>
          </section>

          <section id="force-majeure">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
              12. Force majeure
            </h2>
            <p className="mt-2 text-sm leading-relaxed">
              Aucune des parties ne pourra être tenue responsable de l&apos;inexécution de ses
              obligations résultant d&apos;un cas de force majeure au sens de l&apos;article 1218 du
              Code civil (catastrophe naturelle, pandémie, incident majeur d&apos;un hébergeur
              tiers, cyberattaque massive…).
            </p>
          </section>

          <section id="modifications">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
              13. Modification des CGU
            </h2>
            <p className="mt-2 text-sm leading-relaxed">
              {publisherName} peut modifier les présentes CGU à tout moment. L&apos;utilisateur en
              sera informé par email au moins 30 jours avant l&apos;entrée en vigueur des
              changements substantiels. En cas de désaccord, il pourra résilier son compte sans
              frais.
            </p>
          </section>

          <section id="droit">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
              14. Droit applicable et litiges
            </h2>
            <p className="mt-2 text-sm leading-relaxed">
              Les présentes CGU sont soumises au droit français. À défaut d&apos;accord amiable,
              tout litige sera porté devant les tribunaux compétents du siège social de
              l&apos;éditeur.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Contact</h2>
            <p className="mt-2 text-sm leading-relaxed">
              Pour toute question :{" "}
              <a
                href={`mailto:${publisherEmail}`}
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                {publisherEmail}
              </a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
