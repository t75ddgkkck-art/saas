"use client";

/**
 * Lot 53 (F15) — Toggle opt-in/out du digest email hebdomadaire.
 *
 * Intégré à /dashboard/settings/notifications. Le flag DB
 * (`users.weekly_digest_enabled`) est checké par le cron avant chaque envoi.
 *
 * UX :
 *  - Fetch initial GET /api/account/weekly-digest → toggle state
 *  - Toggle → PATCH direct (pas de "Save" séparé, pattern optimistic UI)
 *  - Rollback local si l'API échoue
 *  - Affiche la date du dernier envoi si dispo
 */

import { useEffect, useState } from "react";
import { Mail, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/Toast";

export function WeeklyDigestToggle() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [lastSentAt, setLastSentAt] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  useEffect(() => {
    fetch("/api/account/weekly-digest")
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) {
          setEnabled(data.enabled);
          setLastSentAt(data.lastSentAt ?? null);
        }
      })
      .catch(() => {
        // Silencieux — le composant reste dans l'état skeleton
      });
  }, []);

  const handleToggle = async () => {
    if (enabled === null || saving) return;
    const newValue = !enabled;
    // Optimistic update
    setEnabled(newValue);
    setSaving(true);
    try {
      const res = await fetch("/api/account/weekly-digest", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: newValue }),
      });
      const data = await res.json();
      if (!data.ok) {
        // Rollback
        setEnabled(!newValue);
        toast.error("Impossible de mettre à jour votre préférence");
      } else {
        toast.success(newValue ? "Digest activé" : "Digest désactivé");
      }
    } catch {
      setEnabled(!newValue);
      toast.error("Erreur réseau");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
          <Mail className="h-4 w-4" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            Récap email hebdomadaire
          </h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Chaque dimanche soir, un email avec votre activité de la semaine (visites, RDV,
            devis, encaissements) + les actions à mener.
          </p>
          {lastSentAt && (
            <p className="mt-1.5 text-[10px] text-slate-400">
              Dernier envoi : {new Date(lastSentAt).toLocaleDateString("fr-FR")}
            </p>
          )}
        </div>

        {/* Toggle switch */}
        {enabled === null ? (
          <Loader2 className="h-5 w-5 animate-spin text-slate-400" aria-label="Chargement" />
        ) : (
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            aria-label="Activer ou désactiver le récap hebdomadaire"
            onClick={handleToggle}
            disabled={saving}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
              enabled ? "bg-indigo-600" : "bg-slate-300 dark:bg-slate-700"
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                enabled ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </button>
        )}
      </div>
    </section>
  );
}
