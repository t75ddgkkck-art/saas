/**
 * Lot 37 — <PresetPicker> : sélecteur de preset couleurs par métier.
 * Grille compacte avec preview visuel des 3 couleurs, groupée par catégorie.
 */

"use client";

import { useMemo } from "react";
import { Check } from "lucide-react";
import { COLOR_PRESETS, type ColorPreset } from "@/lib/vitrine-personalization";

interface PresetPickerProps {
  /** ID du preset actuel (ou null si custom). */
  currentPresetId?: string | null;
  /** Couleurs actuelles pour matcher automatiquement (fallback). */
  primary?: string | null;
  onSelect: (preset: ColorPreset) => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  batiment: "Bâtiment",
  beaute: "Beauté & bien-être",
  restauration: "Restauration",
  juridique: "Services professionnels",
  sport: "Sport & coaching",
  creatif: "Créatifs",
  autre: "Autre",
};

export function PresetPicker({ currentPresetId, primary, onSelect }: PresetPickerProps) {
  // Groupe par catégorie
  const groups = useMemo(() => {
    const map = new Map<string, ColorPreset[]>();
    for (const p of COLOR_PRESETS) {
      const arr = map.get(p.category) ?? [];
      arr.push(p);
      map.set(p.category, arr);
    }
    return Array.from(map.entries());
  }, []);

  // Matching automatique : si pas de currentPresetId, matche par couleur primary
  const selectedId = useMemo(() => {
    if (currentPresetId) return currentPresetId;
    if (!primary) return null;
    const match = COLOR_PRESETS.find((p) => p.primary.toLowerCase() === primary.toLowerCase());
    return match?.id ?? null;
  }, [currentPresetId, primary]);

  return (
    <div className="space-y-5">
      {groups.map(([category, presets]) => (
        <div key={category}>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            {CATEGORY_LABELS[category] ?? category}
          </h4>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {presets.map((p) => {
              const active = selectedId === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onSelect(p)}
                  aria-pressed={active}
                  aria-label={`Preset ${p.label}`}
                  className={`group relative flex flex-col items-start rounded-lg border-2 p-3 text-left transition ${
                    active
                      ? "border-slate-900 dark:border-white shadow-md"
                      : "border-slate-200 dark:border-slate-700 hover:border-slate-400"
                  }`}
                >
                  <div className="mb-2 flex items-center gap-1">
                    <span className="text-lg" aria-hidden>
                      {p.emoji}
                    </span>
                    {active && (
                      <span className="ml-auto rounded-full bg-emerald-500 p-0.5 text-white">
                        <Check className="h-3 w-3" aria-hidden />
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-medium text-slate-900 dark:text-white leading-tight">
                    {p.label}
                  </p>
                  {/* 3 pastilles couleurs */}
                  <div className="mt-2 flex gap-1">
                    <span
                      className="h-4 w-4 rounded-full border border-slate-200 dark:border-slate-700"
                      style={{ backgroundColor: p.primary }}
                      aria-hidden
                    />
                    <span
                      className="h-4 w-4 rounded-full border border-slate-200 dark:border-slate-700"
                      style={{ backgroundColor: p.secondary }}
                      aria-hidden
                    />
                    <span
                      className="h-4 w-4 rounded-full border border-slate-200 dark:border-slate-700"
                      style={{ backgroundColor: p.accent }}
                      aria-hidden
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
