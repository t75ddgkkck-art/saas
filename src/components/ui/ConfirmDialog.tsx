"use client";

/**
 * ConfirmDialog réutilisable (Lot 22).
 *
 * Remplace tous les `window.confirm()` natifs qui :
 *  - Bloquent le thread JS (mauvais UX)
 *  - N'ont pas de style dark mode
 *  - Ne sont pas accessibles à distance (screen reader dépend du navigateur)
 *  - Ne permettent pas de mettre un CTA rouge pour danger
 *
 * Usage direct (contrôlé) :
 *   const [open, setOpen] = useState(false);
 *   <ConfirmDialog
 *     isOpen={open}
 *     onClose={() => setOpen(false)}
 *     onConfirm={async () => { await doIt(); }}
 *     title="Supprimer ce RDV ?"
 *     description="Récupérable 30 jours."
 *     variant="danger"
 *     confirmLabel="Supprimer"
 *   />
 *
 * Usage via hook (impératif) — voir useConfirm() ci-dessous.
 */

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { AlertTriangle, Info } from "lucide-react";

export type ConfirmVariant = "danger" | "info";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description?: string;
  variant?: ConfirmVariant;
  confirmLabel?: string;
  cancelLabel?: string;
  /**
   * Si défini, l'utilisateur doit taper EXACTEMENT cette valeur avant que
   * le bouton "confirmer" ne soit actif. Utile pour actions destructrices
   * (suppression compte, ban admin…). Ex : "SUPPRIMER".
   */
  requireTypedConfirmation?: string;
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  variant = "info",
  confirmLabel = "Confirmer",
  cancelLabel = "Annuler",
  requireTypedConfirmation,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [typed, setTyped] = useState("");
  const requiresTyping = Boolean(requireTypedConfirmation);
  const canConfirm = !requiresTyping || typed === requireTypedConfirmation;

  const handleConfirm = async () => {
    if (!canConfirm) return;
    setBusy(true);
    try {
      await onConfirm();
      // Reset input pour le prochain usage
      setTyped("");
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const Icon = variant === "danger" ? AlertTriangle : Info;
  const iconTone =
    variant === "danger"
      ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
      : "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400";

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="" size="sm">
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${iconTone}`}
            aria-hidden="true"
          >
            <Icon className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              {title}
            </h2>
            {description && (
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{description}</p>
            )}
          </div>
        </div>

        {requiresTyping && (
          <div>
            <label
              htmlFor="confirm-typed-input"
              className="mb-1 block text-sm text-slate-700 dark:text-slate-300"
            >
              Tapez <strong>{requireTypedConfirmation}</strong> pour confirmer
            </label>
            <input
              id="confirm-typed-input"
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoFocus
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-slate-700"
            />
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button
            variant={variant === "danger" ? "destructive" : "primary"}
            onClick={handleConfirm}
            loading={busy}
            disabled={!canConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
