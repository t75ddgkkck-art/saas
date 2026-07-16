"use client";

/**
 * Lot 46 (F11) — Sélecteur de vitrine active en haut de la sidebar dashboard.
 *
 * Comportement :
 *  - Si l'user a 1 seule vitrine → affichage READ-ONLY (nom + emoji catégorie)
 *  - Si l'user a 2+ vitrines → dropdown cliquable avec liste + switch actif
 *  - Bouton "+ Nouvelle vitrine" en pied de dropdown :
 *      * Free / Pro (2e vitrine) → route vers /dashboard/my-businesses qui gère
 *        le CTA upgrade Premium via <UpgradeGate>
 *      * Premium sous quota → route directe création
 *
 * Design : dropdown natif (details/summary) — pas de dépendance Radix,
 * accessible par défaut (Enter/Espace pour ouvrir, Escape pour fermer).
 * Fermeture automatique au clic sur un item via body listener.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, Check, ChevronDown, Plus } from "lucide-react";
import { CATEGORIES } from "@/lib/utils";

interface BusinessLite {
  id: string;
  name: string;
  slug: string;
  category: string;
}

interface CurrentBusiness {
  id: string;
  name: string;
}

export function BusinessSwitcher() {
  const [businesses, setBusinesses] = useState<BusinessLite[] | null>(null);
  const [current, setCurrent] = useState<CurrentBusiness | null>(null);
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const load = useCallback(async () => {
    try {
      // On charge en parallèle la liste + la vitrine ACTIVE (source de vérité = /api/my-business)
      const [listRes, currentRes] = await Promise.all([
        fetch("/api/my-businesses").then((r) => r.json()),
        fetch("/api/my-business").then((r) => r.json()),
      ]);
      setBusinesses(listRes.businesses ?? []);
      if (currentRes?.id) {
        setCurrent({ id: currentRes.id, name: currentRes.name });
      }
    } catch {
      // Silencieux : le switcher disparait juste si erreur réseau
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Fermeture au clic hors du composant (bonne pratique dropdown accessible)
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  const handleSwitch = async (bizId: string) => {
    if (bizId === current?.id) {
      setOpen(false);
      return;
    }
    setSwitching(bizId);
    try {
      const res = await fetch("/api/my-businesses/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId: bizId }),
      });
      const data = await res.json();
      if (data.ok) {
        setCurrent({ id: data.businessId, name: data.name });
        setOpen(false);
        // Refresh de toutes les pages qui dépendent de getCurrentBusiness()
        // → server components re-fetch avec la nouvelle vitrine active.
        router.refresh();
      }
    } finally {
      setSwitching(null);
    }
  };

  // Aucun business = user tout neuf. On n'affiche rien (le welcome onboarding
  // s'occupe déjà de guider vers la création).
  if (!businesses || businesses.length === 0) return null;

  const categoryIcon = (cat: string) =>
    CATEGORIES.find((c) => c.id === cat)?.icon ?? "🏪";

  // Vue mono-vitrine : simplement afficher le nom, pas de dropdown
  if (businesses.length === 1) {
    const only = businesses[0];
    return (
      <div className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white dark:bg-slate-900 text-base">
          {categoryIcon(only.category)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
            {only.name}
          </p>
          <p className="truncate text-[10px] text-slate-500">vitrix.fr/{only.slug}</p>
        </div>
      </div>
    );
  }

  // Vue multi-vitrines : dropdown
  const currentBiz = current
    ? businesses.find((b) => b.id === current.id) ?? businesses[0]
    : businesses[0];

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={`Vitrine active : ${currentBiz.name}. Cliquer pour changer.`}
        className="flex w-full items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white dark:bg-slate-900 text-base">
          {categoryIcon(currentBiz.category)}
        </div>
        <div className="min-w-0 flex-1 text-left">
          <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
            {currentBiz.name}
          </p>
          <p className="truncate text-[10px] text-slate-500">
            {businesses.length} vitrines · cliquer pour changer
          </p>
        </div>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${
            open ? "rotate-180" : ""
          }`}
          aria-hidden
        />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg"
        >
          {businesses.map((biz) => {
            const isCurrent = biz.id === currentBiz.id;
            const isSwitching = switching === biz.id;
            return (
              <button
                key={biz.id}
                type="button"
                role="option"
                aria-selected={isCurrent}
                disabled={isSwitching}
                onClick={() => handleSwitch(biz.id)}
                className={`flex w-full items-center gap-2 p-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors ${
                  isCurrent ? "bg-slate-50 dark:bg-slate-800/50" : ""
                }`}
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 text-base">
                  {categoryIcon(biz.category)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                    {biz.name}
                  </p>
                  <p className="truncate text-[10px] text-slate-500">
                    vitrix.fr/{biz.slug}
                  </p>
                </div>
                {isCurrent && (
                  <Check className="h-4 w-4 shrink-0 text-emerald-500" aria-label="Actif" />
                )}
              </button>
            );
          })}
          <Link
            href="/dashboard/my-businesses"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 border-t border-slate-200 dark:border-slate-700 p-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
              <Plus className="h-4 w-4" />
            </div>
            <span>Gérer mes vitrines</span>
          </Link>
        </div>
      )}
    </div>
  );
}

/**
 * Fallback minimal si `BusinessSwitcher` fail complètement — évite un blank sidebar.
 * Utilisé nulle part par défaut, exporté pour les tests éventuels.
 */
export function BusinessSwitcherFallback() {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-2.5 text-slate-400">
      <Building2 className="h-5 w-5" />
      <span className="text-xs">Aucune vitrine</span>
    </div>
  );
}
