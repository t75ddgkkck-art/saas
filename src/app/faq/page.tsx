"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp } from "lucide-react";

const faqs = [
  {
    q: "Qu'est-ce que Vitrix ?",
    a: "Vitrix est la plateforme qui donne de la visibilité aux artisans et professionnels. Créez votre page vitrine en 5 minutes, recevez des réservations en ligne, gérez vos devis et encaissez vos paiements — le tout depuis un seul endroit.",
  },
  {
    q: "Qui peut s'inscrire sur Vitrix ?",
    a: "Uniquement les professionnels disposant d'un numéro SIRET actif. Nous vérifions chaque SIRET auprès de la base officielle SIRENE de l'INSEE pour garantir que tous les pros présents sur Vitrix sont de vrais professionnels déclarés.",
  },
  {
    q: "Combien ça coûte ?",
    a: "Le plan Gratuit vous donne une page vitrine complète avec boutons de contact, WhatsApp, galerie et QR code. Le plan Pro (29€/mois) ajoute la réservation en ligne, les devis, le CRM et les paiements Stripe. Le plan Premium (79€/mois) inclut l'assistant IA, le programme de fidélité, la marque blanche et les rappels SMS.",
  },
  {
    q: "Comment mes clients me trouvent-ils ?",
    a: "Votre page Vitrix est optimisée pour le référencement Google (SEO) : elle apparaît dans les résultats de recherche locaux. Vous disposez aussi d'un QR code imprimable pour vos cartes de visite, votre vitrine physique ou votre véhicule.",
  },
  {
    q: "Comment fonctionnent les paiements ?",
    a: "Vous connectez votre propre compte Stripe (gratuit) en 2 minutes. Vos clients paient directement sur votre vitrine par carte bancaire, Apple Pay ou Google Pay. L'argent arrive directement sur votre compte Stripe. Vous pouvez aussi accepter les espèces.",
  },
  {
    q: "Les avis sont-ils fiables ?",
    a: "Oui. Contrairement à d'autres plateformes, les avis Google affichés sur votre page proviennent exclusivement de votre compte Google Business vérifié. Impossible de publier de faux avis.",
  },
  {
    q: "Puis-je personnaliser ma page ?",
    a: "Entièrement : logo, photo de couverture, couleurs, description, horaires, URL personnalisée (vitrix.fr/votre-nom), et avec le plan Premium vous pouvez même masquer la mention Vitrix (marque blanche).",
  },
  {
    q: "Puis-je annuler mon abonnement ?",
    a: "Oui, à tout moment depuis vos paramètres, sans frais ni justification. Votre abonnement reste actif jusqu'à la fin de la période payée, puis bascule automatiquement sur le plan Gratuit.",
  },
  {
    q: "Comment supprimer mon compte ?",
    a: "Depuis Paramètres → Suppression. La suppression est immédiate et définitive : votre vitrine et toutes vos données sont effacées conformément au RGPD.",
  },
  {
    q: "Le programme de fidélité, comment ça marche ?",
    a: "Avec le plan Premium, vous activez un programme de points : vos clients gagnent des points à chaque euro dépensé et débloquent la récompense que vous définissez (réduction, service offert, etc.). Un excellent moyen de les faire revenir !",
  },
];

export default function FAQPage() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      <div className="mx-auto max-w-3xl px-4 py-16">
        <Link href="/" className="text-sm text-slate-500 hover:text-slate-900 dark:hover:text-slate-100">← Retour à Vitrix</Link>
        <h1 className="mt-6 text-3xl font-bold text-slate-900 dark:text-slate-100">Questions fréquentes</h1>
        <p className="mt-2 text-slate-500 dark:text-slate-400">Tout ce que vous devez savoir sur Vitrix</p>

        <div className="mt-8 space-y-3">
          {faqs.map((faq, i) => (
            <div key={i} className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="flex w-full items-center justify-between p-5 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-900"
              >
                <span className="font-medium text-slate-900 dark:text-slate-100">{faq.q}</span>
                {open === i ? <ChevronUp className="h-4 w-4 shrink-0 text-slate-400" /> : <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />}
              </button>
              {open === i && (
                <div className="border-t border-slate-100 px-5 py-4 text-sm leading-relaxed text-slate-600 dark:border-slate-800 dark:text-slate-400">
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-12 rounded-2xl bg-slate-50 p-8 text-center dark:bg-slate-900">
          <h2 className="font-semibold text-slate-900 dark:text-slate-100">Une autre question ?</h2>
          <p className="mt-1 text-sm text-slate-500">Notre équipe vous répond sous 24h.</p>
          <a href="mailto:contact@vitrix.fr" className="mt-4 inline-block rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900">
            Nous contacter
          </a>
        </div>
      </div>
    </div>
  );
}
