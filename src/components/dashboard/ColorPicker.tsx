"use client";

import { useMemo } from "react";
import { Check, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Color picker avec suggestions professionnelles + vérif contraste WCAG AA
 * pour éviter que le pro choisisse une couleur illisible.
 */

// Palettes soigneusement choisies : contraste texte blanc OK (WCAG AA 4.5:1)
const SUGGESTED_COLORS: { name: string; value: string }[] = [
  { name: "Bleu marine", value: "#0f172a" },
  { name: "Indigo", value: "#3730a3" },
  { name: "Bleu roi", value: "#1d4ed8" },
  { name: "Émeraude", value: "#047857" },
  { name: "Forêt", value: "#166534" },
  { name: "Bordeaux", value: "#991b1b" },
  { name: "Orange", value: "#c2410c" },
  { name: "Violet", value: "#6d28d9" },
  { name: "Rose", value: "#be185d" },
  { name: "Slate", value: "#475569" },
];

/**
 * Ratio de contraste WCAG (relative luminance).
 * Retourne 1 (identique) à 21 (noir/blanc).
 */
function contrastRatio(hex: string, against = "#ffffff"): number {
  const parse = (h: string): [number, number, number] => {
    const c = h.replace("#", "");
    return [
      parseInt(c.slice(0, 2), 16),
      parseInt(c.slice(2, 4), 16),
      parseInt(c.slice(4, 6), 16),
    ];
  };
  const luminance = (rgb: [number, number, number]): number => {
    const [r, g, b] = rgb.map((v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    }) as [number, number, number];
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  try {
    const l1 = luminance(parse(hex));
    const l2 = luminance(parse(against));
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
  } catch {
    return 1;
  }
}

export interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  label?: string;
  className?: string;
}

export function ColorPicker({ value, onChange, label = "Couleur principale", className }: ColorPickerProps) {
  const isValid = /^#[0-9a-fA-F]{6}$/.test(value);
  const contrast = useMemo(() => (isValid ? contrastRatio(value, "#ffffff") : 1), [value, isValid]);
  const hasWarning = isValid && contrast < 4.5;

  const handleHexChange = (raw: string) => {
    let v = raw.trim();
    if (v && !v.startsWith("#")) v = "#" + v;
    onChange(v.toUpperCase());
  };

  return (
    <div className={cn("space-y-3", className)}>
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
        {label}
      </label>

      {/* Ligne : color + input hex + preview badge */}
      <div className="flex items-center gap-3">
        <input
          type="color"
          value={isValid ? value : "#0f172a"}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          aria-label="Sélecteur de couleur"
          className="h-11 w-14 cursor-pointer rounded-lg border border-slate-200 bg-transparent p-0.5 dark:border-slate-700"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => handleHexChange(e.target.value)}
          maxLength={7}
          placeholder="#0f172a"
          aria-label="Code hexadécimal"
          aria-invalid={!isValid}
          className={cn(
            "h-11 w-32 rounded-lg border bg-white px-3 font-mono text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 dark:bg-slate-900 dark:text-slate-100",
            isValid
              ? "border-slate-200 dark:border-slate-700"
              : "border-red-300 dark:border-red-800"
          )}
        />
        {isValid && (
          <div
            className="flex h-11 flex-1 items-center gap-2 rounded-lg px-4 text-sm font-medium text-white shadow-sm"
            style={{ background: value }}
            aria-label="Aperçu de la couleur"
          >
            <span className="opacity-90">Aperçu bouton</span>
          </div>
        )}
      </div>

      {/* Vérification de contraste */}
      {hasWarning && (
        <div
          className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-300"
          role="alert"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-medium">Contraste faible ({contrast.toFixed(1)}:1)</p>
            <p className="mt-0.5 text-xs">
              Le texte blanc sera peu lisible sur ce fond. Recommandé : au moins 4.5:1.
            </p>
          </div>
        </div>
      )}

      {/* Palette suggérée */}
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-400">
          Palette suggérée (bonne lisibilité)
        </p>
        <div className="flex flex-wrap gap-2">
          {SUGGESTED_COLORS.map((c) => {
            const selected = value.toLowerCase() === c.value.toLowerCase();
            return (
              <button
                key={c.value}
                type="button"
                onClick={() => onChange(c.value.toUpperCase())}
                aria-label={`Choisir ${c.name}`}
                aria-pressed={selected}
                title={`${c.name} — ${c.value}`}
                style={{ background: c.value }}
                className={cn(
                  "relative h-9 w-9 rounded-lg border-2 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-slate-400",
                  selected
                    ? "border-slate-900 shadow-md dark:border-white"
                    : "border-white/60 dark:border-slate-700"
                )}
              >
                {selected && (
                  <Check
                    className="absolute inset-0 m-auto h-4 w-4 text-white drop-shadow"
                    aria-hidden="true"
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
