"use client";

/**
 * useConfirm() — hook impératif pour ConfirmDialog (Lot 22).
 *
 * Objectif : remplacer `window.confirm()` par un vrai dialog UX pro,
 * SANS obliger l'appelant à gérer manuellement `useState<boolean>` + JSX.
 *
 * Usage :
 *   const { confirm, dialog } = useConfirm();
 *
 *   async function handleDelete() {
 *     const ok = await confirm({
 *       title: "Supprimer ?",
 *       description: "Récupérable 30 jours",
 *       variant: "danger",
 *       confirmLabel: "Supprimer",
 *     });
 *     if (!ok) return;
 *     await doDelete();
 *   }
 *
 *   return (
 *     <>
 *       {...JSX...}
 *       {dialog}
 *     </>
 *   );
 *
 * `dialog` doit être rendu quelque part dans le composant. Il est invisible
 * tant que `confirm()` n'est pas appelé. Une seule instance par composant
 * suffit — chaque appel remplace le précédent (les vieux résolvent à `false`).
 */

import { useCallback, useRef, useState } from "react";
import { ConfirmDialog, type ConfirmVariant } from "@/components/ui/ConfirmDialog";

interface ConfirmOptions {
  title: string;
  description?: string;
  variant?: ConfirmVariant;
  confirmLabel?: string;
  cancelLabel?: string;
  requireTypedConfirmation?: string;
}

export function useConfirm() {
  const [state, setState] = useState<ConfirmOptions | null>(null);
  // Le resolver pending — un seul dialog à la fois.
  const resolverRef = useRef<((ok: boolean) => void) | null>(null);

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    // Résout l'ancien à false si on ouvre un nouveau dialog par-dessus
    resolverRef.current?.(false);
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      setState(opts);
    });
  }, []);

  const close = useCallback((result: boolean) => {
    const r = resolverRef.current;
    resolverRef.current = null;
    setState(null);
    r?.(result);
  }, []);

  const dialog = state ? (
    <ConfirmDialog
      isOpen={true}
      onClose={() => close(false)}
      onConfirm={() => close(true)}
      title={state.title}
      description={state.description}
      variant={state.variant}
      confirmLabel={state.confirmLabel}
      cancelLabel={state.cancelLabel}
      requireTypedConfirmation={state.requireTypedConfirmation}
    />
  ) : null;

  return { confirm, dialog };
}
