/**
 * Politique de confidentialité (Lot 15.1).
 *
 * Contenu conforme RGPD article 13-14 :
 * - Identité et coordonnées du responsable de traitement
 * - Finalités et bases légales (article 6)
 * - Destinataires (sous-traitants nominatifs)
 * - Transferts hors UE + garanties
 * - Durées de conservation
 * - Droits des personnes (accès, rectification, effacement, portabilité,
 *   opposition, limitation) + réclamation CNIL
 */

import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Politique de confidentialité",
  description:
    "Politique de confidentialité et protection des données de Vitrix — traitements, sous-traitants, durées, vos droits RGPD.",
};

const publisherName = process.env.NEXT_PUBLIC_LEGAL_PUBLISHER || "Vitrix";
const publisherEmail = process.env.NEXT_PUBLIC_LEGAL_EMAIL || "contact@vitrix.fr";
const dpoEmail = process.env.NEXT_PUBLIC_LEGAL_DPO_EMAIL || publisherEmail;

export default function ConfidentialitePage() {
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
          Politique de confidentialité
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Version 2 · Dernière mise à jour : {new Date().toLocaleDateString("fr-FR")}
        </p>

        <div className="mt-8 space-y-8 text-slate-700 dark:text-slate-300">
          <section>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
              1. Responsable de traitement
            </h2>
            <p className="mt-2 text-sm leading-relaxed">
              Pour les données que vous nous confiez en tant qu&apos;utilisateur inscrit
              (compte, abonnement), <strong>{publisherName}</strong> est responsable de
              traitement.
            </p>
            <p className="mt-2 text-sm leading-relaxed">
              Pour les données de vos propres clients (que vous saisissez dans le
              CRM, RDV, devis, factures), <strong>vous êtes le responsable de traitement</strong>
              {" "}et {publisherName} agit en qualité de sous-traitant au sens du RGPD
              article 28. Voir la clause DPA dans les{" "}
              <Link href="/cgu#dpa" className="text-blue-600 hover:underline dark:text-blue-400">
                CGU section 11
              </Link>
              .
            </p>
            <p className="mt-2 text-sm leading-relaxed">
              Contact DPO :{" "}
              <a href={`mailto:${dpoEmail}`} className="text-blue-600 hover:underline dark:text-blue-400">
                {dpoEmail}
              </a>
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
              2. Données collectées et finalités
            </h2>
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left dark:border-slate-800">
                    <th className="py-2 pr-3 font-semibold">Catégorie</th>
                    <th className="py-2 pr-3 font-semibold">Finalité</th>
                    <th className="py-2 pr-3 font-semibold">Base légale</th>
                  </tr>
                </thead>
                <tbody className="text-slate-600 dark:text-slate-400">
                  <Row cat="Identité (nom, prénom, email, téléphone)" fin="Création et gestion du compte, authentification" base="Contrat (art. 6.1.b)" />
                  <Row cat="Données pro (SIRET, dénomination, adresse)" fin="Vérification INSEE, affichage sur vitrine" base="Contrat (art. 6.1.b)" />
                  <Row cat="Données de paiement (via Stripe)" fin="Facturation abonnement" base="Contrat (art. 6.1.b)" />
                  <Row cat="Logs techniques (IP, user-agent)" fin="Sécurité, prévention de la fraude, débogage" base="Intérêt légitime (art. 6.1.f)" />
                  <Row cat="Cookies de session" fin="Maintenir la connexion" base="Strictement nécessaire (dispensé de consent)" />
                  <Row cat="Données clients saisies par le pro (CRM, RDV, notes)" fin="Fournir l'outil au pro (nous sommes sous-traitants)" base="Responsable = le pro" />
                  <Row cat="Emails/SMS envoyés" fin="Notifications transactionnelles, rappels" base="Contrat + intérêt légitime" />
                  <Row cat="Historique IA (prompts, tokens)" fin="Quota, facturation, amélioration service" base="Contrat + intérêt légitime" />
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
              3. Destinataires et sous-traitants
            </h2>
            <p className="mt-2 text-sm leading-relaxed">
              Les données ne sont accessibles qu&apos;aux personnes strictement
              habilitées (équipe technique {publisherName}) et aux sous-traitants
              suivants, sélectionnés pour leur conformité RGPD :
            </p>
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left dark:border-slate-800">
                    <th className="py-2 pr-3 font-semibold">Sous-traitant</th>
                    <th className="py-2 pr-3 font-semibold">Rôle</th>
                    <th className="py-2 pr-3 font-semibold">Localisation</th>
                    <th className="py-2 pr-3 font-semibold">Garanties</th>
                  </tr>
                </thead>
                <tbody className="text-slate-600 dark:text-slate-400">
                  <SubRow name="Supabase" role="Base de données PostgreSQL" loc="UE (Frankfurt)" g="Hébergement UE" />
                  <SubRow name="Vercel Inc." role="Hébergement application, edge functions" loc="USA + edge global" g="EU-US Data Privacy Framework + CCT" />
                  <SubRow name="Stripe Payments Europe" role="Paiements et facturation" loc="Irlande (UE) + USA" g="PCI-DSS niveau 1 + CCT" />
                  <SubRow name="Resend" role="Envoi emails transactionnels" loc="USA" g="CCT + DPA signé" />
                  <SubRow name="OpenAI" role="Génération IA (chatbot, blog, réponses avis)" loc="USA" g="CCT + zero-retention API" />
                  <SubRow name="IONOS" role="Registrar de domaine" loc="Allemagne (UE)" g="Hébergement UE" />
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-sm leading-relaxed">
              Les données ne sont <strong>jamais vendues à des tiers</strong> à des
              fins publicitaires ou marketing.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
              4. Transferts hors Union européenne
            </h2>
            <p className="mt-2 text-sm leading-relaxed">
              Certains sous-traitants (Stripe, OpenAI, Vercel, Resend) sont établis
              aux États-Unis. Les transferts sont encadrés par :
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-6 text-sm">
              <li>
                Les <strong>Clauses Contractuelles Types</strong> (décision UE 2021/914)
                signées avec chaque sous-traitant
              </li>
              <li>
                L&apos;adhésion au <strong>EU-US Data Privacy Framework</strong> pour les
                sous-traitants certifiés
              </li>
              <li>
                Le chiffrement systématique des données en transit (TLS 1.2+)
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
              5. Durées de conservation
            </h2>
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left dark:border-slate-800">
                    <th className="py-2 pr-3 font-semibold">Donnée</th>
                    <th className="py-2 pr-3 font-semibold">Durée</th>
                  </tr>
                </thead>
                <tbody className="text-slate-600 dark:text-slate-400">
                  <DurRow d="Compte utilisateur actif" t="Durée de l'abonnement" />
                  <DurRow d="Compte supprimé (soft delete)" t="30 jours avant purge finale automatique" />
                  <DurRow d="Factures et données comptables" t="10 ans (obligation légale L123-22 C. commerce)" />
                  <DurRow d="Logs de connexion et sécurité" t="12 mois (LCEN, obligation opérateur)" />
                  <DurRow d="Emails de désinscription (opt-out)" t="3 ans après la dernière interaction" />
                  <DurRow d="Cookies de session" t="7 jours max (renouvelable à la connexion)" />
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
              6. Sécurité
            </h2>
            <ul className="mt-2 list-disc space-y-1 pl-6 text-sm">
              <li>Chiffrement TLS 1.2+ pour toutes les communications</li>
              <li>Chiffrement au repos de la base (Supabase)</li>
              <li>Mots de passe hachés avec bcrypt (cost 10)</li>
              <li>Sessions signées HMAC-SHA256, cookies httpOnly + Secure + SameSite=Lax</li>
              <li>Rate-limiting sur toutes les routes sensibles (login, register, IA…)</li>
              <li>Monitoring temps réel des erreurs (Sentry) et alerting webhook</li>
              <li>Sauvegardes quotidiennes de la base + point-in-time recovery</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
              7. Vos droits (RGPD)
            </h2>
            <p className="mt-2 text-sm leading-relaxed">
              Conformément aux articles 15 à 22 du RGPD, vous disposez des droits
              suivants sur vos données personnelles :
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-6 text-sm">
              <li>
                <strong>Accès (art. 15)</strong> et <strong>portabilité (art. 20)</strong> :
                bouton &laquo; Exporter mes données &raquo; dans les paramètres → JSON
                machine-readable
              </li>
              <li>
                <strong>Rectification (art. 16)</strong> : modifiable directement depuis
                votre dashboard, ou par email
              </li>
              <li>
                <strong>Effacement (art. 17)</strong> : bouton &laquo; Supprimer mon
                compte &raquo; dans les paramètres → soft delete immédiat, purge finale
                sous 30 jours
              </li>
              <li>
                <strong>Opposition (art. 21)</strong> et <strong>limitation (art. 18)</strong> :
                sur demande à{" "}
                <a href={`mailto:${dpoEmail}`} className="text-blue-600 hover:underline dark:text-blue-400">
                  {dpoEmail}
                </a>
              </li>
              <li>
                <strong>Désinscription emails</strong> : lien &laquo; Se désinscrire &raquo;
                dans chaque email + endpoint one-click RFC 8058
              </li>
            </ul>
            <p className="mt-3 text-sm leading-relaxed">
              Vous avez également le droit d&apos;introduire une réclamation auprès de la{" "}
              <a
                href="https://www.cnil.fr/fr/plaintes"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                CNIL
              </a>{" "}
              si vous estimez que le traitement de vos données personnelles constitue
              une violation du RGPD.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
              8. Cookies
            </h2>
            <p className="mt-2 text-sm leading-relaxed">
              Vitrix n&apos;utilise <strong>que des cookies strictement nécessaires</strong>
              {" "}au fonctionnement (session de connexion). Aucun cookie publicitaire,
              analytique ou de pistage tiers n&apos;est déposé.
            </p>
            <p className="mt-2 text-sm leading-relaxed">
              Conformément à la directive ePrivacy et à la doctrine CNIL, les cookies
              strictement nécessaires sont dispensés de consentement. Une bannière
              informative est néanmoins affichée pour transparence.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
              9. Contact
            </h2>
            <p className="mt-2 text-sm leading-relaxed">
              Pour toute question ou exercice de vos droits :
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-6 text-sm">
              <li>
                DPO :{" "}
                <a href={`mailto:${dpoEmail}`} className="text-blue-600 hover:underline dark:text-blue-400">
                  {dpoEmail}
                </a>
              </li>
              <li>
                Contact général :{" "}
                <a href={`mailto:${publisherEmail}`} className="text-blue-600 hover:underline dark:text-blue-400">
                  {publisherEmail}
                </a>
              </li>
              <li>Réponse garantie sous 30 jours (art. 12.3 RGPD).</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}

function Row({ cat, fin, base }: { cat: string; fin: string; base: string }) {
  return (
    <tr className="border-b border-slate-100 last:border-0 dark:border-slate-800/50">
      <td className="py-2 pr-3 align-top">{cat}</td>
      <td className="py-2 pr-3 align-top">{fin}</td>
      <td className="py-2 pr-3 align-top text-xs">{base}</td>
    </tr>
  );
}

function SubRow({
  name,
  role,
  loc,
  g,
}: {
  name: string;
  role: string;
  loc: string;
  g: string;
}) {
  return (
    <tr className="border-b border-slate-100 last:border-0 dark:border-slate-800/50">
      <td className="py-2 pr-3 font-medium">{name}</td>
      <td className="py-2 pr-3">{role}</td>
      <td className="py-2 pr-3">{loc}</td>
      <td className="py-2 pr-3 text-xs">{g}</td>
    </tr>
  );
}

function DurRow({ d, t }: { d: string; t: string }) {
  return (
    <tr className="border-b border-slate-100 last:border-0 dark:border-slate-800/50">
      <td className="py-2 pr-3">{d}</td>
      <td className="py-2 pr-3 font-medium">{t}</td>
    </tr>
  );
}
