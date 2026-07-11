/**
 * F6 (Lot 35) — <QuickPaymentModal> : encaissement 1 clic depuis un RDV.
 *
 * UI minimaliste terrain :
 *  - Grand input numeric montant (grand écran mobile → clavier numérique)
 *  - 4 boutons méthode (Espèces / CB terminal / Chèque / Virement)
 *  - Toggle "Marquer aussi terminé" (défaut ON)
 *  - Note optionnelle (petit texte)
 *  - CTA "Encaisser" grand vert
 */

"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { Banknote, CreditCard, FileText, Building2 } from "lucide-react";

type Method = "cash" | "card_terminal" | "cheque" | "transfer";

const METHODS: { id: Method; label: string; icon: typeof Banknote }[] = [
  { id: "cash", label: "Espèces", icon: Banknote },
  { id: "card_terminal", label: "CB terminal", icon: CreditCard },
  { id: "cheque", label: "Chèque", icon: FileText },
  { id: "transfer", label: "Virement", icon: Building2 },
];

interface QuickPaymentModalProps {
  appointmentId: string;
  appointmentTitle: string;
  suggestedAmount?: number;
  onSuccess: () => void;
  onClose: () => void;
}

export function QuickPaymentModal({
  appointmentId,
  appointmentTitle,
  suggestedAmount,
  onSuccess,
  onClose,
}: QuickPaymentModalProps) {
  const [amount, setAmount] = useState<string>(suggestedAmount ? suggestedAmount.toFixed(2) : "");
  const [method, setMethod] = useState<Method>("cash");
  const [alsoComplete, setAlsoComplete] = useState(true);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const toast = useToast();

  const parsedAmount = parseFloat(amount.replace(",", "."));
  const isValid = Number.isFinite(parsedAmount) && parsedAmount > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/appointments/${appointmentId}/quick-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parsedAmount,
          method,
          type: "full",
          note: note.trim() || undefined,
          alsoComplete,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Erreur");
        return;
      }
      toast.success(`Paiement encaissé : ${parsedAmount.toFixed(2)} €`);
      onSuccess();
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal isOpen onClose={onClose} title="Encaisser un paiement" description={appointmentTitle}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Montant en grand */}
        <label className="block">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Montant reçu
          </span>
          <div className="relative mt-1">
            <input
              type="text"
              inputMode="decimal"
              autoFocus
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0,00"
              className="w-full rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 pl-4 pr-12 py-4 text-3xl font-bold text-slate-900 dark:text-white focus:border-emerald-500 focus:outline-none"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-2xl font-semibold text-slate-400">
              €
            </span>
          </div>
        </label>

        {/* Méthode */}
        <div>
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Méthode</span>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {METHODS.map((m) => {
              const Icon = m.icon;
              const selected = method === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMethod(m.id)}
                  className={`flex items-center gap-2 rounded-lg border-2 px-3 py-3 text-sm font-medium transition ${
                    selected
                      ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200"
                      : "border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden />
                  <span>{m.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Note optionnelle (repliée par défaut, dépliée si clic) */}
        <details className="text-sm">
          <summary className="cursor-pointer text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
            Ajouter une note (optionnel)
          </summary>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            placeholder="Ex : Reçu N°123, chèque n°456…"
            className="mt-2 w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2"
          />
        </details>

        {/* Toggle "marquer terminé" */}
        <label className="flex cursor-pointer items-center gap-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 p-3">
          <input
            type="checkbox"
            checked={alsoComplete}
            onChange={(e) => setAlsoComplete(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
          />
          <span className="text-sm text-slate-700 dark:text-slate-300">
            Marquer aussi le rendez-vous comme <strong>terminé</strong>
          </span>
        </label>

        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onClose} className="flex-1">
            Annuler
          </Button>
          <Button
            type="submit"
            loading={submitting}
            disabled={!isValid}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700"
          >
            Encaisser {isValid && `${parsedAmount.toFixed(2)} €`}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
