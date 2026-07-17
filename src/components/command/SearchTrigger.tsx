"use client";

/**
 * Lot 55 — Bouton "Rechercher ⌘K" qui remplace l'ancien input GlobalSearch.
 *
 * Design : ressemble à un input mais c'est un bouton — clic ouvre la Command
 * Palette. Convention Linear/Vercel/Notion.
 *
 * Avantages :
 *  - Espace visuel identique à un input classique (habitude user préservée)
 *  - Un seul point d'entrée pour la recherche (privée + publique unifiées)
 *  - Indicateur ⌘K visible → apprend le shortcut aux users
 *  - Cross-platform : affiche `⌘K` sur Mac, `Ctrl+K` ailleurs
 */

import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { useCommandPalette } from "./useCommandPalette";

export function SearchTrigger() {
  const { open } = useCommandPalette();
  const [isMac, setIsMac] = useState(false);

  // Détection Mac vs autres OS pour afficher le bon modifier
  useEffect(() => {
    // navigator.platform est deprecated mais reste le plus fiable pour Mac vs autre
    // (userAgentData n'est pas encore supporté partout)
    if (typeof navigator !== "undefined") {
      setIsMac(/mac/i.test(navigator.platform));
    }
  }, []);

  return (
    <button
      type="button"
      onClick={open}
      aria-label="Ouvrir la recherche (raccourci Cmd+K)"
      className="flex w-full items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 px-3 py-2 text-left text-sm text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
    >
      <Search className="h-4 w-4 shrink-0" aria-hidden />
      <span className="flex-1 truncate">Rechercher…</span>
      <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900 px-1.5 py-0.5 text-[10px] font-mono text-slate-500 dark:text-slate-400">
        {isMac ? "⌘K" : "Ctrl+K"}
      </kbd>
    </button>
  );
}
