"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";

const PLANS = [
  {
    id: "free",
    name: "Gratuit",
    monthly: 0,
    yearly: 0,
    tagline: "Pour démarrer votre présence en ligne",
    features: [
      "Page vitrine personnalisée",
      "Boutons contact & WhatsApp",
      "Galerie photos",
      // Lot 47 : précision sur le QR pour Free (1 QR trackable, on en fait mention concrète)
      "1 QR code trackable imprimable",
      "3 articles de blog SEO",
      "FAQ personnalisable",
      // Lot 52 : parrainage TOUS plans — argument fort pour Free
      "Parrainage : 1 mois offert par filleul Pro/Premium",
    ],
    cta: "Commencer gratuitement",
    highlight: false,
  },
  {
    id: "pro",
    name: "Pro",
    monthly: 29,
    // -20 % annuel (soit 2 mois offerts)
    yearly: 278,
    tagline: "Pour développer votre activité",
    features: [
      "Tout du Gratuit",
      // Lot 46 : préciser que Pro = 1 seule vitrine (contraste avec Premium x3)
      "1 vitrine avec design & couleurs personnalisés",
      "Réservation en ligne 24/7",
      "Devis & signature électronique",
      "Paiements Stripe / Apple Pay",
      "CRM clients complet",
      "4 templates de vitrine",
      "Blog illimité",
      // Lot 47 : 3 QR trackables multi-supports (carte visite / camionnette / flyer)
      "3 QR codes trackables (mesurez vos supports print)",
      "Rappels email automatiques",
    ],
    cta: "Essayer Pro 14 jours",
    highlight: true,
  },
  {
    id: "premium",
    name: "Premium",
    monthly: 79,
    yearly: 758,
    tagline: "L'expérience complète, sans limite",
    features: [
      "Tout du Pro",
      "Assistant IA 24/7",
      // Lot 45 : mise en avant explicite de la génération IA de devis.
      // C'est LA feature Premium avec le meilleur wow-effect démo commerciale.
      "Génération de devis par IA (prix marché intégrés)",
      // Lot 46 : multi-vitrines — argument franchise / multi-métiers
      "Jusqu'à 3 vitrines simultanées (multi-marques, franchises)",
      // Lot 47 : quota QR étendu pour campagnes A/B, saisonnières, multi-canaux
      "20 QR codes trackables (campagnes A/B, saisonnières)",
      // Lot 49 : IA rédige les messages de réactivation clients dormants
      "IA « Clients à recontacter » (messages personnalisés)",
      "Programme de fidélité clients",
      "Marque blanche (sans logo Vitrix)",
      "7 templates dont 3 exclusifs",
      "Rappels SMS & WhatsApp",
      "Statistiques avancées",
      "Support prioritaire",
    ],
    cta: "Essayer Premium",
    highlight: false,
  },
];

export function PricingSection() {
  const [billing, setBilling] = useState<"monthly" | "yearly">("yearly");

  return (
    <section id="pricing" className="py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-4xl lg:text-5xl">
            Des tarifs simples et transparents
          </h2>
          <p className="mt-4 text-lg text-slate-600 dark:text-slate-400">
            Commencez gratuitement, évoluez selon vos besoins.
          </p>

          {/* Toggle mensuel / annuel — accessible (role=radiogroup) */}
          <div
            role="radiogroup"
            aria-label="Choisir la fréquence de facturation"
            className="mt-8 inline-flex items-center gap-1 rounded-2xl bg-slate-100 p-1 dark:bg-slate-800"
          >
            <button
              role="radio"
              aria-checked={billing === "monthly"}
              onClick={() => setBilling("monthly")}
              className={`rounded-xl px-6 py-2.5 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${
                billing === "monthly"
                  ? "bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100"
                  : "text-slate-600 dark:text-slate-400"
              }`}
            >
              Mensuel
            </button>
            <button
              role="radio"
              aria-checked={billing === "yearly"}
              onClick={() => setBilling("yearly")}
              className={`flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${
                billing === "yearly"
                  ? "bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100"
                  : "text-slate-600 dark:text-slate-400"
              }`}
            >
              Annuel
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">
                -20%
              </span>
            </button>
          </div>
        </div>

        <div className="mt-14 grid gap-6 lg:grid-cols-3">
          {PLANS.map((plan) => {
            const price = billing === "monthly" ? plan.monthly : plan.yearly;
            const suffix = plan.monthly === 0 ? "" : billing === "monthly" ? "/mois" : "/an";
            const savings = plan.monthly * 12 - plan.yearly;
            return (
              <div
                key={plan.id}
                className={`relative rounded-2xl bg-white p-8 transition-all dark:bg-slate-900 ${
                  plan.highlight
                    ? "border-2 border-slate-900 shadow-xl lg:-translate-y-2 dark:border-white"
                    : "border border-slate-200/60 dark:border-slate-800 hover:shadow-md"
                }`}
              >
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-slate-900 px-3 py-1 text-xs font-medium text-white dark:bg-white dark:text-slate-900">
                    <Sparkles className="h-3 w-3" aria-hidden="true" />
                    Le plus populaire
                  </div>
                )}
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {plan.name}
                </h3>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{plan.tagline}</p>
                <div className="mt-6" aria-live="polite">
                  <span className="text-4xl font-bold text-slate-900 dark:text-slate-100">
                    {price === 0 ? "0€" : `${price}€`}
                  </span>
                  <span className="text-slate-500 dark:text-slate-400">{suffix}</span>
                  {billing === "yearly" && plan.monthly > 0 && (
                    <p className="mt-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                      soit {(plan.yearly / 12).toFixed(2)}€/mois — vous économisez {savings}€/an
                    </p>
                  )}
                </div>
                <ul className="mt-8 space-y-3">
                  {plan.features.map((f) => (
                    <li
                      key={f}
                      className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400"
                    >
                      <Check
                        className="h-4 w-4 flex-shrink-0 text-emerald-500"
                        aria-hidden="true"
                      />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href={{
                    pathname: "/register",
                    query: { plan: plan.id, billing },
                  }}
                >
                  <Button variant={plan.highlight ? "primary" : "outline"} className="mt-8 w-full">
                    {plan.cta}
                  </Button>
                </Link>
              </div>
            );
          })}
        </div>
        <p className="mt-8 text-center text-sm text-slate-500">
          Paiement sécurisé par Stripe · Sans engagement · Résiliable à tout moment
        </p>
      </div>
    </section>
  );
}
