/**
 * F2 (Lot 30) — Éditeur inline d'acompte pour un service.
 *
 * S'insère sous la ligne "nom + prix + description" d'un service.
 * Replié par défaut, s'ouvre au clic sur "Configurer un acompte".
 * Gaté sur l'entitlement `payments.stripe` : les users Free voient un lien
 * discret vers l'upgrade au lieu du formulaire.
 */

"use client";

import { useState } from "react";
import { CreditCard, ChevronDown, ChevronUp, Lock } from "lucide-react";
import Link from "next/link";
import { useEntitlement } from "@/hooks/useEntitlement";
import { computeDepositCents, formatCentsEur } from "@/lib/deposit";

interface ServiceDepositEditorProps {
  priceCents: number | null | undefined;
  depositType: "fixed" | "percent" | null | undefined;
  depositAmount: number | null | undefined;
  onChange: (patch: {
    priceCents?: number | null;
    depositType?: "fixed" | "percent" | null;
    depositAmount?: number | null;
  }) => void;
}

export function ServiceDepositEditor(props: ServiceDepositEditorProps) {
  const { allowed, loading } = useEntitlement("payments.stripe");
  const [open, setOpen] = useState(Boolean(props.depositType));

  // Preview du montant calculé, mis à jour à chaque changement
  const previewCents = computeDepositCents({
    priceCents: props.priceCents,
    depositType: props.depositType,
    depositAmount: props.depositAmount,
  });

  if (loading) return null;

  if (!allowed) {
    return (
      <div className="mt-2 flex items-center justify-between rounded-lg bg-slate-100 dark:bg-slate-800/60 px-3 py-2 text-xs">
        <span className="flex items-center gap-1.5 text-slate-500">
          <Lock className="h-3 w-3" aria-hidden />
          Acompte à la réservation
        </span>
        <Link
          href="/pricing?from=payments.stripe"
          className="font-medium text-indigo-600 hover:underline dark:text-indigo-400"
        >
          Passer au plan Pro
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-lg"
      >
        <span className="flex items-center gap-1.5">
          <CreditCard className="h-3.5 w-3.5" aria-hidden />
          Acompte à la réservation
          {previewCents > 0 && (
            <span className="ml-1 rounded-full bg-emerald-100 dark:bg-emerald-900/40 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
              {formatCentsEur(previewCents)}
            </span>
          )}
        </span>
        {open ? (
          <ChevronUp className="h-3.5 w-3.5" aria-hidden />
        ) : (
          <ChevronDown className="h-3.5 w-3.5" aria-hidden />
        )}
      </button>

      {open && (
        <div className="border-t border-slate-100 dark:border-slate-800 space-y-2 px-3 py-3">
          {/* Prix en euros pour référence — converti en centimes en interne */}
          <label className="block">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
              Prix du service (€) — obligatoire pour un acompte en %
            </span>
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="Ex : 80.00"
              value={
                props.priceCents !== null && props.priceCents !== undefined
                  ? (props.priceCents / 100).toFixed(2)
                  : ""
              }
              onChange={(e) => {
                const v = e.target.value.trim();
                if (v === "") {
                  props.onChange({ priceCents: null });
                } else {
                  const euros = parseFloat(v);
                  if (!isNaN(euros) && euros >= 0) {
                    props.onChange({ priceCents: Math.round(euros * 100) });
                  }
                }
              }}
              className="mt-1 w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm text-slate-900 dark:text-slate-100"
            />
          </label>

          <div className="grid grid-cols-2 gap-2">
            {/* Type d'acompte */}
            <label className="block">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Type</span>
              <select
                value={props.depositType ?? ""}
                onChange={(e) => {
                  const v = e.target.value as "fixed" | "percent" | "";
                  props.onChange({
                    depositType: v === "" ? null : v,
                    depositAmount: v === "" ? null : (props.depositAmount ?? null),
                  });
                }}
                className="mt-1 w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm text-slate-900 dark:text-slate-100"
              >
                <option value="">Aucun acompte</option>
                <option value="fixed">Montant fixe (€)</option>
                <option value="percent">Pourcentage du prix (%)</option>
              </select>
            </label>

            {/* Montant */}
            <label className="block">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                {props.depositType === "percent" ? "% (1-100)" : "Montant (€)"}
              </span>
              <input
                type="number"
                min="0"
                max={props.depositType === "percent" ? 100 : undefined}
                step={props.depositType === "percent" ? 1 : 0.01}
                placeholder={props.depositType === "percent" ? "20" : "10.00"}
                disabled={!props.depositType}
                value={
                  props.depositAmount !== null && props.depositAmount !== undefined
                    ? props.depositType === "percent"
                      ? props.depositAmount
                      : (props.depositAmount / 100).toFixed(2)
                    : ""
                }
                onChange={(e) => {
                  const v = e.target.value.trim();
                  if (v === "") {
                    props.onChange({ depositAmount: null });
                    return;
                  }
                  const num = parseFloat(v);
                  if (isNaN(num) || num < 0) return;
                  // Percent : on stocke directement 0-100
                  // Fixed : on convertit € → centimes
                  props.onChange({
                    depositAmount:
                      props.depositType === "percent" ? Math.round(num) : Math.round(num * 100),
                  });
                }}
                className="mt-1 w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm text-slate-900 dark:text-slate-100 disabled:opacity-50"
              />
            </label>
          </div>

          {previewCents > 0 && (
            <p className="rounded bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1.5 text-xs text-emerald-700 dark:text-emerald-300">
              → Le client paiera <strong>{formatCentsEur(previewCents)}</strong> pour réserver ce
              créneau.
            </p>
          )}
          {props.depositType === "percent" &&
            (props.priceCents === null ||
              props.priceCents === undefined ||
              props.priceCents === 0) && (
              <p className="rounded bg-amber-50 dark:bg-amber-900/20 px-2 py-1.5 text-xs text-amber-700 dark:text-amber-300">
                ⚠️ Pour un acompte en %, remplissez d&apos;abord le prix du service.
              </p>
            )}
        </div>
      )}
    </div>
  );
}
