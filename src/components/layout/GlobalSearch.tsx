"use client";

import { useState } from "react";
import { Search, X } from "lucide-react";
import Link from "next/link";

interface SearchResult {
  type: "business" | "blog" | "service";
  title: string;
  subtitle: string;
  href: string;
}

export function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  const handleSearch = (value: string) => {
    setQuery(value);
    if (value.length < 2) {
      setResults([]);
      return;
    }

    // Simulation de recherche (à remplacer par un vrai fetch API)
    const mockResults = [
      {
        type: "business" as const,
        title: "Dupont Plomberie",
        subtitle: "Plombier • Paris 2e",
        href: "/dupont-plomberie",
      },
      {
        type: "blog" as const,
        title: "5 signes que votre plomberie doit être rénovée",
        subtitle: "Conseils • Plomberie",
        href: "/dupont-plomberie/blog/5-signes-renovation-plomberie",
      },
      {
        type: "service" as const,
        title: "Rénovation salle de bain",
        subtitle: "Dupont Plomberie",
        href: "/dupont-plomberie",
      },
    ].filter((r) =>
      r.title.toLowerCase().includes(value.toLowerCase()) ||
      r.subtitle.toLowerCase().includes(value.toLowerCase())
    );

    setResults(mockResults);
    setIsOpen(true);
  };

  return (
    <div className="relative w-full max-w-md">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Rechercher un artisan, un service, un article..."
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          onFocus={() => query.length > 1 && setIsOpen(true)}
          className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-10 text-sm placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
        />
        {query && (
          <button
            onClick={() => { setQuery(""); setResults([]); setIsOpen(false); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {isOpen && results.length > 0 && (
        <div className="absolute top-full mt-2 w-full rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900 z-50">
          {results.map((result, index) => (
            <Link
              key={index}
              href={result.href}
              onClick={() => { setIsOpen(false); setQuery(""); }}
              className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-lg dark:bg-slate-800">
                {result.type === "business" ? "🏪" : result.type === "blog" ? "📝" : "🔧"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-900 dark:text-slate-100 truncate">{result.title}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{result.subtitle}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
