"use client";

/**
 * Lot 55 — Command Palette (Cmd+K / Ctrl+K).
 *
 * Pattern Linear/Notion/GitHub :
 *  - Modal centrée, backdrop blur, focus trap
 *  - Input avec placeholder "Rechercher..." + auto-focus
 *  - Résultats groupés par type (Actions rapides / Clients / RDV / Devis / Factures / Historique)
 *  - Navigation clavier COMPLÈTE :
 *      ↑ ↓  → change l'item sélectionné
 *      Enter → navigue vers le href de l'item courant
 *      Esc  → ferme la modal
 *      Cmd+K / Ctrl+K → toggle open/close (écouté globalement)
 *  - Historique : les 5 derniers items cliqués sauvés dans localStorage
 *  - Fetch privé debouncé 200ms sur /api/search/dashboard + AbortController
 *  - Fallback fetch public /api/search si aucun résultat privé (chercher un business ami)
 *
 * Design volontairement compact — hauteur max 60vh, scroll interne.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  User,
  Calendar,
  FileText,
  Receipt,
  Sparkles,
  Store,
  ArrowRight,
  Clock,
  Plus,
  LayoutDashboard,
  BarChart3,
  Settings,
} from "lucide-react";

// -----------------------------------------------------------------------------
// Types miroir des routes /api/search[/dashboard]
// -----------------------------------------------------------------------------

type ResultType =
  | "client"
  | "appointment"
  | "quote"
  | "invoice"
  | "business"
  | "blog"
  | "action"
  | "recent";

interface CommandResult {
  type: ResultType;
  title: string;
  subtitle: string;
  href: string;
  /** Identifiant stable pour localStorage historique */
  id?: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

// -----------------------------------------------------------------------------
// Actions rapides — toujours affichées si query vide
// -----------------------------------------------------------------------------

const QUICK_ACTIONS: CommandResult[] = [
  {
    type: "action",
    title: "Nouveau devis",
    subtitle: "Créer un devis pour un client",
    href: "/dashboard/quotes",
  },
  {
    type: "action",
    title: "Nouveau client",
    subtitle: "Ajouter un contact dans le CRM",
    href: "/dashboard/clients",
  },
  {
    type: "action",
    title: "Aujourd'hui",
    subtitle: "Voir les RDV du jour + météo",
    href: "/dashboard/today",
  },
  {
    type: "action",
    title: "Statistiques",
    subtitle: "Analytics vitrine + revenus",
    href: "/dashboard/analytics",
  },
  {
    type: "action",
    title: "Ma vitrine",
    subtitle: "Personnalisation, design, horaires",
    href: "/dashboard/vitrine",
  },
  {
    type: "action",
    title: "Paramètres",
    subtitle: "Compte, notifications, sécurité",
    href: "/dashboard/settings",
  },
];

const HISTORY_KEY = "vitrix:cmdk:history";
const HISTORY_MAX = 5;

/**
 * Icône lucide selon type de résultat — mapping stable.
 * On retourne directement le composant (pas de fabrique intermédiaire).
 */
function iconForType(type: ResultType): typeof User {
  switch (type) {
    case "client":
      return User;
    case "appointment":
      return Calendar;
    case "quote":
      return FileText;
    case "invoice":
      return Receipt;
    case "business":
      return Store;
    case "blog":
      return FileText;
    case "action":
      return Plus; // Icône par défaut si le titre ne match aucune règle iconForAction
    case "recent":
      return Clock;
    default:
      return Search;
  }
}

/**
 * Pour les items de type "action", on choisit une icône selon le titre pour
 * matcher la sémantique visuelle (Nouveau devis → FileText, Statistiques → BarChart3, etc.).
 */
function iconForAction(title: string): typeof User {
  const t = title.toLowerCase();
  if (t.includes("devis")) return FileText;
  if (t.includes("client")) return User;
  if (t.includes("aujourd")) return Calendar;
  if (t.includes("stat")) return BarChart3;
  if (t.includes("vitrine")) return LayoutDashboard;
  if (t.includes("paramètre")) return Settings;
  return Sparkles;
}

// -----------------------------------------------------------------------------
// Composant principal
// -----------------------------------------------------------------------------

