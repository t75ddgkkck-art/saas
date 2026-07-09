"use client";

import { useState } from "react";
import { Monitor, Smartphone, ExternalLink, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Aperçu live de la vitrine dans un iframe.
 * Basculement desktop/mobile pour tester le responsive.
 * Le bouton "Actualiser" force un rechargement quand l'utilisateur a
 * sauvegardé un changement (l'iframe ne se re-render pas seule).
 */
export function VitrinePreview({
  slug,
  className,
}: {
  slug: string;
  className?: string;
}) {
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [reloadKey, setReloadKey] = useState(0);

  const src = `/${slug}?preview=1`;
  const fullUrl = `/${slug}`;

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900",
        className
      )}
    >
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2 dark:border-slate-800 dark:bg-slate-800/50">
        <div
          role="tablist"
          aria-label="Choisir la taille d'écran d'aperçu"
          className="inline-flex items-center gap-1 rounded-lg bg-white p-1 dark:bg-slate-900"
        >
          <button
            role="tab"
            aria-selected={device === "desktop"}
            onClick={() => setDevice("desktop")}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              device === "desktop"
                ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
            )}
          >
            <Monitor className="h-3.5 w-3.5" aria-hidden="true" />
            Desktop
          </button>
          <button
            role="tab"
            aria-selected={device === "mobile"}
            onClick={() => setDevice("mobile")}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              device === "mobile"
                ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
            )}
          >
            <Smartphone className="h-3.5 w-3.5" aria-hidden="true" />
            Mobile
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setReloadKey((k) => k + 1)}
            aria-label="Actualiser l'aperçu"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
          </button>
          <a
            href={fullUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Ouvrir la vitrine dans un nouvel onglet"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
          </a>
        </div>
      </div>

      {/* Viewport */}
      <div className="flex min-h-[560px] items-start justify-center overflow-auto bg-slate-100 p-4 dark:bg-slate-800">
        <div
          className={cn(
            "overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm transition-all dark:border-slate-700",
            device === "mobile" ? "w-[375px]" : "w-full max-w-[1200px]"
          )}
          style={{ height: 560 }}
        >
          <iframe
            key={reloadKey}
            src={src}
            title="Aperçu vitrine"
            className="h-full w-full border-0"
            // Sandbox : pas de top-navigation, mais on autorise les scripts
            // pour que la vitrine reste interactive.
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
          />
        </div>
      </div>
    </div>
  );
}
