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
      // F6 (Lot 34, B29) : `top-safe` = max(0.75rem, env(safe-area-inset-top))
      // → compense l'encoche iPhone en PWA installée. `pr-safe` pour l'encoche
      // en landscape. Sans ça, la barre passait sous le status bar iOS.
      // z-40 : sous les modals (z-50), au-dessus du contenu.
      className="fixed right-3 top-safe pr-safe z-40 flex items-center gap-1.5 rounded-2xl bg-white/95 px-1.5 py-1 shadow-lg backdrop-blur dark:bg-slate-900/95 lg:hidden"
      role="toolbar"
      aria-label="Actions rapides"
    >
      <ThemeToggle />
      <NotificationBell />
    </div>
  );
}