export function CommandPalette({ isOpen, onClose }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [query, setQuery] = useState("");
  const [privateResults, setPrivateResults] = useState<CommandResult[]>([]);
  const [publicResults, setPublicResults] = useState<CommandResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [history, setHistory] = useState<CommandResult[]>([]);

  // Charge l'historique au mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      if (raw) setHistory(JSON.parse(raw) as CommandResult[]);
    } catch {
      /* corrupted localStorage : reset silently */
    }
  }, []);

  // Auto-focus input à l'ouverture
  useEffect(() => {
    if (isOpen) {
      // Reset état à chaque ouverture
      setQuery("");
      setPrivateResults([]);
      setPublicResults([]);
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Fetch privé + public en parallèle, debouncé 200ms
  const doSearch = useCallback(async (value: string) => {
    if (value.length < 2) {
      setPrivateResults([]);
      setPublicResults([]);
      setLoading(false);
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);

    try {
      const [privRes, pubRes] = await Promise.all([
        fetch(`/api/search/dashboard?q=${encodeURIComponent(value)}`, {
          signal: controller.signal,
        })
          .then((r) => (r.ok ? r.json() : { results: [] }))
          .catch(() => ({ results: [] })),
        fetch(`/api/search?q=${encodeURIComponent(value)}`, {
          signal: controller.signal,
        })
          .then((r) => (r.ok ? r.json() : { results: [] }))
          .catch(() => ({ results: [] })),
      ]);

      setPrivateResults(Array.isArray(privRes.results) ? privRes.results : []);
      setPublicResults(Array.isArray(pubRes.results) ? pubRes.results : []);
    } catch (err) {
      if (err instanceof Error && err.name !== "AbortError") {
        setPrivateResults([]);
        setPublicResults([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = (value: string) => {
    setQuery(value);
    setSelectedIndex(0);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => void doSearch(value), 200);
  };

  // Construit la liste PLATE de tous les items visibles (pour navigation clavier)
  // avec headers de groupe inclus (mais non sélectionnables — filtrés)
  const flatItems = useMemo<CommandResult[]>(() => {
    if (query.length < 2) {
      // Écran d'accueil : historique + actions rapides
      return [...history, ...QUICK_ACTIONS];
    }
    return [...privateResults, ...publicResults];
  }, [query, history, privateResults, publicResults]);

  // Handler pour sélectionner un item (via clic OU Enter)
  const selectItem = useCallback(
    (item: CommandResult) => {
      // Ajoute à l'historique (dédup par href, cap 5)
      try {
        const newHistory = [item, ...history.filter((h) => h.href !== item.href)].slice(
          0,
          HISTORY_MAX
        );
        setHistory(newHistory);
        localStorage.setItem(HISTORY_KEY, JSON.stringify(newHistory));
      } catch {
        /* localStorage full ou disabled : ignore */
      }
      onClose();
      router.push(item.href);
    },
    [history, onClose, router]
  );

  // Navigation clavier
  useEffect(() => {
    if (!isOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, Math.max(0, flatItems.length - 1)));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(0, i - 1));
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const item = flatItems[selectedIndex];
        if (item) selectItem(item);
        return;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, flatItems, selectedIndex, selectItem, onClose]);

  // Scroll into view l'item sélectionné
  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(`[data-cmd-index="${selectedIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  if (!isOpen) return null;

  const showHistory = query.length < 2 && history.length > 0;
  const showActions = query.length < 2;
  const showResults = query.length >= 2 && (privateResults.length > 0 || publicResults.length > 0);
  const showEmpty = query.length >= 2 && !loading && privateResults.length === 0 && publicResults.length === 0;

  // Compteur cumulatif pour data-cmd-index (nav clavier)
  let indexCounter = -1;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Rechercher"
      // Backdrop : blur + clic ferme
      className="fixed inset-0 z-[100] flex items-start justify-center bg-slate-950/40 backdrop-blur-sm p-4 pt-[15vh]"
      onClick={onClose}
    >
      <div
        // Stopper la propagation pour éviter fermeture au clic dans la modal
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl"
      >
        {/* Input */}
        <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-800 px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => handleChange(e.target.value)}
            placeholder="Rechercher un client, devis, facture..."
            aria-label="Rechercher"
            aria-autocomplete="list"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400 text-slate-900 dark:text-slate-100"
          />
          <kbd className="hidden sm:inline-flex h-5 items-center gap-0.5 rounded border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 px-1.5 text-[10px] font-mono text-slate-500 dark:text-slate-400">
            Esc
          </kbd>
        </div>

        {/* Résultats */}
        <div ref={listRef} className="max-h-[60vh] overflow-y-auto py-2">
          {loading && (
            <div className="px-4 py-8 text-center text-sm text-slate-500">Recherche…</div>
          )}

          {/* HISTORIQUE (accueil, si présent) */}
          {showHistory && (
            <CommandGroup label="Récents">
              {history.map((item) => {
                indexCounter++;
                const idx = indexCounter;
                return (
                  <CommandItem
                    key={`history-${idx}`}
                    item={{ ...item, type: "recent" }}
                    isSelected={selectedIndex === idx}
                    dataIndex={idx}
                    onSelect={() => selectItem(item)}
                    onHover={() => setSelectedIndex(idx)}
                  />
                );
              })}
            </CommandGroup>
          )}

          {/* ACTIONS RAPIDES (accueil) */}
          {showActions && (
            <CommandGroup label="Actions rapides">
              {QUICK_ACTIONS.map((item) => {
                indexCounter++;
                const idx = indexCounter;
                return (
                  <CommandItem
                    key={`action-${idx}`}
                    item={item}
                    isSelected={selectedIndex === idx}
                    dataIndex={idx}
                    onSelect={() => selectItem(item)}
                    onHover={() => setSelectedIndex(idx)}
                  />
                );
              })}
            </CommandGroup>
          )}

          {/* RÉSULTATS PRIVÉS (query >= 2) */}
          {showResults && privateResults.length > 0 && (
            <CommandGroup label="Dans votre business">
              {privateResults.map((item) => {
                indexCounter++;
                const idx = indexCounter;
                return (
                  <CommandItem
                    key={`priv-${item.type}-${idx}`}
                    item={item}
                    isSelected={selectedIndex === idx}
                    dataIndex={idx}
                    onSelect={() => selectItem(item)}
                    onHover={() => setSelectedIndex(idx)}
                  />
                );
              })}
            </CommandGroup>
          )}

          {/* RÉSULTATS PUBLICS (query >= 2) */}
          {showResults && publicResults.length > 0 && (
            <CommandGroup label="Sur Vitrix">
              {publicResults.map((item) => {
                indexCounter++;
                const idx = indexCounter;
                return (
                  <CommandItem
                    key={`pub-${item.type}-${idx}`}
                    item={item}
                    isSelected={selectedIndex === idx}
                    dataIndex={idx}
                    onSelect={() => selectItem(item)}
                    onHover={() => setSelectedIndex(idx)}
                  />
                );
              })}
            </CommandGroup>
          )}

          {/* Empty state */}
          {showEmpty && (
            <div className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
              Aucun résultat pour &laquo; {query} &raquo;.
            </div>
          )}
        </div>

        {/* Footer keyboard hints */}
        <div className="flex items-center justify-between gap-2 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 px-4 py-2 text-[10px] text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-slate-200 dark:border-slate-700 px-1 font-mono">
                ↑
              </kbd>
              <kbd className="rounded border border-slate-200 dark:border-slate-700 px-1 font-mono">
                ↓
              </kbd>
              naviguer
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-slate-200 dark:border-slate-700 px-1 font-mono">
                ↵
              </kbd>
              sélectionner
            </span>
          </div>
          <span className="hidden sm:inline">Vitrix Search</span>
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Sous-composants
// -----------------------------------------------------------------------------

function CommandGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-1">
      <p className="px-4 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
        {label}
      </p>
      {children}
    </div>
  );
}

function CommandItem({
  item,
  isSelected,
  dataIndex,
  onSelect,
  onHover,
}: {
  item: CommandResult;
  isSelected: boolean;
  dataIndex: number;
  onSelect: () => void;
  onHover: () => void;
}) {
  const IconRaw = iconForType(item.type);
  // Cas spécial "action" : icône plus spécifique selon titre
  const Icon = item.type === "action" ? iconForAction(item.title) : IconRaw;

  return (
    <button
      type="button"
      data-cmd-index={dataIndex}
      onClick={onSelect}
      onMouseEnter={onHover}
      role="option"
      aria-selected={isSelected}
      className={`flex w-full items-center gap-3 px-4 py-2 text-left transition-colors ${
        isSelected
          ? "bg-slate-100 dark:bg-slate-800"
          : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
      }`}
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
        <Icon className="h-4 w-4" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
          {item.title}
        </p>
        <p className="truncate text-xs text-slate-500 dark:text-slate-400">{item.subtitle}</p>
      </div>
      {isSelected && <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />}
    </button>
  );
}
