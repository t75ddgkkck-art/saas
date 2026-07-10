/**
 * Mentions légales (Lot 15.3).
 *
 * Obligatoire loi française LCEN (2004-575, article 6-III) :
 *  - Nom et coordonnées de l'éditeur
 *  - Directeur de la publication
 *  - Hébergeur
 *  - RCS / SIREN
 *
 * Les valeurs sensibles (SIREN, adresse physique) sont lues depuis des env vars
 * pour permettre au user de personnaliser sans re-déployer.
 */

import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mentions légales",
  description:
    "Mentions légales de la plateforme Vitrix — éditeur, hébergeur, directeur de publication.",
  robots: { index: true, follow: false },
};

// Valeurs par défaut affichables même sans env vars (dev / démo).
// À surcharger via NEXT_PUBLIC_LEGAL_* pour la prod.
const publisherName = process.env.NEXT_PUBLIC_LEGAL_PUBLISHER || "Vitrix (à compléter)";
const publisherAddress =
  process.env.NEXT_PUBLIC_LEGAL_ADDRESS || "Adresse à compléter";
const publisherEmail =
  process.env.NEXT_PUBLIC_LEGAL_EMAIL || "contact@vitrix.fr";
const publisherPhone = process.env.NEXT_PUBLIC_LEGAL_PHONE || "";
const publisherSiren = process.env.NEXT_PUBLIC_LEGAL_SIREN || "SIREN à compléter";
const publisherRcs =
  process.env.NEXT_PUBLIC_LEGAL_RCS || "RCS à compléter";
const publisherCapital =
  process.env.NEXT_PUBLIC_LEGAL_CAPITAL || "Capital social à compléter";
const publisherDirector =
  process.env.NEXT_PUBLIC_LEGAL_DIRECTOR || "Directeur de la publication à compléter";
const publisherVat =
  process.env.NEXT_PUBLIC_LEGAL_VAT || "TVA intracommunautaire à compléter";

export default function MentionsLegalesPage() {
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
          Mentions légales
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Conformément aux dispositions de l&apos;article 6-III de la loi n° 2004-575 du
          21 juin 2004 pour la Confiance dans l&apos;Économie Numérique (LCEN).
        </p>

        <div className="mt-8 space-y-8 text-slate-700 dark:text-slate-300">
          <section>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
              Éditeur du site
            </h2>
            <dl className="mt-3 space-y-2 text-sm">
              <Row label="Dénomination" value={publisherName} />
              <Row label="Forme juridique / capital" value={publisherCapital} />
              <Row label="Adresse du siège" value={publisherAddress} />
              <Row label="RCS" value={publisherRcs} />
              <Row label="SIREN" value={publisherSiren} />
              <Row label="TVA intracommunautaire" value={publisherVat} />
              <Row
                label="Email"
                value={
                  <a
                    href={`mailto:${publisherEmail}`}
                    className="text-blue-600 hover:underline dark:text-blue-400"
                  >
                    {publisherEmail}
                  </a>
                }
              />
              {publisherPhone && <Row label="Téléphone" value={publisherPhone} />}
            </dl>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
              Directeur de la publication
            </h2>
            <p className="mt-3 text-sm leading-relaxed">{publisherDirector}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
              Hébergement
            </h2>
            <p className="mt-3 text-sm leading-relaxed">
              Le site est hébergé par <strong>Vercel Inc.</strong>, 340 S Lemon Ave #4133,
              Walnut, CA 91789, États-Unis — <a href="https://vercel.com" className="text-blue-600 hover:underline dark:text-blue-400">vercel.com</a>.
              La base de données est hébergée par <strong>Supabase</strong> (localisation UE :
              région Frankfurt).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
              Nom de domaine
            </h2>
            <p className="mt-3 text-sm leading-relaxed">
              Le nom de domaine est enregistré auprès de <strong>IONOS SARL</strong>,
              7 place de la Gare, BP 70109, 57200 Sarreguemines Cedex, France.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
              Propriété intellectuelle
            </h2>
            <p className="mt-3 text-sm leading-relaxed">
              L&apos;ensemble des éléments présents sur ce site (textes, logos, images,
              code source, marque Vitrix) est protégé par le droit de la propriété
              intellectuelle. Toute reproduction non autorisée est interdite.
            </p>
            <p className="mt-2 text-sm leading-relaxed">
              Les contenus publiés par les utilisateurs (vitrines pro, articles de blog,
              photos, avis) restent la propriété de leurs auteurs. En les publiant sur
              Vitrix, ils accordent à Vitrix une licence gratuite, non-exclusive et
              mondiale pour les afficher dans le cadre du service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
              Signalement de contenu
            </h2>
            <p className="mt-3 text-sm leading-relaxed">
              Pour signaler un contenu manifestement illicite (LCEN article 6-I-5) :{" "}
              <a
                href={`mailto:${publisherEmail}?subject=Signalement%20contenu%20illicite`}
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                {publisherEmail}
              </a>
              . Un accusé de réception vous sera adressé sous 48h.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
              Données personnelles
            </h2>
            <p className="mt-3 text-sm leading-relaxed">
              Pour l&apos;usage des données personnelles, voir la{" "}
              <Link
                href="/confidentialite"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                politique de confidentialité
              </Link>
              .
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:gap-4">
      <dt className="text-slate-500 sm:w-56 sm:shrink-0 dark:text-slate-400">
        {label}
      </dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
