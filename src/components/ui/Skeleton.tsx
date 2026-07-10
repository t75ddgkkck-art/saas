import { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/**
 * Skeleton loader — placeholder animé pour éviter les écrans blancs
 * pendant les fetch client. Utilisé par SkeletonList, SkeletonCard, etc.
 */
export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="status"
      aria-hidden="true"
      className={cn("animate-pulse rounded-lg bg-slate-200/70 dark:bg-slate-800", className)}
      {...props}
    />
  );
}

/**
 * Ligne de liste type "avatar + 2 lignes de texte".
 */
export function SkeletonListItem() {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <Skeleton className="h-10 w-10 shrink-0 rounded-xl" />
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-3.5 w-1/2" />
        <Skeleton className="h-3 w-1/3" />
      </div>
      <Skeleton className="h-6 w-16 rounded-full" />
    </div>
  );
}

export function SkeletonList({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-2" role="status" aria-live="polite">
      <span className="sr-only">Chargement de la liste…</span>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonListItem key={i} />
      ))}
    </div>
  );
}

/**
 * Grille de cartes (dashboard, stats, etc.)
 */
export function SkeletonCards({ count = 4, className }: { count?: number; className?: string }) {
  return (
    <div
      className={cn("grid grid-cols-2 gap-3 lg:grid-cols-4", className)}
      role="status"
      aria-live="polite"
    >
      <span className="sr-only">Chargement…</span>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="h-28 animate-pulse rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
        />
      ))}
    </div>
  );
}
