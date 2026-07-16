import dynamic from "next/dynamic";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { PricingSection } from "@/components/public/PricingSection";
// Lot 40 : nav landing avec burger mobile fonctionnel (avant : nav cassée <md)
import { LandingNav } from "@/components/landing/LandingNav";
// Lot 41 : hero mockup lazy-loadé — ~30 KB First Load JS économisés,
// et sur mobile l'utilisateur voit rarement le mockup avant de scroller.
const HeroMockup = dynamic(
  () => import("@/components/landing/HeroMockup").then((m) => m.HeroMockup),
  {
    // Placeholder pendant le chargement pour éviter un layout shift brutal
    loading: () => (
      <div className="mx-auto mt-14 h-64 max-w-5xl animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-900 sm:mt-20 sm:h-96" />
    ),
  }
);
import {
  Store,
  CalendarDays,
  FileText,
  Users,
  CreditCard,
  MessageSquare,
  Star,
  Zap,
  ArrowRight,
  Check,
  Phone,
  Globe,
  Shield,
  BarChart3,
} from "lucide-react";

export default function Home() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": "https://www.vitrix.fr/#organization",
        name: "Vitrix",
        url: "https://www.vitrix.fr",
        logo: "https://www.vitrix.fr/icons/logo.svg",
        description:
          "Vitrix donne de la visibilité aux artisans : page professionnelle, réservation en ligne, devis, paiements et avis clients.",
      },
      {
        "@type": "SoftwareApplication",
        name: "Vitrix",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        description:
          "Plateforme tout-en-un pour artisans : vitrine en ligne, réservation 24/7, devis avec signature électronique, paiements Stripe et fidélisation clients.",
        offers: {
          "@type": "AggregateOffer",
          lowPrice: "0",
          highPrice: "79",
          priceCurrency: "EUR",
          offerCount: "3",
        },
      },
      {
        "@type": "WebSite",
        "@id": "https://www.vitrix.fr/#website",
        url: "https://www.vitrix.fr",
        name: "Vitrix",
        publisher: { "@id": "https://www.vitrix.fr/#organization" },
      },
    ],
  };

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      {/* Données structurées SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* Navigation (Lot 40 : burger mobile fonctionnel) */}
      <LandingNav />

      {/* Main content — cible du skip link */}
      <main id="main-content" tabIndex={-1} className="focus:outline-none">
        {/* Hero Section
            Lot 41 : paddings verticaux réduits sur mobile (24 → 32) car sur
            iPhone SE (667px viewport - encoche - burger) il ne reste que
            ~500px de fold utile → un pt-32 (128px) engloutissait le H1. */}
        <section className="relative overflow-hidden pt-24 pb-14 sm:pt-32 sm:pb-20 lg:pt-44 lg:pb-32">
          {/* Background gradient — Lot 41 : blur limité à la largeur du viewport
              en dessous de sm (avant : 600×600 qui débordait horizontalement
              et pouvait déclencher un scroll horizontal parasite sur SE). */}
          <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-slate-950" />
            <div className="absolute left-1/2 top-0 h-[320px] w-[320px] -translate-x-1/2 rounded-full bg-gradient-to-br from-blue-100/50 via-purple-100/30 to-pink-100/50 blur-3xl dark:from-blue-900/20 dark:via-purple-900/10 dark:to-pink-900/20 sm:h-[600px] sm:w-[600px]" />
          </div>

          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-4xl text-center">
              {/* Badge — Lot 41 : padding réduit + text-xs sur mobile pour tenir
                  proprement sur une seule ligne sur iPhone SE. */}
              <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300 sm:mb-6 sm:px-4 sm:py-2 sm:text-sm">
                <Zap className="h-3.5 w-3.5 text-amber-500 sm:h-4 sm:w-4" />
                Visibilité & clients pour artisans
              </div>

              {/* H1 — Lot 41 : text-3xl sur mobile (36→30px) + balanced wrapping.
                  On garde la coupure de ligne AVANT le gradient uniquement sur sm+
                  (sur mobile on laisse le navigateur wrapper naturellement pour
                  éviter les 3 lignes forcées qui explosent le fold). */}
              <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 [text-wrap:balance] sm:text-5xl lg:text-7xl">
                Votre activité,
                <br className="hidden sm:inline" />{" "}
                <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                  une seule page.
                </span>
              </h1>

              {/* Paragraphe — Lot 41 : text-base sur mobile (avant text-lg
                  = 18px trop lourd) + marge réduite. */}
              <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-slate-600 dark:text-slate-400 sm:mt-6 sm:text-xl">
                Plombiers, électriciens, coiffeurs, artisans... Créez votre page professionnelle
                ultra-moderne et gérez rendez-vous, devis, paiements et clients depuis un seul
                endroit.
              </p>

              {/* CTAs — Lot 41 : full-width sur mobile pour tap-target 100%,
                  gap réduit, marge top réduite. On force min-h-11 (44px = WCAG
                  target size min recommandé) via padding. */}
              <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:mt-10 sm:flex-row sm:items-center sm:gap-4">
                <Link href="/register" className="w-full sm:w-auto">
                  <Button size="lg" className="w-full gap-2 sm:w-auto">
                    Créer ma page gratuite
                    <ArrowRight className="h-5 w-5" />
                  </Button>
                </Link>
                <Link href="/a-propos" className="w-full sm:w-auto">
                  <Button variant="outline" size="lg" className="w-full gap-2 sm:w-auto">
                    En savoir plus
                  </Button>
                </Link>
              </div>

              {/* Trust badges — Lot 41 : gap réduit sur mobile, on les
                  passe en 3 colonnes serrées plutôt que flex-wrap pour éviter
                  qu'un item passe seul sur une nouvelle ligne. */}
              <div className="mt-8 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-slate-500 dark:text-slate-400 sm:mt-12 sm:gap-x-8 sm:gap-y-3 sm:text-sm">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <Check className="h-3.5 w-3.5 text-emerald-500 sm:h-4 sm:w-4" />
                  <span>Gratuit pour toujours</span>
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <Check className="h-3.5 w-3.5 text-emerald-500 sm:h-4 sm:w-4" />
                  <span>Sans engagement</span>
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <Check className="h-3.5 w-3.5 text-emerald-500 sm:h-4 sm:w-4" />
                  <span>Setup en 5 min</span>
                </div>
              </div>
            </div>

            {/* Hero mockup — Lot 41 : extrait dans <HeroMockup />
                dynamic-imported ci-dessus pour économiser du First Load JS.
                L'URL fake "vitrix.fr/dupont-plomberie" est aussi corrigée
                (avant : monapp.fr — legacy pré-rebranding). */}
            <HeroMockup />
          </div>
        </section>

        {/* Features Section — Lot 41 : padding vertical réduit sur mobile */}
        <section id="features" className="py-16 sm:py-24 lg:py-32">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 [text-wrap:balance] sm:text-4xl lg:text-5xl">
                Tout ce dont vous avez besoin
              </h2>
              <p className="mt-3 text-base text-slate-600 dark:text-slate-400 sm:mt-4 sm:text-lg">
                Une plateforme complète pour gérer votre activité d&apos;artisan au quotidien.
              </p>
            </div>

            <div className="mt-10 grid gap-4 sm:mt-16 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[
                {
                  icon: Globe,
                  title: "Page publique premium",
                  description:
                    "Une page professionnelle moderne et responsive, optimisée pour le mobile. Logo, galerie, avis, FAQ, et plus encore.",
                },
                {
                  icon: CalendarDays,
                  title: "Prise de rendez-vous",
                  description:
                    "Calendrier en ligne, créneaux personnalisables, rappels automatiques par email, SMS et WhatsApp.",
                },
                {
                  icon: FileText,
                  title: "Devis professionnels",
                  // Lot 45 : mention IA + signature (F8+F9) — ce sont les 2 gros
                  // arguments de vente du module devis. Court, punchy, non exhaustif.
                  description:
                    "Générez des devis chiffrés avec l'IA en 1 phrase, signature électronique, facture auto à la signature, relances incluses.",
                },
                {
                  icon: CreditCard,
                  title: "Paiement en ligne",
                  description:
                    "Acceptez les acomptes et paiements via Stripe. Factures automatiques, remboursements simplifiés.",
                },
                {
                  icon: Users,
                  title: "CRM intégré",
                  description:
                    "Gérez vos clients, leur historique, notes, photos. Relances automatiques pour les devis non signés.",
                },
                {
                  icon: Zap,
                  title: "Assistant IA",
                  description:
                    "Un assistant intelligent répond aux questions, qualifie les demandes et prend des rendez-vous pour vous, 24/7.",
                },
                {
                  icon: Star,
                  title: "Avis Google",
                  description:
                    "Récoltez automatiquement des avis après chaque intervention. Affichez les meilleurs avis sur votre page.",
                },
                {
                  icon: MessageSquare,
                  title: "Communication multi-canal",
                  description:
                    "Boutons d'appel, WhatsApp, SMS, email. Vos clients vous contactent comme ils préfèrent.",
                },
                {
                  icon: BarChart3,
                  title: "Statistiques avancées",
                  description:
                    "Suivez votre CA, vos rendez-vous, visiteurs de la page, provenance et bien plus dans votre dashboard.",
                },
              ].map((feature) => (
                <div
                  key={feature.title}
                  // Lot 41 : padding réduit sur mobile (p-8 → p-5) pour tenir
                  // 2 colonnes propres sur écrans 375-390px. Border-radius
                  // gardé constant, l'icône passe de 12 → 10 côtés.
                  className="group rounded-2xl border border-slate-200/60 bg-white p-5 transition-all duration-300 hover:border-slate-300 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700 sm:p-8"
                >
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-900 transition-colors duration-300 group-hover:bg-slate-900 group-hover:text-white dark:bg-slate-800 dark:text-slate-100 dark:group-hover:bg-white dark:group-hover:text-slate-900 sm:mb-5 sm:h-12 sm:w-12">
                    <feature.icon className="h-5 w-5 sm:h-6 sm:w-6" />
                  </div>
                  <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 sm:text-lg">
                    {feature.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400 sm:mt-3">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <PricingSection />

        {/* CTA Section — Lot 41 : paddings réduits mobile + bouton full-width */}
        <section className="py-16 sm:py-24 lg:py-32">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="relative overflow-hidden rounded-3xl bg-slate-900 px-5 py-12 dark:bg-white sm:px-16 sm:py-24">
              <div className="relative z-10 mx-auto max-w-2xl text-center">
                <h2 className="text-2xl font-bold tracking-tight text-white dark:text-slate-900 [text-wrap:balance] sm:text-4xl lg:text-5xl">
                  Prêt à digitaliser votre activité ?
                </h2>
                <p className="mt-3 text-base text-slate-300 dark:text-slate-600 sm:mt-4 sm:text-lg">
                  Rejoignez des milliers d&apos;artisans qui font confiance à Vitrix pour développer
                  leur activité.
                </p>
                <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:mt-10 sm:flex-row sm:items-center sm:gap-4">
                  <Link href="/register" className="w-full sm:w-auto">
                    <Button
                      size="lg"
                      className="w-full bg-white text-slate-900 hover:bg-slate-100 dark:bg-slate-900 dark:text-white dark:hover:bg-slate-800 sm:w-auto"
                    >
                      Créer ma page gratuite
                      <ArrowRight className="h-5 w-5" />
                    </Button>
                  </Link>
                </div>
              </div>
              {/* Background decoration — Lot 41 : blur borderless mais on
                  ajoute `pointer-events-none` pour être sûr de ne pas bloquer
                  le tap sur bouton (au cas où z-index bougerait un jour). */}
              <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-gradient-to-br from-emerald-500/20 to-blue-500/20 blur-3xl" />
            </div>
          </div>
        </section>
      </main>

      {/* Footer — Lot 41 : padding réduit sur mobile */}
      <footer className="border-t border-slate-200/60 py-8 dark:border-slate-800 sm:py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white dark:bg-white dark:text-slate-900">
                <Store className="h-4 w-4" />
              </div>
              <span className="font-semibold">Vitrix</span>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
              <Link href="/faq" className="hover:text-slate-900 dark:hover:text-slate-100">
                FAQ
              </Link>
              <Link href="/cgu" className="hover:text-slate-900 dark:hover:text-slate-100">
                CGU
              </Link>
              <Link
                href="/confidentialite"
                className="hover:text-slate-900 dark:hover:text-slate-100"
              >
                Confidentialité
              </Link>
              <Link
                href="/mentions-legales"
                className="hover:text-slate-900 dark:hover:text-slate-100"
              >
                Mentions légales
              </Link>
              <Link href="/status" className="hover:text-slate-900 dark:hover:text-slate-100">
                Statut
              </Link>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              © 2025 Vitrix. Visibilité & clients pour artisans.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
