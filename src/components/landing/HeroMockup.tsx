"use client";

/**
 * Lot 41 — Hero mockup extrait en composant client à part.
 *
 * Pourquoi ?
 * - Sur mobile (iPhone SE en particulier), la mockup ajoute ~600px de hauteur
 *   après le fold utile → l'utilisateur voit rarement le mockup avant de scroller
 *   les features. Elle n'a donc AUCUNE raison de rentrer dans le premier bundle.
 * - En l'isolant en client + import dynamique dans page.tsx, on économise
 *   quelques KB de HTML/CSS/JS sur le TTFB.
 * - En bonus, on peut ajouter `loading="lazy"` sur les visuels internes plus tard
 *   sans toucher au hero.
 *
 * Note : c'est une pure démo visuelle (blocs colorés), aucune image réelle.
 * On aurait pu en faire un composant serveur, mais le split en client permet
 * un lazy-load côté page sans wrapper Suspense supplémentaire.
 */
export function HeroMockup() {
  return (
    <div className="mx-auto mt-14 max-w-5xl sm:mt-20">
      {/*
        Container "fenêtre navigateur" — la barre d'onglets fake et l'URL
        rendent la démo plus crédible qu'un simple screenshot.
      */}
      <div className="relative rounded-2xl border border-slate-200/60 bg-slate-900 p-1.5 shadow-2xl dark:border-slate-800 sm:p-2">
        <div className="flex items-center gap-1.5 rounded-t-xl bg-slate-800 px-3 py-2 sm:gap-2 sm:px-4 sm:py-3">
          <div className="h-2.5 w-2.5 rounded-full bg-red-500 sm:h-3 sm:w-3" />
          <div className="h-2.5 w-2.5 rounded-full bg-amber-500 sm:h-3 sm:w-3" />
          <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 sm:h-3 sm:w-3" />
          {/* URL fake — tronquée sur mobile pour ne pas déborder */}
          <div className="ml-2 flex-1 truncate rounded-lg bg-slate-700 px-2.5 py-1 text-[11px] text-slate-500 sm:ml-4 sm:px-4 sm:py-1.5 sm:text-sm">
            vitrix.fr/dupont-plomberie
          </div>
        </div>
        <div className="overflow-hidden rounded-b-xl bg-gradient-to-b from-slate-50 to-white p-4 dark:from-slate-900 dark:to-slate-950 sm:p-6">
          <div className="grid gap-4 sm:gap-6 md:grid-cols-2">
            {/* Colonne 1 : profil + CTA + galerie */}
            <div className="space-y-3 sm:space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 shrink-0 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 sm:h-14 sm:w-14" />
                <div className="min-w-0 flex-1">
                  <div className="h-3.5 w-32 max-w-full rounded bg-slate-200 dark:bg-slate-700 sm:h-4" />
                  <div className="mt-1 h-3 w-20 max-w-full rounded bg-slate-100 dark:bg-slate-800" />
                </div>
              </div>
              <div className="h-3 w-full rounded bg-slate-100 dark:bg-slate-800" />
              <div className="h-3 w-3/4 rounded bg-slate-100 dark:bg-slate-800" />
              <div className="flex gap-2">
                <div className="h-9 flex-1 rounded-xl bg-blue-500 sm:h-10" />
                <div className="h-9 flex-1 rounded-xl bg-emerald-500 sm:h-10" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="aspect-square rounded-xl bg-slate-100 dark:bg-slate-800" />
                <div className="aspect-square rounded-xl bg-slate-100 dark:bg-slate-800" />
                <div className="aspect-square rounded-xl bg-slate-100 dark:bg-slate-800" />
              </div>
            </div>
            {/* Colonne 2 : image + avis + boutons secondaires */}
            <div className="space-y-3 sm:space-y-4">
              <div className="h-32 rounded-2xl bg-slate-100 dark:bg-slate-800 sm:h-40" />
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full bg-amber-400 sm:h-3 sm:w-3" />
                  <div className="h-2.5 w-2.5 rounded-full bg-amber-400 sm:h-3 sm:w-3" />
                  <div className="h-2.5 w-2.5 rounded-full bg-amber-400 sm:h-3 sm:w-3" />
                  <div className="h-2.5 w-2.5 rounded-full bg-amber-400 sm:h-3 sm:w-3" />
                  <div className="h-2.5 w-2.5 rounded-full bg-amber-400 sm:h-3 sm:w-3" />
                  <div className="h-2.5 w-20 rounded bg-slate-100 dark:bg-slate-800 sm:h-3 sm:w-24" />
                </div>
                <div className="h-14 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50 sm:h-16">
                  <div className="h-2 w-full rounded bg-slate-100 dark:bg-slate-700" />
                  <div className="mt-2 h-2 w-3/4 rounded bg-slate-100 dark:bg-slate-700" />
                </div>
              </div>
              <div className="flex gap-2">
                <div className="h-8 flex-1 rounded-lg bg-slate-100 dark:bg-slate-800 sm:h-9" />
                <div className="h-8 flex-1 rounded-lg bg-slate-100 dark:bg-slate-800 sm:h-9" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
