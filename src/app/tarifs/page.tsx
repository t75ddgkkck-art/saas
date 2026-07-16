/**
 * Fix NAV1 (Lot 50) — Page `/tarifs` dédiée.
 *
 * Avant : `<UpgradeGate>` et `/a-propos` liaient vers `/pricing` et `/tarifs`
 * qui n'existaient pas → 404 sur TOUS les CTA upgrade Premium. Bug MAJEUR
 * de conversion.
 *
 * Maintenant :
 *  - `/tarifs` = URL canonique, SEO propre, rend `<PricingSection />`
 *  - `/pricing` = redirect 308 permanent vers `/tarifs` (voir next.config.ts)
 *  - Tous les CTA `href="/tarifs"` fonctionnent
 *
 * Server component pour bénéficier de SSG + metadata SEO.
 */

import type { Metadata } from "next";
import { PricingSection } from "@/components/public/PricingSection";
import { LandingNav } from "@/components/landing/LandingNav";
import Link from "next/link";
import { Store } from "lucide-react";

export const metadata: Metadata = {
  title: "Tarifs — Vitrix",
  description:
    "3 plans simples pour tous les artisans : Gratuit pour démarrer, Pro à 29€/mois pour développer, Premium à 79€/mois pour l'expérience complète.",
  alternates: {
    canonical: "/tarifs",
  },
};

export default function TarifsPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      <LandingNav />
      <main id="main-content" tabIndex={-1} className="focus:outline-none pt-24 sm:pt-32">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 [text-wrap:balance] sm:text-5xl">
            Un tarif simple pour chaque étape de votre activité
          </h1>
          <p className="mt-4 text-base text-slate-600 dark:text-slate-400 sm:text-lg">
            Sans engagement, changement de plan à tout moment. Économisez 2 mois en payant à l&apos;année.
          </p>
        </div>
        <PricingSection />
      </main>

      {/* Footer minimal — cohérent avec landing */}
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
              <Link href="/" className="hover:text-slate-900 dark:hover:text-slate-100">
                Accueil
              </Link>
              <Link href="/a-propos" className="hover:text-slate-900 dark:hover:text-slate-100">
                À propos
              </Link>
              <Link href="/faq" className="hover:text-slate-900 dark:hover:text-slate-100">
                FAQ
              </Link>
              <Link href="/cgu" className="hover:text-slate-900 dark:hover:text-slate-100">
                CGU
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
