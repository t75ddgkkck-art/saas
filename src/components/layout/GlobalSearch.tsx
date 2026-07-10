"use client";

/**
 * GlobalSearch — recherche unifiée (Lot 20 fix B8).
 *
 * Avant : 100% mock avec "Dupont Plomberie" hardcodé, ne trouvait rien.
 * Maintenant : vrai fetch `/api/search?q=...` avec :
 *  - Debounce 250ms (évite de tirer une requête par frappe)
 *  - AbortController pour annuler les requêtes obsolètes (course résolue)
 *  - Rate-limit backend 30/min/IP
 *  - Skeleton pendant le fetch
 *  - Empty state "aucun résultat"
 *  - Fermeture par click-outside + Escape
 *  - Navigation clavier friendly (chaque résultat est un <a>)
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Search, X, Loader2, Store, FileText } from "lucide-react";

interface SearchResult {
  type: "business" | "blog";
  title: string;
  subtitle: string;
  href: string;
}

const DEBOUNCE_MS = 250;

export function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch réel, debouncé, avec annulation des requêtes obsolètes
  const doSearch = useCallback(async (value: string) => {
    if (value.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    // Annule la requête précédente s'il y en a une
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(value)}`, {
        signal: controller.signal,
      });
      if (!res.ok) throw new Error("search error");
      const data = await res.json();
      setResults(Array.isArray(data.results) ? data.results : []);
    } catch (err) {
      // AbortError = requête annulée, on ignore silencieusement
      if (err instanceof Error && err.name === "AbortError") return;
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => void doSearch(value), DEBOUNCE_MS);
  };

  // Fermeture par click-outside + Escape
  useEffect(() => {
    if (!isOpen) return;
    function onDocClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setIsOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [isOpen]);

  // Reset state à la fermeture (mais on garde la query pour ne pas frustrer)
  const clear = () => {
    setQuery("");
    setResults([]);
    abortRef.current?.abort();
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
          aria-hidden="true"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => setIsOpen(true)}
          placeholder="Rechercher un pro, un article…"
          aria-label="Recherche"
          className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-9 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:ring-slate-700"
        />
        {query && (
          <button
            type="button"
            onClick={clear}
            aria-label="Effacer la recherche"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {isOpen && query.length >= 2 && (
        <div
          role="listbox"
          className="absolute left-0 right-0 top-full z-40 mt-1 max-h-80 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900"
        >
          {loading && (
            <div className="flex items-center gap-2 px-3 py-3 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Recherche…
            </div>
          )}
          {!loading && results.length === 0 && (
            <div className="px-3 py-4 text-center text-sm text-slate-500 dark:text-slate-400">
              Aucun résultat pour « {query} »
            </div>
          )}
          {!loading &&
            results.map((r, i) => (
              <Link
                key={`${r.type}-${r.href}-${i}`}
                href={r.href}
                role="option"
                onClick={() => setIsOpen(false)}
                className="flex items-start gap-3 border-b border-slate-100 px-3 py-2.5 text-sm last:border-0 hover:bg-slate-50 focus:bg-slate-50 focus:outline-none dark:border-slate-800 dark:hover:bg-slate-800/60 dark:focus:bg-slate-800/60"
              >
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {r.type === "business" ? (
                    <Store className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <FileText className="h-4 w-4" aria-hidden="true" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-slate-900 dark:text-slate-100">
                    {r.title}
                  </p>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                    {r.subtitle}
                  </p>
                </div>
              </Link>
            ))}
        </div>
      )}
    </div>
  );
}
