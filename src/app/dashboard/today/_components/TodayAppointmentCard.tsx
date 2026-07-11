/**
 * F6 (Lot 35) — <TodayAppointmentCard> : carte RDV terrain grande zone tap.
 *
 * Design mobile-first : boutons 44×44px min (Apple HIG).
 * Actions rapides :
 *  - 📞 Appeler (tel:) — deep link OS
 *  - 💬 WhatsApp (wa.me/) — deep link app
 *  - 🗺️  Itinéraire (geo:) — Apple Maps sur iOS, Google Maps sur Android/Desktop
 *  - 🚚 En route / 🏠 Arrivé / ✅ Terminé — transitions state machine
 *  - 💰 Encaisser — ouvre QuickPaymentModal
 *  - 🎤 Note vocale — VoiceNote inline
 *  - ❌ No-show (uniquement si status en_route/confirmed)
 *
 * Le composant est LOCAL — le refetch parent gère la mise à jour de la liste.
 */

"use client";

import { useState } from "react";
import {
  Phone,
  MessageCircle,
  Navigation,
  Play,
  MapPin,
  CheckCircle2,
  UserX,
  DollarSign,
  Loader2,
} from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/useConfirm";
import { QuickPaymentModal } from "./QuickPaymentModal";
import { VoiceNote } from "./VoiceNote";
import type { AppointmentStatus } from "@/lib/appointment-status";
import { STATUS_LABELS } from "@/lib/appointment-status";

export interface TodayAppointment {
  id: string;
  title: string;
  description: string | null;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string;
  status: AppointmentStatus;
  clientId: string | null;
  clientFirstName: string | null;
  clientLastName: string | null;
  clientPhone: string | null;
  clientAddress?: string | null;
}

interface Props {
  appointment: TodayAppointment;
  onChanged: () => void;
}

const STATUS_STYLE: Record<AppointmentStatus, string> = {
  pending: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200",
  confirmed: "bg-blue-100 text-blue-900 dark:bg-blue-900/40 dark:text-blue-200",
  en_route: "bg-indigo-100 text-indigo-900 dark:bg-indigo-900/40 dark:text-indigo-200",
  in_progress: "bg-purple-100 text-purple-900 dark:bg-purple-900/40 dark:text-purple-200",
  completed: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200",
  no_show: "bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-200",
  cancelled: "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
};

/**
 * URL deep-link pour l'app maps native selon l'OS.
 * iOS/macOS → Apple Maps (maps://) sinon Google Maps.
 */
