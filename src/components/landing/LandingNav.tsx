/**
 * Lot 40 — Nav landing page avec burger mobile fonctionnel.
 *
 * Avant : la nav landing avait un menu desktop `hidden md:flex` mais AUCUN
 * burger mobile → sur téléphone, les 3 liens (Fonctionnalités, Tarifs, À propos)
 * étaient totalement invisibles. Fixé.
 *
 * Design :
 *  - Desktop (md+) : liens inline dans la topbar
 *  - Mobile (<md) : bouton burger → panel qui slide-down avec les liens
 *  - Fermeture auto au clic sur un lien
 *  - Escape ferme le panel
 *  - Body scroll lock quand ouvert (évite double-scroll)
 *  - z-50 comme la nav parent (au-dessus de tout sauf modals)
 */

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X, Store } from "lucide-react";
import { Button } from "@/components/ui/Button";

export function LandingNav() {
  const [open, setOpen] = useState(false);

  // Fermeture au ESC
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Body scroll lock
  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [open]);

  return (
    <nav className="fixed inset-x-0 top-0 z-50 border-b border-slate-200/60 bg-white/80 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/80">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 lg:px-8">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2" aria-label="Vitrix — Accueil">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900">
            <Store className="h-5 w-5" aria-hidden />
          </div>
          <span className="text-lg font-bold tracking-tight">Vitrix</span>
        </Link>

        {/* Liens desktop (md+) */}
        <div className="hidden items-center gap-8 md:flex">
          <a
            href="#features"
            className="text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
          >
            Fonctionnalités
          </a>
          <a
            href="#pricing"
            className="text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
          >
            Tarifs
          </a>
          <Link
            href="/a-propos"
            className="text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
          >
            À propos
          </Link>
        </div>

        {/* Actions droites : boutons + burger mobile */}
        <div className="flex items-center gap-2">
          {/* Se connecter — visible desktop uniquement */}
          <Link href="/login" className="hidden sm:block">
            <Button variant="ghost" size="sm">
              Se connecter
            </Button>
          </Link>
          {/* Essayer — visible desktop uniquement (burger contient déjà) */}
          <Link href="/register" className="hidden sm:block">
            <Button size="sm">Essayer gratuitement</Button>
          </Link>

          {/* Burger mobile (<sm) */}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
            aria-expanded={open}
            aria-controls="landing-mobile-menu"
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 sm:hidden"
          >
            {open ? (
              <X className="h-5 w-5" aria-hidden />
            ) : (
              <Menu className="h-5 w-5" aria-hidden />
            )}
          </button>
        </div>
      </div>

      {/* Panel mobile — slide down sous la topbar */}
      {open && (
        <div
          id="landing-mobile-menu"
          className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 sm:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Menu principal"
        >
          <div className="mx-auto max-w-7xl px-4 py-4 space-y-3">
            <a
              href="#features"
              onClick={() => setOpen(false)}
              className="block rounded-lg px-3 py-3 text-base font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Fonctionnalités
            </a>
            <a
              href="#pricing"
              onClick={() => setOpen(false)}
              className="block rounded-lg px-3 py-3 text-base font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Tarifs
            </a>
            <Link
              href="/a-propos"
              onClick={() => setOpen(false)}
              className="block rounded-lg px-3 py-3 text-base font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              À propos
            </Link>
            <div className="border-t border-slate-200 dark:border-slate-800 pt-3 space-y-2">
              <Link href="/login" onClick={() => setOpen(false)} className="block">
                <Button variant="outline" className="w-full">
                  Se connecter
                </Button>
              </Link>
              <Link href="/register" onClick={() => setOpen(false)} className="block">
                <Button className="w-full">Essayer gratuitement</Button>
              </Link>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
