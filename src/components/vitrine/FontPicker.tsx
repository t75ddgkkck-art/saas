/**
 * Lot 37 — <FontPicker> : sélecteur de police pour la vitrine.
 * Grille avec preview visuel de la font (le nom rendu dans la font elle-même).
 */

"use client";

import { useMemo } from "react";
import { Check } from "lucide-react";
import { FONT_OPTIONS, type FontOption } from "@/lib/vitrine-personalization";

interface FontPickerProps {
  value: string | null | undefined;
  onChange: (fontId: string) => void;
}

const CATEGORY_LABELS: Record<FontOption["category"], string> = {
  "sans-serif": "Sans-serif",
  serif: "Serif",
  display: "Display",
  monospace: "Monospace",
};

export function FontPicker({ value, onChange }: FontPickerProps) {
  const selected = value ?? "inter";
  const groups = useMemo(() => {
    const map = new Map<FontOption["category"], FontOption[]>();
    for (const f of FONT_OPTIONS) {
      const arr = map.get(f.category) ?? [];
      arr.push(f);
      map.set(f.category, arr);
    }
    return Array.from(map.entries());
  }, []);

  return (
    <div className="space-y-5">
      {groups.map(([cat, fonts]) => (
        <div key={cat}>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            {CATEGORY_LABELS[cat]}
          </h4>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {fonts.map((f) => {
              const active = selected === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => onChange(f.id)}
                  aria-pressed={active}
                  className={`flex flex-col items-start rounded-lg border-2 p-3 text-left transition ${
                    active
                      ? "border-slate-900 dark:border-white shadow-md"
                      : "border-slate-200 dark:border-slate-700 hover:border-slate-400"
                  }`}
                >
                  <div className="flex w-full items-baseline justify-between">
                    <p
                      className="text-lg font-semibold text-slate-900 dark:text-white"
                      style={{ fontFamily: f.stack }}
                    >
                      {f.label}
                    </p>
                    {active && (
                      <span className="rounded-full bg-emerald-500 p-0.5 text-white">
                        <Check className="h-3 w-3" aria-hidden />
                      </span>
                    )}
                  </div>
                  <p
                    className="mt-1 text-xs text-slate-500 dark:text-slate-400"
                    style={{ fontFamily: f.stack }}
                  >
                    Aa Bb Cc — L&apos;artisan du numérique
                  </p>
                  <p className="mt-1 text-[10px] text-slate-400">{f.description}</p>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
