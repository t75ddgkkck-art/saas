/**
 * F3 (Lot 31) — <ClientDashboard />
 *
 * Composant client qui affiche :
 *  - Sections : RDV à venir, historique RDV, devis, mes pros
 *  - Actions : annuler un RDV (avec confirmation), voir un devis (lien)
 *  - Format acompte : indique si un acompte a été payé et son statut
 *
 * Charge en parallèle /api/client/me + /api/client/appointments + /api/client/quotes.
 */

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Calendar,
  Clock,
  MapPin,
  FileText,
  Store,
  XCircle,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { formatCentsEur } from "@/lib/deposit";
import { useConfirm } from "@/components/ui/useConfirm";
import { useToast } from "@/components/ui/Toast";

interface BusinessLink {
  id: string;
  slug: string;
  name: string;
  city: string | null;
  category: string | null;
  profileImage: string | null;
}

interface ClientAppointment {
  id: string;
  businessId: string;
  businessName: string;
  businessSlug: string;
  businessCity: string | null;
  title: string;
  description: string | null;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string;
  status: "pending" | "confirmed" | "cancelled" | "completed" | "no_show";
  depositRequired: boolean;
  depositAmountCents: number | null;
  depositStatus: "pending" | "paid" | "refunded" | "forfeited" | null;
  createdAt: string;
}

interface ClientQuote {
  id: string;
  businessId: string;
  businessName: string;
  businessSlug: string;
  quoteNumber: string;
  title: string;
  total: string;
  status: "draft" | "sent" | "accepted" | "declined" | "expired";
  validUntil: string | null;
  createdAt: string;
  signedAt: string | null;
}

