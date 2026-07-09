import { Store } from "lucide-react";

// Fallback pendant le rendu server-side de n'importe quelle route.
// UI minimaliste, cohérente avec la landing.
export default function Loading() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-screen flex-col items-center justify-center gap-6 bg-slate-50 dark:bg-slate-950"
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-white dark:bg-white dark:text-slate-900">
        <Store className="h-7 w-7 animate-pulse" aria-hidden="true" />
      </div>
      <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
        <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.3s]" />
        <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.15s]" />
        <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" />
        <span className="ml-2">Chargement…</span>
      </div>
    </div>
  );
}