function buildMapsUrl(address: string): string {
  const encoded = encodeURIComponent(address);
  if (typeof navigator !== "undefined" && /iPad|iPhone|iPod|Macintosh/.test(navigator.userAgent)) {
    return `maps://?daddr=${encoded}`;
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${encoded}`;
}

/**
 * URL wa.me pour ouvrir WhatsApp avec numéro pré-rempli.
 * Format international attendu (sans + ni espaces).
 */
function buildWhatsAppUrl(phone: string): string {
  const cleaned = phone.replace(/[^\d]/g, "");
  return `https://wa.me/${cleaned}`;
}

export function TodayAppointmentCard({ appointment: apt, onChanged }: Props) {
  const [showPayment, setShowPayment] = useState(false);
  const [showVoice, setShowVoice] = useState(false);
  const [transitioning, setTransitioning] = useState<AppointmentStatus | null>(null);
  const toast = useToast();
  const { confirm, dialog } = useConfirm();

  const clientName = [apt.clientFirstName, apt.clientLastName].filter(Boolean).join(" ").trim();
  const isFinished =
    apt.status === "completed" || apt.status === "cancelled" || apt.status === "no_show";

  async function transition(next: AppointmentStatus) {
    setTransitioning(next);
    try {
      const res = await fetch(`/api/appointments/${apt.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Transition impossible");
        return;
      }
      toast.success(`Statut : ${STATUS_LABELS[next]}`);
      onChanged();
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setTransitioning(null);
    }
  }

  async function handleNoShow() {
    const ok = await confirm({
      title: "Marquer comme absent ?",
      description:
        "Le client sera compté comme no-show (compteur incrémenté). Une action irréversible.",
      confirmLabel: "Oui, absent",
      cancelLabel: "Annuler",
      variant: "danger",
    });
    if (ok) await transition("no_show");
  }

  return (
    <>
      {dialog}
      <article className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
        {/* Header : heure + statut */}
        <div className="flex items-start justify-between gap-2 p-4 pb-2">
          <div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white leading-none">
              {apt.startTime}
              <span className="ml-1 text-sm font-normal text-slate-500">→ {apt.endTime}</span>
            </p>
            <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
              <strong>{apt.title}</strong>
              {clientName && ` — ${clientName}`}
            </p>
          </div>
          <span
            className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_STYLE[apt.status]}`}
          >
            {STATUS_LABELS[apt.status]}
          </span>
        </div>

        {/* Adresse (si présente) */}
        {apt.clientAddress && (
          <p className="px-4 pb-2 text-xs text-slate-500 flex items-start gap-1">
            <MapPin className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
            <span>{apt.clientAddress}</span>
          </p>
        )}

        {/* Description */}
        {apt.description && (
          <p className="px-4 pb-2 text-xs text-slate-600 dark:text-slate-400 whitespace-pre-wrap max-h-24 overflow-y-auto">
            {apt.description}
          </p>
        )}

        {/* Actions rapides contact (min 44x44) */}
        {(apt.clientPhone || apt.clientAddress) && !isFinished && (
          <div className="grid grid-cols-3 gap-1 border-t border-slate-100 dark:border-slate-800 px-3 py-2">
            {apt.clientPhone && (
              <a
                href={`tel:${apt.clientPhone}`}
                className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-md bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 text-xs font-medium hover:bg-blue-100 dark:hover:bg-blue-950/60"
              >
                <Phone className="h-4 w-4" aria-hidden />
                Appeler
              </a>
            )}
            {apt.clientPhone && (
              <a
                href={buildWhatsAppUrl(apt.clientPhone)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs font-medium hover:bg-emerald-100 dark:hover:bg-emerald-950/60"
              >
                <MessageCircle className="h-4 w-4" aria-hidden />
                WhatsApp
              </a>
            )}
            {apt.clientAddress && (
              <a
                href={buildMapsUrl(apt.clientAddress)}
                className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-medium hover:bg-slate-200 dark:hover:bg-slate-700"
              >
                <Navigation className="h-4 w-4" aria-hidden />
                GPS
              </a>
            )}
          </div>
        )}

        {/* Actions terrain (state machine) */}
        {!isFinished && (
          <div className="grid grid-cols-3 gap-1 border-t border-slate-100 dark:border-slate-800 p-3">
            <StatusButton
              show={apt.status === "confirmed" || apt.status === "pending"}
              onClick={() => transition("en_route")}
              loading={transitioning === "en_route"}
              icon={Navigation}
              label="En route"
              color="indigo"
            />
            <StatusButton
              show={apt.status === "en_route" || apt.status === "confirmed"}
              onClick={() => transition("in_progress")}
              loading={transitioning === "in_progress"}
              icon={Play}
              label="Arrivé"
              color="purple"
            />
            <StatusButton
              show={apt.status !== "completed"}
              onClick={() => transition("completed")}
              loading={transitioning === "completed"}
              icon={CheckCircle2}
              label="Terminé"
              color="emerald"
            />
          </div>
        )}

        {/* Actions bottom : encaisser + no-show + voice */}
        {!isFinished && (
          <div className="flex flex-wrap gap-2 border-t border-slate-100 dark:border-slate-800 p-3">
            <button
              type="button"
              onClick={() => setShowPayment(true)}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-md bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-700"
            >
              <DollarSign className="h-4 w-4" aria-hidden />
              Encaisser
            </button>
            <button
              type="button"
              onClick={() => setShowVoice((v) => !v)}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-md border border-slate-200 dark:border-slate-700 px-3 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              🎤 Note vocale
            </button>
            <button
              type="button"
              onClick={handleNoShow}
              className="ml-auto inline-flex min-h-[44px] items-center gap-1.5 rounded-md px-3 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              <UserX className="h-4 w-4" aria-hidden />
              Absent
            </button>
          </div>
        )}

        {/* VoiceNote panel (repliable) */}
        {showVoice && (
          <div className="border-t border-slate-100 dark:border-slate-800 p-3">
            <VoiceNote
              appointmentId={apt.id}
              currentDescription={apt.description}
              onSaved={() => {
                setShowVoice(false);
                onChanged();
              }}
            />
          </div>
        )}
      </article>

      {showPayment && (
        <QuickPaymentModal
          appointmentId={apt.id}
          appointmentTitle={apt.title}
          onClose={() => setShowPayment(false)}
          onSuccess={() => {
            setShowPayment(false);
            onChanged();
          }}
        />
      )}
    </>
  );
}

// -----------------------------------------------------------------------------
// Bouton statut réutilisable
// -----------------------------------------------------------------------------

function StatusButton({
  show,
  onClick,
  loading,
  icon: Icon,
  label,
  color,
}: {
  show: boolean;
  onClick: () => void;
  loading: boolean;
  icon: typeof CheckCircle2;
  label: string;
  color: "indigo" | "purple" | "emerald";
}) {
  const colorCls =
    color === "indigo"
      ? "bg-indigo-600 hover:bg-indigo-700"
      : color === "purple"
        ? "bg-purple-600 hover:bg-purple-700"
        : "bg-emerald-600 hover:bg-emerald-700";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!show || loading}
      className={`inline-flex min-h-[44px] items-center justify-center gap-1 rounded-md text-xs font-semibold text-white transition disabled:opacity-30 disabled:cursor-not-allowed ${colorCls}`}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      ) : (
        <Icon className="h-4 w-4" aria-hidden />
      )}
      {label}
    </button>
  );
}
