/**
 * F6 (Lot 34) — Onglet Notifications dans les settings.
 *
 * Trois blocs :
 *  1. Activation push OS (bouton subscribe/unsubscribe)
 *  2. Mode "Do Not Disturb" (créneau silencieux)
 *  3. Événements désactivés (checkboxes par type)
 */

"use client";

import { useEffect, useState } from "react";
import { Bell, Moon, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { PushSubscribeButton } from "@/components/notifications/PushSubscribeButton";

// Liste UI-friendly des types notifs (aligné avec `src/lib/notify.ts`)
// Grouped par domaine pour la lisibilité.
const NOTIF_GROUPS: { label: string; items: { type: string; label: string }[] }[] = [
  {
    label: "Rendez-vous",
    items: [
      { type: "appointment.created", label: "Nouveau rendez-vous" },
      { type: "appointment.cancelled_by_client", label: "Annulation client" },
      { type: "appointment.no_show_detected", label: "Client absent (no-show)" },
    ],
  },
  {
    label: "Paiements",
    items: [
      { type: "payment.received", label: "Paiement reçu" },
      { type: "deposit.paid", label: "Acompte payé" },
      { type: "deposit.refunded", label: "Acompte remboursé" },
      { type: "invoice.overdue", label: "Facture en retard" },
    ],
  },
  {
    label: "Devis",
    items: [
      { type: "quote.received", label: "Demande de devis" },
      { type: "quote.accepted", label: "Devis accepté" },
      { type: "quote.declined", label: "Devis refusé" },
    ],
  },
  {
    label: "Avis clients",
    items: [{ type: "review.received", label: "Nouvel avis" }],
  },
  {
    label: "Équipe",
    items: [
      { type: "team.invitation_accepted", label: "Invitation acceptée" },
      { type: "team.member_left", label: "Membre parti" },
    ],
  },
];

interface Prefs {
  disabledTypes: string[];
  disabledChannels: string[];
  dndStart: string | null;
  dndEnd: string | null;
}

export function NotificationsTab() {
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  useEffect(() => {
    void fetch("/api/account/notification-preferences")
      .then((r) => r.json())
      .then((data) => setPrefs(data));
  }, []);

  async function save() {
    if (!prefs) return;
    setSaving(true);
    try {
      const res = await fetch("/api/account/notification-preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prefs),
      });
      if (!res.ok) {
        toast.error("Erreur lors de la sauvegarde");
        return;
      }
      toast.success("Préférences enregistrées");
    } finally {
      setSaving(false);
    }
  }

  function toggleType(type: string) {
    if (!prefs) return;
    const disabled = new Set(prefs.disabledTypes);
    if (disabled.has(type)) disabled.delete(type);
    else disabled.add(type);
    setPrefs({ ...prefs, disabledTypes: Array.from(disabled) });
  }

  if (!prefs) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Chargement…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Bloc 1 : Push OS */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5">
        <div className="mb-3 flex items-center gap-2">
          <Bell className="h-4 w-4 text-slate-500" aria-hidden />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            Notifications push
          </h3>
        </div>
        <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
          Recevez les notifications directement sur votre appareil (bureau ou mobile), même quand
          Vitrix n&apos;est pas ouvert.
        </p>
        <PushSubscribeButton />
      </section>

      {/* Bloc 2 : DND */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5">
        <div className="mb-3 flex items-center gap-2">
          <Moon className="h-4 w-4 text-slate-500" aria-hidden />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Ne pas déranger</h3>
        </div>
        <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
          Créneau horaire pendant lequel les push OS sont mises en sourdine. Les notifications
          restent visibles dans la cloche 🔔 du dashboard.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-xs text-slate-600 dark:text-slate-300">
            De
            <input
              type="time"
              value={prefs.dndStart ?? ""}
              onChange={(e) => setPrefs({ ...prefs, dndStart: e.target.value || null })}
              className="ml-2 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-sm"
            />
          </label>
          <label className="text-xs text-slate-600 dark:text-slate-300">
            À
            <input
              type="time"
              value={prefs.dndEnd ?? ""}
              onChange={(e) => setPrefs({ ...prefs, dndEnd: e.target.value || null })}
              className="ml-2 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-sm"
            />
          </label>
          {(prefs.dndStart || prefs.dndEnd) && (
            <button
              type="button"
              onClick={() => setPrefs({ ...prefs, dndStart: null, dndEnd: null })}
              className="text-xs text-red-600 hover:underline dark:text-red-400"
            >
              Désactiver
            </button>
          )}
        </div>
      </section>

      {/* Bloc 3 : Événements */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5">
        <h3 className="mb-1 text-sm font-semibold text-slate-900 dark:text-white">
          Événements notifiés
        </h3>
        <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
          Décochez les événements que vous ne voulez pas recevoir.
        </p>
        <div className="space-y-5">
          {NOTIF_GROUPS.map((group) => (
            <div key={group.label}>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                {group.label}
              </h4>
              <ul className="space-y-1.5">
                {group.items.map((item) => {
                  const enabled = !prefs.disabledTypes.includes(item.type);
                  return (
                    <li key={item.type}>
                      <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                        <input
                          type="checkbox"
                          checked={enabled}
                          onChange={() => toggleType(item.type)}
                          className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-500"
                        />
                        {item.label}
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <div className="flex justify-end">
        <Button onClick={save} loading={saving}>
          <Save className="mr-2 h-4 w-4" aria-hidden />
          Enregistrer
        </Button>
      </div>
    </div>
  );
}
