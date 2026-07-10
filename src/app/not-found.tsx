import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Compass, Home, Search } from "lucide-react";

export const dynamic = "force-static";

export const metadata = {
  title: "Page introuvable",
  description: "La page que vous cherchez n'existe pas ou a été déplacée.",
};

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-slate-50 px-4 text-center dark:bg-slate-950">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-white dark:bg-white dark:text-slate-900">
        <Compass className="h-7 w-7" aria-hidden="true" />
      </div>
      <div>
        <p className="text-sm font-semibold uppercase tracking-widest text-slate-400">404</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900 dark:text-slate-100">
          Page introuvable
        </h1>
        <p className="mt-2 max-w-md text-sm text-slate-500 dark:text-slate-400">
          La page que vous cherchez n&apos;existe pas ou a été déplacée. Vérifiez l&apos;URL ou
          utilisez les raccourcis ci-dessous.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link href="/">
          <Button leftIcon={<Home className="h-4 w-4" aria-hidden="true" />}>Accueil</Button>
        </Link>
        <Link href="/annuaire">
          <Button variant="outline" leftIcon={<Search className="h-4 w-4" aria-hidden="true" />}>
            Parcourir l&apos;annuaire
          </Button>
        </Link>
      </div>
    </div>
  );
}
