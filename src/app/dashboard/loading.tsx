/**
 * Loading dashboard : squelette du layout + placeholders pour éviter le CLS
 * (mieux qu'un spinner qui décale la page quand le contenu arrive).
 */
export default function DashboardLoading() {
  return (
    <div className="space-y-6" role="status" aria-live="polite">
      <span className="sr-only">Chargement du tableau de bord…</span>
      {/* En-tête */}
      <div className="h-9 w-64 animate-pulse rounded-lg bg-slate-200/70 dark:bg-slate-800" />
      {/* Grille de stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-28 animate-pulse rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
          />
        ))}
      </div>
      {/* Deux blocs */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="h-72 animate-pulse rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 lg:col-span-2" />
        <div className="h-72 animate-pulse rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900" />
      </div>
    </div>
  );
}
