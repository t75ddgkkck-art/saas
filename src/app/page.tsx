import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { PricingSection } from "@/components/public/PricingSection";
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
  Menu,
  X,
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
        description: "Vitrix donne de la visibilité aux artisans : page professionnelle, réservation en ligne, devis, paiements et avis clients.",
      },
      {
        "@type": "SoftwareApplication",
        name: "Vitrix",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        description: "Plateforme tout-en-un pour artisans : vitrine en ligne, réservation 24/7, devis avec signature électronique, paiements Stripe et fidélisation clients.",
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
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      {/* Navigation */}
      <nav className="fixed inset-x-0 top-0 z-50 border-b border-slate-200/60 bg-white/80 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/80">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 lg:px-8">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900">
              <Store className="h-5 w-5" />
            </div>
            <span className="text-lg font-bold tracking-tight">Vitrix</span>
          </div>

          <div className="hidden items-center gap-8 md:flex">
            <a href="#features" className="text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100">
              Fonctionnalités
            </a>
            <a href="#pricing" className="text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100">
              Tarifs
            </a>
            <Link href="/a-propos" className="text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100">
              À propos
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm">Se connecter</Button>
            </Link>
            <Link href="/register">
              <Button size="sm">Essayer gratuitement</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-32 pb-20 lg:pt-44 lg:pb-32">
        {/* Background gradient */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-slate-950" />
          <div className="absolute left-1/2 top-0 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-gradient-to-br from-blue-100/50 via-purple-100/30 to-pink-100/50 blur-3xl dark:from-blue-900/20 dark:via-purple-900/10 dark:to-pink-900/20" />
        </div>

        <div className="mx-auto max-w-7xl px-4 lg:px-8">
          <div className="mx-auto max-w-4xl text-center">
            {/* Badge */}
            <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
              <Zap className="h-4 w-4 text-amber-500" />
              Visibilité & clients pour artisans
            </div>

            <h1 className="text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-5xl lg:text-7xl">
              Votre activité,
              <br />
              <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                une seule page.
              </span>
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-600 dark:text-slate-400 sm:text-xl">
              Plombiers, électriciens, coiffeurs, artisans... Créez votre page professionnelle
              ultra-moderne et gérez rendez-vous, devis, paiements et clients depuis un seul endroit.
            </p>

            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link href="/register">
                <Button size="lg" className="gap-2">
                  Créer ma page gratuite
                  <ArrowRight className="h-5 w-5" />
                </Button>
              </Link>
              <Link href="/a-propos">
                <Button variant="outline" size="lg" className="gap-2">
                  En savoir plus
                </Button>
              </Link>
            </div>

            {/* Trust badges */}
            <div className="mt-12 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-slate-500 dark:text-slate-400">
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-emerald-500" />
                <span>Gratuit pour toujours</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-emerald-500" />
                <span>Sans engagement</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-emerald-500" />
                <span>Setup en 5 min</span>
              </div>
            </div>
          </div>

          {/* Hero mockup */}
          <div className="mx-auto mt-20 max-w-5xl">
            <div className="relative rounded-2xl border border-slate-200/60 bg-slate-900 p-2 shadow-2xl dark:border-slate-800">
              <div className="flex items-center gap-2 rounded-t-xl bg-slate-800 px-4 py-3">
                <div className="h-3 w-3 rounded-full bg-red-500" />
                <div className="h-3 w-3 rounded-full bg-amber-500" />
                <div className="h-3 w-3 rounded-full bg-emerald-500" />
                <div className="ml-4 flex-1 rounded-lg bg-slate-700 px-4 py-1.5 text-sm text-slate-400">
                  monapp.fr/dupont-plomberie
                </div>
              </div>
              <div className="overflow-hidden rounded-b-xl bg-gradient-to-b from-slate-50 to-white p-6 dark:from-slate-900 dark:to-slate-950">
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600" />
                      <div>
                        <div className="h-4 w-32 rounded bg-slate-200 dark:bg-slate-700" />
                        <div className="mt-1 h-3 w-20 rounded bg-slate-100 dark:bg-slate-800" />
                      </div>
                    </div>
                    <div className="h-3 w-full rounded bg-slate-100 dark:bg-slate-800" />
                    <div className="h-3 w-3/4 rounded bg-slate-100 dark:bg-slate-800" />
                    <div className="flex gap-2">
                      <div className="h-10 flex-1 rounded-xl bg-blue-500" />
                      <div className="h-10 flex-1 rounded-xl bg-emerald-500" />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="aspect-square rounded-xl bg-slate-100 dark:bg-slate-800" />
                      <div className="aspect-square rounded-xl bg-slate-100 dark:bg-slate-800" />
                      <div className="aspect-square rounded-xl bg-slate-100 dark:bg-slate-800" />
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="h-40 rounded-2xl bg-slate-100 dark:bg-slate-800" />
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full bg-amber-400" />
                        <div className="h-3 w-3 rounded-full bg-amber-400" />
                        <div className="h-3 w-3 rounded-full bg-amber-400" />
                        <div className="h-3 w-3 rounded-full bg-amber-400" />
                        <div className="h-3 w-3 rounded-full bg-amber-400" />
                        <div className="h-3 w-24 rounded bg-slate-100 dark:bg-slate-800" />
                      </div>
                      <div className="h-16 rounded-xl bg-slate-50 dark:bg-slate-800/50 p-3">
                        <div className="h-2 w-full rounded bg-slate-100 dark:bg-slate-700" />
                        <div className="mt-2 h-2 w-3/4 rounded bg-slate-100 dark:bg-slate-700" />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <div className="h-9 flex-1 rounded-lg bg-slate-100 dark:bg-slate-800" />
                      <div className="h-9 flex-1 rounded-lg bg-slate-100 dark:bg-slate-800" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 lg:py-32">
        <div className="mx-auto max-w-7xl px-4 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-4xl lg:text-5xl">
              Tout ce dont vous avez besoin
            </h2>
            <p className="mt-4 text-lg text-slate-600 dark:text-slate-400">
              Une plateforme complète pour gérer votre activité d&apos;artisan au quotidien.
            </p>
          </div>

          <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: Globe,
                title: "Page publique premium",
                description: "Une page professionnelle moderne et responsive, optimisée pour le mobile. Logo, galerie, avis, FAQ, et plus encore.",
              },
              {
                icon: CalendarDays,
                title: "Prise de rendez-vous",
                description: "Calendrier en ligne, créneaux personnalisables, rappels automatiques par email, SMS et WhatsApp.",
              },
              {
                icon: FileText,
                title: "Devis professionnels",
                description: "Créez et envoyez des devis en quelques clics. Signature électronique, suivi et relances automatiques.",
              },
              {
                icon: CreditCard,
                title: "Paiement en ligne",
                description: "Acceptez les acomptes et paiements via Stripe. Factures automatiques, remboursements simplifiés.",
              },
              {
                icon: Users,
                title: "CRM intégré",
                description: "Gérez vos clients, leur historique, notes, photos. Relances automatiques pour les devis non signés.",
              },
              {
                icon: Zap,
                title: "Assistant IA",
                description: "Un assistant intelligent répond aux questions, qualifie les demandes et prend des rendez-vous pour vous, 24/7.",
              },
              {
                icon: Star,
                title: "Avis Google",
                description: "Récoltez automatiquement des avis après chaque intervention. Affichez les meilleurs avis sur votre page.",
              },
              {
                icon: MessageSquare,
                title: "Communication multi-canal",
                description: "Boutons d'appel, WhatsApp, SMS, email. Vos clients vous contactent comme ils préfèrent.",
              },
              {
                icon: BarChart3,
                title: "Statistiques avancées",
                description: "Suivez votre CA, vos rendez-vous, visiteurs de la page, provenance et bien plus dans votre dashboard.",
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className="group rounded-2xl border border-slate-200/60 bg-white p-8 transition-all duration-300 hover:border-slate-300 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
              >
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-900 transition-colors duration-300 group-hover:bg-slate-900 group-hover:text-white dark:bg-slate-800 dark:text-slate-100 dark:group-hover:bg-white dark:group-hover:text-slate-900">
                  <feature.icon className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{feature.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <PricingSection />

      {/* CTA Section */}
      <section className="py-24 lg:py-32">
        <div className="mx-auto max-w-7xl px-4 lg:px-8">
          <div className="relative overflow-hidden rounded-3xl bg-slate-900 px-8 py-16 dark:bg-white sm:px-16 sm:py-24">
            <div className="relative z-10 mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight text-white dark:text-slate-900 sm:text-4xl lg:text-5xl">
                Prêt à digitaliser votre activité ?
              </h2>
              <p className="mt-4 text-lg text-slate-300 dark:text-slate-600">
                Rejoignez des milliers d&apos;artisans qui font confiance à Vitrix pour développer leur activité.
              </p>
              <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
                <Link href="/register">
                  <Button size="lg" className="bg-white text-slate-900 hover:bg-slate-100 dark:bg-slate-900 dark:text-white dark:hover:bg-slate-800">
                    Créer ma page gratuite
                    <ArrowRight className="h-5 w-5" />
                  </Button>
                </Link>
              </div>
            </div>
            {/* Background decoration */}
            <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 blur-3xl" />
            <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-gradient-to-br from-emerald-500/20 to-blue-500/20 blur-3xl" />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200/60 py-12 dark:border-slate-800">
        <div className="mx-auto max-w-7xl px-4 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white dark:bg-white dark:text-slate-900">
                <Store className="h-4 w-4" />
              </div>
              <span className="font-semibold">Vitrix</span>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
              <Link href="/faq" className="hover:text-slate-900 dark:hover:text-slate-100">FAQ</Link>
              <Link href="/cgu" className="hover:text-slate-900 dark:hover:text-slate-100">CGU</Link>
              <Link href="/confidentialite" className="hover:text-slate-900 dark:hover:text-slate-100">Confidentialité</Link>
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