export function ClientDashboard() {
  const [me, setMe] = useState<{ email: string; businesses: BusinessLink[] } | null>(null);
  const [appointments, setAppointments] = useState<ClientAppointment[] | null>(null);
  const [quotes, setQuotes] = useState<ClientQuote[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const { confirm, dialog } = useConfirm();
  const toast = useToast();

  useEffect(() => {
    Promise.all([
      fetch("/api/client/me").then((r) => (r.ok ? r.json() : null)),
      fetch("/api/client/appointments").then((r) => (r.ok ? r.json() : { appointments: [] })),
      fetch("/api/client/quotes").then((r) => (r.ok ? r.json() : { quotes: [] })),
    ])
      .then(([meRes, aptRes, quoteRes]) => {
        if (meRes) setMe(meRes);
        setAppointments(aptRes.appointments ?? []);
        setQuotes(quoteRes.quotes ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleCancel(apt: ClientAppointment) {
    const ok = await confirm({
      title: "Annuler ce rendez-vous ?",
      description:
        apt.depositStatus === "paid"
          ? "Un acompte a été payé. Selon la politique du professionnel, il sera remboursé automatiquement si le délai est respecté, sinon conservé."
          : "Le créneau sera libéré et le professionnel notifié.",
      confirmLabel: "Oui, annuler le RDV",
      cancelLabel: "Non, garder",
      variant: "danger",
    });
    if (!ok) return;

    setCancelingId(apt.id);
    try {
      const res = await fetch(`/api/client/appointments/${apt.id}/cancel`, { method: "POST" });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        depositStatus?: string;
        refundAttempted?: boolean;
      };
      if (!res.ok || !data.ok) {
        toast.error(data.error ?? "Erreur lors de l'annulation");
        return;
      }
      toast.success(
        data.refundAttempted
          ? "RDV annulé. Le remboursement est en cours de traitement (2-5 jours ouvrés)."
          : "Rendez-vous annulé."
      );
      // Refetch appointments
      const refreshed = await fetch("/api/client/appointments").then((r) => r.json());
      setAppointments(refreshed.appointments ?? []);
    } catch {
      toast.error("Erreur réseau, veuillez réessayer.");
    } finally {
      setCancelingId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" aria-hidden />
      </div>
    );
  }

  const now = new Date();
  const upcoming =
    appointments?.filter(
      (a) =>
        (a.status === "pending" || a.status === "confirmed") &&
        new Date(`${a.date}T${a.startTime}:00`).getTime() >= now.getTime()
    ) ?? [];
  const past = appointments?.filter((a) => !upcoming.includes(a)) ?? [];

  return (
    <div className="space-y-8">
      {dialog}

      {/* Mes pros */}
      {me && me.businesses.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            <Store className="h-4 w-4" aria-hidden /> Mes professionnels
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {me.businesses.map((b) => (
              <Link
                key={b.id}
                href={`/${b.slug}`}
                className="flex items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 hover:border-slate-300 dark:hover:border-slate-700 transition"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500">
                  {b.profileImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={b.profileImage}
                      alt=""
                      className="h-10 w-10 rounded-full object-cover"
                    />
                  ) : (
                    <Store className="h-5 w-5" aria-hidden />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900 dark:text-white">
                    {b.name}
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {b.category ?? ""}
                    {b.city ? ` · ${b.city}` : ""}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* RDV à venir */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          <Calendar className="h-4 w-4" aria-hidden /> Rendez-vous à venir
          <span className="text-xs font-normal text-slate-400">({upcoming.length})</span>
        </h2>
        {upcoming.length === 0 ? (
          <EmptyBlock text="Vous n'avez aucun rendez-vous à venir." />
        ) : (
          <ul className="space-y-3">
            {upcoming.map((a) => (
              <AppointmentCard
                key={a.id}
                apt={a}
                onCancel={handleCancel}
                canceling={cancelingId === a.id}
              />
            ))}
          </ul>
        )}
      </section>

      {/* Historique RDV */}
      {past.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            <Clock className="h-4 w-4" aria-hidden /> Historique
            <span className="text-xs font-normal text-slate-400">({past.length})</span>
          </h2>
          <ul className="space-y-3">
            {past.slice(0, 20).map((a) => (
              <AppointmentCard key={a.id} apt={a} historical />
            ))}
          </ul>
        </section>
      )}

      {/* Devis */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          <FileText className="h-4 w-4" aria-hidden /> Mes devis
          <span className="text-xs font-normal text-slate-400">({quotes?.length ?? 0})</span>
        </h2>
        {!quotes || quotes.length === 0 ? (
          <EmptyBlock text="Vous n'avez reçu aucun devis pour le moment." />
        ) : (
          <ul className="space-y-2">
            {quotes.map((q) => (
              <li
                key={q.id}
                className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900 dark:text-white">
                    {q.title}{" "}
                    <span className="text-xs font-normal text-slate-500">· {q.quoteNumber}</span>
                  </p>
                  <p className="text-xs text-slate-500">
                    {q.businessName} · {new Date(q.createdAt).toLocaleDateString("fr-FR")}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-slate-900 dark:text-white">
                    {q.total} €
                  </span>
                  <QuoteStatusBadge status={q.status} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sous-composants
// ---------------------------------------------------------------------------

function EmptyBlock({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-6 text-center text-sm text-slate-500">
      {text}
    </div>
  );
}

function AppointmentCard({
  apt,
  onCancel,
  canceling,
  historical,
}: {
  apt: ClientAppointment;
  onCancel?: (apt: ClientAppointment) => void;
  canceling?: boolean;
  historical?: boolean;
}) {
  const dateFmt = new Date(`${apt.date}T${apt.startTime}:00`).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return (
    <li className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">{apt.title}</p>
          <p className="mt-0.5 text-xs text-slate-500">
            {dateFmt} · {apt.startTime}–{apt.endTime}
          </p>
          <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
            <MapPin className="h-3 w-3" aria-hidden />
            <Link href={`/${apt.businessSlug}`} className="hover:underline">
              {apt.businessName}
            </Link>
            {apt.businessCity ? ` · ${apt.businessCity}` : ""}
          </p>
          {apt.depositRequired && (
            <DepositLine amountCents={apt.depositAmountCents} depositStatus={apt.depositStatus} />
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          <AppointmentStatusBadge status={apt.status} />
          {!historical && onCancel && (apt.status === "pending" || apt.status === "confirmed") && (
            <button
              type="button"
              onClick={() => onCancel(apt)}
              disabled={canceling}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
            >
              {canceling ? (
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
              ) : (
                <XCircle className="h-3 w-3" aria-hidden />
              )}
              Annuler
            </button>
          )}
        </div>
      </div>
    </li>
  );
}

function DepositLine({
  amountCents,
  depositStatus,
}: {
  amountCents: number | null;
  depositStatus: "pending" | "paid" | "refunded" | "forfeited" | null;
}) {
  if (amountCents === null || amountCents === undefined) return null;
  const amount = formatCentsEur(amountCents);
  const label =
    depositStatus === "paid"
      ? { text: `Acompte de ${amount} payé`, cls: "text-emerald-600 dark:text-emerald-400" }
      : depositStatus === "pending"
        ? { text: `Acompte de ${amount} en attente`, cls: "text-amber-600 dark:text-amber-400" }
        : depositStatus === "refunded"
          ? { text: `Acompte de ${amount} remboursé`, cls: "text-slate-500" }
          : depositStatus === "forfeited"
            ? { text: `Acompte de ${amount} non remboursé`, cls: "text-slate-500" }
            : null;
  if (!label) return null;
  return <p className={`mt-1 text-xs ${label.cls}`}>{label.text}</p>;
}

function AppointmentStatusBadge({ status }: { status: ClientAppointment["status"] }) {
  const map = {
    pending: {
      text: "En attente",
      icon: AlertCircle,
      cls: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
    },
    confirmed: {
      text: "Confirmé",
      icon: CheckCircle2,
      cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
    },
    completed: {
      text: "Terminé",
      icon: CheckCircle2,
      cls: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    },
    cancelled: {
      text: "Annulé",
      icon: XCircle,
      cls: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-500",
    },
    no_show: {
      text: "Absent",
      icon: XCircle,
      cls: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
    },
  } as const;
  const cfg = map[status];
  const Icon = cfg.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${cfg.cls}`}
    >
      <Icon className="h-3 w-3" aria-hidden /> {cfg.text}
    </span>
  );
}

function QuoteStatusBadge({ status }: { status: ClientQuote["status"] }) {
  const map = {
    draft: {
      text: "Brouillon",
      cls: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
    },
    sent: { text: "Reçu", cls: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300" },
    accepted: {
      text: "Accepté",
      cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
    },
    declined: {
      text: "Refusé",
      cls: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
    },
    expired: {
      text: "Expiré",
      cls: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-500",
    },
  } as const;
  const cfg = map[status];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${cfg.cls}`}
    >
      {cfg.text}
    </span>
  );
}
