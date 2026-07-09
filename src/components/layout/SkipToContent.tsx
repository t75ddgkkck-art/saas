/**
 * Lien "Aller au contenu principal" pour la navigation clavier / lecteurs d'écran.
 * - Invisible jusqu'à ce qu'il reçoive le focus (Tab au chargement de la page).
 * - Cible l'élément avec id="main-content" (à ajouter sur le <main> ou l'article principal).
 * - Recommandation WCAG 2.4.1 : Bypass Blocks.
 */
export function SkipToContent({
  targetId = "main-content",
  label = "Aller au contenu principal",
}: {
  targetId?: string;
  label?: string;
}) {
  return (
    <a
      href={`#${targetId}`}
      className={[
        "sr-only focus:not-sr-only",
        "fixed left-4 top-4 z-[100]",
        "rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white",
        "shadow-lg outline-none ring-4 ring-slate-400/40 ring-offset-2",
        "dark:bg-white dark:text-slate-900",
      ].join(" ")}
    >
      {label}
    </a>
  );
}
