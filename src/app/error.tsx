"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { AlertTriangle } from "lucide-react";

/**
 * Erreur runtime globale. Next.js remonte ici tout throw non catché.
 * On log côté client (Sentry si présent) + on propose retry/retour accueil.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Lot 13 : import dynamique pour ne pas embarquer le monitoring
    // dans le bundle initial (côté client). Le fallback logger tourne
    // quand même via console.error si aucun Sentry configuré.
    void import("@/lib/monitoring")
      .then(({ captureException }) => {
        captureException(error, {
          route: "app/error.tsx",
          severity: "error",
          extra: { digest: error.digest },
        });
      })
      .catch(() => {
        // eslint-disable-next-line no-console
        console.error("[app] uncaught error", error);
      });
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-slate-50 px-4 text-center dark:bg-slate-950">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-500 dark:bg-red-900/20">
        <AlertTriangle className="h-7 w-7" aria-hidden="true" />
      </div>
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Une erreur est survenue</h1>
        <p className="mt-2 max-w-md text-sm text-slate-500 dark:text-slate-400">
          Nous n&apos;avons pas pu afficher cette page. Notre équipe a été notifiée. Vous pouvez réessayer
          ou revenir à l&apos;accueil.
        </p>
        {error.digest && (
          <p className="mt-3 font-mono text-xs text-slate-500">Code : {error.digest}</p>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button onClick={reset}>Réessayer</Button>
        <Link href="/">
          <Button variant="outline">Retour à l&apos;accueil</Button>
        </Link>
      </div>
    </div>
  );
}
