"use client";

/**
 * Topbar mobile (Lot 18 B11).
 *
 * Sur mobile (<lg), le sidebar est caché derrière un burger en position fixed.
 * Résultat : NotificationBell + ThemeToggle qui vivent DANS le sidebar sont
 * inaccessibles tant que l'utilisateur ne l'ouvre pas → mauvaise UX.
 *
 * On extrait ces contrôles dans une topbar mobile persistante qui :
 *  - Reste visible en haut d'écran (<lg uniquement, .lg:hidden)
 *  - Laisse la place au bouton burger existant (à gauche, le composant se cale à droite)
 *  - Reprend les mêmes composants que dans le sidebar → source unique de vérité
 */

import { NotificationBell } from "./NotificationBell";
import { ThemeToggle } from "./ThemeToggle";

export function MobileTopBar() {
  return (
    <div
      // top-3 pour s'aligner avec le bouton burger (top-4), z-40 pour rester
      // sous les modals (z-50) mais au-dessus du contenu (z auto).
      // right-3 pour laisser un peu d'air.
      className="fixed right-3 top-3 z-40 flex items-center gap-1.5 rounded-2xl bg-white/95 px-1.5 py-1 shadow-lg backdrop-blur dark:bg-slate-900/95 lg:hidden"
      role="toolbar"
      aria-label="Actions rapides"
    >
      <ThemeToggle />
      <NotificationBell />
    </div>
  );
}
